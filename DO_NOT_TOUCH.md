# DO_NOT_TOUCH.md — Zonas protegidas de la app

> Regla fundamental: las fases de recetas, nutrición, ejercicios, interfaz,
> imágenes, videos o contenido **NO pueden modificar incidentalmente** estas
> zonas. Detalles de cómo funciona cada una: ver `SYNC_ARCHITECTURE.md`.

## Zonas protegidas

1. **Sincronización con Supabase** — `cloudSave`, `cloudRest`, `cloudStartupSync`,
   flujo de subida/descarga/verificación en `index.html`.
2. **Cloudflare Worker** — `cloudflare-worker.js` (versión desplegada
   `WORKER_VERSION = '1.187.27'`).
3. **PATCH** — escritura por PATCH `personal_backups?user_id=eq.<sub>` con
   `Prefer: return=representation` (incluido el fallback a POST upsert).
4. **RLS** — políticas `own_rows` (`auth.uid() = user_id`) en Supabase
   (`CONFIGURAR-SUPABASE.sql`). El cliente NUNCA envía user_id ajeno.
5. **Realtime** — canal WebSocket (topic `realtime:public:<tabla>:user_id=eq.<uid>`),
   latidos, watchdog, reconexión idempotente, `_csBusy`.
6. **Merge / resolución de conflictos** — `mergeCloudStates`, `_mergeArrays`,
   `_mergeProfile`, `_mergeHabitosLog`, `_mergeVehiculos`: unión por id, gana
   `updated_at` más reciente, nunca resta.
7. **IDs existentes** — nunca regenerar, reutilizar ni reordenar IDs guardados.
8. **workoutLog** — estructura de registros `{id, date, localDate, sessionId,
   exercise, weight, sets, reps, note}`. Solo lectura y añadir. El feedback de
   sesión vive en `state.sessionFeedbacks`, NUNCA dentro de workoutLog.
9. **Lógica offline** — guardado local-first (IndexedDB), promoción de lo local
   al reconectar, detección de respuestas bloqueadas, reintentos (3 s del puente).
10. **Backups/sync** — tabla `personal_backups` (una fila por usuario), instantánea
    automática diaria local (`auto-<fecha>`, últimas 10), puntos de restauración.

## Protocolo si una tarea FUTURA necesita tocar una zona protegida

Antes de modificar CUALQUIERA de las zonas anteriores, la tarea debe
**detenerse** y explicar explícitamente:

1. **Qué** necesita cambiar (función/tabla/política concreta).
2. **Por qué** es imprescindible (y por qué no alcanza con tocar fuera de la zona).
3. **Archivos afectados** (lista exacta).
4. **Riesgo para la sincronización** (escenarios de pérdida/conflicto concretos).
5. **Pruebas necesarias** (suites existentes que se correrán + nuevas pruebas
   que se agregarán para cubrir el cambio).
6. **Estrategia de rollback** (tag/commit exacto al que volver y cómo verificar).

Y debe esperar la aprobación explícita del usuario antes de escribir una sola línea.

## Referencia rápida de "qué se puede tocar sin protocolo"

- Contenido: recetas, ejercicios de la biblioteca (`EX_LIB`), textos, UI/estilos,
  generador de rutinas (`buildFitnessTodayPlan`, `buildCustomRoutine`,
  `f3*`) — SIEMPRE que no alteren los puntos 6-10 de arriba.
- Nuevos campos de `state` que viajen con la sync existente sin migraciones.
- Pruebas nuevas.

## Cómo se protege hoy

- Suites de sincronización en verde en cada cambio (ver sección 9 de
  `SYNC_ARCHITECTURE.md`): 814 pruebas totales en v1.188.4.
- Tags de rollback: `1.188.3-fase3a-base`, `1.188.2-fase2-base`,
  `1.188.1-fase1-base` y tags de versión (`1.188.1` … `1.188.4`).
- `CLAUDE.md` (instrucciones permanentes) obliga a leer este documento y
  `SYNC_ARCHITECTURE.md` antes de modificar código sensible.
