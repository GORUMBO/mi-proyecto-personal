# CLAUDE.md — Instrucciones permanentes del proyecto

## Antes de modificar código: LEE PRIMERO

1. **`SYNC_ARCHITECTURE.md`** — cómo funciona de verdad la sincronización
   (Supabase, Cloudflare Worker, PATCH, RLS, Realtime, merge, IDs, updated_at,
   workoutLog, offline, conflictos, backups, errores resueltos, invariantes).
2. **`DO_NOT_TOUCH.md`** — zonas protegidas y el protocolo obligatorio
   (detenerse y explicar qué/por qué/archivos/riesgo/pruebas/rollback) antes de
   tocar cualquier zona protegida.

## Reglas de oro

- La sincronización iPhone ↔ Supabase ↔ Windows está ESTABLE (v1.188.4,
  53/53/53, 0 pérdidas). No modificarla salvo error real demostrado.
- El motor de rutinas usa `EX_LIB` + `F3_RULES` + validadores (fuentes:
  ACSM 2009, Schoenfeld 2016/2017, Grgic 2018, Helms 2016 — ver `RULE_SOURCES`
  en `index.html`). Variación SOLO por semilla entre candidatos válidos;
  nunca `Math.random` para construir rutinas.
- `workoutLog` es solo lectura/añadir. El feedback va en `state.sessionFeedbacks`.
- Probar TODO antes de publicar: `node tests\<suite>.test.js` (19 suites,
  814 pruebas). Publicar requiere actualizar los 3 lugares en sincronía:
  `HM_APP_VERSION` (index.html), `CACHE` (sw.js) y `version.json`.
- Flujo de publicación: pruebas verdes → commit → push a `deepseek-desarrollo`
  y `main` (GitHub Pages) → tag de versión → verificar producción
  (https://gorumbo.github.io/mi-proyecto-personal/version.json).
