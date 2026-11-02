# Diseño — Pestaña «Análisis»

Fecha: 2026-11-02. La usuaria pidió saltarse las preguntas; todo lo que no viene del diseño principal (§8 «Informes y exportación (v3)» de `2026-10-28-seguimiento-promociones-design.md`) es **[decisión de Claude]**.

## 1. Intención

§8 del diseño principal: análisis por promoción; comparativas entre promociones, periodos, KAM, concesiones, territorios, canales, espacios y marcas; indicadores de participación, aceptación, activación, consumo de cupos, GSV y pendientes; exportación a Excel/CSV. Esta pestaña lo cubre en una sola pantalla de solo lectura.

Anti-objetivos: modificar datos desde Análisis; gráficos con dos escalas; librerías nuevas.

## 2. Acceso y datos **[decisión de Claude]**
- Nueva ruta `/analisis` y enlace «Análisis» en el menú, para administración y KAM.
- Todos los internos ven todos los datos (ya pueden leer todo el seguimiento por RLS). El KAM tiene la casilla «Solo mis concesiones», marcada por defecto; el administrador la tiene desmarcada.
- Fuente: filas de `seguimiento` con su promoción (tag, espacio, marca, canal, estado, fecha_inicio, fecha_fin), su concesión (id, nombre, territorio, KAM) y sus cifras. Se excluyen siempre las promociones en borrador.
- La lectura es **paginada** con `range` en bloques de 1000 hasta agotar. Así se evita el límite de 1000 filas de la API, aunque hoy haya unas 490.
- Sin cambios en la base de datos.

## 3. Métricas (mismas definiciones que `v_resumen_promocion`)
- Convocadas = filas.
- Presentadas = estado ≠ «no entra».
- Aceptadas = acepta + activa.
- Activas = activa.
- Pendientes; Rechazadas.
- % aceptación = aceptadas ÷ presentadas.
- % activación = activas ÷ presentadas.
- Cupos (suma); Usos (suma).
- % cupos gastados = usos ÷ cupos, vacío si cupos = 0.
- GSV (suma); GSV/uso = GSV ÷ usos.
- Promociones = TAG distintos.

## 4. Pantalla **[decisión de Claude]**

1. **Filtros en una fila arriba:** Espacio (todos/TMICC/UFS/Campañas), Marca (todas/TMICC/UFS), Estado de la promoción (por defecto Publicada + Cerrada; también Archivada), Inicio desde – hasta (fecha de inicio de la promoción), KAM, Territorio y «Solo mis concesiones» (si es KAM). Cambiar un filtro recalcula todo al instante, en el navegador.
2. **Indicadores:** tarjetas con Promociones, Convocadas, % aceptación, % activación, Cupos, Usos, % cupos gastados y GSV.
3. **Comparativa:**
   - selector «Agrupar por»: Promoción, KAM, Territorio, Concesión, Espacio, Marca, Canal o Mes de inicio;
   - selector «Indicador del gráfico»: GSV, Usos, % cupos gastados, % aceptación, % activación o Convocadas;
   - **barras horizontales** de una sola serie y un solo color (`--color-primario`), sin leyenda, ordenadas de mayor a menor; muestra las 15 primeras y el resto se ve en la tabla;
   - debajo, la **tabla ordenable** (pieza `useOrden` existente) con todas las métricas de §3 por grupo;
   - un botón «Exportar a Excel» descarga esa tabla.
4. **Evolución mensual:** dos gráficos de **barras verticales** por mes de inicio de la promoción. Uno de GSV y otro de Usos, separados porque nunca se usan dos escalas en un gráfico. Una sola serie cada uno.
5. **Estados vacíos:** «No hay datos con estos filtros».

## 5. Reglas de gráficos (guía dataviz)
- Barras finas con extremo redondeado de 4 px apoyado en la línea base, y 2 px de separación entre barras.
- Rejilla y ejes discretos. Textos con los colores de texto, nunca con el de la serie.
- Etiqueta de valor directa solo en la barra mayor y al pasar el ratón.
- **Información al pasar el ratón** en cada barra: grupo y valor formateado. La zona sensible es más grande que la barra.
- Accesible: cada gráfico tiene `role="img"` con `aria-label` resumen, y la tabla es la vista alternativa.
- Formato con `fmtEntero` / `fmtImporte` / `fmtPct`.
- HTML/SVG propio, sin librerías.

## 6. Fuera de alcance
- Socios externos.
- Informes programados o por email.
- Comparar dos periodos lado a lado (se puede hacer con los filtros de fecha).
- Gráficos de varias series.
