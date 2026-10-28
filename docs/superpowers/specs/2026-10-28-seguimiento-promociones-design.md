# Diseño — Plataforma de seguimiento de promociones (Pedidos Ahora)

**Fecha:** 2026-10-28 · **Autora del encargo:** Solana Noé (Pro Agency / Pedidos Ahora) · **Mantenimiento previsto:** la propia autora con ayuda de Claude.

Documento de partida: `contexto-proyecto-seguimiento-promociones.md` (descripción funcional). Este documento lo concreta con las decisiones tomadas en conversación. Marcado **[decisión de Claude]** = propuesta no discutida explícitamente; el resto lo decidió la usuaria.

---

## 1. Intención y por qué

El equipo de Pedidos Ahora sigue en Google Sheets las promociones que ofrece a sus concesiones (distribuidores). Problemas reales:

- **Los KAM se olvidan de actualizar** el seguimiento.
- **No se pueden sacar informes ni conclusiones** directamente. Ejemplo verificado en la hoja actual: los usos están guardados como texto y todos los totales (usos, %cupos, GSV) dan `#VALUE!`.
- **Errores accidentales**: cualquiera puede tocar una celda equivocada.

Objetivo: una web interna que sustituya las hojas. **Éxito = la web se convierte en la herramienta habitual y el equipo deja de usar los Sheets.**

### Anti-objetivos (fracaso aunque funcione)
- Que sea más lenta o engorrosa que la hoja para actualizar muchas concesiones → los KAM volverían al Sheet.
- Que acepte datos erróneos en silencio (valores no válidos, importaciones que pisan datos más recientes).
- Que tenga coste mensual en la fase inicial.

### Fuera de alcance
- La web **no escribe** en la plataforma Pedidos Ahora. Los cupos se ajustan allí y en la web solo se anota el nuevo valor.
- No sustituye al Creador de Informes existente (informes a cliente en Word).

---

## 2. Stack y alojamiento (decidido)

- **Supabase** (plan gratuito): base de datos PostgreSQL, autenticación (Google + enlace mágico por email) y permisos por fila (RLS).
- **Web en React**, publicada en **Cloudflare Pages** (gratuito y permite uso comercial). No se usa Vercel porque su plan gratuito Hobby no admite uso comercial.
- Coste objetivo: **0 €/mes**. Si crece, se migra a Supabase Pro (~25 $/mes) sin rehacer nada.

**Antes de construir hay que verificar** las condiciones actuales del plan gratuito, que se citan de memoria: pausa de Supabase tras ~7 días sin actividad, límite de ~500 MB, envío de emails, condiciones de uso de Cloudflare Pages.

**Copias de seguridad:** el plan gratuito no las ofrece descargables. Se añade una exportación automática periódica de la base de datos, por ejemplo semanal a Google Drive o a un repositorio privado **[decisión de Claude: el destino y el mecanismo exactos los decide quien construya]**.

---

## 3. Usuarios, acceso y permisos

| Rol | Acceso | Puede |
|---|---|---|
| **Administración** | Google corporativo | Todo: promociones, concesiones, usuarios, permisos, importaciones, exportaciones. |
| **KAM** | Google corporativo | Editar el seguimiento de **sus concesiones asignadas**. Ver el resto en solo lectura. |
| **Socio externo** | Solo por invitación: Google o enlace mágico por email | Solo lectura del alcance que defina administración. |

- **Permisos extra (usuaria):** el administrador puede dar a un KAM permiso de edición sobre otras concesiones (por ejemplo, para cubrir vacaciones). **[decisión de Claude]** El permiso se puede dar por concesión o por espacio completo, con fecha de caducidad opcional.
- **Socios [decisión de Claude, siguiendo el doc. de partida]:** el administrador configura por socio los espacios, promociones o concesiones visibles, los **campos visibles** (por ejemplo, ocultar comentarios o GSV) y si puede exportar. Los socios no ven avisos, historial ni datos de otros socios.
- Los emails no invitados no pueden entrar.
- **El login de los internos** se limita al dominio de Google `@pro.agency`. La usuaria ha confirmado que todos los KAM y administradores tienen cuenta en ese dominio.
- **Datos de alta pendientes**, que no bloquean el plan: quiénes son los primeros administradores y el email de cada KAM vinculado a su nombre ("Gisela", "Laia"…). La usuaria los facilitará en la puesta en marcha.

---

## 4. Modelo de información

### Espacios y marca
- **Espacios:** `TMICC` (The Magnum Ice Cream Company), `UFS` (Unilever Food Solutions) y `Campañas`.
- **Marca** de cada promoción: `TMICC` o `UFS`. En los espacios TMICC y UFS es implícita. En Campañas el administrador la elige.
- La vista **"Todos"** agrega todos los espacios en solo lectura e indica el origen de cada promoción. La edición se hace en el espacio de origen.
- Las campañas se siguen **exactamente igual** que las promociones.

