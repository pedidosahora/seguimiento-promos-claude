# Páginas de inicio (KAM y administración) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Al entrar, el KAM ve sus tareas pendientes y el estado de sus concesiones y actúa desde ahí; el administrador ve lo mismo global, más tareas por KAM y ranking de promociones.

**Architecture:** Una migración aditiva `0011` añade `seguimiento.cupos_revisado_en`, `promociones.publicada_en` (con triggers y relleno) y una vista `v_inicio_filas` (`security_invoker`) con una fila por seguimiento de promociones publicadas, datos de promoción y concesión aplanados y la columna `editable`. La clasificación en las cinco tareas es una función pura en `src/dominio/tareas.ts`. La ruta `/` muestra InicioKam o InicioAdmin según el rol; leen la vista una vez y guardan con `guardarFila` (bloqueo por versión ya existente).

**Tech Stack:** React 18 + TypeScript + Vite + React Router 7; Supabase (Postgres 17, RLS); Vitest 5 (proyectos `unit` jsdom TZ=Europe/Madrid e `integracion` node secuencial) + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-30-paginas-inicio-design.md` (amplía `docs/superpowers/specs/2026-10-28-seguimiento-promociones-design.md` §7).

## Global Constraints

- Migraciones nuevas numeradas desde `0011`; no editar `0001`–`0010`. Funciones con `set search_path = public`, `revoke ... from public, anon`, `grant ... to authenticated` donde se llamen desde la web.
- Producción tiene datos reales: la migración es aditiva y se aplica sin perder nada.
- Los cambios desde el inicio usan `guardarFila(id, cambios, actualizadoEn)` de `src/app/promocion/servicio.ts` (bloqueo por `actualizado_en`, triggers `seg_bloqueo`, historial). Nada de escrituras directas nuevas.
- Solo cuentan promociones con `estado = 'publicada'`.
- Interfaz en castellano, tono práctico. Etiquetas de estado: `ETIQUETA_ESTADO` de `src/dominio/etiquetas.ts`.
- Colores de estado: activa verde, acepta azul, pendiente ámbar, rechaza rojo, no entra gris. Estilos en `src/app/estilos.css`.
- Datos del inicio en pocas consultas: una lectura de `v_inicio_filas` por pantalla (más concesiones/perfiles/ranking), nunca una por concesión.
- Local: API 54421, DB 54422. Tras crear la migración: `npm run db:reset` y `npm run tipos`. `npm run test:int` borra el seed: después `npm run db:reset`.
- Commits terminan con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Otra persona cambió la fila antes** (dos pestañas, KAM y admin a la vez): el inicio muestra «Esta fila ha cambiado; recarga» y recarga esa fila, sin pisar el dato → test en Task 3.
2. **Límite exacto del periodo de revisión** (revisado hace justo 7 días, o un segundo más): pendiente solo si es *estrictamente* anterior a ahora − periodo; quincenal usa 14 → test en Task 2.
3. **Promoción sin cupos definidos** (`cupos` nulo o 0): nunca cuenta en «Cupos al límite» y en el ranking va al final con «—» → tests en Task 2 y Task 5.
4. **KAM con permiso extra por espacio**: sus contadores incluyen esas filas (editables), pero «Mis concesiones» no se llena con todo el espacio (solo titular + permisos por concesión + concesiones que salen en filas editables de promociones publicadas) → tests en Task 1 y Task 4.
5. **Fila `no_entra`/`rechaza` con SMS en `pending`**: no cuenta como envío pendiente → test en Task 2.

---

### Task 1: Migración 0011 (campos, triggers, vista)

**Files:**
- Create: `supabase/migrations/0011_inicio.sql`
- Modify: `src/lib/database.types.ts` (regenerado con `npm run tipos`)
- Test: `tests/integracion/inicio.test.ts`

**Interfaces:**
- Produces:
  - `seguimiento.cupos_revisado_en timestamptz` (nullable).
  - `promociones.publicada_en timestamptz` (nullable).
  - Vista `v_inicio_filas` (`security_invoker = on`), columnas: `seguimiento_id uuid, actualizado_en timestamptz, estado estado_seguimiento, cupos int, usos int, sms estado_envio, email estado_envio, cupos_revisado_en timestamptz, promocion_id uuid, tag text, espacio espacio, umbral_cupos numeric, revision_cupos revision_cupos, publicada_en timestamptz, concesion_id int, concesion_nombre text, kam_id uuid, kam_nombre text, editable boolean`. Solo promociones `publicada`. `concesion_nombre` = `coalesce(nombre_comercial, razon_social)`. `editable` = `puede_editar_concesion(concesion_id, espacio)`. `grant select ... to authenticated`.

- [ ] **Step 1: Escribir `tests/integracion/inicio.test.ts`** (patrón de `resumen.test.ts`: `resetDatos`, `crearUsuario`, `admin()`, `clienteComo`) con:
  - `cupos_revisado_en se pone al cambiar cupos`: admin inserta seguimiento con `cupos_revisado_en: '2026-01-01T00:00:00Z'`, actualiza `cupos` de 10 a 20 → `cupos_revisado_en` > instante de inicio del test. Actualizar solo `estado` → `cupos_revisado_en` no cambia.
  - `cupos_revisado_en explícito se respeta`: un KAM titular de la concesión hace `update({ cupos_revisado_en: <ahora ISO> })` en promoción publicada → ok, y hay una entrada en `historial` (tabla `seguimiento`, esa fila) cuya clave de `cambios` incluye `cupos_revisado_en`.
  - `fila nueva nace revisada`: insertar seguimiento sin el campo → `cupos_revisado_en` no nulo.  - `publicada_en al publicar`: promoción en `borrador` → `publicada_en` nulo; pasarla a `publicada` → no nulo; insertar otra directamente `publicada` → no nulo.
  - `v_inicio_filas solo publicadas y editable por usuario`: una promoción publicada y otra cerrada; concesiones 9100 (KAM ana) y 9101 (KAM bea) convocadas en ambas. Como ana: la vista devuelve 2 filas (solo la publicada); `editable` true en 9100 y false en 9101; `kam_nombre` = 'Ana' en 9100.
  - `permiso extra por espacio hace editable`: `permisos_extra` de ana con `espacio = 'TMICC'` → como ana, 9101 en la promoción TMICC sale `editable` true.

- [ ] **Step 2: Ejecutar y ver que falla**
  Run: `npm run test:int -- inicio`
  Expected: FAIL (columna `cupos_revisado_en` / relación `v_inicio_filas` no existe).

- [ ] **Step 3: Escribir `supabase/migrations/0011_inicio.sql`**
  - `alter table seguimiento add column cupos_revisado_en timestamptz default now();` y a continuación `alter table seguimiento alter column cupos_revisado_en drop default;`. Así las filas existentes nacen revisadas **sin un `update`**: un `update` dispararía `seg_bloqueo` (la migración no corre como admin y lo rechazaría) y llenaría el historial.
  - `alter table promociones add column publicada_en timestamptz;` sin relleno.
  - Trigger `BEFORE INSERT OR UPDATE` en `seguimiento` llamado `seg_cupos_revisado` (orden alfabético: tras `seg_bloqueo`): en INSERT, si `new.cupos_revisado_en` es nulo → `now()`; en UPDATE, si `new.cupos is distinct from old.cupos` → `now()`; si no, conserva lo que venga (permite «revisado, sin cambios»).
  - Trigger `BEFORE INSERT OR UPDATE OF estado` en `promociones` llamado `promociones_publicada_en`: si `new.estado = 'publicada'` y (INSERT o `old.estado <> 'publicada'`) → `new.publicada_en := now()`.
  - Vista `v_inicio_filas` según Interfaces (join `seguimiento` → `promociones` con estado publicada → `concesiones` → left join `perfiles` por `kam_id`).
  - `revoke execute` de las funciones de trigger a `public, anon, authenticated`; `grant select on v_inicio_filas to authenticated`.

- [ ] **Step 4: Aplicar y regenerar tipos**
  Run: `npm run db:reset && npm run tipos`
  Expected: reset sin errores (el seed, con filas de seguimiento ya creadas, recibe la columna con valor: si el relleno fallara, el reset daría error o la vista del inicio contaría todo como «Revisión semanal»); `src/lib/database.types.ts` contiene `cupos_revisado_en`, `publicada_en` y `v_inicio_filas`. La comprobación de «ninguna fila nula» con datos reales se hace en producción (Task 6, Step 3).

- [ ] **Step 5: Ejecutar tests**
  Run: `npm run test:int` (todos) y luego `npm run db:reset`
  Expected: PASS, incluidos los 67 previos.

- [ ] **Step 6: Commit**
  ```bash
  git add supabase/migrations/0011_inicio.sql src/lib/database.types.ts tests/integracion/inicio.test.ts
  git commit -m "feat(db): revisión de cupos, fecha de publicación y vista del inicio"
  ```

---

### Task 2: Clasificación de tareas (dominio)

**Files:**
- Create: `src/dominio/tareas.ts`
- Test: `tests/unit/tareas.test.ts`

**Interfaces:**
- Consumes: `nivelAlertaCupos` de `src/dominio/calculos.ts`; tipo de la vista (Task 1).
- Produces:
  - `export type FilaInicio = Database['public']['Views']['v_inicio_filas']['Row']`
  - `export type Tarea = 'sin_respuesta' | 'sin_activar' | 'cupos' | 'revision' | 'envios'`
  - `export const TAREAS: { clave: Tarea; etiqueta: string }[]` en este orden y con estas etiquetas: `Sin respuesta`, `Aceptadas sin activar`, `Cupos al límite`, `Revisión semanal`, `Envíos pendientes`.
  - `export function tareasDeFila(f: FilaInicio, ahora: Date): Tarea[]`
  - `export function contarTareas(filas: FilaInicio[], ahora: Date): Record<Tarea, number>`
  - `export function hayAgotadas(filas: FilaInicio[]): boolean` (alguna fila `acepta`/`activa` con `cupos > 0` y `usos >= cupos`)

- [ ] **Step 1: Escribir `tests/unit/tareas.test.ts`** con una fábrica `fila(parcial)` (por defecto: estado `activa`, cupos 10, usos 0, sms/email `enviado`, `umbral_cupos` 0.8, `revision_cupos` `ninguna`, `cupos_revisado_en` = ahora) y `const ahora = new Date('2026-10-30T10:00:00Z')`:
  - `pendiente → ['sin_respuesta']`; `acepta (usos 0) → ['sin_activar']`.
  - Cupos: `acepta 8/10 → incluye 'cupos'`; `activa 7/10 → no`; `activa 10/10 → 'cupos'`; `pendiente 9/10 → no 'cupos'`; `cupos null → no`; `cupos 0 → no`.
  - Revisión: activa `semanal` revisada `2026-10-23T09:59:59Z` → incluye `'revision'`; revisada `2026-10-23T10:00:00Z` (justo 7 días) → no; `quincenal` revisada hace 10 días → no, hace 15 → sí; `ninguna` revisada hace 30 días → no; `acepta` semanal antigua → no; activa semanal con `cupos_revisado_en: null` → sí.
  - Envíos: activa con sms `pending` → `'envios'`; pendiente con email `pending` → `'envios'`; `no_entra` con sms `pending` → no; `rechaza` con email `pending` → no.
  - `contarTareas` suma por clave y da 0 a las claves sin filas.
  - `hayAgotadas` true con activa 10/10, false con 9/10.

- [ ] **Step 2: Ejecutar y ver que falla**
  Run: `npx vitest run --project unit tests/unit/tareas.test.ts`
  Expected: FAIL (módulo no existe).

- [ ] **Step 3: Implementar `src/dominio/tareas.ts`.** Periodo `semanal` = 7 días, `quincenal` = 14; pendiente si `cupos_revisado_en` es nulo o `< ahora − periodo`. «Cupos» solo en `acepta`/`activa` con `nivelAlertaCupos(usos, cupos, Number(umbral_cupos)) !== null` (`umbral_cupos` puede llegar como string).

- [ ] **Step 4: Ejecutar tests**
  Run: `npm test`
  Expected: PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add src/dominio/tareas.ts tests/unit/tareas.test.ts
  git commit -m "feat: clasificación de filas en las cinco tareas del inicio"
  ```

