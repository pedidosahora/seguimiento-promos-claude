-- Desconvocar de forma atómica: solo filas de seguimiento sin tocar.

create function desconvocar(p_ids uuid[]) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_borradas int;
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede desconvocar';
  end if;

  delete from public.seguimiento s
  where s.id = any (p_ids)
    and s.estado = 'pendiente'
    and s.fecha_aceptacion is null
    and s.fecha_activacion is null
    and s.cupos is null
    and s.usos is null
    and s.gsv is null
    and s.sms = 'pending'
    and s.email = 'pending'
    and not exists (select 1 from public.comentarios c where c.seguimiento_id = s.id);
  get diagnostics v_borradas = row_count;

  -- El raise revierte todo: o se borran todas las filas pedidas o ninguna.
  if v_borradas < (select count(distinct x) from unnest(p_ids) x) then
    raise exception 'Alguna fila ya tiene datos; márcala como "No entra"';
  end if;
  return v_borradas;
end
$$;

revoke all on function desconvocar(uuid[]) from public, anon;
grant execute on function desconvocar(uuid[]) to authenticated;
