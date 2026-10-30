# Puesta en marcha y copia de seguridad

Guía paso a paso para publicar la aplicación con coste 0 €/mes. Los pasos con cuentas, claves y contraseñas los haces tú.

Requisitos: acceso admin al Google Workspace `pro.agency`, una cuenta de Supabase, una de Cloudflare y una de GitHub (todas con plan gratuito).

---

## 0. Condiciones gratuitas (comprobadas el 28/10/2026)

"Hecho" = lo dice la documentación oficial. "Inferencia" = conclusión a partir de ella.

| Servicio | Condición | Tipo | Fuente |
|---|---|---|---|
| Supabase Free | Pausa si hay poca actividad en la base de datos durante 7 días; restaurable desde Studio durante 90 días | Hecho | https://supabase.com/docs/guides/platform/free-project-pausing |
| Supabase Free | 500 MB de base de datos, 5 GB de egress, 50.000 MAU, 1 GB de storage, 2 proyectos gratuitos | Hecho | https://supabase.com/docs/guides/platform/billing-on-supabase |
| Supabase Free | Sin copias diarias automáticas (solo Pro o superior). La documentación recomienda exportar con `db dump` y guardar fuera | Hecho | https://supabase.com/docs/guides/platform/backups |
| Supabase Auth | El proveedor de email integrado envía como máximo 2 emails por hora en todo el proyecto | Hecho | https://supabase.com/docs/guides/auth/rate-limits |
| Cloudflare Pages Free | 500 builds/mes, 1 build simultáneo, 20 min por build, 20.000 archivos por sitio, 25 MiB por archivo | Hecho | https://developers.cloudflare.com/pages/platform/limits/ |
| Cloudflare Pages Free | Peticiones a estáticos gratuitas e ilimitadas | Hecho | https://developers.cloudflare.com/pages/functions/pricing/ |
| Cloudflare Pages Free | Uso comercial: la documentación técnica consultada no lo prohíbe ni lo autoriza expresamente | **No verificado** | https://www.cloudflare.com/plans/ (revisar términos de servicio) |
| GitHub Free (repo privado) | 2.000 minutos/mes de Actions y 500 MB de artefactos y paquetes | Hecho | https://docs.github.com/en/billing/managing-billing-for-your-products/managing-billing-for-github-actions/about-billing-for-github-actions |
| GitHub Actions | Logs y artefactos se conservan 90 días por defecto | Hecho | https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts |
| GitHub Actions | En repos públicos los workflows programados se desactivan tras 60 días sin actividad; la página no dice nada de los privados | Hecho / sin dato | https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows |

### Lo que puede romper el coste cero

1. **Pausa de Supabase por inactividad (riesgo real).** Si nadie usa la app en 7 días, el proyecto se pausa y la app deja de funcionar hasta restaurarlo a mano. Mitigación: la copia semanal (sección 6) consulta la base de datos cada lunes y jueves, lo que por inferencia cuenta como actividad. La documentación no lo garantiza; compruébalo las primeras semanas. Si se pausara, restaurar es gratis (90 días de margen).
2. **Emails de Auth: 2 por hora.** Solo afecta si se usan enlaces mágicos, OTP o confirmaciones por email. El acceso previsto es con Google, que no envía emails. No uses login por email en producción; si hiciera falta, habría que configurar un SMTP propio.
3. **Sin copias automáticas en Free.** Por eso existe la copia semanal. El artefacto vive 90 días en GitHub; descarga un volcado de vez en cuando a un sitio de la agencia.
4. **Uso comercial en Cloudflare Pages: sin confirmar.** Es una herramienta interna de una agencia. Lee los términos de Cloudflare; si lo restringieran, la alternativa es otro alojamiento estático gratuito, sin tocar el código.
5. **500 MB de base de datos.** Revisa el tamaño de vez en cuando (Supabase > Reports > Database). Para este volumen debería sobrar (inferencia).

Nada de esto obliga a pagar hoy. Los puntos 1 y 4 son los que hay que vigilar.

---

## 1. Crear el proyecto Supabase

1. Entra en https://supabase.com y crea un proyecto nuevo.
2. Región: **EU** (West EU - Ireland o Frankfurt). Plan: Free.
3. Guarda la contraseña de la base de datos en el gestor de contraseñas.
4. De Project Settings > API apunta:
   - **Project URL** (será `VITE_SUPABASE_URL`).
   - **anon public key** (será `VITE_SUPABASE_ANON_KEY`). Es pública por diseño. Nunca uses la `service_role` en la web.
5. Apunta el **Project ref** (el código de la URL del dashboard).

## 2. Aplicar las migraciones (0001 a 0010)

Desde la carpeta del proyecto:

```bash
npx supabase login
npx supabase link --project-ref <PROJECT_REF>
npx supabase db push
```

