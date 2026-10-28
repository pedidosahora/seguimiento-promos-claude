-- Datos sintéticos de desarrollo (se cargan en `supabase db reset`).
-- No se insertan usuarios de Auth: el enlace mágico crea el usuario y el trigger vincula el perfil por email.
-- IDs de concesión 9100+ para no chocar con los de las pruebas de integración (900-904).

insert into territorios (nombre) values ('Norte'), ('Sur');

insert into perfiles (email, nombre, rol) values
  ('admin@pro.agency', 'Admin Demo', 'admin'),
  ('ana@pro.agency', 'Ana KAM', 'kam'),
  ('bea@pro.agency', 'Bea KAM', 'kam');

insert into concesiones (id, razon_social, nombre_comercial, kam_id, territorio_id, activa) values
  (9100, 'Distribuciones Alfa SL', 'Alfa', (select id from perfiles where email = 'ana@pro.agency'), (select id from territorios where nombre = 'Norte'), true),
  (9101, 'Bebidas Beta SA', 'Beta', (select id from perfiles where email = 'ana@pro.agency'), (select id from territorios where nombre = 'Norte'), true),
  (9102, 'Comercial Gamma SL', 'Gamma', (select id from perfiles where email = 'bea@pro.agency'), (select id from territorios where nombre = 'Sur'), true),
  (9103, 'Delta Horeca SL', 'Delta', (select id from perfiles where email = 'bea@pro.agency'), (select id from territorios where nombre = 'Sur'), true),
  (9104, 'Epsilon Foodservice SA', 'Epsilon', (select id from perfiles where email = 'ana@pro.agency'), (select id from territorios where nombre = 'Sur'), true),
  (9105, 'Zeta Antigua SL', 'Zeta', null, null, false);

insert into promociones (tag, espacio, marca, mecanica, objetivo, canal, fecha_inicio, fecha_fin, estado) values
  ('TMICC-2610-A', 'TMICC', 'TMICC', '2x1 en barriles', 'Activar nuevos pedidos', 'Plataforma', '2026-10-01', '2026-12-31', 'publicada'),
  ('TMICC-2608-B', 'TMICC', 'TMICC', '10 % de descuento', 'Fidelizar', 'Email', '2026-08-01', '2026-09-30', 'publicada'),
  ('CAMP-2610-UFS', 'CAMPANAS', 'UFS', 'Pack degustación', 'Rotación de producto', 'WhatsApp', '2026-10-15', '2026-11-30', 'publicada');

-- 4 concesiones activas por promoción, estados variados.
insert into seguimiento (promocion_id, concesion_id, estado, cupos, usos, gsv, fecha_dato, sms, email)
select p.id, v.concesion_id, v.estado::estado_seguimiento, v.cupos, v.usos, v.gsv, current_date,
       v.sms::estado_envio, v.email::estado_envio
from promociones p
join (values
  ('TMICC-2610-A', 9100, 'activa', 50, 42, 1260.00, 'enviado', 'enviado'),
  ('TMICC-2610-A', 9101, 'acepta', 40, 0, 0, 'enviado', 'pending'),
  ('TMICC-2610-A', 9102, 'pendiente', 30, 0, 0, 'pending', 'pending'),
  ('TMICC-2610-A', 9103, 'rechaza', 20, 0, 0, 'enviado', 'enviado'),
  ('TMICC-2608-B', 9100, 'activa', 60, 55, 1980.50, 'enviado', 'enviado'),
  ('TMICC-2608-B', 9102, 'activa', 30, 31, 1004.00, 'enviado', 'enviado'),
  ('TMICC-2608-B', 9103, 'acepta', 25, 0, 0, 'enviado', 'enviado'),
  ('TMICC-2608-B', 9104, 'no_entra', null, 0, 0, 'no_hay', 'no_hay'),
  ('CAMP-2610-UFS', 9101, 'pendiente', 15, 0, 0, 'pending', 'pending'),
  ('CAMP-2610-UFS', 9102, 'acepta', 25, 0, 0, 'enviado', 'pending'),
  ('CAMP-2610-UFS', 9103, 'activa', 35, 12, 410.75, 'enviado', 'enviado'),
  ('CAMP-2610-UFS', 9104, 'rechaza', 10, 0, 0, 'enviado', 'enviado')
) as v(tag, concesion_id, estado, cupos, usos, gsv, sms, email) on v.tag = p.tag;