### Concesión (catálogo común a todos los espacios)
Campos: `ID` (numérico, identificador de la plataforma, único), **razón social**, **nombre comercial**, **KAM asignado**, **territorio** y **activa/inactiva**.
- El Excel de carga usa el nombre comercial (`SERVERA`) y el listado la razón social (`DELICY FOOD SOLUTIONS, S.L.`). **Siempre se cruza por ID.**
- **Inactiva** = cliente con el que ya no se trabaja. No se puede convocar en promociones nuevas, pero conserva su histórico y aparece en los informes.
- Carga inicial desde `DTs Concesiones.xlsx`: 35 concesiones, columnas `ID, CONCESION, KAM PRO, TERRITORIO`, con 7 KAM y 6 territorios. El nombre comercial se puede completar desde el Excel de carga por ID **[decisión de Claude]**.
- Territorios actuales: Mediterráneo, Norte, Sur, Nordeste, Canarias y Centro. Se guardan como lista editable **[decisión de Claude]**.

### Usuario
Email, nombre visible (el mismo que aparece como "KAM PRO", por ejemplo "Gisela"), rol y concesiones asignadas (las que tienen su nombre como KAM).

### Promoción
- `TAG` (único en todo el sistema), espacio, marca.
- **Mecánica** (texto descriptivo, hace de nombre), **objetivo** y **canal** (por ejemplo, "Total Plataforma" o "HORECA + BARCA + OCIO").
- **Fecha de inicio y fecha de fin.**
- Ciclo de vida: `Borrador → Publicada → Cerrada → Archivada`. Los borradores admiten datos incompletos. El seguimiento se puede editar hasta que la promoción se cierra **[decisión de Claude: "Cerrada" bloquea la edición de los KAM y "Archivada" solo la saca de las vistas activas]**.
- **El cierre y el archivo los hace administración a mano**, como dice el documento de partida. No son automáticos al llegar la fecha de fin. La web avisa al administrador de las promociones ya vencidas que siguen publicadas **[decisión de Claude]**.
- **La importación de usos y GSV se sigue aplicando a las promociones cerradas y archivadas**, porque los resultados siguen llegando después de la fecha de fin **[decisión de Claude]**.
- **Umbral de aviso de cupos**, 80 % por defecto **[decisión de Claude]**.
- **Revisión periódica de cupos:** ninguna, semanal o quincenal **[decisión de Claude sobre las opciones; la necesidad de revisión semanal la planteó la usuaria]**.
- Concesiones convocadas: se eligen del catálogo de activas. **Solo las convocadas tienen fila de seguimiento** (usuaria). Al convocarlas, su estado inicial es `Pendiente` **[decisión de Claude]**.

### Seguimiento (una fila por promoción × concesión)
- **Estado:** `No entra`, `Pendiente`, `Acepta`, `Rechaza` o `Activa`. `No entra` = convocada que no participa (usuaria). Tal como hace la hoja actual, queda fuera de las "presentadas" y de los porcentajes.
- **Fecha de aceptación** y **fecha de activación**, con fecha y hora.
- **Cupos** (entero, editable por el KAM), **usos** (entero) y **GSV** (euros, decimal), junto con la **fecha del dato de usos/GSV**.
- **Usos y GSV** llegan por importación. Solo administración puede corregirlos a mano; los KAM no **[decisión de Claude]**.
- **Fechas de aceptación y activación:** se rellenan solas, con la fecha y hora actuales, cuando el estado pasa a `Acepta` o `Activa`, también en los cambios masivos. Después se pueden corregir a mano. Si se pasa directamente a `Activa` sin haber aceptado antes, la aceptación queda vacía, como ocurre en la hoja actual **[decisión de Claude]**.
- **SMS:** `Enviado`, `Pending` o `No hay`. **Email:** `Enviado`, `Pending` o `No hay`. En la hoja existía también "Si", que se importa como `Enviado`.
- **Comentarios:** lista de entradas con autor y fecha, no un campo único **[decisión de Claude]**.

### Cálculos (derivados, nunca introducidos a mano)
- **Convocadas** = todas las filas de seguimiento de la promoción.
- **Presentadas** = convocadas con estado distinto de `No entra`. En la hoja: Pendiente + Rechaza + Acepta + Activa. Es la base de todos los porcentajes.
- **% de aceptación** = (Acepta + Activa) / presentadas. Las activas cuentan como aceptadas.
- % de pendientes, de rechazos y de activación = cada estado / presentadas.
- **% de cupos** = usos / cupos.
- **GSV por uso** = GSV / usos.
- Totales por promoción: suma de cupos, usos y GSV.

