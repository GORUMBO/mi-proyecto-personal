# SYNC_ARCHITECTURE.md — Arquitectura de sincronización (documentada desde el código real)

> Documento de referencia. Describe ÚNICAMENTE lo que existe hoy en el código.
> No modificar nada de lo aquí descrito sin pasar por el protocolo de
> `DO_NOT_TOUCH.md`. Última revisión: v1.188.4 (2026-08-16).

## 1. Panorama general

```
iPhone (PWA, offline-first) ──┐
                               ├─> Supabase (PostgREST + Realtime, RLS) ──┐
Windows (Electron, archivos locales) ──┘          ▲                        ▼
                                                  │              Cloudflare Worker
                                                  └────────── (puente opcional, solo iPhone)
```

- Todo el estado vive en `state` (en `index.html`) y se guarda local-first
  (IndexedDB) antes de cualquier red.
- El respaldo completo viaja en **una fila por usuario** de la tabla
  `personal_backups` (PK `user_id`, columna `data jsonb` + `updated_at`).
- Las tablas por-ítem (`peso`, `comidas`, `calorias`, `proteina`, `ejercicios`,
  `pasos`, `gastos`, `ajustes`) existen para sync por elemento con `client_id`.
- El servicio worker (`sw.js`) **nunca** intercepta Supabase ni `version.json`.

## 2. Tablas y RLS (`CONFIGURAR-SUPABASE.sql`)

- Por-ítem: `id uuid pk`, `user_id uuid` (FK a `auth.users`), `client_id text`,
  `data jsonb`, `updated_at timestamptz default now()`, `deleted boolean`,
  `unique(user_id, client_id)`. Índice `(user_id, updated_at)`.
- `ajustes` y `personal_backups`: una fila por usuario, PK `user_id`.
- **RLS es la autoridad**: política `own_rows` en todas las tablas:
  `using (auth.uid() = user_id)` / `with check (auth.uid() = user_id)`.
- Storage: bucket privado `personal-media` con políticas por carpeta
  (`storage.foldername(name)[1] = auth.uid()::text`).

## 3. Cloudflare Worker (`cloudflare-worker.js`)

- URL de producción: `https://mi-proyecto-sync.rubenalanfloo.workers.dev`
  (se re-despliega manualmente pegando el archivo en el editor de Cloudflare).
- `WORKER_VERSION = '1.187.27'` — visible en TODAS las respuestas JSON.
- Rutas: `/auth/refresh` (renovación de sesión) y `/sync/<tabla>` con una
  lista blanca de 9 tablas (`TABLAS`). Cualquier otra ruta → 403.
- El JWT del usuario llega en `Authorization: Bearer` y **se reenvía TAL CUAL**:
  la firma la valida Supabase. El Worker solo decodifica `exp`/`sub`.
- **Nunca usa `service_role` ni contiene secretos** (solo la llave anon pública).
- Escrituras en `personal_backups`: verifica que el `user_id` del body coincida
  con `sub` del JWT (defensa en profundidad; RLS decide al final).
- Métodos: GET, POST y PATCH. Para `personal_backups` reenvía **PATCH
  `/rest/v1/personal_backups?user_id=eq.<sub>` con `Prefer: return=representation`**
  enviando SOLO `data` y `updated_at` (se elimina `user_id` del body). Si el
  PATCH no devuelve filas, cae al **upsert POST** (`on_conflict=user_id`,
  `Prefer: resolution=merge-duplicates,return=representation`).
- Quita parámetros que PostgREST rechazaría (p. ej. `&ts=` de anti-caché).
- La respuesta de Supabase DEBE ser JSON; si llega HTML (portal/filtro),
  responde `respuesta_invalida_de_supabase` 502 — la app lo trata como bloqueo.
- Respuesta exitosa incluye diagnóstico sin secretos: `workerVersion`, `sub`,
  `rowUserId`, `workoutLogCount`, `updatedAt`, query recibida/enviada, método.

## 4. Motor de sincronización (`index.html`)

- `cloudRest(path, options, _retried)` — peticiones REST con reintento único
  gestionado y desempaquetado `{ok, data}`.
- `cloudSave(silent)` (~línea 23470):
  1. **Lee primero** la fila real (`personal_backups?user_id=eq.<uid>&select=data,updated_at`).
  2. **Fusiona SIEMPRE antes de subir** (`mergeCloudStates`): la nube solo crece.
  3. Sube con el puente activo: **PATCH** (ver Worker); sin puente: **POST upsert**.
  4. **Relee** para verificar (`select=data,updated_at`); con puente, un
     **reintento a los 3 s** (la lectura inmediata puede traer copia rezagada).
  5. Éxito SOLO si el conteo releído ≥ enviado; si detecta varias filas
     `personal_backups` para el usuario → error explícito (no toca datos).
- `mergeCloudStates(local, remote)` (~línea 22915):
  - Base según `lastModified`/`updated_at` más reciente.
  - Arrays con `_mergeArrays`: **unión por clave** (`id:` o JSON completo);
    conflicto por el mismo id → gana el de `updated_at` más reciente; sin
    `updated_at` (series de workoutLog) se conserva el primero. **Nunca resta.**
  - `onboarded` pegajoso (una vez completado, no se vuelve a pedir).
  - `profile` unido **campo a campo** (un valor vacío/default nunca pisa el real).
  - Fusiones profundas específicas: `habitosLog` (fecha por fecha) y
    `vehiculos` (historial por id).
- **Realtime** (~línea 23171): WebSocket `wss://<proyecto>/realtime/v1/websocket?apikey=…&vsn=1.0.0`,
  protocolo Phoenix, topic `realtime:public:<tabla>:user_id=eq.<uid>`,
  `postgres_changes` con evento `*` y filtro `user_id=eq.<uid>`.
  Latidos `phoenix/heartbeat`; watchdog de canal muerto (75 s) con reconexión
  idempotente; una sola sincronización a la vez (`_csBusy`). Al recibir un
  evento: `cloudStartupSync({skipUpload:true})` → descarga + merge + UI.