---

### Task 3: Piezas compartidas del inicio

**Files:**
- Create: `src/app/inicio/datos.ts`, `src/app/inicio/Contadores.tsx`, `src/app/inicio/ListaTareas.tsx`, `src/app/inicio/EtiquetaEstado.tsx`
- Modify: `src/app/promocion/servicio.ts` (añadir `'cupos_revisado_en'` al tipo `Cambios`), `src/app/estilos.css`
- Test: `tests/unit/InicioPiezas.test.tsx`

**Interfaces:**
- Consumes: Task 2; `guardarFila`, `ConflictoError`, `Cambios` (servicio.ts); `ETIQUETA_ESTADO`, `ETIQUETA_ENVIO`.
- Produces:
  - `datos.ts`: `cargarFilasInicio(): Promise<FilaInicio[]>` (select `*` de `v_inicio_filas`); `recargarFila(seguimientoId: string): Promise<FilaInicio | null>`; `guardarDesdeInicio(f: FilaInicio, cambios: Cambios): Promise<FilaInicio>` → `guardarFila(f.seguimiento_id, cambios, f.actualizado_en)` y devuelve `f` con `estado, cupos, sms, email, cupos_revisado_en, actualizado_en` de la fila guardada.
  - `rutaPromocion(espacio: Espacio, tag: string): string` en `datos.ts` → `/tmicc/<tag>`, `/ufs/<tag>`, `/campanas/<tag>`.
  - `<Contadores conteos={Record<Tarea, number>} agotadas={boolean} activa={Tarea | null} onElegir={(t: Tarea) => void} />`: un botón por tarea (número + etiqueta); clase `aviso` si > 0; clase `peligro` en `cupos` si `agotadas`; `aria-pressed` en el activo.
  - `<ListaTareas tarea={Tarea} filas={FilaInicio[]} ahora={Date} onCambio={(f: FilaInicio) => void} mostrarKam?: boolean />`: filas de esa tarea (filtradas con `tareasDeFila`), columnas Concesión, (KAM si `mostrarKam`), TAG (enlace `rutaPromocion`), dato y acción:
    - `sin_respuesta` / `sin_activar`: `<select>` de estado (guarda al cambiar).
    - `cupos`: `<input type="number">` de cupos + «Guardar».
    - `revision`: input de cupos + «Guardar» + «Revisado, sin cambios» (guarda `{ cupos_revisado_en: new Date().toISOString() }`).
    - `envios`: `<select>` SMS y `<select>` Email.
    - Al guardar: éxito → `onCambio(filaNueva)`; `ConflictoError` → texto `role="alert"` «Esta fila ha cambiado; recarga» + `recargarFila` → `onCambio` si devuelve fila; otro error → `error.message` en `role="alert"`.
  - `<EtiquetaEstado fila={FilaInicio} ahora={Date} onCambio={(f: FilaInicio) => void} />`: muestra `TAG · Estado` con clase `estado-<estado>`; si hay aviso de cupos, ⚠ y `%` redondeado (clase `cerca` o `agotado`). Si `fila.editable`, es un botón que al pulsarse muestra un `<select>` de estado y guarda como `ListaTareas` (mismo manejo de conflicto); si no, es texto sin interacción.

