-- Importación del catálogo de concesiones (solo admin)

create function importar_concesiones(filas jsonb, aplicar boolean)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  f jsonb;
  v_kam uuid;
  v_ter int;
  v_ter_nombre text;
  v_id int;
  v_actual concesiones%rowtype;
  v_crear int := 0;
  v_actualizar int := 0;
  v_sin int := 0;
  v_errores jsonb := '[]'::jsonb;
begin
  if not es_admin() then
    raise exception 'Solo un administrador puede importar concesiones';
  end if;

  for f in select * from jsonb_array_elements(filas) loop
    v_id := (f->>'id')::int;
    v_kam := null;
    select id into v_kam from perfiles where nombre = f->>'kam';
    if v_kam is null then
      v_errores := v_errores || jsonb_build_object(
        'fila', (f->>'fila')::int,
        'motivo', 'KAM desconocido: ' || coalesce(f->>'kam', ''));
      continue;
    end if;

    v_ter_nombre := nullif(trim(coalesce(f->>'territorio', '')), '');
    v_ter := null;
    if v_ter_nombre is not null then
      select id into v_ter from territorios where nombre = v_ter_nombre;
    end if;

    select * into v_actual from concesiones where id = v_id;
    if not found then
      v_crear := v_crear + 1;
    elsif v_actual.razon_social is not distinct from (f->>'razonSocial')
      and v_actual.kam_id is not distinct from v_kam
      and v_actual.territorio_id is not distinct from v_ter
      and (v_ter_nombre is null or v_ter is not null) then
      v_sin := v_sin + 1;
      continue;
    else
      v_actualizar := v_actualizar + 1;
    end if;

    if aplicar then
      if v_ter_nombre is not null and v_ter is null then
        insert into territorios (nombre) values (v_ter_nombre)
        on conflict (nombre) do update set nombre = excluded.nombre
        returning id into v_ter;
      end if;
      insert into concesiones (id, razon_social, kam_id, territorio_id, actualizado_en)
      values (v_id, f->>'razonSocial', v_kam, v_ter, now())
      on conflict (id) do update set
        razon_social = excluded.razon_social,
        kam_id = excluded.kam_id,
        territorio_id = excluded.territorio_id,
        actualizado_en = now();
    end if;
  end loop;

  return jsonb_build_object(
    'crear', v_crear, 'actualizar', v_actualizar,
    'sin_cambios', v_sin, 'errores', v_errores);
end $$;

revoke all on function importar_concesiones(jsonb, boolean) from public, anon;
grant execute on function importar_concesiones(jsonb, boolean) to authenticated;
