# Diseño — Afinado visual y tablas ordenables

Fecha: 2026-10-30. Va sobre la web en producción (v1 + páginas de inicio). No cambia datos ni permisos: solo presentación y ordenación. La siguiente fase será la pestaña de datos y análisis (diseño aparte).

Marcas: sin marca = lo pidió o aprobó la usuaria; **[decisión de Claude]** = lo decidí yo y puede corregirse.

## 1. Intención y por qué

La usuaria quiere «afinar el diseño, revisando todos los elementos y tablas para asegurar que todo está perfecto» y que **las tablas sean ordenables**. Se revisaron en local las 10 pantallas a 1366 px como KAM y como administrador; la usuaria aprobó la lista de problemas resultante (§3).

Estilo: limpio y coherente con lo que ya hay. **No** se aplica identidad de marca de Pedidos Ahora (no se pidió) **[decisión de Claude]**.

### Anti-objetivos
- Cambiar comportamiento, datos, permisos o textos de negocio más allá de lo listado.
- Romper la tabla de seguimiento (AG Grid), que ya ordena y tiene edición, bloqueo por versión y selección.

## 2. Tablas ordenables

Aplica a las 13 tablas HTML (`<table className="tabla">`):
- **Inicio:** Mis concesiones, lista de tareas, tareas por KAM y ranking.
- **Listas de promociones:** TMICC, UFS, Campañas y Todos (un mismo componente).
- **Ficha de concesión:** sus promociones.
- **Administración:** promociones, concesiones, usuarios, permisos y convocatoria.
- **Importar:** las dos tablas de la vista previa.

La tabla de seguimiento (AG Grid) ya ordena; no se toca.

Comportamiento:
- Pulsar una cabecera ordena por esa columna ascendente; volver a pulsarla, descendente; una tercera vez vuelve al orden por defecto de la tabla **[decisión de Claude: tres estados]**.
- La columna ordenada muestra ▲ o ▼, y la cabecera lleva `aria-sort`. Las cabeceras ordenables son botones accesibles con el teclado.
- **Comparación:** texto con `localeCompare('es')` sin distinguir mayúsculas; números como números; fechas por fecha; vacíos («—», `null`) siempre al final en los dos sentidos **[decisión de Claude]**.
- El orden por defecto de cada tabla es el que tiene hoy (p. ej. ranking por % cupos desc; tareas por KAM por «Sin respuesta» desc).
- Las columnas de acciones (botones Editar, select de estado, etc.) no se ordenan.
- En «Mis concesiones», la columna de etiquetas no se ordena; sí «Concesión».
- El orden no se guarda entre visitas **[decisión de Claude]**.
- Una única pieza reutilizable para todas: p. ej. un hook `useOrden(filas, columnas, ordenPorDefecto)` y un componente de cabecera ordenable, con sus tests.

## 3. Afinado visual (lista aprobada)

**Toda la web**
1. **Ancho de página uniforme:** todas las páginas usan el mismo contenedor, centrado, con ancho máximo de unos 1280 px **[decisión de Claude: valor]**.
2. **Etiquetas de filtros y campos** a un tamaño legible: mínimo 13 px, el mismo en toda la web.
3. **Acciones de tablas con un solo estilo:** botón secundario pequeño en todas (Editar, Convocatoria, Desactivar…). Los enlaces subrayados quedan solo para navegar a otra página (TAG, concesión).
4. **Separador de miles siempre** en números e importes («1.260,00 €», «1.234»). Un único formateador compartido para enteros, importes y porcentajes, usado en toda la web **[decisión de Claude: se aparta a propósito de la norma española de no agrupar 4 cifras, para que las columnas se lean igual]**.

**Pantalla de promoción**

5. **Cabecera de indicadores en una fila:** las 11 tarjetas pasan a 3 grupos compactos en una sola fila a 1366 px **[decisión de Claude]**:
   - Participación: Convocadas, Presentadas, Activas, Pendientes.
   - Porcentajes: % aceptación, % pendientes, % rechazo, % activación.
   - Resultados: Cupos, Usos, GSV.
6. **Tabla de seguimiento sin hueco vacío:** el alto se ajusta al número de filas (`domLayout: 'autoHeight'`) hasta unas 20 filas; por encima conserva alto fijo con scroll **[decisión de Claude]**.
7. **Sin cabeceras ni cifras cortadas:** cabeceras «% cupos» y «GSV/uso», ancho mínimo de columna suficiente para «12.345,67 €», y `title`/tooltip con el valor completo si aun así no cabe.
8. **La ficha lateral no encoge la tabla:** se abre como panel superpuesto a la derecha (encima de la tabla, con sombra y botón Cerrar). La tabla mantiene su ancho y todas sus columnas **[decisión de Claude]**.