- [ ] **Step 1: Escribir `tests/unit/InicioPiezas.test.tsx`** (mock de `../../src/app/inicio/datos` con `vi.mock`, salvo `rutaPromocion` real; patrón de `Rutas.test.tsx`; `MemoryRouter` por los enlaces):
  - `Contadores muestra los cinco con su número y llama onElegir`.
  - `Contadores marca peligro en cupos si hay agotadas`.
  - `ListaTareas sin_respuesta: elegir 'acepta' llama guardarDesdeInicio con { estado: 'acepta' } y luego onCambio`.
  - `ListaTareas revision: «Revisado, sin cambios» guarda solo cupos_revisado_en (string ISO)`.
  - `ListaTareas conflicto: guardarDesdeInicio rechaza con ConflictoError → «Esta fila ha cambiado; recarga» y recargarFila llamado` (Review Focus 1).
  - `EtiquetaEstado no editable no muestra select al pulsar`; `editable: pulsar → select → 'rechaza' guarda { estado: 'rechaza' }`.
  - `EtiquetaEstado con usos 9 / cupos 10 / umbral 0.8 muestra ⚠ y 90 %`.

- [ ] **Step 2: Ejecutar y ver que falla**
  Run: `npx vitest run --project unit tests/unit/InicioPiezas.test.tsx`
  Expected: FAIL.