### Historial de cambios
Cada cambio en el seguimiento, en las promociones, en las concesiones y en los permisos registra quién, cuándo, el campo, el valor anterior y el valor nuevo. Desde el historial se puede **deshacer** un cambio **[decisión de Claude: el deshacer solo está disponible para administración y para el autor del cambio]**.

---

## 5. Pantallas

- **Navegación:** espacios (TMICC, UFS, Campañas, Todos) → lista de promociones (filtros: estado del ciclo, vigentes o terminadas, marca) → promoción.
- **Pantalla de promoción (decidida con boceto):**
  - **Cabecera:** TAG, mecánica, vigencia y los indicadores presentadas, % de aceptación, activas, pendientes, usos y GSV.
  - Pestañas: **Mis concesiones / Todas / Solo pendientes**.
  - **Vista principal: tabla editable** parecida a la hoja, con desplegables y campos validados. Solo se pueden editar las filas permitidas. Las alertas de cupos se marcan (⚠ en ≥ umbral y en ≥ 100 %).
  - **Al pulsar una concesión se abre una ficha lateral** con comentarios, historial de esa fila y barra de cupos.
  - **En el móvil:** vista de lista + ficha en lugar de la tabla. **Va en la v2.** La v1 se diseña para ordenador; en el móvil se puede consultar, aunque no esté optimizada **[decisión de Claude]**.
  - Debe permitir actualizar muchas filas rápido (anti-objetivo nº 1). Es deseable el cambio masivo de estado o de SMS/email sobre una selección de filas **[decisión de Claude]**.
- **Ficha de concesión:** datos, KAM, territorio y todas las promociones en las que participa, con su estado.
- **Administración:** promociones (crear, editar, publicar, cerrar, archivar), catálogo de concesiones, usuarios y roles, permisos extra y socios.
- **Importación:** subir archivo → vista previa → confirmar (véase §6).

Boceto de referencia: `.superpowers/brainstorm/*/content/seguimiento-kam.html`.

---

## 6. Importaciones

Principio común: **subir → vista previa (qué se crea, qué se actualiza, qué no encaja, qué tiene errores) → confirmar.** Las filas válidas se importan y las incidencias quedan listadas. Todo queda en el historial.

### 6.1 Resultados de usos y GSV (Excel de la plataforma)
- **Formato** (`Carga de Datos.xlsx`): una hoja con las columnas `Id`, `Concesión`, `Tag`, `Usos`, `GSV` y `Fecha actualización`. Hay una fila por concesión + TAG, sin duplicados. La muestra tiene unas 6.900 filas, 58 concesiones y 2.800 TAGs, con fechas distintas en cada fila.
- **Los valores son totales acumulados → sustituyen** a los guardados, no se suman. Volver a importar el mismo archivo no duplica nada.
- El cruce se hace por `Id` + `Tag` contra el seguimiento existente.
- **TAG que no existe en la plataforma:** se ignora y se lista como "TAG desconocido". No se crean promociones solas **[decisión de Claude]**.
- **ID que no está en el catálogo:** se lista como "concesión desconocida" y no se carga. El administrador puede darla de alta (activa o inactiva) y volver a importar.
- **Concesión del catálogo sin fila de seguimiento en esa promoción** (no convocada): se lista como incidencia y no se carga. Si la fila existe con estado `No entra`, el dato se carga, pero se marca como aviso, porque hay usos de una concesión que supuestamente no participa **[decisión de Claude]**.
- **Fila sin TAG** (hay 27 en la muestra): es un error y no se carga.
- **Fecha más antigua que la guardada:** la fila se marca como "dato más antiguo" y no se aplica salvo confirmación explícita **[decisión de Claude]**.

### 6.2 Histórico (hojas de seguimiento actuales)
- No habrá más de unos 10 archivos, todos con el mismo formato que `SEGUIMIENTO SEPT-NOV.xlsx`.
- **Formato:** una pestaña con **bloques horizontales de 15 columnas**, uno por promoción (14 en la muestra).
  - Fila 6: `FECHAS`, inicio y fin.
  - Filas 7–10: `MECÁNICA`, `OBJETIVO`, `CANAL` y `TAG` (etiqueta en la columna 5 del bloque, valor en la columna 6).
  - Fila 11: cabecera `ID, CONCESION, KAM PRO, TERRITORIO, ➤Status, Aceptación, Activación, ➤Cupos, Usos, %Cupos, GSV, GSV/Uso, ➤SMS, ➤Email`.
  - Filas 12 en adelante: concesiones.
  - Las filas 2–4 son resúmenes con fórmulas y se ignoran.
