# Afinado visual y tablas ordenables — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Las 13 tablas HTML se ordenan pulsando la cabecera y la web queda pulida según la lista aprobada de 15 puntos.

**Architecture:** Un formateador numérico compartido (`src/dominio/formato.ts`) y una pieza de ordenación reutilizable (`src/app/comun/orden.ts` + `CabeceraOrdenable.tsx`) que cada tabla adopta. El resto son cambios de presentación por pantalla y de CSS en `src/app/estilos.css`. Sin cambios en la base de datos.

**Tech Stack:** React 18 + TypeScript + Vite + React Router 7; AG Grid Community 36 (solo tabla de seguimiento); Vitest 5 (`unit`, jsdom, TZ=Europe/Madrid) + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-30-afinado-diseno-design.md` (§2 ordenación, §3 lista de 15 puntos, §3bis precisiones).

## Global Constraints

- Sin cambios en la base de datos ni en permisos; sí se pueden ampliar los `select` de la web.
- Sin librerías nuevas de UI. CSS en `src/app/estilos.css`, siguiendo sus variables (`--color-*`, `--radio`).
- Ordenación: 3 estados (asc → desc → orden por defecto); ▲/▼ en la columna activa; `aria-sort` en el `<th>`; cabeceras ordenables como `<button>` dentro del `<th>`; texto con `localeCompare('es', { sensitivity: 'base' })`; números como números; fechas por fecha; vacíos (`null`/`undefined`/`''`) siempre al final; orden por defecto = el actual de cada tabla; no se guarda entre visitas; columnas de acciones y de chips no ordenables.
- Formato: separador de miles siempre (`useGrouping: 'always'`); enteros 0 decimales; importes 2 decimales con «€»; porcentajes 0 decimales con « %»; vacío = «—».
- Interfaz en castellano. La tabla de seguimiento (AG Grid) mantiene su ordenación, edición, bloqueo por versión y selección.
- Los tests existentes siguen pasando; si cambian textos o estructura, se actualizan sin perder lo que comprueban.
- Local: API 54421, DB 54422, Mailpit 54424, dev en localhost:5173. Comandos: `npm test`, `npm run build`. No hace falta `test:int` salvo que se toque una consulta (Task 3), y entonces `npm run db:reset` después.
- Commits terminan con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Ordenar una tabla con valores vacíos** («—», sin cupos, sin KAM): los vacíos quedan al final tanto en ▲ como en ▼ → test en Task 2.
2. **Ordenar mientras se edita una fila** (lista de tareas, etiqueta de estado, concesión en edición): tras guardar, la fila conserva su posición según el orden activo y no se pierde la edición abierta → test en Task 3 (ListaTareas) y Task 4 (Concesiones).
3. **Números de 4 cifras, cero y vacío** (1260 → «1.260»; 0 → «0»; null → «—») en todas las tablas y la cabecera → tests en Task 1.
4. **Ficha lateral abierta y cambio de fila**: pulsar otra fila visible cambia la ficha; Esc la cierra; la tabla no cambia de ancho → test en Task 6.
5. **Buscador sin resultados** (concesiones/usuarios): mensaje «Sin resultados» en lugar de tabla vacía con cabeceras → test en Task 4.

---

### Task 1: Formateador compartido

**Files:**
- Create: `src/dominio/formato.ts`
- Modify: todos los usos de `toLocaleString('es-ES'…)`/`Intl.NumberFormat` en `src/` (hoy: `importar/VistaPrevia.tsx`, `promociones/ListaPromociones.tsx`, `inicio/RankingPromociones.tsx`, `promocion/Cabecera.tsx`, `promocion/FichaConcesion.tsx`, `promocion/celdas.ts`, `promocion/TablaSeguimiento.tsx`) y los porcentajes formateados a mano (buscar `* 100` y `' %'` en `src/app`)
- Test: `tests/unit/formato.test.ts`

**Interfaces:**
- Produces: `fmtEntero(v: number | null | undefined): string`, `fmtImporte(v: number | string | null | undefined): string`, `fmtPct(v: number | null | undefined): string` (recibe proporción, 0.84 → «84 %»).

- [ ] **Step 1: Test** `tests/unit/formato.test.ts` (normalizar espacios no separables con `.replace(/ | /g, ' ')`): `fmtEntero(1260)` = `'1.260'`; `fmtEntero(0)` = `'0'`; `fmtEntero(null)` = `'—'`; `fmtImporte(1260)` = `'1.260,00 €'`; `fmtImporte('2985.5')` = `'2.985,50 €'`; `fmtImporte(undefined)` = `'—'`; `fmtPct(0.844)` = `'84 %'`; `fmtPct(1.2)` = `'120 %'`; `fmtPct(null)` = `'—'`.
- [ ] **Step 2:** `npx vitest run --project unit tests/unit/formato.test.ts` → FAIL.
- [ ] **Step 3:** Implementar con `Intl.NumberFormat('es-ES', { useGrouping: 'always', … })` y sustituir todos los formateos repartidos por estas tres funciones. Actualizar los tests que afirmaban textos sin separador.
- [ ] **Step 4:** `npm test && npm run build` → PASS.
- [ ] **Step 5: Commit** `feat: formateador numérico compartido con separador de miles`.

---

### Task 2: Pieza de ordenación

**Files:**
- Create: `src/app/comun/orden.ts`, `src/app/comun/CabeceraOrdenable.tsx`
- Modify: `src/app/estilos.css` (estilo del botón de cabecera)
- Test: `tests/unit/orden.test.tsx`

**Interfaces:**
- Produces:
  - `export type Columna<T> = { clave: string; valor: (fila: T) => string | number | Date | null | undefined }`
  - `export type Orden = { clave: string; dir: 'asc' | 'desc' } | null`
  - `export function ordenar<T>(filas: T[], columnas: Columna<T>[], orden: Orden): T[]` (estable; `null` devuelve `filas` tal cual = orden por defecto)
  - `export function useOrden<T>(filas: T[], columnas: Columna<T>[]): { filas: T[]; orden: Orden; alternar: (clave: string) => void }` (asc → desc → null)
  - `<CabeceraOrdenable clave={string} orden={Orden} onAlternar={(clave) => void} className?={string}>{texto}</CabeceraOrdenable>` renderiza `<th aria-sort=…><button type="button">texto ▲/▼</button></th>`.

- [ ] **Step 1: Test** `tests/unit/orden.test.tsx`:
  - Texto: `['beta','Álvaro','alfa']` asc → `alfa, Álvaro, beta` o `Álvaro, alfa, beta` (empate en base: se conserva el orden de entrada) — afirmar que `beta` va última y que las dos «alfa» van antes.
  - Números: `[10, 2, 33]` desc → `33, 10, 2`.
  - Fechas: ISO strings ordenadas por fecha.
  - Vacíos al final en asc y en desc: `[3, null, 1, undefined, '']` → asc `1, 3, …vacíos`; desc `3, 1, …vacíos` (Review Focus 1).
  - Estabilidad: empates conservan el orden de entrada.
  - `useOrden` + `CabeceraOrdenable`: 1.º clic `aria-sort="ascending"` y ▲, 2.º `descending` y ▼, 3.º sin `aria-sort` y orden original.
- [ ] **Step 2:** `npx vitest run --project unit tests/unit/orden.test.tsx` → FAIL.
- [ ] **Step 3:** Implementar. El botón hereda la tipografía de `th`, sin borde ni fondo, cursor pointer, foco visible.
- [ ] **Step 4:** `npm test && npm run build` → PASS.
- [ ] **Step 5: Commit** `feat: ordenación reutilizable para tablas`.

---

### Task 3: Ordenación y afinado en inicio, listas y ficha de concesión

**Files:**
- Modify: `src/app/inicio/InicioKam.tsx` (Mis concesiones: ordena «Concesión»), `src/app/inicio/ListaTareas.tsx`, `src/app/inicio/TareasPorKam.tsx`, `src/app/inicio/RankingPromociones.tsx`, `src/app/promociones/ListaPromociones.tsx`, `src/app/promocion/FichaConcesion.tsx`
- Test: actualizar/añadir en `tests/unit/InicioKam.test.tsx`, `InicioPiezas.test.tsx`, `InicioAdmin.test.tsx`, `ListaPromociones.test.tsx`; crear `tests/unit/FichaConcesion.test.tsx` si no existe

**Interfaces:**
- Consumes: `useOrden`, `CabeceraOrdenable`, `Columna` (Task 2); `fmt*` (Task 1).
- Comportamiento:
  - Cada tabla usa `useOrden` con sus columnas de datos y su orden actual como defecto. «% cupos» ordena por el valor numérico; «Vigencia» por fecha de inicio; columnas de acción/chips no ordenables.
  - FichaConcesion (§3.9–3.10): enlace «← Volver» (`navigate(-1)` si `window.history.state?.idx > 0`, si no `navigate('/')`); columnas TAG, Espacio, «Estado en la promoción», Cupos, Usos, «% cupos» (con ⚠ y clases `cerca`/`agotado` según `nivelAlertaCupos` y el `umbral_cupos` de la promoción), GSV. Ampliar el `select` de seguimiento con `cupos` y `promociones(tag, espacio, umbral_cupos)`.
- [ ] **Step 1: Tests:** en cada tabla, pulsar una cabecera cambia el orden de las filas (comprobar el texto de la primera fila antes y después) y la tercera vez restaura el orden por defecto. `ListaTareas`: tras cambiar el estado de una fila con un orden activo, la lista sigue ordenada (Review Focus 2). `FichaConcesion`: muestra «Estado en la promoción», «% cupos» con ⚠ para 9/10 umbral 0.8 y el enlace «← Volver».
- [ ] **Step 2:** `npx vitest run --project unit <archivos>` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npm test && npm run build` → PASS.
- [ ] **Step 5: Commit** `feat: tablas ordenables en inicio, listas y ficha de concesión`.

