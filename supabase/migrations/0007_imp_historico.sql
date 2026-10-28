-- Importación del histórico de hojas de seguimiento (solo admin).
-- datos = {"marca": "TMICC"|"UFS"|null, "promociones": [PromocionHistorica]}  (camelCase, como lo emite el parser)

-- Aplanado del JSON. Internas: no accesibles desde la API.
create function historico_promos(datos jsonb)
returns table (ord int, tag text, mecanica text, objetivo text, canal text,
               fecha_inicio date, fecha_fin date, n_filas int)
language sql stable set search_path = public as $$
  select distinct on (upper(trim(p.tag)))
    t.ord::int,
    upper(trim(p.tag)),
    nullif(trim(p.mecanica), ''),
    nullif(trim(p.objetivo), ''),
    nullif(trim(p.canal), ''),
    p."fechaInicio",
    p."fechaFin",
    coalesce(jsonb_array_length(p.filas), 0)
  from jsonb_array_elements(datos -> 'promociones') with ordinality as t(el, ord)
  cross join lateral jsonb_to_record(t.el)
    as p(tag text, mecanica text, objetivo text, canal text,
         "fechaInicio" date, "fechaFin" date, filas jsonb)
  where nullif(trim(p.tag), '') is not null
  order by upper(trim(p.tag)), t.ord
$$;

create function historico_filas(datos jsonb)
returns table (tag text, fila int, id int, concesion text, kam text, territorio text,
               estado estado_seguimiento, fecha_aceptacion timestamptz,
               fecha_activacion timestamptz, cupos int, usos int, gsv numeric,
               sms estado_envio, email estado_envio)
language sql stable set search_path = public as $$
  select distinct on (upper(trim(p.tag)), r.id)
    upper(trim(p.tag)), r.fila, r.id, nullif(trim(r.concesion), ''), nullif(trim(r.kam), ''),
    nullif(trim(r.territorio), ''), r.estado::estado_seguimiento,
    r."fechaAceptacion", r."fechaActivacion", r.cupos, r.usos, round(r.gsv, 2),
    r.sms::estado_envio, r.email::estado_envio
  from jsonb_array_elements(datos -> 'promociones') with ordinality as t(el, ord)
  cross join lateral jsonb_to_record(t.el) as p(tag text, filas jsonb)
  cross join lateral jsonb_to_recordset(coalesce(p.filas, '[]'::jsonb))
    as r(fila int, id int, concesion text, kam text, territorio text, estado text,
         "fechaAceptacion" timestamptz, "fechaActivacion" timestamptz,
         cupos int, usos int, gsv numeric, sms text, email text)
  where nullif(trim(p.tag), '') is not null and r.id is not null
  order by upper(trim(p.tag)), r.id, t.ord, r.fila
$$;

-- Marca implícita según el espacio; en CAMPANAS viene en datos.marca.
create function historico_marca(datos jsonb, p_espacio espacio)
returns marca
language plpgsql stable set search_path = public as $$
begin
  if p_espacio = 'TMICC' then return 'TMICC'; end if;
  if p_espacio = 'UFS' then return 'UFS'; end if;
  if datos ->> 'marca' in ('TMICC', 'UFS') then return (datos ->> 'marca')::marca; end if;
  raise exception 'En CAMPANAS hay que indicar la marca (TMICC o UFS)';
end $$;

