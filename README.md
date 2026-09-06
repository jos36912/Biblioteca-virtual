# Portfolio

Una web personal profesional de una sola página, con diseño oscuro y contenido **data-driven**: el contenido vive en una fuente estructurada (Supabase) y se administra desde un **panel de administración** en la web. El sitio público consume esa fuente y la renderiza; nada se edita directamente en el HTML.

## Características actuales

- Una sola página con navegación por secciones (Inicio, Sobre mí, Hoja de vida, Proyectos, Habilidades, Contacto, Reclutador).
- Tema oscuro con identidad visual propia: acento cyan desaturado ("cyan sereno"), capas de fondo (ruido sutil + grid técnico enmascarado), micro-interacciones de hover (elevación y glow) y animación de entrada por scroll. Respetan `prefers-reduced-motion` y no interfieren con los carruseles.
- Contenido persistido en **Supabase** (base de datos con RLS) con respaldo en `data/content.json`.
- **Visibilidad segmentada por ítem**: cada fila de CV/educación/proyectos/habilidades y cada campo de perfil/contacto puede ser `public`, `recruiter` o `private`.
- **Acceso para reclutadores por token temporal**: una sección pública permite ingresar un token; al validarlo el sitio re-renderiza el contenido ampliado fusionado en sus secciones y marca con una franja verde neón los ítems exclusivos de reclutador. La sesión dura 24 horas (o lo que defina el token) y se puede desactivar manualmente. Si el token se revoca, el sitio lo detecta en segundo plano (~60 s o al volver a la pestaña) y oculta el contenido ampliado sin recargar.
- **Certificaciones**: dos carruseles infinitos — **"Certificados Tech"** (arriba, si hay certificaciones marcadas como tech en el panel) y el resto debajo. Se desplazan de derecha a izquierda con difuminado en ambos extremos; la tarjeta que pasa por el centro se agranda (efecto foco). Puedes **arrastrarlos** (ratón o táctil) en ambas direcciones; al soltar el carrusel se detiene donde lo dejes (se centra suavemente si sueltas una tarjeta cerca del medio) y tras ~5 s de inactividad vuelve a girar solo; cualquier interacción (arrastrar, tocar fuera) lo reanuda antes. Al posar el cursor se detienen y la tarjeta señalada crece. El botón **"Mostrar certificación"** abre un modal con la vista previa del adjunto (imagen o PDF) y su descarga. Para reclutadores añade el ID de credencial. La visibilidad del adjunto se controla de forma independiente en **Medios** (`public` lo ve cualquiera; `recruiter`/`private` solo quien valide el token de reclutador).
- **Media Gateway (Cloudflare R2)**: los archivos se guardan en un bucket privado y se entregan por URLs temporales firmadas (TTL 60 s) que el servidor genera tras validar la visibilidad. El navegador nunca ve la URL real del almacenamiento.
- Panel de administración con inicio de sesión protegido (Supabase Auth).
- Módulos del panel completos: **Perfil**, **Experiencia**, **Educación**, **Certificaciones**, **Proyectos**, **Habilidades**, **Contacto**, **Medios** y **Tokens** (crear, editar y eliminar).
- Generación de tokens de reclutador desde el panel: etiqueta, duración en horas, revocación manual y estado en vivo.
- Subida de archivos (PDF, imágenes, etc.) desde el panel con visibilidad por activo.
- Script `sync-content.py` para regenerar `data/content.json` desde Supabase, automatizado con **GitHub Actions** (se regenera solo en cada push y a diario).
- Favicon propio (`assets/darkness.ico`).
- Compatible con dispositivos móviles y escritorio.
- **Dos sitios en una plataforma (multiperfil)**: el sitio actual (perfil tecnológico) y **`trayectoria/`** — separación profesional por narrativa. Ambos comparten panel, Supabase, RLS, Media Gateway y tokens; `script.js` es parametrizable por `window.SITE_CONFIG` (secciones, título, contexto y fuente de datos), así que ambos sitios usan el mismo motor de render. Trayectoria tiene tema propio: layout amplio de escritorio y fondo con **gráficos vectoriales por capas** (radiancias + esquema de ruta + línea de tiempo). El contenido se clasifica por **`context`** (`tech`/`trayectoria`/`ambos`, ver `supabase/multisite.sql`): es presentación, no frontera de seguridad — RLS sigue filtrando por `visibility`. El panel de administración incluye **selector de contexto**: en Perfil/Contacto eliges el sitio a editar y cada registro de las listas muestra un badge y filtro por sitio.
- El respaldo `data/content.json` se normaliza igual que la carga de Supabase (`profile`/`contact` como listas por contexto se resuelven a la fila del sitio activo), así el fallback renderiza el sitio completo aunque Supabase no esté disponible.

## Versionado

El sitio usa el estándar **SemVer**: `MAJOR.MINOR.PATCH` con sufijo de pre-release cuando aplica. La versión actual es **`0.10.0-beta.10`** y se muestra en el pie de página de `index.html` (único lugar visible; el workflow de `content.json` no lo toca).