---

### Task 4: Ordenación y afinado en administración e importación

**Files:**
- Modify: `src/app/admin/Admin.tsx` (tabla de promociones), `Concesiones.tsx`, `Usuarios.tsx`, `Permisos.tsx`, `Convocatoria.tsx`, `src/app/importar/VistaPrevia.tsx`
- Create (si ayuda): `src/app/comun/PanelPlegable.tsx`, `src/app/comun/Buscador.tsx`
- Test: actualizar/añadir en `tests/unit/Usuarios.test.tsx`, `VistaPrevia.test.tsx`, y crear `tests/unit/AdminTablas.test.tsx` para Admin/Concesiones/Permisos/Convocatoria

**Interfaces:**
- Consumes: Task 2.
- Comportamiento:
  - Todas sus tablas ordenables (Convocatoria por concesión, KAM, territorio, estado; vistas previas con defecto por nº de fila).
  - §3.11 Admin promociones: TAG enlaza a `rutaPromocion(espacio, tag)` (de `src/app/inicio/datos.ts`); columnas Mecánica y Vigencia (`dd/mm/aaaa – dd/mm/aaaa`, mismo formato que `ListaPromociones`).
  - §3.12 Concesiones, Usuarios, Permisos: formulario de alta plegado tras botón «Añadir concesión» / «Añadir usuario» / «Añadir permiso»; se abre encima de la tabla; «Editar» abre el mismo panel relleno con título «Editar concesión» / «Editar usuario» (Permisos no tiene editar). Se cierra al guardar o con «Cancelar». Buscador en Concesiones (código, razón social, nombre comercial) y Usuarios (nombre, email), sin distinguir mayúsculas ni tildes; sin resultados → «Sin resultados» (Review Focus 5).
  - §3.13 Usuarios: rol como «Administrador» / «KAM» / «Socio».
  - §3.3 Acciones en tablas de administración: `boton secundario pequeno` en todas (Editar, Convocatoria, Desactivar, Quitar…).
