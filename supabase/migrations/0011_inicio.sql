-- Páginas de inicio: revisión de cupos, fecha de publicación y vista de filas.

-- Las filas existentes nacen revisadas sin un UPDATE (seg_bloqueo lo rechazaría
-- y llenaría el historial): se rellenan con el default y se retira después.
alter table seguimiento add column cupos_revisado_en timestamptz default now();
alter table seguimiento alter column cupos_revisado_en drop default;

alter table promociones add column publicada_en timestamptz;

-- Se ejecuta tras seg_bloqueo (orden alfabético de los triggers BEFORE).
create function seg_cupos_revisado() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.cupos_revisado_en := least(coalesce(new.cupos_revisado_en, now()), now());
  elsif new.cupos is distinct from old.cupos then
    new.cupos_revisado_en := now();
  else
    -- Valor explícito (p. ej. «revisado, sin cambios» o deshacer_cambio): nunca
    -- nulo ni futuro, para que el reloj del navegador no oculte la tarea.
    new.cupos_revisado_en :=
      least(coalesce(new.cupos_revisado_en, old.cupos_revisado_en), now());
  end if;
  return new;
end
$$;

create trigger seg_cupos_revisado
before insert or update on seguimiento
for each row execute function seg_cupos_revisado();

create function promociones_publicada_en() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.estado = 'publicada'
     and (tg_op = 'INSERT' or old.estado is distinct from 'publicada') then
    new.publicada_en := now();
  end if;
  return new;
end
$$;

create trigger promociones_publicada_en
before insert or update of estado on promociones
for each row execute function promociones_publicada_en();

revoke execute on function seg_cupos_revisado(), promociones_publicada_en()
  from public, anon, authenticated;

create view v_inicio_filas
with (security_invoker = on) as
select
  s.id as seguimiento_id,
  s.actualizado_en,
  s.estado,
  s.cupos,
  s.usos,
  s.sms,
  s.email,
  s.cupos_revisado_en,
  p.id as promocion_id,
  p.tag,
  p.espacio,
  p.umbral_cupos,
  p.revision_cupos,
  p.publicada_en,
  c.id as concesion_id,
  coalesce(c.nombre_comercial, c.razon_social) as concesion_nombre,
  c.kam_id,
  k.nombre as kam_nombre,
  public.puede_editar_concesion(c.id, p.espacio) as editable
from seguimiento s
join promociones p on p.id = s.promocion_id and p.estado = 'publicada'
join concesiones c on c.id = s.concesion_id
left join perfiles k on k.id = c.kam_id;

grant select on v_inicio_filas to authenticated;
revoke all on v_inicio_filas from anon;
