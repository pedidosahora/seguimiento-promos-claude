# Diseño — Páginas de inicio (KAM y administración)

Fecha: 2026-10-30. Amplía y sustituye la §7 «Avisos (v2)» del diseño principal (`2026-10-28-seguimiento-promociones-design.md`) en lo que toca al panel de pendientes. El resto del diseño principal sigue vigente.

Marcas: sin marca = lo dijo la usuaria; **[decisión de Claude]** = lo decidí yo y puede corregirse.

---

## 1. Intención y por qué

La v1 ya está en producción (Cloudflare + Supabase, datos reales cargados). Al entrar, hoy cualquier usuario aterriza en la lista «Todos» (solo lectura). La usuaria quiere que **cada persona, al entrar, vea de un vistazo lo que tiene pendiente y el estado de sus concesiones, y pueda actuar desde ahí**.

El día a día de un KAM: entrar, apuntar si alguna concesión ha aceptado o rechazado una promoción (la concesión se lo dice por fuera; la web **no** tiene que detectarlo ni avisar), ver si hay promociones o campañas nuevas y actualizar los datos de las activas.

Éxito: el KAM resuelve su rutina desde la página de inicio sin tener que entrar promoción por promoción, y el administrador sabe qué KAM va retrasado y qué promociones funcionan.

### Anti-objetivos
- Que el inicio sea más lento de usar que entrar en la promoción (debe ahorrar clics, no añadirlos).
- Mostrar a un KAM datos de concesiones que no puede editar como si fueran suyas.

### Fuera de alcance de este diseño
- Email semanal de resumen (estaba en la §7 v2; la usuaria ha cerrado el alcance en las páginas de inicio) **[decisión de Claude: aplazado, no descartado]**.
- Informes y comparativas de la v3, acceso de socios, vista móvil.
- Notificaciones de cualquier tipo.

---

## 2. Página de inicio del KAM (boceto elegido: opción A)

Boceto: `.superpowers/brainstorm/1017-1793355701/content/inicio-kam.html`, opción A.

Pasa a ser la ruta de entrada (`/`) para los usuarios con rol `kam`. «Todos» y los espacios siguen accesibles desde la navegación como hasta ahora.

### 2.1 Arriba: cinco contadores de tareas pendientes

Todos cuentan **filas de seguimiento** (promoción × concesión) de **promociones publicadas** sobre las concesiones que el KAM **puede editar** (las suyas como KAM + las de permisos extra vigentes) **[decisión de Claude: incluir permisos extra]**.

| Contador | Qué cuenta |
|---|---|
| **Sin respuesta** | Filas en estado `pendiente`. |
| **Aceptadas sin activar** | Filas en estado `acepta` (aún no `activa`). |
| **Cupos al límite** | Filas en `acepta` o `activa` con % de cupos ≥ umbral de la promoción (incluye agotadas, ≥ 100 %). Mismo cálculo que `nivelAlertaCupos` **[decisión de Claude: solo esos dos estados]**. |
| **Revisión semanal** | Filas `activa` de promociones con `revision_cupos` = `semanal` (o `quincenal`) cuyo cupo no se ha revisado en el periodo: periodo móvil de 7 o 14 días desde la última revisión, no semanas de calendario **[decisión de Claude]**. Ver §2.4. |
| **Envíos pendientes** | Filas con SMS o email en `pending`, excluidas las que están en `no_entra` o `rechaza` **[decisión de Claude]**. |

Cada contador lleva un color de aviso cuando es > 0 (ámbar; rojo para «Cupos al límite» si hay alguna agotada) **[decisión de Claude]**.

**Al pulsar un contador** se despliega debajo la lista de esas filas (concesión, promoción, dato relevante) con la acción para resolverla ahí mismo: cambiar estado, poner cupos, marcar envío o «revisado, sin cambios» **[decisión de Claude]**. Cada fila tiene también un enlace a la promoción para casos complejos.

### 2.2 Debajo: «Mis concesiones»

Una fila por concesión del KAM (las suyas + permisos extra), ordenadas por nombre **[decisión de Claude]**. En cada fila, **una etiqueta de color por cada promoción publicada en la que está convocada**, con el TAG y el estado:

- Colores por estado: activa = verde, acepta = azul, pendiente = ámbar, rechaza = rojo, no entra = gris **[decisión de Claude]**.
- Si la fila tiene aviso de cupos, la etiqueta lleva ⚠ y el % (ámbar = cerca, rojo = agotado).
- **Al pulsar una etiqueta se cambia el estado ahí mismo** (desplegable con los cinco estados), con las mismas reglas que la tabla de la promoción: validación de permisos y bloqueo por versión (`actualizado_en`); si otra persona la cambió antes, aviso y recarga de la fila.
- Las concesiones sin ninguna promoción publicada aparecen al final, sin etiquetas.
- El nombre de la concesión enlaza a su ficha (`/concesion/:id`, ya existe).

Solo cuentan promociones `publicada`. Las cerradas, archivadas y borradores no aparecen en el inicio.