- **MAJOR** sube con cambios que rompen lo anterior o al alcanzar la versión estable `1.0.0`.
- **MINOR** sube al agregar funcionalidades nuevas (`0.9.0` → `0.10.0`).
- **PATCH** sube con correcciones de errores (`0.9.0` → `0.9.1`).
- **Pre-release**: las etapas siguen el orden `alpha < beta < rc < estable`; los números de candidato se incrementan por build (`0.9.0-beta.1` → `0.9.0-beta.2`). La versión `0.9.0` estable llega cuando se decide liberar el candidato beta.
- En git cada release se marca con un tag con prefijo `v` (`v0.9.0-beta.1`); la "v" es convención de tags, no parte del estándar.

## Licencia

- **Código** (`script.js`, `style.css`, `admin/`, Edge Functions, `supabase/*.sql`, workflows, `sync-content.py`, etc.): licencia **MIT** (ver `LICENSE`). Puedes reutilizarlo con atribución.
- **Contenido personal — todos los derechos reservados**: `data/content.json` (CV, textos y datos personales), fotografías, certificados adjuntos, la marca y el diseño visual de esta web no pueden reutilizarse ni distribuirse sin permiso expreso. El código MIT no autoriza a copiar el contenido que esta web muestra.
- Las librerías vendored (`assets/vendor/supabase-js.min.js`, `assets/vendor/sha256.js`) conservan sus propias licencias de terceros.

## Próximas mejoras (futuras versiones)

- Ocultar por completo el origen de R2 mediante streaming en Cloudflare Workers (ver `cambios/adr-media-gateway.md`).

## Estructura del proyecto

```
assets/            Recursos estáticos (favicon, imágenes, vendor).
assets/vendor/     Bibliotecas de terceros (ej. sha256.js para hash de tokens).
data/content.json  Respaldo del contenido (el sitio usa Supabase primero).
index.html         Esqueleto mínimo del sitio.
script.js          Carga el contenido (Supabase → fallback content.json) y renderiza.
style.css          Estilos y tema oscuro.
supabase-config.js Configuración compartida de Supabase (URL + anon key).
supabase/schema.sql  Esquema de la base de datos (tablas, RLS, vistas y funciones RPC).
supabase/security-hardening.sql   Endurecimiento de RLS (aprestado sobre schema.sql).
supabase/multisite.sql  Migración F1 (0.10.0): context por fila + perfil/contacto por sitio (aplicar en el SQL editor).
supabase/config.toml Configuración del CLI (funciones edge: media-gateway, media-upload, media-delete).
supabase/functions/  Edge Functions (Media Gateway + admin de medios, sin dependencias externas).
supabase/.env.local  Secrets locales para probar las funciones (gitignored).
sync-content.py      Regenera data/content.json con los datos actuales de Supabase.
admin/             Panel de administración (login + panel), en carpeta separada.
admin/index.html   Página del panel (se accede en /admin/).
admin/admin.js     Lógica de sesión, login y módulos del panel.
admin/admin.css    Estilos del panel de administración.
trayectoria/       Segundo sitio: "Trayectoria profesional" (recorrido laboral y formación).
trayectoria/index.html   Página del sitio Trayectoria (configura `window.SITE_CONFIG` y reutiliza `script.js`).
trayectoria/trayectoria.css  Tema propio de Trayectoria: layout amplio de escritorio + fondo vectorial por capas.
.github/workflows/ Automatización con GitHub Actions (regenera data/content.json).
cambios/           Informes y propuestas de evolución del proyecto.
```

## Tecnologías

- HTML5
- CSS3
- JavaScript
- Supabase (Auth, Postgres/PostgREST con RLS, Edge Functions)
- Cloudflare R2 (almacenamiento privado de archivos con URLs temporales firmadas)
- GitHub Actions

## Visibilidad del contenido

Cada elemento de contenido define quién puede verlo:

| Nivel       | Visible para                                     |
|-------------|--------------------------------------------------|
| `public`    | Cualquier visitante                              |
| `recruiter` | Solo quien valide un token de reclutador válido  |
| `private`   | Solo desde el panel de administración            |

- **Listas** (experiencia, educación, proyectos, habilidades): la columna `visibility` se elige por fila.
- **Perfil y contacto**: cada campo tiene su propia visibilidad (`name_visibility`, `role_visibility`, `email_visibility`, …).
- El sitio público solo recibe contenido público (vistas `profile_public`/`contact_public` que enmascaran campos y RLS que filtra filas). El contenido ampliado se sirve **exclusivamente** a través del RPC `get_recruiter_content` cuando hay una sesión válida; ocultar en JavaScript no es el mecanismo de seguridad, sino el control de acceso del lado servidor.

## Acceso para reclutadores