- [ ] **Step 3: Implementar los archivos y el tipo `Cambios`.**

- [ ] **Step 4: Ejecutar tests**
  Run: `npm test`
  Expected: PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add src/app/inicio src/app/promocion/servicio.ts src/app/estilos.css tests/unit/InicioPiezas.test.tsx
  git commit -m "feat: contadores, lista de tareas y etiqueta de estado del inicio"
  ```

---

### Task 4: Página de inicio del KAM y ruta de entrada

**Files:**
- Create: `src/app/inicio/Inicio.tsx`, `src/app/inicio/InicioKam.tsx`, `src/app/inicio/PromocionesNuevas.tsx`
- Modify: `src/app/inicio/datos.ts`, `src/app/rutas.tsx` (ruta índice → `<Inicio />` en lugar de `<Navigate to="/todos" replace />`), `src/app/Layout.tsx` (primer enlace «Inicio» → `/`, `NavLink end`)
- Test: `tests/unit/InicioKam.test.tsx`, `tests/unit/Rutas.test.tsx`

**Interfaces:**
- Consumes: Tasks 2 y 3; `usePerfil`.
- Produces:
  - `<Inicio />`: `perfil.rol === 'admin'` → hasta Task 5 renderiza `<p>Inicio de administración</p>` (Task 5 lo cambia por `<InicioAdmin />`); cualquier otro rol → `<InicioKam />`.
  - `datos.ts` añade `cargarMisConcesiones(perfilId: string): Promise<{ id: number; nombre: string }[]>`: concesiones con `kam_id = perfilId` ∪ concesiones de `permisos_extra` con `concesion_id` no nulo y vigentes (`caduca` nulo o ≥ hoy) de ese perfil; `nombre = nombre_comercial ?? razon_social`. Los permisos por espacio no añaden concesiones aquí.
  - `<PromocionesNuevas filas={FilaInicio[]} ahora={Date} />`: TAGs distintos con `publicada_en` dentro de los últimos 7 días, como enlaces (`rutaPromocion`); no renderiza nada si no hay.
- Comportamiento de `InicioKam`:
  - Carga en paralelo `cargarFilasInicio()` y `cargarMisConcesiones(perfil.id)`; trabaja solo con filas `editable === true`.
  - `Contadores` con `contarTareas` y `hayAgotadas` de esas filas; al elegir uno, `ListaTareas` debajo; pulsar el mismo otra vez la cierra.
  - `PromocionesNuevas`.
  - «Mis concesiones (N)»: una fila por concesión = unión de `cargarMisConcesiones` y concesiones de las filas editables; orden por nombre (`localeCompare('es')`), las que no tienen filas al final; en cada una, una `EtiquetaEstado` por fila editable de esa concesión, ordenadas por TAG; el nombre enlaza a `/concesion/:id`.
  - `onCambio` sustituye la fila en el estado local (contadores y etiquetas se recalculan).
  - Sin concesiones ni filas: «Todavía no tienes concesiones asignadas».
  - Error de carga: `role="alert"` con el mensaje y botón «Reintentar».

- [ ] **Step 1: Escribir `tests/unit/InicioKam.test.tsx`** (mock de `datos` y `SesionContext.Provider` con perfil KAM):
  - `cuenta solo filas editables` (una editable pendiente + una no editable pendiente → «Sin respuesta» = 1).
  - `pulsar «Sin respuesta» abre la lista con esa fila; pulsar otra vez la cierra`.
  - `Mis concesiones: concesión sin filas al final sin etiquetas; con filas, una etiqueta por promoción`.
  - `permiso por espacio: fila editable de concesión ajena aparece en contadores y en Mis concesiones; no aparecen otras concesiones del espacio` (Review Focus 4).
  - `vacío: «Todavía no tienes concesiones asignadas»`.
  - `PromocionesNuevas: publicada_en hace 2 días aparece; hace 8 días o null no`.
  - En `tests/unit/Rutas.test.tsx`: `la ruta / con perfil kam muestra el inicio del KAM` (ampliar el mock existente para `datos`).

- [ ] **Step 2: Ejecutar y ver que falla**
  Run: `npx vitest run --project unit tests/unit/InicioKam.test.tsx tests/unit/Rutas.test.tsx`
  Expected: FAIL.

- [ ] **Step 3: Implementar.**

- [ ] **Step 4: Ejecutar tests**
  Run: `npm test`
  Expected: PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add src/app/inicio src/app/rutas.tsx src/app/Layout.tsx tests/unit/InicioKam.test.tsx tests/unit/Rutas.test.tsx
  git commit -m "feat: página de inicio del KAM como entrada de la web"
  ```