- [ ] **Step 1: Tests:** ordenar cada tabla (primera fila cambia); Concesiones: el formulario no se ve hasta pulsar «Añadir concesión»; «Editar» abre el panel con los datos y el título; el buscador filtra por razón social y muestra «Sin resultados»; con una fila en edición, ordenar no cierra el panel (Review Focus 2). Usuarios: rol «Administrador»/«KAM». Admin: TAG es enlace y aparecen Mecánica y Vigencia.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npm test && npm run build` → PASS.
- [ ] **Step 5: Commit** `feat: tablas ordenables y formularios plegables en administración`.

---

### Task 5: Estilo general, formulario de promoción e importación

**Files:**
- Modify: `src/app/estilos.css`, `src/app/admin/FormPromocion.tsx`, `src/app/importar/Importar.tsx`, y las páginas que no ocupen el ancho común (localizar por qué la lista de promociones se ve más estrecha que administración a 1366 px; `.contenido` ya tiene `max-width: 1280px`)
- Test: actualizar/añadir en `tests/unit/FormPromocion.test.tsx`, `tests/unit/Importar.test.tsx`

**Comportamiento:**
- §3.1: todas las páginas con el mismo contenedor y las tablas a todo el ancho de él.
- §3.2: etiquetas de `.filtros label`, `.formulario label`, `.barra-bloque label` y `.tabla th` a 13 px.
- §3.3: enlaces subrayados solo para navegación; el resto de acciones, botón (revisar lo que no cubra Task 4).
- §3.14 FormPromocion: dos columnas con `fieldset`/`legend` «Identificación» (TAG, Espacio, Marca), «Contenido» (Mecánica, Objetivo, Canal), «Fechas» (inicio y fin en la misma fila), «Cupos» (Umbral, Revisión). Asterisco en TAG; asterisco en Mecánica y fechas con la nota «* Necesario para publicar». Guardar/Publicar sin cambios de comportamiento.
- §3.15 Importar: zona `<label className="zona-archivo">` que envuelve el `<input type="file">` (oculto a la vista pero accesible), admite arrastrar y soltar (`onDragOver`/`onDrop`), muestra «Arrastra el Excel aquí o pulsa para elegirlo» o el nombre del archivo; bajo el selector de tipo, la ayuda exacta de la spec §3.15 para cada tipo.
- [ ] **Step 1: Tests:** FormPromocion muestra las cuatro `legend` y los asteriscos, y sigue guardando con los mismos datos; Importar muestra la ayuda del tipo elegido (texto exacto de la spec) y, tras elegir archivo, su nombre; soltar un archivo en la zona lo selecciona.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npm test && npm run build` → PASS.
- [ ] **Step 5: Commit** `feat: estilo común, formulario de promoción por grupos e importación con zona de archivo`.