- **Reconexión/offline**: al volver la red (o reconectar el canal), la app
  promueve la unión de lo local que la nube no tiene (`reconnect-promotes-local`).

## 5. IDs y `updated_at`

- Registros de `workoutLog`: `id: Date.now()` (+ `sessionId` por sesión,
  `localDate` en fecha local). Rutinas/productos: `ppUUID()`.
- La fusión es por id; los IDs existentes **nunca se regeneran ni se reutilizan**.
- `updated_at`: `timestamptz` asignado por el servidor; la comparación es POR
  TIEMPO con tolerancia (los formatos `+00:00` y `Z` son el mismo instante).
- La relectura tras escritura puede venir rezagada → reintento único a 3 s
  (puente) y semántica de tiempos en la verificación.

## 6. Resolución de conflictos

- Nube = unión de dispositivos: **0 pérdidas** (verificado en el rescate
  iPhone 53 / Supabase 53 / Windows 53).
- Mismo id en ambos lados → `updated_at` más reciente.
- Sin `updated_at` → se conserva el primero (no se sobrescribe a ciegas).
- El perfil se une campo a campo; un dispositivo recién instalado no pisa el
  perfil real con valores por defecto.

## 7. Offline y reintentos

- Guardado local primero (IndexedDB); `cloudSave` es best-effort y nunca
  deshace lo local.
- Sin internet al arrancar → se puede usar la app; "Sincronizar ahora" reintenta.
- Respuesta bloqueada/interceptada (Canopy/HTML) → NO se marca éxito, se
  conserva lo local y NO se reintenta en bucle.
- JSON roto desde el servidor → reintento único; si falla, se sigue con lo local.
- Renovación de sesión compartida (una sola petición) + reintento si el token
  llegó caducado.
- **Instantánea automática diaria** en IndexedDB (`auto-<fecha>`, se conservan
  las últimas 10) — no sobrescribe el estado, solo respaldo local (v1.188.0+).

## 8. Errores importantes ya solucionados (para no reintroducirlos)

| Error | Causa | Solución |
|---|---|---|
| Nube volvió de 53 a 42 registros | POST ciego con copia vieja pisaba la escritura reciente | **Fusionar antes de subir** (unión) |
| "NUESTRA escritura NO se aplicó" falso | Relectura inmediata con `updated_at` rezagado | Tolerancia de tiempos + reintento a 3 s |
| PATCH/POST hacia workers.dev bloqueados (Canopy) | Filtro parental intercepta POST del iPhone | Escrituras por **PATCH** a través del Worker |
| 400 de PostgREST por `&ts=` | Parámetros desconocidos rechazados | Worker quita `ts`; app ya no lo envía |
| `resolution=merge-duplicates` en PATCH | Es exclusivo de POST | PATCH usa solo `return=representation` |
| App atascada en "Casi listo…" | SW en `installing` eterno | Timeout de descarga + `skipWaiting` |
| Bucle local Pendiente→Sincronizado | Cada render guardaba y re-subía | Guardar/subir solo si los datos cambiaron de verdad |
| Ping-pong entre dispositivos | Evento recibido se volvía a subir | Eventos recibidos no re-suben (`skipUpload`) |
| "json parse error" | Respuesta cortada/rara del servidor | Reintento único + seguir con datos locales |
| Sesión "caducó" al sincronizar | Carrera de tokens al renovar | Renovación compartida + reintento |
| Progreso mostraba 0 días/0 volumen | Ventana usaba fecha UTC | Fecha local por registro (`localDate`) |

## 9. Pruebas que protegen esta arquitectura

| Suite | Protege |
|---|---|
| `worker-sync-union.test.js` (8) | Unión por Worker (PATCH/POST), verificación de conteo |
| `realtime-device-to-device.test.js` (11) | Canal en vivo, watchdog, reconexión idempotente |
| `reconnect-promotes-local.test.js` (10) | Promoción de lo local al volver la red |
| `polish-sync.test.js` (8) | Instantánea diaria, registro sin internet, conflicto unión |
| `single-instance-loop.test.js` (10) | Sin bucle de guardado/subida |
| `blocked-response.test.js` (6) | Respuestas interceptadas (Canopy/HTML) |
| `fitness-sync.test.js` (10) | Registro de fitness y veredictos con log |
| `write-log.test.js` (4) | Bitácora de escrituras |
| `idempotent-init.test.js` (8) | Arranque sin re-subidas innecesarias |
| `login-restore.test.js` (15) | Restauración de sesión/perfil sin pisar |
| `updater.test.js` (21) | SW/versión (nunca intercepta Supabase/version.json) |

## 10. Invariantes (NUNCA romper)

1. **Unión, nunca resta**: el merge solo agrega; jamás se borra del remoto por merge.
2. **Subir = fusionar primero**: ninguna escritura ciega.
3. **Éxito verificado**: "Subido" solo tras relectura confirmada (≥ enviado).
4. **RLS es la autoridad**: el Worker no autoriza, solo reenvía.
5. **Sin secretos fuera de Supabase**: Worker usa solo llave anon; nunca service_role.
6. **IDs estables**: los IDs existentes nunca se regeneran.
7. **workoutLog**: solo se añaden registros y se leen; el feedback va en
   `sessionFeedbacks`, NUNCA dentro de workoutLog.
8. **SW no toca Supabase ni version.json**.
9. **Offline primero**: ningún error de red puede perder datos locales.
10. **Comparar `updated_at` por tiempo**, no por texto.