---

### Task 5: Página de inicio del administrador

**Files:**
- Create: `src/app/inicio/InicioAdmin.tsx`, `src/app/inicio/TareasPorKam.tsx`, `src/app/inicio/RankingPromociones.tsx`
- Modify: `src/app/inicio/Inicio.tsx`, `src/app/inicio/datos.ts`
- Test: `tests/unit/InicioAdmin.test.tsx`, `tests/unit/Rutas.test.tsx`

**Interfaces:**
- Consumes: Tasks 2–4; vista `v_resumen_promocion`.
- Produces:
  - `datos.ts` añade `cargarKams(): Promise<{ id: string; nombre: string }[]>` (perfiles activos con rol `kam` ∪ perfiles que son `kam_id` de alguna concesión) y `cargarRanking(): Promise<FilaRanking[]>` con `export type FilaRanking = { promocion_id: string; tag: string; espacio: Espacio; usos: number; cupos: number; gsv: number; activas: number; pct: number | null }` (promociones publicadas + su fila de `v_resumen_promocion`; `pct = cupos > 0 ? usos / cupos : null`).
  - `<TareasPorKam filas={FilaInicio[]} kams={{ id: string; nombre: string }[]} ahora={Date} onElegir={(kamId: string | null, t: Tarea) => void} />`: una fila por KAM de `kams` (también a cero) + fila «Sin KAM» (`kam_id` null) solo si tiene filas; columnas las cinco tareas + Total; atribución por `kam_id` de la fila; orden por `sin_respuesta` desc y luego nombre; cada celda > 0 es un botón.
  - `<RankingPromociones filas={FilaRanking[]} />`: orden `pct` desc, `null` al final con «—»; columnas TAG (enlace `rutaPromocion`), Espacio, % cupos gastados (texto + barra), Usos, Cupos, GSV, Activas.
