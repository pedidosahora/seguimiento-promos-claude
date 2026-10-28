-- Ajustes finales: relink de perfil al cambiar email, guarda de último administrador,
-- deshacer con bloqueo de fila e histórico entre espacios.

-- 1. Cambiar el email de un perfil lo revincula con el usuario confirmado de ese email (o lo desvincula)
create function revincular_perfil_al_cambiar_email() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if lower(new.email) <> lower(old.email) then
    select u.id into new.user_id from auth.users u
    where lower(u.email) = lower(new.email) and u.email_confirmed_at is not null
    limit 1;
    if not found then
      new.user_id := null;
    end if;
  end if;
  return new;
end
$$;

create trigger revincular_perfil_al_cambiar_email
before update of email on perfiles
for each row execute function revincular_perfil_al_cambiar_email();

revoke execute on function revincular_perfil_al_cambiar_email() from public, anon, authenticated;

-- 6. Siempre debe quedar al menos un administrador activo
create function exigir_un_admin_activo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.rol = 'admin' and old.activo
     and not (new.rol = 'admin' and new.activo)
     and not exists (
       select 1 from public.perfiles p
       where p.id <> old.id and p.rol = 'admin' and p.activo) then
    raise exception 'Debe quedar al menos un administrador activo';
  end if;
  return new;
end
$$;

create trigger exigir_un_admin_activo
before update of rol, activo on perfiles
for each row execute function exigir_un_admin_activo();

revoke execute on function exigir_un_admin_activo() from public, anon, authenticated;

-- 5. deshacer_cambio: bloquea la fila destino ("for update") antes de leerla
create or replace function deshacer_cambio(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_h public.historial;
  v_perfil uuid := (select id from public.mi_perfil());
  v_actual jsonb;
  v_clave text;
  v_campos text[] := '{}';
  v_sets text[] := '{}';
begin
  select * into v_h from public.historial where id = p_id for update;
  if v_h.id is null or v_perfil is null
     or not (public.es_admin() or v_h.autor_id = v_perfil) then
    raise exception 'Sin permiso para deshacer este cambio';
  end if;
  if v_h.accion <> 'update' or v_h.deshecho then
    raise exception 'Este cambio no se puede deshacer';
  end if;
  if v_h.tabla not in ('seguimiento', 'promociones', 'concesiones', 'permisos_extra', 'perfiles') then
    raise exception 'Este cambio no se puede deshacer';
  end if;
  -- Fuera de seguimiento solo escribe administración (RLS no se aplica dentro de esta función)
  if v_h.tabla <> 'seguimiento' and not public.es_admin() then
    raise exception 'Sin permiso para deshacer este cambio';
  end if;

  execute format('select to_jsonb(t) from public.%I t where id::text = $1 for update', v_h.tabla)
    into v_actual using v_h.fila_id;
  if v_actual is null then
    raise exception 'La fila ya no existe; no se puede deshacer';
  end if;

  for v_clave in select jsonb_object_keys(v_h.cambios) loop
    if v_actual -> v_clave is distinct from v_h.cambios -> v_clave -> 'despues' then
      raise exception 'El valor ha cambiado después; no se puede deshacer';
    end if;
    v_sets := v_sets || format('%I = r.%I', v_clave, v_clave);
    v_campos := v_campos || v_clave;
  end loop;

  execute format(
    'update public.%I t set %s from jsonb_populate_record(null::public.%I, $1) r where t.id::text = $2',
    v_h.tabla, array_to_string(v_sets, ', '), v_h.tabla
  ) using (
    select jsonb_object_agg(k, v_h.cambios -> k -> 'antes')
    from unnest(v_campos) k
  ), v_h.fila_id;

  update public.historial set deshecho = true where id = p_id;
end
$$;

revoke execute on function deshacer_cambio(bigint) from public, anon;
grant execute on function deshacer_cambio(bigint) to authenticated, service_role;

-- 7. Histórico: se indica el espacio de las promociones existentes y una promoción
-- existente de otro espacio no se actualiza (se omite con motivo).
create or replace function previsualizar_historico(datos jsonb, p_espacio espacio)
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
      (jsonb_build_object(
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
      ) || case when e.id is null then '{}'::jsonb
                else jsonb_build_object('espacio', e.espacio) end) as j
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

create or replace function aplicar_historico(datos jsonb, p_espacio espacio, tags_actualizar text[] default '{}')
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_marca marca;
  v_conc_creadas int;
  v_creadas int;
  v_actualizadas int;
  v_omitidas int;
  v_otro jsonb;
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

  -- Una promoción existente de otro espacio no se actualiza aunque se pida: se omite con motivo.
  select coalesce(jsonb_agg(jsonb_build_object(
           'tag', p.tag,
           'motivo', 'La promoción existe en el espacio ' || e.espacio || ', no en ' || p_espacio)
         order by p.tag), '[]'::jsonb)
    into v_otro
  from tmp_hp p
  join promociones e on e.id = p.promo_id
  where p.existe and p.tag in (select tag from tmp_act) and e.espacio <> p_espacio;
  delete from tmp_act
  where tag in (select p.tag from tmp_hp p join promociones e on e.id = p.promo_id
                where e.espacio <> p_espacio);

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
    'omitidas', v_omitidas, 'concesiones_creadas', v_conc_creadas)
    || case when jsonb_array_length(v_otro) = 0 then '{}'::jsonb
            else jsonb_build_object('omitidas_otro_espacio', v_otro) end;
end $$;

revoke all on function previsualizar_historico(jsonb, espacio) from public, anon;
revoke all on function aplicar_historico(jsonb, espacio, text[]) from public, anon;
grant execute on function previsualizar_historico(jsonb, espacio) to authenticated;
grant execute on function aplicar_historico(jsonb, espacio, text[]) to authenticated;
