-- Concesiones de una promoción que quien llama puede editar (una sola llamada en vez de una por fila).
-- Refleja las reglas de seg_bloqueo: admin siempre; el resto, promoción publicada y puede_editar_concesion.
create function concesiones_editables(p_promocion uuid) returns int[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(s.concesion_id order by s.concesion_id), '{}'::int[])
  from public.seguimiento s
  join public.promociones p on p.id = s.promocion_id
  where s.promocion_id = p_promocion
    and public.es_interno()
    and (
      public.es_admin()
      or (p.estado = 'publicada' and public.puede_editar_concesion(s.concesion_id, p.espacio))
    )
$$;

revoke all on function concesiones_editables(uuid) from public, anon;
grant execute on function concesiones_editables(uuid) to authenticated, service_role;