---

### Task 6: Pantalla de promoción

**Files:**
- Modify: `src/app/promocion/Cabecera.tsx`, `src/app/promocion/TablaSeguimiento.tsx`, `src/app/promocion/Promocion.tsx`, `src/app/promocion/FichaLateral.tsx`, `src/app/estilos.css`
- Test: actualizar/añadir en `tests/unit/Cabecera.test.tsx`, `TablaSeguimiento.test.tsx`, `FichaLateral.test.tsx`, `Promocion.test.tsx`

**Comportamiento:**
- §3.5 Cabecera: tres grupos en una fila (`Participación`: Convocadas, Presentadas, Activas, Pendientes; `Porcentajes`: % aceptación, % pendientes, % rechazo, % activación; `Resultados`: Cupos, Usos, GSV), con un título pequeño por grupo; cabe en una fila a 1366 px.
- §3.6 TablaSeguimiento: `domLayout` = `'autoHeight'` con 20 filas o menos, si no `'normal'` con alto fijo de unos 640 px; el modo `pruebas` existente se mantiene; el alto `calc(100vh - 360px)` de `.tabla-grid` solo aplica en modo normal.
- §3.7 Cabeceras «% cupos» y «GSV/uso»; `minWidth` en GSV y GSV/uso suficiente para «12.345,67 €»; `tooltipValueGetter` o `title` con el valor completo en celdas numéricas.
- §3.8 Ficha lateral como panel superpuesto fijo a la derecha (unos 380 px, sombra, por encima de la tabla, sin alterar su ancho); fila seleccionada resaltada; pulsar otra fila visible cambia la ficha; Esc y «Cerrar» la cierran.
- [ ] **Step 1: Tests:** Cabecera tiene los tres títulos de grupo y los 11 valores; TablaSeguimiento con 5 filas usa autoHeight y con 25 no (comprobar la prop del grid o la clase del contenedor); FichaLateral/Promocion: abrir la ficha no cambia la clase de ancho de la tabla, Esc la cierra, pulsar otra concesión cambia el nombre mostrado (Review Focus 4).
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npm test && npm run build` → PASS.
- [ ] **Step 5: Commit** `feat: cabecera agrupada, tabla de alto ajustado y ficha superpuesta`.

---

### Task 7: Comprobación visual y publicación

- [ ] **Step 1:** `npm test && npm run build` → PASS.
- [ ] **Step 2:** En local a 1366 px, como `admin@pro.agency` y `ana@pro.agency` (enlace mágico vía Mailpit), recorrer: inicio, TMICC/UFS/Campañas/Todos, una promoción (con ficha abierta), ficha de concesión, administración (4 pestañas + nueva promoción + convocatoria) e importar. Comprobar los 15 puntos de §3 y ordenar al menos una tabla por pantalla. Sin errores de consola.
- [ ] **Step 3:** Pedir confirmación a la usuaria para fusionar en `main` y subir (sin migraciones; Cloudflare publica solo).
- [ ] **Step 4:** Fusionar, `git push origin main`, esperar el bundle nuevo en `https://seguimiento-promos-claude.pedidosahora-pro.workers.dev` y comprobar que carga sin errores.