create function previsualizar_historico(datos jsonb, p_espacio espacio)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_promos jsonb;
begin
  if not es_admin() then
    raise exception 'Solo un administrador puede importar el histórico';
  end if;
  perform historico_marca(datos, p_espacio);

  select coalesce(jsonb_agg(x.j order by x.ord), '[]'::jsonb) into v_promos
  from (
    select p.ord,
      jsonb_build_object(
        'tag', p.tag,
        'accion', case when e.id is null then 'crear' else 'ya_existe' end,
        'filas', p.n_filas,
        'concesiones_nuevas', coalesce(
          (select jsonb_agg(f.id order by f.id)
           from historico_filas(datos) f
           where f.tag = p.tag and not exists (select 1 from concesiones c where c.id = f.id)),
          '[]'::jsonb),
        'aviso', case
          when e.id is not null then null
          when p.mecanica is null or p.fecha_inicio is null or p.fecha_fin is null
            then 'Falta mecánica o alguna fecha: se importará como borrador'
          when p.fecha_fin < p.fecha_inicio
            then 'La fecha de fin es anterior a la de inicio: se importará como borrador'
          else null end
      ) as j
    from historico_promos(datos) p
    left join promociones e on e.tag = p.tag
  ) x;

  return jsonb_build_object(
    'promociones', v_promos,
    'totales', jsonb_build_object(
      'promociones', jsonb_array_length(v_promos),
      'crear', (select count(*) from jsonb_array_elements(v_promos) q where q ->> 'accion' = 'crear'),
      'ya_existe', (select count(*) from jsonb_array_elements(v_promos) q where q ->> 'accion' = 'ya_existe'),
      'filas', (select coalesce(sum(n_filas), 0) from historico_promos(datos)),
      'avisos', (select count(*) from jsonb_array_elements(v_promos) q where q ->> 'aviso' is not null),
      'concesiones_nuevas', (
        select count(distinct f.id) from historico_filas(datos) f
        where not exists (select 1 from concesiones c where c.id = f.id))));
end $$;

create function aplicar_historico(datos jsonb, p_espacio espacio, tags_actualizar text[] default '{}')
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_marca marca;
  v_conc_creadas int;
  v_creadas int;
  v_actualizadas int;
  v_omitidas int;