1. En el panel, el propietario genera un token (módulo **Tokens**) con etiqueta y duración; el token se muestra una sola vez y se entrega al reclutador por un canal privado.
2. En el sitio, la sección **Reclutador** pide el token.
3. Al validarlo, el sitio re-renderiza el contenido ampliado dentro de sus secciones existentes (volviendo al inicio) y los ítems exclusivos de reclutador aparecen con una franja verde neón en el borde superior.
4. La sesión queda guardada en el navegador hasta su expiración (24 h por defecto o el vencimiento del token). Un botón **Desactivar acceso** vuelve al modo público.
5. Los tokens caducan automáticamente y pueden revocarse desde el panel en cualquier momento.

### RPCs del lado servidor

- `validate_recruiter_token(p_token)` — valida un token y abre una sesión temporal (`access_sessions`).
- `get_recruiter_content(p_session_token)` — devuelve el contenido ampliado (`public` + `recruiter`) solo para una sesión válida y no revocada.
- `get_media_asset(p_asset_id, p_session_token)` — autoriza la entrega de un archivo por visibilidad (la usa el Media Gateway; el frontend no la invoca).

Los tokens y las sesiones se almacenan como **SHA-256 de los bytes** del valor entregado; nunca en texto plano (ver `SECURITY.md`).

## Media Gateway y archivos

Los archivos viven en un bucket privado de Cloudflare R2. El flujo de entrega:

```
Frontend (GitHub Pages)
   │  GET media-gateway?asset_id=…&session_token=…
   ▼
Edge Function media-gateway → RPC get_media_asset (valida visibilidad)
   │  302 a presigned URL (TTL 60 s, SigV4 con Web Crypto)
   ▼
Cloudflare R2 (bucket privado)
```

- `media-gateway`: entrega archivos con URLs temporales firmadas (públicos y de reclutador).
- `media-upload` / `media-delete`: usados por el panel para subir y borrar objetos (requieren sesión de admin).
- El panel **Medios** sube el archivo (las imágenes se comprimen a WebP en el navegador, máx. 1600 px, calidad 0.8), y la certificación o proyecto lo enlaza por `media_asset_id`.
- Desplegar las funciones (requiere `supabase login` y CLI):
  ```bash
  supabase link --project-ref <ref>
  supabase secrets set R2_ENDPOINT=… R2_BUCKET=… R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=…
  supabase functions deploy media-gateway media-upload media-delete --use-api
  ```
  El flag `--use-api` bundlea del lado servidor y evita el bundler local.

## Panel de administración

El panel está en la carpeta `admin/` (se accede en `/admin/`) y solo permite entrar con una sesión válida de Supabase (correo + contraseña). Se comunica con los recursos compartidos mediante rutas relativas (`../`).

### Configuración en Supabase

1. Crear un proyecto en [supabase.com](https://supabase.com) y copiar el *Project URL* y la *anon public key* en `supabase-config.js`.
2. En **Authentication → Providers → Email**: habilitar el inicio de sesión con correo y contraseña.
3. Crear tu usuario en **Auth → Users** con tu correo.
4. Desactivar el sign-up público para que solo tú puedas registrarte/entrar.
5. En **SQL Editor**, ejecutar el contenido de `supabase/schema.sql` para crear las tablas, las políticas RLS y los datos iniciales.

La `anon key` es pública por diseño y es segura para el navegador. La `service_role key` jamás debe usarse en el cliente.

### Políticas de acceso (RLS)

- **Público (anon)**: solo puede leer (`select`) el contenido.
- **Administrador (authenticated)**: puede crear, leer, actualizar y eliminar. Como el sign-up público está desactivado, `authenticated` es únicamente tu usuario.

## Instalación / Uso local

El sitio usa `fetch`, así que debe servirse por HTTP:

```bash
python3 -m http.server
```

Luego abre `http://localhost:8000` en tu navegador.

## Cómo se administra el contenido

El contenido se edita desde el panel (`/admin/`) y se guarda en Supabase. El sitio público intenta leer de Supabase y, si no está disponible, usa `data/content.json` como respaldo.

Para que el respaldo refleje los últimos cambios del panel, `content.json` se regenera **automáticamente** mediante GitHub Actions (workflow `.github/workflows/sync-content.yml`), que se ejecuta en cada push a `main`/`portfolio`, a diario (cron) o manualmente desde la pestaña *Actions*. Si prefieres regenerarlo a mano:

```bash
python3 sync-content.py
```

El script lee las tablas (profile, experience, education, projects, skills, contact, certifications, media_assets) con la anon key de `supabase-config.js` y conserva las secciones estáticas (`site` y `sections`). Solo descarga contenido público: profile y contact se leen desde las vistas `profile_public`/`contact_public`, certifications desde `certifications_public`, las tablas de listas aplican RLS (anon solo ve filas `public`) y `media_assets` se lee desde la vista `media_assets_public` (metadatos sin `object_key`); los archivos se sirven por el Media Gateway, nunca en bruto.