### 2.3 «Promociones nuevas»

La rutina incluye «ver si hay alguna promo/campaña nueva». Encima de «Mis concesiones», una línea con las promociones publicadas en los últimos 7 días en las que alguna de sus concesiones está convocada, con enlace a cada una **[decisión de Claude: forma y ventana de 7 días]**.

Hoy no se guarda cuándo se publica una promoción. Se añade `promociones.publicada_en`, que un trigger rellena con `now()` cuando el estado pasa a `publicada` (también desde la importación del histórico). En las promociones que ya existen queda **vacío**, así que no salen como nuevas **[decisión de Claude]**.

### 2.4 Revisión periódica de cupos

Se mantiene lo ya decidido en la §7 del diseño principal: la tarea se cierra al **actualizar el cupo** o al **marcar «revisado, sin cambios»**. Para saber cuándo se revisó por última vez hace falta guardarlo: un campo `cupos_revisado_en` en `seguimiento`, que se pone a `now()` al cambiar `cupos` o al pulsar «revisado, sin cambios» **[decisión de Claude: campo nuevo en lugar de leer el historial]**. Una fila está pendiente de revisión si `cupos_revisado_en` es nulo o anterior a hoy menos el periodo.

- **Quién lo rellena:** un trigger en la base de datos, cada vez que cambia `cupos`, venga el cambio de donde venga: tabla, inicio, cambio en bloque o importación **[decisión de Claude]**.
- **«Revisado, sin cambios»:** es un `update` normal de `cupos_revisado_en`, por el mismo camino de permisos, bloqueo por versión e historial. Queda registrado en el historial como cambio de ese campo.
- **Filas que ya existen en producción:** la migración les pone `now()`. Así el contador no amanece lleno el primer día y la primera revisión toca dentro de 7 o 14 días **[decisión de Claude]**.

---

## 3. Página de inicio del administrador

Ruta de entrada (`/`) para el rol `admin`. Mismas piezas que la del KAM, pero **globales** (todas las concesiones y todas las promociones publicadas), más:

### 3.1 Tareas pendientes por KAM
Tabla: una fila por KAM, columnas = los cinco contadores de §2.1, más el total. Ordenada por «Sin respuesta» de mayor a menor (es la que más dice quién va retrasado). Al pulsar una celda, la misma lista de filas filtrada por ese KAM y esa tarea.

- **Atribución:** cada fila cuenta solo para el **KAM titular** de la concesión (`concesiones.kam_id`). Los permisos extra no se cuentan aquí, así la suma por KAM coincide con los contadores globales **[decisión de Claude]**.
- Las concesiones sin KAM se agrupan en una fila «Sin KAM».
- Aparecen todos los perfiles activos con rol `kam` o con concesiones asignadas, aunque estén a cero.

### 3.2 Ranking de promociones
Promociones publicadas ordenadas por **% de cupos gastados** (suma de usos ÷ suma de cupos de la promoción), de mayor a menor. «Funciona bien» = ha gastado cupos o los ha agotado. Columnas: TAG, espacio, % cupos gastados (con barra), usos, cupos, GSV, activas. Las que no tienen cupos definidos van al final con «—».

Las sumas usan las mismas definiciones que `v_resumen_promocion`: usos y cupos sumados sobre todas las filas de la promoción, y «activas» = filas en estado `activa`. Se calcula a partir de esa vista, sin crear otra definición **[decisión de Claude]**.

### 3.3 Los cinco contadores globales y «Promociones nuevas»
Arriba, como en el KAM, pero sobre todo. El bloque «Promociones nuevas» (§2.3) también aparece, con todas las publicadas en los últimos 7 días **[decisión de Claude]**.

### 3.4 Otros roles
Los `socio` no cambian: en la v1 no tienen acceso a nada (la RLS solo deja leer a internos) y su pantalla llega en la v3. Un KAM sin concesiones ve los contadores a cero y el mensaje «Todavía no tienes concesiones asignadas».

«Mis concesiones» no se muestra al administrador (serían todas); en su lugar está la tabla por KAM **[decisión de Claude]**. El administrador sigue pudiendo actuar sobre cualquier fila desde las listas de tareas.

---

## 4. Restricciones

- Mismo stack y patrones que la v1: React + Supabase, RLS, `v_resumen_promocion`, `security_invoker`, migraciones nuevas numeradas a partir de `0011`.
- Los datos del inicio deben venir en pocas consultas (una vista o RPC por bloque), no una por concesión.
- Los cambios hechos desde el inicio pasan por el mismo camino que los de la tabla (triggers `seg_bloqueo`, historial, bloqueo por versión).
- Producción ya tiene datos reales: la migración nueva debe ser aditiva y aplicarse sin perder nada.
- Idioma de la interfaz: castellano, tono práctico.

## 5. Lo que queda en manos de quien construya

- Diseño visual exacto (espaciado, tipografía), siguiendo el estilo actual de la web.
- Paginación o límite de las listas de tareas si son largas.
- Si el bloque «Promociones nuevas» se oculta cuando está vacío.