- El administrador **elige el espacio de destino** al importar (SEPT-NOV → TMICC).
- **Conversiones:**
  - Usos en texto ("18") → número.
  - "-", `#VALUE!` o vacío → sin dato.
  - Email "Si" → `Enviado`.
  - %Cupos y GSV/Uso se ignoran y se recalculan.
- **Las concesiones que no están en el catálogo se crean como inactivas.** El KAM y el territorio del bloque no sobrescriben el catálogo **[decisión de Claude]**.
- Si los usos o el GSV del Excel de carga son más recientes, prevalecen sobre los del histórico.
- Una promoción importada ya terminada se crea como `Cerrada` **[decisión de Claude]**.
- **Fecha del dato** de los usos y el GSV que vienen del histórico: vacía: el histórico no fija fecha del dato, así que cualquier importación de Carga de Datos prevalece **[decisión de Claude, ajustada tras probar con datos reales]**.
- **TAG que ya existe en la plataforma** (porque se importa el mismo archivo otra vez, porque el TAG aparece en otro archivo o porque se creó a mano): la vista previa lo muestra como "ya existe". Por defecto se omite. El administrador puede elegir actualizarlo, y en ese caso solo se rellenan los campos vacíos, sin pisar los datos ya introducidos en la web **[decisión de Claude]**.

### 6.3 Plantilla de promociones (doc. de partida §7)
Plantilla descargable para crear o actualizar promociones y su seguimiento con datos parciales. Las que vengan incompletas se guardan como borrador. **Va en la v2** **[decisión de Claude]**: la v1 cubre la creación manual y la importación del histórico.

---

## 7. Avisos (v2)

Panel **"Mis pendientes"** al entrar, con acceso directo para corregir cada caso:
1. **Aceptaciones pendientes:** filas en `Pendiente` de promociones vigentes, de la más antigua a la más reciente.
2. **Cupos agotados:** filas `Activa` con usos ≥ cupos.
3. **Cupos cerca de agotarse:** filas `Activa` con % de cupos ≥ umbral de la promoción.
4. **Revisión periódica de cupos:** en las promociones con revisión semanal o quincenal, se genera cada periodo la tarea "revisar cupos" por cada fila `Activa`. Se cierra al actualizar el cupo o al marcar "revisado, sin cambios".

Administración ve los mismos avisos agrupados por KAM. Los avisos se recalculan tras cada importación y cada cambio. **Email semanal** de resumen a cada KAM **[decisión de Claude: lunes a primera hora]**.

---

## 8. Informes y exportación (v3)

Según el documento de partida §8:
- Análisis por promoción.
- Comparativas entre promociones, periodos, KAM, concesiones, territorios, canales, espacios y marcas.
- Indicadores: participación, aceptación, activación, consumo de cupos, GSV y pendientes.
- Exportación a Excel/CSV.

**El detalle de qué informes concretos y con qué forma está por definir:** se hará un brainstorming propio antes de la v3. Como el modelo de datos ya es estructurado, no hace falta preparar nada especial en la v1.

**En la v1 basta con:** los indicadores de la cabecera de cada promoción y la exportación de la tabla de seguimiento a Excel **[decisión de Claude]**.

---

## 9. Fases

| Fase | Contenido |
|---|---|
| **v1** (alcance mínimo para dejar los Sheets; decidido por la usuaria, con dos añadidos de Claude aceptados implícitamente) | Login Google; catálogo de concesiones (carga desde el listado); usuarios y asignación de KAM; permisos (roles + permisos extra); creación y gestión de promociones por el administrador; pantalla de seguimiento (tabla + ficha); **importación del histórico**; *importación de usos/GSV*; *historial de cambios*; exportación básica; copia de seguridad periódica. |
| **v2** | Panel "Mis pendientes", avisos de cupos, revisión periódica, email semanal, plantilla de promociones (§6.3). |
| **v3** | Informes y comparativas; acceso de socios externos. |

---

## 10. Lo que queda en manos de quien construya

- La estructura de las tablas, las políticas RLS y la organización del código.
- La librería de tabla editable y la de lectura de Excel en el navegador o en el servidor.
- El diseño visual (sobrio y profesional, coherente con el boceto).
- El mecanismo concreto de copia de seguridad y de envío de emails (dentro del coste cero).
- Los mensajes de error y los textos de la interfaz, en castellano.

---

## 11. Archivos de referencia (en Descargas de la usuaria; no se versionan porque contienen datos reales)

- `contexto-proyecto-seguimiento-promociones.md`: descripción funcional.
- `Carga de Datos.xlsx`: formato de usos y GSV.
- `SEGUIMIENTO SEPT-NOV.xlsx`: formato del histórico.
- `DTs Concesiones.xlsx`: catálogo de concesiones.