- Comportamiento de `InicioAdmin`: carga `cargarFilasInicio`, `cargarKams`, `cargarRanking` en paralelo; `Contadores` globales (todas las filas) → al elegir, `ListaTareas` con `mostrarKam`; `PromocionesNuevas` (todas); `TareasPorKam` → al pulsar celda, `ListaTareas` con las filas de ese KAM y esa tarea; `RankingPromociones`. Sin «Mis concesiones». Mismo manejo de error/Reintentar que InicioKam.

- [ ] **Step 1: Escribir `tests/unit/InicioAdmin.test.tsx`:**
  - `TareasPorKam atribuye por kam_id y la suma de cada columna = contador global`.
  - `TareasPorKam incluye KAM a cero; «Sin KAM» solo si hay filas sin kam`.
  - `TareasPorKam ordena por Sin respuesta desc`.
  - `Ranking: 10/10 antes que 5/10; cupos 0 al final con «—»` (Review Focus 3).
  - `InicioAdmin: pulsar celda de un KAM muestra ListaTareas solo con filas de ese KAM`.
  - En `Rutas.test.tsx`: `la ruta / con perfil admin muestra el inicio de administración`.

- [ ] **Step 2: Ejecutar y ver que falla**
  Run: `npx vitest run --project unit tests/unit/InicioAdmin.test.tsx tests/unit/Rutas.test.tsx`
  Expected: FAIL.

