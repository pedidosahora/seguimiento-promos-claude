# Seguimiento de promociones v1 — Plan de construcción

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir la v1 de la web interna que sustituye los Google Sheets de seguimiento de promociones: catálogo, permisos, promociones, tabla de seguimiento, importaciones (catálogo, usos/GSV, histórico), historial con deshacer, exportación y copia de seguridad.

**Architecture:** SPA en React + TypeScript (Vite) contra Supabase. Toda regla de negocio y de permisos vive en PostgreSQL: RLS, triggers y funciones RPC. El cliente solo lee los Excel y los traduce a JSON; la clasificación y la aplicación de las importaciones se hacen en el servidor, dentro de una única transacción por importación. Los indicadores de cada promoción salen de una vista SQL, que es la única fuente de verdad.

**Tech Stack:**
- React 18, TypeScript, Vite y React Router.
- `@supabase/supabase-js` v2; Supabase CLI como devDependency (`npx supabase`), con Docker para el entorno local.
- AG Grid Community (`ag-grid-community` + `ag-grid-react`) para la tabla editable.
- SheetJS (`xlsx` desde `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`) para leer y escribir Excel.
- Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-28-seguimiento-promociones-design.md`

## Global Constraints

- Coste 0 €/mes: solo planes gratuitos (Supabase Free, Cloudflare Pages, GitHub Actions) y librerías gratuitas (AG Grid **Community**, nunca Enterprise).
- Todos los textos de la interfaz en castellano.
- Los usuarios internos entran solo con cuentas `@pro.agency`.
- Las concesiones se cruzan **siempre por ID**.
- El TAG se normaliza con `trim` + mayúsculas en toda entrada y comparación.
- Usos y GSV son **totales acumulados**: sustituyen a los valores guardados, nunca se suman.
- La web no escribe nunca en la plataforma Pedidos Ahora.
- Etiquetas visibles exactas:
  - Estado: `No entra`, `Pendiente`, `Acepta`, `Rechaza`, `Activa`.
  - SMS y email: `Enviado`, `Pending`, `No hay`.
  - Ciclo de la promoción: `Borrador`, `Publicada`, `Cerrada`, `Archivada`.
- Umbral de aviso de cupos por defecto: 80 % (`0.80`).
- **No se versionan datos reales.** `*.xlsx` está en `.gitignore` y las pruebas usan datos sintéticos construidos en código.

## Review Focus

1. **Números y TAG con formato "de Excel":**
   - `"18"`, `"102,06"`, `"1.234,5"`, `"-"`, `"#VALUE!"` y celdas vacías deben dar número o "sin dato", nunca `NaN`.
   - `" 3experienciac326 "` debe cruzar con `3EXPERIENCIAC326`.
   - Lo cubren las pruebas de la Tarea 6.
2. **Subir el mismo Excel dos veces:** la segunda importación clasifica todo como `sin_cambios` y no duplica nada ni crea historial nuevo. Tareas 7 y 8.
3. **Permiso extra caducado ayer:** el KAM ya no puede editar. Tarea 3.
4. **Dos personas editan la misma fila a la vez:** el segundo guardado se rechaza con "Esta fila ha cambiado; recarga" en lugar de pisar el primero. Tarea 11.
5. **Cupos 0 o vacíos, usos 0:** `%Cupos` y `GSV/uso` se muestran como `—`, nunca `Infinity` ni `NaN`, y no se dispara ninguna alerta. Tarea 5.

---

## Estructura de archivos

```
package.json · vite.config.ts · vitest.config.ts · tsconfig.json · .env.example · README.md
supabase/config.toml
supabase/migrations/
  0001_catalogo.sql        enums, territorios, perfiles, concesiones, permisos_extra, helpers de permisos
  0002_promociones.sql     promociones, seguimiento, comentarios, triggers de seguimiento, RLS
  0003_historial.sql       historial, trigger genérico, deshacer_cambio()
  0004_resumen.sql         vista v_resumen_promocion
  0005_imp_concesiones.sql importar_concesiones()
  0006_imp_usos.sql        clasificar_usos(), previsualizar_usos(), aplicar_usos()
  0007_imp_historico.sql   previsualizar_historico(), aplicar_historico()
