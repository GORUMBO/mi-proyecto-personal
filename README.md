# Mi Proyecto Personal

App personal **offline-first** (PWA) con sincronización opcional entre **Windows y iPhone** mediante Supabase.

🌐 **App en vivo:** https://rubenalanfloo-art.github.io/mi-proyecto-personal/

## Características

- Funciona sin conexión gracias al *service worker* (`sw.js`) y es instalable como PWA (`manifest.webmanifest`).
- Sincronización opcional en la nube con Supabase (respaldo de datos y almacenamiento de fotos privado por usuario).
- Bloqueo con PIN y soporte de passkey / Face ID.
- Funciones opcionales de IA (introduces tu propia API key en la app; no se guarda ninguna clave en el código).

## Uso

### Como web (GitHub Pages)
Abre directamente https://rubenalanfloo-art.github.io/mi-proyecto-personal/ e instálala desde el navegador si quieres tenerla como app.

### Como app de escritorio (Electron)
```bash
npm install
npm start          # abrir en modo desarrollo
npm run build:win  # generar instalador para Windows
```

## Sincronización con Supabase (opcional)

1. Crea un proyecto en [Supabase](https://supabase.com).
2. Ejecuta una sola vez el archivo [`CONFIGURAR-SUPABASE.sql`](./CONFIGURAR-SUPABASE.sql) en **SQL Editor** (crea la tabla de respaldos, el bucket de fotos y las políticas de Row Level Security).
3. En la app, dentro de *Ajustes → Nube*, introduce la URL del proyecto, la clave *publishable*, tu correo y contraseña.

> La clave `sb_publishable_` es pública por diseño; el acceso a los datos está protegido por **Row Level Security**, de modo que cada usuario solo puede leer y escribir su propia información.

## Estructura

| Archivo | Descripción |
|---|---|
| `index.html` | Aplicación completa (UI + lógica). |
| `sw.js` | Service worker (caché offline). |
| `manifest.webmanifest` | Manifiesto PWA. |
| `main.js`, `preload.js` | Empaquetado Electron para escritorio. |
| `CONFIGURAR-SUPABASE.sql` | Esquema y políticas de la base de datos. |

## Licencia

Uso personal (UNLICENSED).