`db push` pide la contraseña de la base de datos y aplica las 10 migraciones de `supabase/migrations`. Después, `npx supabase migration list` debe mostrar las 10 aplicadas en local y remoto.

No ejecutes `supabase/seed.sql`: son datos de desarrollo.

**Producción actual** (proyecto `itrvdvnvfsstvmcpsjfq`): las migraciones 0001–0011 se aplicaron con la herramienta `apply_migration` del conector de Supabase, no con `db push`, así que en el historial remoto figuran con versión de fecha y no como `0001…0011`. Si algún día usas `db push`, revisa antes `npx supabase migration list` para no reaplicarlas.

- 0011 (páginas de inicio) aplicada el 30/10/2026.
- Comprobado: ninguna fila de `seguimiento` sin `cupos_revisado_en` (490 de 490), y `v_inicio_filas` con 455 filas (= seguimiento de promociones publicadas).
- Orden para futuras migraciones que cambien lo que lee la web: **primero la migración y después el push de `main`**. Si la web nueva se publica antes, falla al no encontrar la vista o la columna.

## 3. Primer administrador

Solo entran emails dados de alta en `perfiles`. Al iniciar sesión con Google por primera vez, el sistema vincula el perfil con el usuario si el email coincide y está confirmado.

En Supabase > SQL Editor ejecuta, cambiando los valores:

```sql
insert into perfiles (email, nombre, rol)
values ('TU.EMAIL@pro.agency', 'TU NOMBRE', 'admin');
```

Los perfiles internos (`admin` y `kam`) deben tener email `@pro.agency`; la base de datos lo exige. Cuando entres como admin, da de alta al resto (administradores y los 7 KAM) con sus emails, desde la aplicación o con el mismo `insert` usando `'kam'`.

## 4. Ajustes de autenticación de producción (obligatorios)

Surgen de un hallazgo de seguridad de la revisión del código. En local están en modo pruebas; en producción hay que fijarlos a mano en el dashboard de Supabase > Authentication:

1. **Confirmación de email activada** (proveedor Email > "Confirm email" ON). Sin esto, alguien podría registrarse con el email de otra persona y quedar vinculado a su perfil.
2. **Proveedor Email desactivado** (Authentication > Providers > Email: déjalo apagado, o sin registro). **Mantén "Allow new users to sign up" ACTIVADO.** Ese ajuste también afecta a los usuarios de Google (OAuth) y la vinculación del perfil necesita que el usuario de acceso se cree en el primer login; si lo apagas, es probable que ningún KAM pueda entrar por primera vez (inferencia, no verificado en un proyecto real). La restricción de dominio no viene de este ajuste sino de la pantalla de consentimiento "Interno" de Google (paso 3 y sección 5). Un desconocido sin perfil no ve nada: las políticas RLS solo dejan leer a quien tiene un perfil activo.
3. **Google restringido al Workspace**: pantalla de consentimiento "Interno" (sección 5).
4. **URL Configuration**:
   - Site URL: `https://seguimiento-promos-claude.pedidosahora-pro.workers.dev`
   - Redirect URLs: `https://seguimiento-promos-claude.pedidosahora-pro.workers.dev/**` (y `http://localhost:5173/**` si quieres seguir probando en local).

## 5. Google OAuth (Workspace interno)

1. En https://console.cloud.google.com crea un proyecto con la cuenta del Workspace `pro.agency`.
2. APIs y servicios > **Pantalla de consentimiento de OAuth**: tipo de usuario **Interno**. Solo podrán entrar cuentas de `pro.agency`. Rellena nombre de la app y email de contacto.
3. Credenciales > Crear credenciales > **ID de cliente de OAuth** > Aplicación web.
   - URI de redireccionamiento autorizado: `https://<PROJECT_REF>.supabase.co/auth/v1/callback`
4. Copia el Client ID y el Client Secret.
5. En Supabase > Authentication > Providers > **Google**: actívalo y pega ambos valores.

Atención: los usuarios con rol `socio` no son del Workspace y no podrían entrar con un consentimiento "Interno". Si habrá socios con acceso, hay que decidir con ellos otro método de acceso antes de abrir (queda fuera de esta guía).

## 6. Copia de seguridad semanal (GitHub Actions)

El workflow `.github/workflows/copia-seguridad.yml` vuelca datos y esquema los lunes y jueves a las 05:00 UTC y los guarda como artefacto 90 días. Al consultar la base de datos dos veces por semana, probablemente ayuda también a mantener activo el proyecto (inferencia, ver sección 0, punto 1).

1. Sube el repositorio a GitHub como repositorio **privado** (contiene datos de clientes en las copias).
2. En Supabase, botón **Connect**, copia la cadena de conexión del *Session pooler* (la conexión directa es IPv6 y los runners de GitHub pueden no soportarlo) con tu contraseña de base de datos.
3. En GitHub: Settings > Secrets and variables > Actions > **New repository secret**:
   - Nombre: `SUPABASE_DB_URL`
   - Valor: la cadena `postgresql://postgres.<ref>:<CONTRASEÑA>@...`