supabase/seed.sql          datos sintéticos de desarrollo
src/lib/supabase.ts        cliente
src/lib/database.types.ts  generado: npx supabase gen types typescript --local
src/dominio/etiquetas.ts   enums ↔ etiquetas visibles
src/dominio/calculos.ts    pctCupos, gsvPorUso, nivelAlertaCupos
src/importar/normalizar.ts aNumero, aFechaISO, normalizarTag, mapearEstado, mapearEnvio, normalizarCabecera
src/importar/leerExcel.ts  leerHoja()
src/importar/concesiones.ts · usos.ts · historico.ts   parsers → JSON para las RPC
src/exportar/seguimiento.ts
src/app/                   rutas y pantallas (Tareas 9–12)
tests/unit/**              Vitest, sin red
tests/integracion/**       Vitest contra Supabase local (requiere `npx supabase start`)
tests/integracion/ayuda.ts crearUsuario(), clienteComo(), resetDatos()
.github/workflows/copia-seguridad.yml
```

## Convenciones de prueba

- **Unitarias:** `npm test` → `vitest run --project unit`.
- **Integración:** `npm run test:int` → `vitest run --project integracion`.
  - Ejecución secuencial (`fileParallelism: false`).
  - Cada archivo llama a `resetDatos()` en `beforeEach`.
  - Requieren `npx supabase start` y `npx supabase db reset`.
- **Ayudas en `tests/integracion/ayuda.ts`:**
  - `crearUsuario({email, nombre, rol}): Promise<{perfilId: string, userId: string}>`: crea el usuario con el admin API (service role) y contraseña de prueba `test-local-1234`, solo para el entorno local, más su fila en `perfiles`.
  - `clienteComo(email): Promise<SupabaseClient>`: inicia sesión con contraseña.
  - `admin(): SupabaseClient`: cliente con service role.
  - `resetDatos(): Promise<void>`: TRUNCATE de las tablas de dominio y borrado de los usuarios de prueba.
- Las claves locales se leen de `npx supabase status -o env` y se escriben en `.env.test` (ignorado por git).

---

### Task 1: Andamiaje del proyecto

**Files:**
- Create: `package.json`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/app/App.tsx`, `src/lib/supabase.ts`, `.env.example`, `README.md`, `supabase/config.toml` (con `npx supabase init`), `tests/unit/humo.test.ts`, `tests/integracion/ayuda.ts`, `tests/integracion/humo.test.ts`

**Interfaces:**
- Produce: `supabase` (cliente tipado) desde `src/lib/supabase.ts`, leyendo `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Produce también las ayudas de prueba descritas en "Convenciones de prueba".

- [ ] **Step 1:** `npm create vite@latest . -- --template react-ts`. Añadir las dependencias del Tech Stack y `npx supabase init`.
- [ ] **Step 2:** Configurar `vitest.config.ts` con los proyectos `unit` (`tests/unit/**`, entorno `jsdom`) e `integracion` (`tests/integracion/**`, entorno `node`, `fileParallelism: false`). Añadir los scripts `test`, `test:int`, `db:reset` (`supabase db reset`) y `tipos` (`supabase gen types typescript --local > src/lib/database.types.ts`).
- [ ] **Step 3:** Escribir las pruebas de humo:
  - `tests/unit/humo.test.ts`: `expect(1 + 1).toBe(2)`.
  - `tests/integracion/humo.test.ts`: `admin().auth.admin.listUsers()` no devuelve error.
- [ ] **Step 4:** Ejecutar `npx supabase start`, `npm test` y `npm run test:int`. Esperado: 2 PASS. Ejecutar `npm run build`. Esperado: sin errores.
- [ ] **Step 5:** README con los requisitos previos (Node 24, Docker) y los comandos de arranque local. Commit `chore: andamiaje Vite + Supabase + Vitest`.

---

### Task 2: Catálogo, perfiles y permisos base

**Files:**
- Create: `supabase/migrations/0001_catalogo.sql`, `tests/integracion/catalogo.test.ts`

**Interfaces:**
- Produce estos enums:
  - `rol_usuario` (`admin`, `kam`, `socio`)
  - `espacio` (`TMICC`, `UFS`, `CAMPANAS`)
  - `marca` (`TMICC`, `UFS`)
- Produce estas tablas:
  - `territorios(id serial pk, nombre text unique not null)`
  - `perfiles(id uuid pk default gen_random_uuid(), user_id uuid unique null → auth.users, email text unique not null, nombre text unique not null, rol rol_usuario not null, activo bool default true)`, con CHECK: `rol = 'socio' OR lower(email) LIKE '%@pro.agency'`.
  - `concesiones(id int pk, razon_social text not null, nombre_comercial text, kam_id uuid → perfiles, territorio_id int → territorios, activa bool default true, actualizado_en timestamptz default now())`
  - `permisos_extra(id uuid pk, perfil_id uuid not null → perfiles, concesion_id int null → concesiones, espacio espacio null, caduca date null)`, con CHECK: exactamente uno de `concesion_id` o `espacio`.
- Produce estas funciones `SECURITY DEFINER STABLE`:
  - `mi_perfil() returns perfiles`
  - `es_admin() returns boolean`
  - `es_interno() returns boolean` (admin o kam, activo)
  - `puede_editar_concesion(p_concesion int, p_espacio espacio) returns boolean`: true si es admin, si `concesiones.kam_id = mi_perfil().id`, o si existe un `permisos_extra` del perfil con esa concesión o ese espacio y `(caduca IS NULL OR caduca >= current_date)`.
- Trigger en `auth.users` AFTER INSERT: `UPDATE perfiles SET user_id = NEW.id WHERE lower(email) = lower(NEW.email) AND user_id IS NULL`.
- RLS:
  - `territorios`, `concesiones` y `perfiles`: SELECT si `es_interno()`; INSERT, UPDATE y DELETE solo si `es_admin()`.
  - `permisos_extra`: todo solo para admin, más SELECT de las filas propias.

- [ ] **Step 1: Pruebas que fallan** (`tests/integracion/catalogo.test.ts`):
  - `admin crea concesión y kam la lee`: el admin inserta `{id: 900, razon_social: 'PRUEBA S.L.'}` y el kam hace SELECT y obtiene 1 fila.
  - `kam no puede crear concesiones`: el insert del kam devuelve error, o 0 filas afectadas.
  - `usuario sin perfil no ve nada`: un usuario autenticado sin fila en `perfiles` hace SELECT de `concesiones` y obtiene `[]`.
  - `perfil se vincula al primer login`: se crea el perfil con el email y luego el usuario de auth, y `perfiles.user_id` queda relleno.
  - `perfil interno exige @pro.agency`: insertar `{email: 'x@gmail.com', rol: 'kam'}` viola el CHECK.
- [ ] **Step 2:** `npm run test:int -- catalogo`. Esperado: FAIL (las tablas no existen).
- [ ] **Step 3:** Escribir la migración `0001_catalogo.sql` con los objetos del bloque Interfaces. Después `npm run db:reset` y `npm run tipos`.
- [ ] **Step 4:** `npm run test:int -- catalogo`. Esperado: 5 PASS.
- [ ] **Step 5:** Commit `feat(db): catálogo, perfiles y permisos base`.

---

### Task 3: Promociones, seguimiento y reglas de edición

**Files:**
- Create: `supabase/migrations/0002_promociones.sql`, `tests/integracion/seguimiento.test.ts`

**Interfaces:**
- Consume: `es_admin()`, `es_interno()`, `puede_editar_concesion()` y `mi_perfil()` de la Tarea 2.
- Produce estos enums:
  - `estado_promocion` (`borrador`, `publicada`, `cerrada`, `archivada`)
  - `estado_seguimiento` (`no_entra`, `pendiente`, `acepta`, `rechaza`, `activa`)
  - `estado_envio` (`enviado`, `pending`, `no_hay`)
  - `revision_cupos` (`ninguna`, `semanal`, `quincenal`)
- Produce esta tabla:
  - `promociones(id uuid pk, tag text unique not null, espacio espacio not null, marca marca not null, mecanica text, objetivo text, canal text, fecha_inicio date, fecha_fin date, estado estado_promocion default 'borrador', umbral_cupos numeric(3,2) default 0.80 check (0 < umbral_cupos <= 1), revision_cupos revision_cupos default 'ninguna', actualizado_en timestamptz)`
  - CHECKs de `promociones`:
    - `(espacio='TMICC' → marca='TMICC')` y `(espacio='UFS' → marca='UFS')`.
    - `estado <> 'borrador'` exige `mecanica`, `fecha_inicio` y `fecha_fin` no nulos y `fecha_fin >= fecha_inicio`.
  - Trigger BEFORE INSERT/UPDATE de `promociones`: `tag := upper(trim(tag))`.
- Produce esta tabla:
  - `seguimiento(id uuid pk, promocion_id uuid not null → promociones on delete cascade, concesion_id int not null → concesiones, estado estado_seguimiento default 'pendiente', fecha_aceptacion timestamptz, fecha_activacion timestamptz, cupos int check ≥0, usos int check ≥0, gsv numeric(12,2) check ≥0, fecha_dato date, sms estado_envio default 'pending', email estado_envio default 'pending', actualizado_en timestamptz default now(), unique(promocion_id, concesion_id))`
- Produce esta tabla:
  - `comentarios(id uuid pk, seguimiento_id uuid → seguimiento on delete cascade, autor_id uuid → perfiles default mi_perfil().id, texto text not null check length>0, creado_en timestamptz default now())`
- Triggers BEFORE UPDATE de `seguimiento`, en este orden:
  1. `seg_bloqueo`:
     - Si no es admin, la promoción debe estar `publicada` y `puede_editar_concesion(concesion_id, espacio de la promoción)`; si no, `RAISE 'Sin permiso para editar esta fila'`.
     - Si no es admin y cambian `usos`, `gsv` o `fecha_dato`: `RAISE 'Usos y GSV solo los modifica administración'`.
  2. `seg_fechas`:
     - Si `estado` pasa a `acepta` y `fecha_aceptacion` es null: `now()`.
     - Si pasa a `activa` y `fecha_activacion` es null: `now()`.
     - Nunca se rellena la aceptación al pasar directamente a `activa`.
  3. `seg_tocado`: `actualizado_en := now()`.
- Trigger BEFORE INSERT de `seguimiento`: la concesión debe estar `activa = true`, salvo que `current_setting('app.origen', true) = 'importacion_historico'`.
- RLS:
  - `promociones`: SELECT si es interno y (admin o estado ≠ `borrador`); escritura solo admin.
  - `seguimiento`: SELECT si es interno; INSERT y DELETE solo admin; UPDATE si es interno (el trigger decide).
  - `comentarios`: SELECT si es interno; INSERT si es interno y `puede_editar_concesion` sobre la fila; sin UPDATE ni DELETE.

- [ ] **Step 1: Pruebas que fallan** (`tests/integracion/seguimiento.test.ts`). Escenario común:
  - Promoción `publicada` en TMICC, con convocatoria de la concesión 900 (KAM Ana) y de la 901 (KAM Bea).
  - `kam edita su fila`: Ana pone `estado='acepta'` en la 900; OK, y `fecha_aceptacion` no es null.
  - `kam no edita fila ajena`: Ana actualiza la 901 y recibe un error que contiene `Sin permiso`.
  - `permiso extra vigente permite editar`: un permiso de Ana sobre la 901 con `caduca = hoy` permite editar.
  - `permiso extra caducado ayer no permite editar` (Review Focus 3): con `caduca = hoy - 1`, Ana recibe un error al editar.
  - `permiso por espacio`: un permiso de Ana sobre el espacio `TMICC` permite editar la 901.
  - `kam no toca usos ni gsv`: Ana cambia `usos` y recibe el error `Usos y GSV solo los modifica administración`.
  - `activa directa no rellena aceptación`: de `pendiente` a `activa` deja `fecha_activacion` rellena y `fecha_aceptacion` en null.
  - `promoción cerrada bloquea al kam`: con la promoción en `cerrada`, la edición de Ana da error y la del admin funciona.
  - `kam no ve borradores`: Ana hace SELECT de una promoción `borrador` y obtiene `[]`.
  - `tag se normaliza`: insertar `' abc1 '` guarda `ABC1`.
  - `no se convoca concesión inactiva`: insertar seguimiento de una concesión con `activa=false` da error.
- [ ] **Step 2:** `npm run test:int -- seguimiento`. Esperado: FAIL.
- [ ] **Step 3:** Escribir la migración `0002_promociones.sql`. Después `db:reset` y `tipos`.
- [ ] **Step 4:** `npm run test:int -- seguimiento`. Esperado: 11 PASS.
- [ ] **Step 5:** Commit `feat(db): promociones, seguimiento y reglas de edición`.

---

### Task 4: Historial de cambios y deshacer

**Files:**
- Create: `supabase/migrations/0003_historial.sql`, `tests/integracion/historial.test.ts`

**Interfaces:**
- Consume: las tablas de las Tareas 2 y 3.
- Produce:
  - `historial(id bigserial pk, tabla text, fila_id text, accion text check in ('insert','update','delete'), cambios jsonb, autor_id uuid null, origen text default 'manual', fecha timestamptz default now(), deshecho bool default false)`.
  - Formato de `cambios` en un update: `{"campo": {"antes": v, "despues": v}}`, solo con los campos que cambian. Se excluye `actualizado_en`.
- Trigger AFTER INSERT/UPDATE/DELETE `registrar_historial()` en `seguimiento`, `promociones`, `concesiones`, `permisos_extra` y `perfiles`:
  - `origen := coalesce(current_setting('app.origen', true), 'manual')`.
  - Un update sin cambios reales no registra nada.
- `deshacer_cambio(p_id bigint) returns void`:
  - Solo actúa si es admin o si `autor_id = mi_perfil().id`, y solo sobre `accion='update'` con `deshecho=false`.
  - Si el valor actual de algún campo ≠ `despues`: `RAISE 'El valor ha cambiado después; no se puede deshacer'`.
  - Si no, aplica los valores `antes` (pasando por los triggers normales y generando su propia entrada de historial) y marca `deshecho=true`.
- RLS de `historial`: SELECT si es interno; sin escritura directa.

- [ ] **Step 1: Pruebas que fallan:**
  - `cambio de estado queda registrado`: Ana pasa la 900 a `acepta` y aparece una fila con `cambios.estado = {antes:'pendiente', despues:'acepta'}` y `autor_id` = Ana.
  - `update sin cambios no registra`.
  - `autor deshace su cambio`: tras `deshacer_cambio`, la 900 vuelve a `pendiente` y queda `deshecho=true`.
  - `otro kam no puede deshacer cambio ajeno`: da error.
  - `no se deshace si hubo cambio posterior`: Ana pasa a `acepta`, luego a `activa`, y deshacer la primera entrada da el error `ha cambiado después`.
- [ ] **Step 2:** Ejecutar las pruebas. Esperado: FAIL.
- [ ] **Step 3:** Escribir la migración `0003_historial.sql`.
- [ ] **Step 4:** Ejecutar las pruebas. Esperado: 5 PASS. Repetir `npm run test:int` completo, que debe seguir en verde.
- [ ] **Step 5:** Commit `feat(db): historial de cambios con deshacer`.

---

### Task 5: Indicadores y cálculos

**Files:**
- Create: `supabase/migrations/0004_resumen.sql`, `src/dominio/calculos.ts`, `src/dominio/etiquetas.ts`, `tests/unit/calculos.test.ts`, `tests/integracion/resumen.test.ts`

**Interfaces:**
- Produce la vista `v_resumen_promocion` (con `security_invoker = on`), una fila por promoción con:
  - `promocion_id`, `convocadas` (todas las filas) y `presentadas` (estado ≠ `no_entra`).
  - `pendientes`, `rechazadas`, `aceptadas` (acepta + activa) y `activas`.
  - `pct_aceptacion`, `pct_pendientes`, `pct_rechazo` y `pct_activacion` (null si `presentadas = 0`).
  - `cupos`, `usos` y `gsv` (sumas, con `coalesce` a 0).
- Produce en `src/dominio/calculos.ts`:
  - `pctCupos(usos: number|null, cupos: number|null): number|null`
  - `gsvPorUso(gsv: number|null, usos: number|null): number|null`
  - `nivelAlertaCupos(usos: number|null, cupos: number|null, umbral: number): 'agotado'|'cerca'|null`
- Produce en `src/dominio/etiquetas.ts`:
  - `ETIQUETA_ESTADO: Record<EstadoSeguimiento, string>` (`no_entra` → `'No entra'`, …)
  - `ETIQUETA_ENVIO`, `ETIQUETA_ESTADO_PROMOCION` y `ETIQUETA_ESPACIO` (`CAMPANAS` → `'Campañas'`).

- [ ] **Step 1: Pruebas unitarias que fallan:**
  ```ts
  expect(pctCupos(51, 50)).toBeCloseTo(1.02)
  expect(pctCupos(5, 0)).toBeNull(); expect(pctCupos(5, null)).toBeNull()   // Review Focus 5
  expect(gsvPorUso(416.24, 10)).toBeCloseTo(41.624); expect(gsvPorUso(100, 0)).toBeNull()
  expect(nivelAlertaCupos(50, 50, 0.8)).toBe('agotado')
  expect(nivelAlertaCupos(40, 50, 0.8)).toBe('cerca')
  expect(nivelAlertaCupos(39, 50, 0.8)).toBeNull()
  expect(nivelAlertaCupos(3, 0, 0.8)).toBeNull()
  ```
- [ ] **Step 2: Prueba de integración que falla** (`resumen como en la hoja`): una promoción con 2 `pendiente`, 2 `rechaza`, 0 `acepta`, 31 `activa` y 1 `no_entra` (36 convocadas) debe dar en la vista `presentadas=35`, `aceptadas=31` y `pct_aceptacion≈0.8857`. Son los valores del bloque 3EXPERIENCIAC326 de la hoja real.
- [ ] **Step 3:** Ejecutar ambas. Esperado: FAIL.
- [ ] **Step 4:** Implementar la vista y las funciones TS.
- [ ] **Step 5:** Ejecutar ambas. Esperado: PASS.
- [ ] **Step 6:** Commit `feat: indicadores de promoción y cálculos de cupos`.

---

### Task 6: Lectura de Excel, normalización e importación del catálogo

**Files:**
- Create: `src/importar/leerExcel.ts`, `src/importar/normalizar.ts`, `src/importar/concesiones.ts`, `supabase/migrations/0005_imp_concesiones.sql`, `tests/unit/normalizar.test.ts`, `tests/unit/concesiones.test.ts`, `tests/integracion/imp_concesiones.test.ts`

**Interfaces:**
- Produce en `leerExcel.ts`:
  - `leerHoja(buf: ArrayBuffer): unknown[][]`: primera hoja, leída con `XLSX.read(buf, {cellDates: true})` y `sheet_to_json(ws, {header: 1, raw: true, defval: null})`.
- Produce en `normalizar.ts`:
  - `aNumero(v: unknown): number|null`:
    - Acepta number, `"18"`, `"102,06"` (→ 102.06), `"1.234,5"` (→ 1234.5) y `"102.06"`.
    - Devuelve null para `null`, `""`, `"-"`, `"—"` y cualquier texto que empiece por `#`.
    - Devuelve `NaN` para textos no numéricos, y quien llama lo marca como error.
  - `aFechaISO(v: unknown): string|null`: acepta Date, número de serie de Excel y `"dd/mm/aaaa"`, y devuelve `"aaaa-mm-dd"`. Para fecha con hora existe `aFechaHoraISO`, que devuelve ISO completo.
  - `normalizarTag(v: unknown): string|null`: `String(v).trim().toUpperCase()`, o null si queda vacío.
  - `normalizarCabecera(v: unknown): string`: minúsculas, sin tildes, sin `➤` y sin espacios.
  - `mapearEstado(v): EstadoSeguimiento|null`: insensible a mayúsculas, con las etiquetas de la spec.
  - `mapearEnvio(v): EstadoEnvio|null`: `Enviado` y `Si` → `enviado`, `Pending` → `pending`, `No hay` → `no_hay`.
- Produce en `concesiones.ts`:
  - `parsearConcesiones(aoa: unknown[][]): {filas: FilaConcesion[], errores: ErrorFila[]}`
  - `FilaConcesion = {fila: number, id: number, razonSocial: string, kam: string, territorio: string}`
  - `ErrorFila = {fila: number, motivo: string}`
  - Columnas localizadas por cabecera normalizada: `id`, `concesion`, `kampro` y `territorio`.
- Produce la RPC `importar_concesiones(filas jsonb, aplicar boolean) returns jsonb`, solo para admin:
  - Hace upsert por `id`. Crea en `territorios` los nombres nuevos y resuelve `kam` por `perfiles.nombre`.
  - Devuelve `{crear: n, actualizar: n, sin_cambios: n, errores: [{fila, motivo}]}`. Con `aplicar=false` solo calcula. El motivo `KAM desconocido: <nombre>` corresponde a una fila no aplicada.

- [ ] **Step 1: Pruebas unitarias que fallan** (Review Focus 1):
  ```ts
  expect(aNumero('18')).toBe(18); expect(aNumero('102,06')).toBe(102.06); expect(aNumero('1.234,5')).toBe(1234.5)
  expect(aNumero('-')).toBeNull(); expect(aNumero('#VALUE!')).toBeNull(); expect(aNumero('')).toBeNull()
  expect(aNumero('abc')).toBeNaN()
  expect(normalizarTag(' 3experienciac326 ')).toBe('3EXPERIENCIAC326')
  expect(mapearEnvio('Si')).toBe('enviado'); expect(mapearEstado('No entra')).toBe('no_entra')
  expect(normalizarCabecera('➤Status')).toBe('status'); expect(normalizarCabecera('Concesión')).toBe('concesion')
  expect(aFechaISO(new Date(2026, 9, 26))).toBe('2026-10-26')
  ```
  En `concesiones.test.ts`, con un aoa sintético de cabecera `['ID','CONCESION','KAM PRO','TERRITORIO']`:
  - Una fila con ID vacío da el error `ID vacío`.
  - Un ID repetido da el error `ID duplicado` en la segunda aparición.
- [ ] **Step 2: Prueba de integración que falla:**
  - Con el perfil `Gisela`, importar 2 filas (una de un KAM desconocido) con `aplicar=false` devuelve `crear:1` y 1 error, y la tabla sigue vacía.
  - Con `aplicar=true` se crea 1 concesión.
  - Una segunda importación idéntica devuelve `sin_cambios:1`.
- [ ] **Step 3:** Ejecutar las pruebas. Esperado: FAIL.
- [ ] **Step 4:** Implementar.
- [ ] **Step 5:** Ejecutar las pruebas. Esperado: PASS.
- [ ] **Step 6:** Commit `feat(importar): lectura de Excel, normalización y catálogo`.

---

### Task 7: Importación de usos y GSV

**Files:**
- Create: `src/importar/usos.ts`, `supabase/migrations/0006_imp_usos.sql`, `tests/unit/usos.test.ts`, `tests/integracion/imp_usos.test.ts`

**Interfaces:**
- Consume: `normalizar.ts` (Tarea 6) y `seguimiento` (Tarea 3).
- Produce en `usos.ts`:
  - `parsearUsos(aoa): {filas: FilaUsos[], errores: ErrorFila[]}`
  - `FilaUsos = {fila: number, id: number, concesion: string, tag: string, usos: number, gsv: number, fecha: string}`
  - Columnas por cabecera normalizada: `id`, `concesion`, `tag`, `usos`, `gsv` y `fechaactualizacion`.
  - Errores: `Fila sin TAG`, `Usos no numérico`, `GSV no numérico`, `Fecha no válida`.
- Produce `clasificar_usos(filas jsonb) returns table(fila int, categoria text, seguimiento_id uuid, detalle text)`. Para cada fila, la primera categoría que aplique:
  1. `tag_desconocido`: no existe una promoción con ese TAG.
  2. `concesion_desconocida`: el ID no está en `concesiones`.
  3. `no_convocada`: no existe la fila de seguimiento.
  4. `dato_antiguo`: `fecha < seguimiento.fecha_dato`.
  5. `sin_cambios`: los usos, el GSV y la fecha coinciden con lo guardado.
  6. `aviso_no_entra`: el estado de la fila es `no_entra`.
  7. `actualiza`: el resto de casos.
- Produce `previsualizar_usos(filas jsonb) returns jsonb`, solo admin: `{conteos: {categoria: n}, detalle: [{fila, categoria, detalle}]}`. El detalle excluye `actualiza` y `sin_cambios`.
- Produce `aplicar_usos(filas jsonb, incluir_antiguos boolean) returns jsonb`, solo admin:
  - En una sola transacción hace `set_config('app.origen','importacion_usos',true)`.
  - Escribe `usos`, `gsv` y `fecha_dato = fecha` en las filas `actualiza` y `aviso_no_entra`, y también en las `dato_antiguo` si `incluir_antiguos`.
  - Rellena `concesiones.nombre_comercial` cuando es null.
  - Devuelve `{aplicadas: n, conteos}`.

- [ ] **Step 1: Pruebas unitarias que fallan:**
  - Un aoa sintético con la cabecera `['Id','Concesión','Tag','Usos','GSV','Fecha actualización']` y 3 filas (una sin TAG) da 2 filas y 1 error `Fila sin TAG`.
  - El TAG `' 11bjc426'` queda como `11BJC426`.
- [ ] **Step 2: Pruebas de integración que fallan.** Escenario: la promoción `11BJC426` con las concesiones 900 (`activa`, `fecha_dato` 2026-10-20) y 901 (`no_entra`) convocadas, y la 902 en el catálogo sin convocar.
  - `clasifica cada caso`: filas para `ZZZ`, el ID 999, la 902, la 900 con fecha 2026-10-01, la 900 con fecha 2026-10-26 y la 901 dan respectivamente `tag_desconocido`, `concesion_desconocida`, `no_convocada`, `dato_antiguo`, `actualiza` y `aviso_no_entra`.
  - `aplicar sustituye, no suma`: la 900 tenía `usos=10` y al aplicar `usos=12` queda en 12.
  - `reimportar no duplica` (Review Focus 2): una segunda llamada idéntica a `aplicar_usos` devuelve `aplicadas: 0`, todo `sin_cambios`, y no aparecen filas nuevas en `historial`.
  - `antiguo solo con permiso explícito`: con `incluir_antiguos=true`, la fila antigua sí se aplica.
  - `historial marca origen`: las entradas tienen `origen='importacion_usos'`.
  - `kam no puede importar`: la RPC llamada como Ana da error.
- [ ] **Step 3:** Ejecutar las pruebas. Esperado: FAIL.
- [ ] **Step 4:** Implementar.
- [ ] **Step 5:** Ejecutar las pruebas. Esperado: PASS. Medir `aplicar_usos` con 7.000 filas sintéticas: debe tardar menos de 10 s en local.
- [ ] **Step 6:** Commit `feat(importar): usos y GSV acumulados con vista previa`.

---

### Task 8: Importación del histórico

**Files:**
- Create: `src/importar/historico.ts`, `supabase/migrations/0007_imp_historico.sql`, `tests/unit/historico.test.ts`, `tests/fixtures/historico.ts`, `tests/integracion/imp_historico.test.ts`

**Interfaces:**
- Produce en `historico.ts`: `parsearHistorico(aoa): {promociones: PromocionHistorica[], errores: ErrorFila[]}`.
  - `PromocionHistorica = {tag, mecanica, objetivo, canal, fechaInicio: string|null, fechaFin: string|null, filas: FilaHistorica[]}`
  - `FilaHistorica = {fila, id: number, concesion: string, kam: string, territorio: string, estado: EstadoSeguimiento, fechaAceptacion: string|null, fechaActivacion: string|null, cupos: number|null, usos: number|null, gsv: number|null, sms: EstadoEnvio|null, email: EstadoEnvio|null}`
- Algoritmo de detección de bloques (no depende de filas fijas):
  1. Buscar las celdas cuyo valor normalizado es `id` y cuya celda 4 columnas a la derecha normaliza a `status`. Cada una marca el inicio de un bloque en la columna `c` y la fila de cabecera `h`.
  2. Por encima de `h`, en la columna `c+4`, localizar las etiquetas `fechas`, `mecanica`, `objetivo`, `canal` y `tag`. Su valor está en `c+5`; en el caso de `fechas`, inicio en `c+5` y fin en `c+6`.
  3. Leer las filas de datos desde `h+1` mientras la columna `c` tenga ID. Columnas relativas: 0 ID, 1 concesión, 2 KAM, 3 territorio, 4 estado, 5 aceptación, 6 activación, 7 cupos, 8 usos, 10 GSV, 12 SMS, 13 email. Las columnas 9 y 11 son calculadas y se ignoran.
  4. Errores: bloque sin TAG, estado no reconocido o ID no numérico. Se omite la fila o el bloque y se indica el motivo.
- `tests/fixtures/historico.ts`: `construirHojaHistorico(bloques: BloqueSintetico[]): unknown[][]` reproduce la disposición real (cabecera en la fila 11, etiquetas en las filas 6–10, 15 columnas por bloque y filas de resumen 2–4 con basura `#VALUE!`).
- Produce `previsualizar_historico(datos jsonb, p_espacio espacio) returns jsonb`, solo admin: por promoción, `{tag, accion: 'crear'|'ya_existe', filas: n, concesiones_nuevas: [id]}` más los totales.
- Produce `aplicar_historico(datos jsonb, p_espacio espacio, tags_actualizar text[]) returns jsonb`, solo admin, en una transacción con `app.origen='importacion_historico'`:
  - **Concesiones nuevas:** se crean con `activa=false`, `razon_social` = concesión del bloque, el territorio resuelto o creado y `kam_id` por nombre si existe. Las concesiones existentes no se modifican.
  - **TAG nuevo:** se crea la promoción en `p_espacio`, con la marca implícita (si `p_espacio='CAMPANAS'`, la marca se recibe en `datos.marca`). El estado es `cerrada` si `fechaFin < current_date` y `publicada` en caso contrario. Se crean las filas con `fecha_dato = fechaFin`.
  - **TAG existente que está en `tags_actualizar`:** se rellenan solo los campos que están a null en la promoción y en sus filas, y se crean las filas que falten.
  - **TAG existente que no está en `tags_actualizar`:** se omite.
  - Devuelve `{creadas, actualizadas, omitidas, concesiones_creadas}`.

- [ ] **Step 1: Pruebas unitarias que fallan:**
  - Una hoja con 2 bloques da 2 promociones, con TAG, mecánica, canal y fechas correctos.
  - Los usos `'18'` dan 18; los cupos `'-'` y el GSV `'#VALUE!'` dan null.
  - El email `'Si'` da `enviado`.
  - Un bloque sin TAG da 1 error, y el otro bloque se lee igualmente.
- [ ] **Step 2: Pruebas de integración que fallan:**
  - `crea promociones cerradas`: un bloque con fin 2026-09-30 se crea como `cerrada` en TMICC, con `fecha_dato='2026-09-30'`.
  - `concesión desconocida se crea inactiva`.
  - `reimportar omite por defecto` (Review Focus 2): la segunda importación da `omitidas: 1` y ningún cambio en `seguimiento`.
  - `actualizar solo rellena vacíos`: si la fila tiene `cupos=20` y el archivo trae `cupos=30` con `tags_actualizar=[tag]`, `cupos` sigue en 20; los `cupos` que estaban a null pasan a 30.
  - `usos posteriores prevalecen`: tras importar el histórico, `aplicar_usos` con fecha 2026-10-26 los actualiza, y con fecha 2026-09-01 los clasifica como `dato_antiguo`.
- [ ] **Step 3:** Ejecutar las pruebas. Esperado: FAIL.
- [ ] **Step 4:** Implementar.
- [ ] **Step 5:** Ejecutar las pruebas. Esperado: PASS.
- [ ] **Step 6:** Verificación manual con el archivo real, fuera del repositorio: `parsearHistorico(leerHoja(SEGUIMIENTO SEPT-NOV.xlsx))` da 14 promociones de 35 filas cada una y 0 errores.
- [ ] **Step 7:** Commit `feat(importar): histórico de hojas de seguimiento`.

---

### Task 9: Acceso, estructura y lista de promociones

**Files:**
- Create: `src/app/auth/Acceso.tsx`, `src/app/auth/useSesion.ts`, `src/app/Layout.tsx`, `src/app/rutas.tsx`, `src/app/promociones/ListaPromociones.tsx`, `src/app/estilos.css`, `tests/unit/ListaPromociones.test.tsx`

**Interfaces:**
- Consume: `supabase`, `v_resumen_promocion` y `ETIQUETA_*`.
- Produce: `useSesion(): {cargando: boolean, perfil: Perfil|null}`. Si hay sesión pero no hay perfil activo, muestra la pantalla "Tu cuenta no tiene acceso. Pide alta a administración".
- Produce: las rutas `/:espacio` (`tmicc`, `ufs`, `campanas`, `todos`), `/:espacio/:tag`, `/admin/*` (Tarea 10) e `/importar` (Tarea 12).
- **Acceso:**
  - Botón "Entrar con Google": `signInWithOAuth({provider:'google', options:{queryParams:{hd:'pro.agency'}}})`.
  - Si `import.meta.env.DEV`, se añade además un formulario de enlace por email (`signInWithOtp`); en local, el correo llega a Inbucket.
- **Lista de promociones:**
  - Por espacio; en "Todos", con una columna de espacio, y en modo solo lectura.
  - Filtros: ciclo, vigentes o terminadas y marca.
  - Columnas: TAG, mecánica, vigencia, presentadas, % de aceptación, activas, usos y GSV.
  - Insignia "Vencida" cuando `estado='publicada' AND fecha_fin < hoy`, visible solo para admin.

- [ ] **Step 1: Prueba que falla** (Testing Library, con el cliente simulado):
  - Con 2 promociones simuladas (una publicada y vencida), el rol `admin` ve la insignia "Vencida" y el rol `kam` no.
  - En `/todos`, la lista muestra la columna "Espacio" con el valor "Campañas".
- [ ] **Step 2:** Ejecutar las pruebas. Esperado: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Ejecutar las pruebas. Esperado: PASS.
- [ ] **Step 5:** Escribir `supabase/seed.sql` con datos sintéticos:
  - Admin `admin@pro.agency`, KAM `ana@pro.agency` y `bea@pro.agency`.
  - 6 concesiones (IDs 900–905), una de ellas inactiva.
  - 2 promociones publicadas en TMICC y 1 en Campañas con marca UFS, cada una con 4 filas de seguimiento en estados variados.

  Después `npm run db:reset` y `npm run dev`, entrar por enlace mágico como `admin@pro.agency` y comprobar que se navega entre espacios.
- [ ] **Step 6:** Commit `feat(ui): acceso, navegación y lista de promociones`.

---

### Task 10: Administración

**Files:**
- Create: `src/app/admin/Concesiones.tsx`, `src/app/admin/Usuarios.tsx`, `src/app/admin/Permisos.tsx`, `src/app/admin/FormPromocion.tsx`, `src/app/admin/Convocatoria.tsx`, `tests/unit/FormPromocion.test.tsx`

**Interfaces:**
- Consume: las tablas de las Tareas 2 y 3.
- Produce:
  - CRUD de concesiones: alta, edición y activar/desactivar, con filtro "activas/inactivas".
  - CRUD de usuarios: email, nombre, rol y activo.
  - Permisos extra: concesión o espacio, más fecha de caducidad opcional.
  - Formulario de promoción con:
    - Espacio, y marca, que solo se puede elegir en Campañas.
    - TAG, mecánica, objetivo, canal y fechas.
    - Umbral, en %, con 80 por defecto.
    - Revisión de cupos.
    - Acciones Publicar, Cerrar, Archivar y Reabrir (de cerrada a publicada).
  - Convocatoria: lista de concesiones activas con casillas y "Seleccionar todas"; al guardar, inserta las filas nuevas.
  - Desconvocar solo está permitido si la fila sigue en `pendiente` sin cambios; si no, se pide pasarla a "No entra".
- Rutas `/admin/*` visibles solo con `perfil.rol='admin'`.

- [ ] **Step 1: Prueba que falla:**
  - Con espacio `TMICC`, el selector de marca está deshabilitado y vale `TMICC`; en `Campañas` está habilitado.
  - Publicar sin fechas muestra el mensaje "Para publicar faltan: fecha de inicio, fecha de fin" y no llama al cliente.
- [ ] **Step 2:** Ejecutar las pruebas. Esperado: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Ejecutar las pruebas. Esperado: PASS.
- [ ] **Step 5:** Manual: crear una promoción, convocar 3 concesiones, publicarla y comprobar que el KAM del seed la ve.
- [ ] **Step 6:** Commit `feat(ui): administración de catálogo, usuarios, permisos y promociones`.

---

### Task 11: Pantalla de promoción (tabla + ficha)

**Files:**
- Create: `src/app/promocion/Promocion.tsx`, `src/app/promocion/Cabecera.tsx`, `src/app/promocion/TablaSeguimiento.tsx`, `src/app/promocion/FichaLateral.tsx`, `src/app/promocion/servicio.ts`, `tests/unit/TablaSeguimiento.test.tsx`, `tests/integracion/servicio_seguimiento.test.ts`

**Interfaces:**
- Consume: `v_resumen_promocion`, `pctCupos`, `gsvPorUso`, `nivelAlertaCupos`, `ETIQUETA_*`, `comentarios`, `historial` y `deshacer_cambio`.
- Produce en `servicio.ts`:
  - `guardarFila(id: string, cambios: Partial<FilaSeguimiento>, actualizadoEn: string): Promise<FilaSeguimiento>`: hace UPDATE con `.eq('id', id).eq('actualizado_en', actualizadoEn).select()`. Si devuelve 0 filas, lanza `ConflictoError('Esta fila ha cambiado; recarga')`.
  - `guardarEnBloque(ids: string[], cambios: Pick<FilaSeguimiento,'estado'|'sms'|'email'>): Promise<{ok: number, fallidas: {id, motivo}[]}>`
- Pantalla:
  - Cabecera con los indicadores de la vista y pestañas "Mis concesiones / Todas / Solo pendientes".
  - Tabla AG Grid:
    - Editores de selección para estado, SMS y email; numérico para cupos (y para usos/GSV solo si es admin); fecha y hora para aceptación y activación.
    - Las celdas no editables según permiso (`puede_editar_concesion` vía RPC al cargar) aparecen en gris.
    - `%Cupos` y `GSV/uso` se calculan; si son null muestran `—`. Las alertas van en ámbar (`cerca`) y en rojo con ⚠ (`agotado`).
    - Selección múltiple y barra de acciones en bloque.
  - Al pulsar el nombre de la concesión se abre la ficha lateral: datos, barra de cupos, comentarios (con alta de comentario nuevo) e historial de la fila, con el botón "Deshacer" donde corresponda.
  - Errores del servidor en un aviso visible, con el mensaje tal cual (por ejemplo, `Sin permiso para editar esta fila`).
- Produce también la ruta `/concesion/:id` (`src/app/promocion/FichaConcesion.tsx`), que muestra datos, KAM, territorio, estado activa o inactiva y la lista de todas sus promociones con espacio, estado de seguimiento, usos y GSV. Se llega desde la ficha lateral con el enlace "Ver todas sus promociones".

- [ ] **Step 1: Prueba de integración que falla** (Review Focus 4): Ana y Bea, con permiso extra, leen la misma fila. Ana guarda; Bea guarda con el `actualizadoEn` antiguo y recibe un `ConflictoError` con el mensaje `Esta fila ha cambiado; recarga`. La fila conserva el valor de Ana.
- [ ] **Step 2: Prueba unitaria que falla:**
  - Una fila con `cupos=0, usos=3` muestra `—` en %Cupos y no tiene clase de alerta.
  - Una fila con `usos=51, cupos=50` muestra `102 %` con la clase `alerta-agotado`.
  - Una fila ajena sin permiso se pinta con la clase `no-editable`.
- [ ] **Step 3:** Ejecutar las pruebas. Esperado: FAIL.
- [ ] **Step 4:** Implementar.
- [ ] **Step 5:** Ejecutar las pruebas. Esperado: PASS.
- [ ] **Step 6:** Manual con el seed: cambiar el estado de 5 filas en bloque, añadir un comentario y deshacer un cambio.
- [ ] **Step 7:** Commit `feat(ui): pantalla de promoción con tabla editable y ficha`.

---

### Task 12: Asistente de importación y exportación

**Files:**
- Create: `src/app/importar/Importar.tsx`, `src/app/importar/VistaPrevia.tsx`, `src/exportar/seguimiento.ts`, `tests/unit/exportar.test.ts`, `tests/unit/Importar.test.tsx`

**Interfaces:**
- Consume: `leerHoja` y `parsear*` (Tareas 6–8) y las RPC `importar_concesiones`, `previsualizar_*` y `aplicar_*`.
- Produce: un asistente de 3 pasos, solo para admin.
  1. **Tipo y archivo:** "Catálogo de concesiones", "Usos y GSV" o "Histórico de seguimiento". En el histórico se elige además el espacio, y la marca si es Campañas.
  2. **Vista previa:**
     - Errores del parser y conteos por categoría del servidor, con la tabla de incidencias filtrable.
     - En usos, una casilla "Aplicar también datos más antiguos (N)".
     - En histórico, casillas "Actualizar" por cada TAG `ya_existe`.
  3. **Confirmar → resultado:** resumen final y enlace a las promociones afectadas.
- Produce: `exportarSeguimiento(promo: Promocion, filas: FilaSeguimiento[]): Blob` (xlsx).
  - Columnas en este orden: ID, Concesión, KAM, Territorio, Estado, Aceptación, Activación, Cupos, Usos, %Cupos, GSV, GSV/uso, SMS, Email.
  - Etiquetas visibles, no valores de enum. Los números se guardan como número y no como texto, para no repetir el `#VALUE!` de la hoja.
  - Nombre de archivo: `<TAG>_seguimiento_<aaaa-mm-dd>.xlsx`.

- [ ] **Step 1: Pruebas que fallan:**
  - `exportarSeguimiento`, leído de nuevo con `leerHoja`, tiene en la fila 1 la cabecera exacta, en la celda de usos un valor de tipo number y en la de estado el texto `No entra`.
  - El asistente no muestra el botón "Confirmar" mientras la vista previa no ha llegado.
- [ ] **Step 2:** Ejecutar las pruebas. Esperado: FAIL.
- [ ] **Step 3:** Implementar. Añadir el botón "Exportar a Excel" en la Cabecera (Tarea 11).
- [ ] **Step 4:** Ejecutar las pruebas. Esperado: PASS.
- [ ] **Step 5:** Verificación manual en local con los 3 archivos reales, sin versionarlos:
  - `DTs Concesiones.xlsx`: 35 concesiones creadas. Antes hay que dar de alta los 7 KAM del seed real, o se mostrarán los errores "KAM desconocido".
  - `SEGUIMIENTO SEPT-NOV.xlsx` en TMICC: 14 promociones creadas.
  - `Carga de Datos.xlsx`: muchas filas `tag_desconocido` (es lo esperado), las de las 14 promociones en `actualiza` y 27 errores `Fila sin TAG`.
- [ ] **Step 6:** Commit `feat(ui): asistente de importación y exportación a Excel`.

---

### Task 13: Puesta en producción y copia de seguridad

Requiere a la usuaria: ella crea las cuentas (Supabase, Google Cloud, Cloudflare, GitHub) y pega las claves. El implementador nunca crea cuentas ni introduce contraseñas.

**Files:**
- Create: `.github/workflows/copia-seguridad.yml`, `docs/puesta-en-marcha.md`

- [ ] **Step 1: Verificar las condiciones gratuitas** (la spec §2 lo exige): consultar la documentación oficial vigente sobre la pausa por inactividad y los límites de Supabase Free, el envío de emails y el uso comercial en Cloudflare Pages. Anotar las conclusiones y las fuentes en `docs/puesta-en-marcha.md`. Si alguna condición rompe el coste cero, parar y avisar a la usuaria.
- [ ] **Step 2: Guía paso a paso para la usuaria** en `docs/puesta-en-marcha.md`:
  - Crear el proyecto Supabase (región UE).
  - Ejecutar `npx supabase link` y `npx supabase db push`.
  - Crear el cliente OAuth de Google (tipo interno de Workspace `pro.agency`) y activar el proveedor en Supabase.
  - Crear el proyecto de Cloudflare Pages (build `npm run build`, salida `dist`, variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`).
  - Añadir la URL de Pages a las redirect URLs de Supabase.
- [ ] **Step 3: `copia-seguridad.yml`:**
  - `schedule: cron '0 5 * * 1'` (lunes a las 05:00 UTC) y `workflow_dispatch`.
  - `npx supabase db dump --db-url "$SUPABASE_DB_URL" --data-only -f datos.sql`, más el esquema en `esquema.sql`.
  - Los dos archivos se suben como artefacto con `retention-days: 90`.
  - El secreto `SUPABASE_DB_URL` está en un repositorio privado de GitHub.
  - Una ejecución semanal mantiene además activo el proyecto Supabase.
- [ ] **Step 4: Verificación:**
  - Lanzar el workflow a mano: debe terminar en verde con el artefacto disponible.
  - Restaurar `datos.sql` en local con `psql` y comprobar que el recuento de `seguimiento` coincide.
- [ ] **Step 5: Carga inicial en producción con la usuaria:**
  1. Dar de alta los administradores y los 7 KAM con sus emails.
  2. Importar el catálogo.
  3. Importar los históricos.
  4. Importar los usos.
  5. Prueba de humo: un KAM entra con Google y edita una fila suya.
- [ ] **Step 6:** Commit `chore: despliegue y copia de seguridad semanal`.
