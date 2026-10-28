-- Importación de usos y GSV acumulados (solo admin). Los valores SUSTITUYEN a los guardados.

-- Clasificación de cada fila importada. Orden de precedencia:
-- duplicada (mismo TAG+ID más de una vez en el lote; nunca se aplica), tag_desconocido, concesion_desconocida, no_convocada, dato_antiguo,
-- sin_cambios, aviso_no_entra, actualiza.
create function clasificar_usos(filas jsonb)
returns table (fila int, categoria text, seguimiento_id uuid, detalle text)
language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then
    raise exception 'Solo un administrador puede importar usos';
  end if;

  return query
  with f as (
    select r.fila, r.id, upper(trim(r.tag)) as tag, r.usos, round(r.gsv, 2) as gsv, r.fecha,
      count(*) over (partition by upper(trim(r.tag)), r.id) as veces
    from jsonb_to_recordset(filas)
      as r(fila int, id int, concesion text, tag text, usos int, gsv numeric, fecha date)
  )
  select
    f.fila,
    case
      when f.veces > 1 then 'duplicada'
      when p.id is null then 'tag_desconocido'
      when c.id is null then 'concesion_desconocida'
      when s.id is null then 'no_convocada'
      when f.fecha < s.fecha_dato then 'dato_antiguo'
      when s.usos is not distinct from f.usos
        and s.gsv is not distinct from f.gsv
        and s.fecha_dato is not distinct from f.fecha then 'sin_cambios'
      when s.estado = 'no_entra' then 'aviso_no_entra'
      else 'actualiza'
    end,
    s.id,
    case
      when f.veces > 1 then 'TAG ' || f.tag || ' + ID ' || f.id || ' repetido en el archivo'
      when p.id is null then 'TAG ' || f.tag || ' no existe'
      when c.id is null then 'Concesión ' || f.id || ' no está en el catálogo'
      when s.id is null then 'Concesión ' || f.id || ' no está convocada en ' || f.tag
      when f.fecha < s.fecha_dato then
        'Dato del ' || f.fecha || ' anterior al guardado (' || s.fecha_dato || ')'
      when s.estado = 'no_entra' and not (
        s.usos is not distinct from f.usos
        and s.gsv is not distinct from f.gsv
        and s.fecha_dato is not distinct from f.fecha) then
        'Concesión ' || f.id || ' figura como "no entra" pero tiene usos'
      else null
    end
  from f
  left join promociones p on p.tag = f.tag
  left join concesiones c on c.id = f.id
  left join seguimiento s on s.promocion_id = p.id and s.concesion_id = f.id
  order by f.fila;
end $$;

create function previsualizar_usos(filas jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then
    raise exception 'Solo un administrador puede importar usos';
  end if;

  return jsonb_build_object(
    'conteos', coalesce(
      (select jsonb_object_agg(categoria, n)
       from (select categoria, count(*) as n from clasificar_usos(filas) group by categoria) t),
      '{}'::jsonb),
    'detalle', coalesce(
      (select jsonb_agg(
         jsonb_build_object('fila', fila, 'categoria', categoria, 'detalle', detalle)
         order by fila)
       from clasificar_usos(filas)
       where categoria not in ('actualiza', 'sin_cambios')),
      '[]'::jsonb));
end $$;

create function aplicar_usos(filas jsonb, incluir_antiguos boolean default false)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_aplicadas int;
  v_conteos jsonb;
begin
  if not es_admin() then
    raise exception 'Solo un administrador puede importar usos';
  end if;

  perform set_config('app.origen', 'importacion_usos', true);

  create temporary table tmp_usos on commit drop as
    select c.fila, c.categoria, c.seguimiento_id
    from clasificar_usos(filas) c;

  select coalesce(jsonb_object_agg(categoria, n), '{}'::jsonb) into v_conteos
  from (select categoria, count(*) as n from tmp_usos group by categoria) t;

  -- Nombre comercial: solo donde está vacío y solo desde filas realmente aplicadas.
  update concesiones c set nombre_comercial = n.nombre
  from (
    select distinct on (r.id) r.id, trim(r.concesion) as nombre
    from tmp_usos t
    join jsonb_to_recordset(filas) as r(fila int, id int, concesion text) on r.fila = t.fila
    where nullif(trim(r.concesion), '') is not null
      and (t.categoria in ('actualiza', 'aviso_no_entra')
           or (incluir_antiguos and t.categoria = 'dato_antiguo'))
    order by r.id, r.fila
  ) n
  where c.id = n.id and c.nombre_comercial is null;

  -- Una sola actualización. Los duplicados ya están excluidos (categoría 'duplicada').
  update seguimiento s
  set usos = r.usos, gsv = round(r.gsv, 2), fecha_dato = r.fecha
  from tmp_usos t
  join jsonb_to_recordset(filas)
    as r(fila int, id int, concesion text, tag text, usos int, gsv numeric, fecha date)
    on r.fila = t.fila
  where s.id = t.seguimiento_id
    and (t.categoria in ('actualiza', 'aviso_no_entra')
         or (incluir_antiguos and t.categoria = 'dato_antiguo'))
    and (s.usos is distinct from r.usos
         or s.gsv is distinct from round(r.gsv, 2)
         or s.fecha_dato is distinct from r.fecha);
  get diagnostics v_aplicadas = row_count;

  return jsonb_build_object('aplicadas', v_aplicadas, 'conteos', v_conteos);
end $$;

revoke all on function clasificar_usos(jsonb) from public, anon, authenticated;
revoke all on function previsualizar_usos(jsonb) from public, anon;
revoke all on function aplicar_usos(jsonb, boolean) from public, anon;
grant execute on function previsualizar_usos(jsonb) to authenticated;
grant execute on function aplicar_usos(jsonb, boolean) to authenticated;