begin
  if not es_admin() then
    raise exception 'Solo un administrador puede importar el histórico';
  end if;
  v_marca := historico_marca(datos, p_espacio);

  perform set_config('app.origen', 'importacion_historico', true);

  create temporary table tmp_hp on commit drop as
    select p.*, e.id as promo_id, (e.id is not null) as existe
    from historico_promos(datos) p
    left join promociones e on e.tag = p.tag;
  create temporary table tmp_hf on commit drop as select * from historico_filas(datos);
  create temporary table tmp_act on commit drop as
    select distinct upper(trim(t)) as tag
    from unnest(coalesce(tags_actualizar, '{}')) t
    where nullif(trim(t), '') is not null;

  -- Las promociones existentes que no se actualizan se omiten por completo
  -- (tampoco crean concesiones ni territorios).
  delete from tmp_hf f
  using tmp_hp p
  where p.tag = f.tag and p.existe and p.tag not in (select tag from tmp_act);

  -- Territorios que no existen
  insert into territorios (nombre)
  select distinct territorio from tmp_hf where territorio is not null
  on conflict (nombre) do nothing;

  -- Concesiones nuevas: inactivas; las existentes no se tocan
  with ins as (
    insert into concesiones (id, razon_social, kam_id, territorio_id, activa)
    select n.id, coalesce(n.concesion, 'Concesión ' || n.id),
      (select pf.id from perfiles pf where lower(pf.nombre) = lower(n.kam) order by pf.id limit 1),
      (select t.id from territorios t where t.nombre = n.territorio),
      false
    from (select distinct on (id) id, concesion, kam, territorio from tmp_hf order by id, tag, fila) n
    where not exists (select 1 from concesiones c where c.id = n.id)
    returning 1)
  select count(*) into v_conc_creadas from ins;

  -- Promociones nuevas: borrador si falta mecánica/fecha o fin < inicio
  insert into promociones (tag, espacio, marca, mecanica, objetivo, canal,
                           fecha_inicio, fecha_fin, estado)
  select p.tag, p_espacio, v_marca, p.mecanica, p.objetivo, p.canal, p.fecha_inicio, p.fecha_fin,
    case
      when p.mecanica is null or p.fecha_inicio is null or p.fecha_fin is null
        or p.fecha_fin < p.fecha_inicio then 'borrador'
      when p.fecha_fin < current_date then 'cerrada'
      else 'publicada'
    end::estado_promocion
  from tmp_hp p
  where not p.existe;
  get diagnostics v_creadas = row_count;

  -- Filas de las promociones nuevas. fecha_dato queda vacía: la hoja es una foto sin fecha fiable
  -- y los datos de la carga de usos deben prevalecer siempre.
  insert into seguimiento (promocion_id, concesion_id, estado, fecha_aceptacion, fecha_activacion,
                           cupos, usos, gsv, fecha_dato, sms, email)
  select pr.id, f.id, f.estado, f.fecha_aceptacion, f.fecha_activacion, f.cupos, f.usos, f.gsv,
    null, coalesce(f.sms, 'pending'), coalesce(f.email, 'pending')
  from tmp_hf f
  join tmp_hp p on p.tag = f.tag and not p.existe
  join promociones pr on pr.tag = p.tag;

  -- Promociones existentes pedidas: rellenar solo vacíos y crear las filas que faltan
  update promociones pr
  set mecanica = coalesce(pr.mecanica, p.mecanica),
      objetivo = coalesce(pr.objetivo, p.objetivo),
      canal = coalesce(pr.canal, p.canal),
      fecha_inicio = coalesce(pr.fecha_inicio, p.fecha_inicio),
      fecha_fin = coalesce(pr.fecha_fin, p.fecha_fin)
  from tmp_hp p
  where p.existe and p.promo_id = pr.id and p.tag in (select tag from tmp_act)
    and (pr.mecanica is null and p.mecanica is not null
      or pr.objetivo is null and p.objetivo is not null
      or pr.canal is null and p.canal is not null
      or pr.fecha_inicio is null and p.fecha_inicio is not null
      or pr.fecha_fin is null and p.fecha_fin is not null);

  update seguimiento s
  set fecha_aceptacion = coalesce(s.fecha_aceptacion, f.fecha_aceptacion),
      fecha_activacion = coalesce(s.fecha_activacion, f.fecha_activacion),
      cupos = coalesce(s.cupos, f.cupos),
      usos = coalesce(s.usos, f.usos),
      gsv = coalesce(s.gsv, f.gsv)
  from tmp_hf f
  join tmp_hp p on p.tag = f.tag and p.existe and p.tag in (select tag from tmp_act)
  where s.promocion_id = p.promo_id and s.concesion_id = f.id
    and (s.fecha_aceptacion is null and f.fecha_aceptacion is not null
      or s.fecha_activacion is null and f.fecha_activacion is not null
      or s.cupos is null and f.cupos is not null
      or s.usos is null and f.usos is not null
      or s.gsv is null and f.gsv is not null);

  insert into seguimiento (promocion_id, concesion_id, estado, fecha_aceptacion, fecha_activacion,
                           cupos, usos, gsv, fecha_dato, sms, email)
  select p.promo_id, f.id, f.estado, f.fecha_aceptacion, f.fecha_activacion, f.cupos, f.usos, f.gsv,
    null, coalesce(f.sms, 'pending'), coalesce(f.email, 'pending')
  from tmp_hf f
  join tmp_hp p on p.tag = f.tag and p.existe and p.tag in (select tag from tmp_act)
  on conflict (promocion_id, concesion_id) do nothing;

  select count(*) into v_actualizadas from tmp_hp where existe and tag in (select tag from tmp_act);
  select count(*) into v_omitidas from tmp_hp where existe and tag not in (select tag from tmp_act);

  return jsonb_build_object('creadas', v_creadas, 'actualizadas', v_actualizadas,
    'omitidas', v_omitidas, 'concesiones_creadas', v_conc_creadas);
end $$;

revoke all on function historico_promos(jsonb), historico_filas(jsonb), historico_marca(jsonb, espacio)
  from public, anon, authenticated;
revoke all on function previsualizar_historico(jsonb, espacio) from public, anon;
revoke all on function aplicar_historico(jsonb, espacio, text[]) from public, anon;
grant execute on function previsualizar_historico(jsonb, espacio) to authenticated;
grant execute on function aplicar_historico(jsonb, espacio, text[]) to authenticated;
