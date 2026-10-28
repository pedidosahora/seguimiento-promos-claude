-- Historial de cambios y deshacer

create table historial (
  id bigserial primary key,
  tabla text not null,
  fila_id text not null,
  accion text not null check (accion in ('insert', 'update', 'delete')),
  cambios jsonb not null,
  -- Sin FK: el historial debe sobrevivir al borrado del perfil.
  autor_id uuid,
  origen text not null default 'manual',
  fecha timestamptz not null default now(),
  deshecho boolean not null default false
);

create index on historial (tabla, fila_id);
create index on historial (fecha desc);

-- Update: {"campo": {"antes": v, "despues": v}} solo con los campos que cambian.
-- Insert: fila nueva completa. Delete: fila borrada completa.
create function registrar_historial() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_cambios jsonb := '{}'::jsonb;
  v_clave text;
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new) - 'actualizado_en';
    v_cambios := v_new;
  elsif tg_op = 'DELETE' then
    v_old := to_jsonb(old) - 'actualizado_en';
    v_cambios := v_old;
  else
    v_old := to_jsonb(old) - 'actualizado_en';
    v_new := to_jsonb(new) - 'actualizado_en';
    for v_clave in select jsonb_object_keys(v_new) loop
      if v_new -> v_clave is distinct from v_old -> v_clave then
        v_cambios := v_cambios || jsonb_build_object(
          v_clave,
          jsonb_build_object('antes', v_old -> v_clave, 'despues', v_new -> v_clave)
        );
      end if;
    end loop;
    if v_cambios = '{}'::jsonb then
      return null;
    end if;
  end if;

  insert into public.historial (tabla, fila_id, accion, cambios, autor_id, origen)
  values (
    tg_table_name,
    case when tg_op = 'DELETE' then to_jsonb(old) ->> 'id' else to_jsonb(new) ->> 'id' end,
    lower(tg_op),
    v_cambios,
    (select id from public.mi_perfil()),
    coalesce(nullif(current_setting('app.origen', true), ''), 'manual')
  );
  return null;
end
$$;

create trigger historial_seguimiento
after insert or update or delete on seguimiento
for each row execute function registrar_historial();
create trigger historial_promociones
after insert or update or delete on promociones
for each row execute function registrar_historial();
create trigger historial_concesiones
after insert or update or delete on concesiones
for each row execute function registrar_historial();
create trigger historial_permisos_extra
after insert or update or delete on permisos_extra
for each row execute function registrar_historial();
create trigger historial_perfiles
after insert or update or delete on perfiles
for each row execute function registrar_historial();

-- Deshacer un update. Se aplica con un UPDATE normal, de modo que los triggers
-- de reglas (seg_bloqueo, seg_fechas...) se ejecutan con la identidad de quien deshace.
-- Es SECURITY DEFINER solo para poder marcar la entrada; el permiso se comprueba aquí.
create function deshacer_cambio(p_id bigint) returns void
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

  execute format('select to_jsonb(t) from public.%I t where id::text = $1', v_h.tabla)
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

revoke execute on function registrar_historial() from public, anon, authenticated;
revoke execute on function deshacer_cambio(bigint) from public, anon;
grant execute on function deshacer_cambio(bigint) to authenticated, service_role;

-- RLS: lectura para internos; la escritura solo ocurre dentro de funciones SECURITY DEFINER
alter table historial enable row level security;
create policy historial_select on historial for select using (es_interno());
revoke all on historial from anon;
revoke insert, update, delete on historial from authenticated;
revoke usage on sequence historial_id_seq from anon, authenticated;