- [ ] **Step 3: Implementar.**

- [ ] **Step 4: Tests, build y prueba visual local**
  Run: `npm test && npm run build`; arrancar el preview «web» de `.claude/launch.json`, entrar como `admin@pro.agency` y como `ana@pro.agency` del seed (enlace mágico vía Mailpit en 54424) y comprobar a 1366 px contadores, lista de tareas, cambio de estado desde una etiqueta, Mis concesiones y ranking, sin errores en consola.
  Expected: PASS, build OK, pantallas correctas.

- [ ] **Step 5: Commit**
  ```bash
  git add src/app/inicio tests/unit/InicioAdmin.test.tsx tests/unit/Rutas.test.tsx
  git commit -m "feat: página de inicio de administración con tareas por KAM y ranking"
  ```

---

### Task 6: Puesta en producción

**Files:**
- Modify: `docs/puesta-en-marcha.md` (añadir 0011 a la lista de migraciones aplicadas)

- [ ] **Step 1: Verificación completa en local**
  Run: `npm test && npm run test:int && npm run db:reset && npm run build`
  Expected: todo PASS.

- [ ] **Step 2: Pedir confirmación a la usuaria** para aplicar `0011_inicio.sql` en producción (proyecto Supabase `itrvdvnvfsstvmcpsjfq`) y subir `main`. No continuar sin un sí explícito.

- [ ] **Step 3: Aplicar en producción** con `apply_migration` de Supabase (nombre `0011_inicio`, contenido del archivo). Comprobar con `execute_sql`: `select count(*) from seguimiento where cupos_revisado_en is null` = 0, y `v_inicio_filas` devuelve tantas filas como seguimiento de promociones publicadas. Revisar `get_advisors` (security).

- [ ] **Step 4: Subir y verificar el despliegue**
  Run: `git push origin main`; esperar a que cambie el bundle de `https://seguimiento-promos-claude.pedidosahora-pro.workers.dev`; abrir `/` con la sesión de administrador del navegador integrado y comprobar contadores y ranking con datos reales.

- [ ] **Step 5: Commit de la guía**
  ```bash
  git add docs/puesta-en-marcha.md
  git commit -m "docs: migración 0011 aplicada en producción"
  git push origin main
  ```
