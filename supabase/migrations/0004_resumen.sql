-- Indicadores por promoción: fuente única para el listado y la cabecera.
-- security_invoker: aplica la RLS del usuario que consulta.
create view v_resumen_promocion
with (security_invoker = on) as
select
  p.id as promocion_id,
  count(s.id)::int as convocadas,
  (count(s.id) filter (where s.estado <> 'no_entra'))::int as presentadas,
  (count(s.id) filter (where s.estado = 'pendiente'))::int as pendientes,
  (count(s.id) filter (where s.estado = 'rechaza'))::int as rechazadas,
  (count(s.id) filter (where s.estado in ('acepta', 'activa')))::int as aceptadas,
  (count(s.id) filter (where s.estado = 'activa'))::int as activas,
  (count(s.id) filter (where s.estado in ('acepta', 'activa'))::numeric
    / nullif(count(s.id) filter (where s.estado <> 'no_entra'), 0)) as pct_aceptacion,
  (count(s.id) filter (where s.estado = 'pendiente')::numeric
    / nullif(count(s.id) filter (where s.estado <> 'no_entra'), 0)) as pct_pendientes,
  (count(s.id) filter (where s.estado = 'rechaza')::numeric
    / nullif(count(s.id) filter (where s.estado <> 'no_entra'), 0)) as pct_rechazo,
  (count(s.id) filter (where s.estado = 'activa')::numeric
    / nullif(count(s.id) filter (where s.estado <> 'no_entra'), 0)) as pct_activacion,
  coalesce(sum(s.cupos), 0)::int as cupos,
  coalesce(sum(s.usos), 0)::int as usos,
  coalesce(sum(s.gsv), 0)::numeric(14, 2) as gsv
from promociones p
left join seguimiento s on s.promocion_id = p.id
group by p.id;

grant select on v_resumen_promocion to authenticated;