**Ficha de concesión**

9. Enlace «← Volver» que regresa a la página anterior, o al inicio si se entró directamente.
10. **Columnas de la tabla:** TAG, Espacio, **Estado en la promoción**, Cupos, Usos, **% cupos** (con el aviso ⚠ como en el resto) y GSV.

**Administración**

11. **Promociones:** el TAG enlaza a la promoción, y se añaden las columnas Mecánica y Vigencia (inicio – fin).
12. **Concesiones, usuarios y permisos:**
    - el formulario de alta queda plegado tras un botón «Añadir concesión», «Añadir usuario» o «Añadir permiso» y se abre encima de la tabla;
    - concesiones y usuarios tienen un buscador que filtra la tabla al escribir (concesiones: código, razón social y nombre comercial; usuarios: nombre y email) **[decisión de Claude: campos]**.
13. **Usuarios:** el rol se muestra como «Administrador», «KAM» o «Socio»; «Activo» como Sí/No (ya es así).
14. **Nueva / editar promoción:** formulario en dos columnas con grupos titulados:
    - Identificación: TAG, Espacio y Marca;
    - Contenido: Mecánica, Objetivo y Canal;
    - Fechas: inicio y fin en la misma fila;
    - Cupos: umbral y revisión.

    Los campos obligatorios se marcan con *: TAG siempre; mecánica y fechas para publicar, con una nota. Los botones Guardar y Publicar no cambian de comportamiento.

**Importar**

15. **Selección de archivo:**
    - el selector se sustituye por una zona «Arrastra el Excel aquí o pulsa para elegirlo», que muestra el nombre del archivo elegido;
    - bajo «Tipo de importación», una línea de ayuda por tipo **[decisión de Claude: textos]**:
      - Catálogo: «Excel con columnas ID, CONCESION, KAM PRO, TERRITORIO».
      - Usos y GSV: «Exportación de la plataforma con Id, Concesión, Tag, Usos, GSV y Fecha actualización».
      - Histórico: «Hoja de seguimiento por bloques (una promoción por bloque). Solo se lee la primera hoja del libro».

## 3bis. Precisiones (tras la revisión del documento) **[decisiones de Claude]**

- **Editar en concesiones y usuarios:** «Editar» abre el mismo panel plegable de §3.12, ya relleno y con el título «Editar concesión» o «Editar usuario». Es un único componente con dos modos. Buscar y ordenar siguen funcionando mientras se edita.
- **Qué se ordena y por qué valor:** todas las columnas de datos son ordenables y no lo son las de acciones ni las de chips.
  - «% cupos» se ordena por el porcentaje numérico.
  - «Vigencia» se ordena por la fecha de inicio.
  - Convocatoria se ordena por concesión, KAM, territorio y estado.
  - Las dos tablas de la vista previa de Importar también se ordenan, con el orden por defecto por número de fila.
- **Panel superpuesto (§3.8):**
  - ocupa unos 380 px a la derecha;
  - la fila seleccionada queda resaltada;
  - pulsar otra fila visible cambia la ficha;
  - Esc o «Cerrar» lo cierran.
- **Alto de la tabla de seguimiento (§3.6):**
  - con 20 filas o menos, `domLayout = 'autoHeight'`;
  - con más, `normal` con un alto fijo de unos 640 px y cabecera fija;
  - el modo de pruebas actual se mantiene para los tests.
- **Formateador (§3.4):**
  - enteros sin decimales;
  - importes con 2 decimales;
  - porcentajes sin decimales, como ahora;
  - vacío = «—» en toda la web.
- **Ficha de concesión (§3.10):** se pueden cambiar las consultas de la web (añadir cupos, umbral, etc. al `select`). No hay cambios en el esquema de la base de datos.

## 4. Restricciones
- Mismo stack (React 18 + TS + Vite, AG Grid Community 36, CSS en `src/app/estilos.css`). Sin librerías nuevas de UI **[decisión de Claude]**.
- Sin cambios en la base de datos ni en permisos.
- Los tests existentes siguen pasando; los que dependan de textos o estructura cambiados se actualizan, sin borrar lo que comprueban.
- Comprobación visual final en local a 1366 px como KAM y como administrador, pantalla por pantalla.

## 5. Lo que queda en manos de quien construya
- Valores exactos de espaciado, sombras y tamaños dentro de lo dicho.
- Si el hook de orden vive en `src/app/comun/` u otra carpeta compartida.
- Iconos ▲/▼ como texto o CSS.