4. Prueba: pestaña **Actions** > "Copia de seguridad semanal" > **Run workflow**. Debe terminar en verde y mostrar el artefacto `copia-seguridad-<id>` con `datos.sql` y `esquema.sql`.
5. **Restaurar** (si hiciera falta): crea un proyecto Supabase nuevo, aplica `npx supabase db push` y carga los datos como se explica a continuación.

`datos.sql` incluye también los datos del esquema `auth` (comprobado en local: con un usuario de prueba aparece su `INSERT INTO "auth"."users"`), además de `supabase_functions`. Por eso:

- Restaurar en el **mismo proyecto** debería funcionar, pero **no se ha probado contra un proyecto real**. Pruébalo antes en un proyecto Supabase desechable.
- No cargues `datos.sql` entero en un proyecto **nuevo**: traería los usuarios de `auth` y podría chocar con objetos que Supabase ya gestiona.
- Para un proyecto nuevo, restaura solo `public`:
  1. Haz el volcado: `npx supabase db dump --db-url "<URL_ORIGEN>" --data-only --schema public -f datos-public.sql` (comprobado: sin datos de `auth`).
  2. Con el esquema ya creado en el proyecto nuevo (`npx supabase db push`), carga los datos: `psql "<URL_NUEVO>" -f datos-public.sql`.
  3. Ejecuta `update perfiles set user_id = null;`. Los `user_id` guardados apuntan a usuarios que ya no existen y el sistema solo vincula perfiles con `user_id` vacío.
  4. Cada usuario se vincula por email en su primer inicio de sesión en el proyecto nuevo (la vinculación ocurre al crearse o confirmarse su cuenta de acceso, no en cada login).

  Comprobado en local con una base de datos de prueba que emula el proyecto nuevo (`auth.users` vacío): la carga termina sin errores y las 12 filas de `seguimiento` se restauran. El archivo empieza con `SET session_replication_role = replica`, por eso la clave foránea de `perfiles.user_id` hacia `auth.users` no rechaza la carga aunque el usuario no exista. No se ha probado que el rol `postgres` de Supabase en la nube permita ese `SET`; si `psql` da error de permisos o de clave foránea, borra de `datos-public.sql` los valores de `user_id` de `perfiles` (ponlos a `NULL`) y repite.

Los artefactos de copia contienen datos personales y hashes de contraseña (`auth.users`) y se conservan 90 días: limita quién tiene acceso al repositorio y a su pestaña Actions.

Si la copia falla no avisa sola: mira la pestaña **Actions** de vez en cuando o activa los emails de fallo en GitHub (Settings > Notifications > Actions).

Mantén el repositorio privado: en repos públicos los workflows programados se desactivan tras 60 días sin actividad.

## 7. Cloudflare (Workers & Pages)

Producción actual: `https://seguimiento-promos-claude.pedidosahora-pro.workers.dev`, desplegada desde la rama `main` de `pedidosahora/seguimiento-promos-claude`. Cada push a `main` se publica solo.

1. En https://dash.cloudflare.com > Workers & Pages > Create > conecta el repositorio de GitHub.
2. Configuración de build:
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Variable `NODE_VERSION` = `24`
3. `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` van en el archivo `.env.production` del repositorio, no en el panel. Las variables del panel de un proyecto de Workers no llegan al build de Vite (comprobado: la web daba `supabaseUrl is required`). Los dos valores son públicos; nunca pongas ahí la `service_role` key ni la contraseña.
4. Vuelve a la sección 4 y pon la URL de producción en Site URL y Redirect URLs de Supabase.
5. Recargar una ruta interna (p. ej. `/promociones`) devuelve 200 (comprobado).

## 8. Carga inicial de datos

Orden obligatorio, desde el asistente de importación de la aplicación, entrando como admin:

1. Alta de administradores y de los 7 KAM con sus emails (sección 3).
2. **Catálogo**.
3. **Histórico**.
4. **Usos**.
5. **Comprobación de vinculación:** un KAM que nunca ha entrado inicia sesión con Google y ve sus concesiones. Si ve la pantalla "Tu cuenta no tiene acceso", revisa que el email de su perfil coincide con el de su cuenta de Google y que "Allow new users to sign up" está activado (sección 4).

No pases del paso 2 al 4 hasta que el anterior esté correcto: el histórico y los usos dependen del catálogo.

## 9. Prueba de humo

- Un KAM entra con su cuenta de Google `pro.agency` y ve su cartera.
- Edita una fila suya y guarda.
- Comprueba que NO puede editar una fila de otro KAM.
- Intenta entrar con un email externo (gmail): debe rechazarlo.
- Lanza a mano la copia de seguridad y confirma que aparece el artefacto.
