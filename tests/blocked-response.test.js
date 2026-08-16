// ============================================================
// PRUEBAS v1.187.17 — Respuestas interceptadas (Canopy/filtros)
// Un 200 con HTML NO es Supabase: la subida se declara bloqueada,
// sin reintentos, y los datos locales NO se tocan.
// Uso: node tests/blocked-response.test.js
// ============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extractFunc(src, name) {
  let i = src.indexOf('async function ' + name + '(');
  if (i < 0) i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('No se encontró function ' + name);
  let parens = 0, j = i, q = null, bodyStart = -1;
  for (; j < src.length; j++) {
    const c = src[j];
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '(') parens++;
    else if (c === ')') { parens--; if (parens === 0) { bodyStart = j + 1; break; } }
  }
  if (bodyStart < 0) throw new Error('params de ' + name);
  let depth = 0; q = null; j = bodyStart;
  for (; j < src.length; j++) {
    const c = src[j];
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return src.slice(i, j + 1); }
  }
  throw new Error('incompleta: ' + name);
}

let passed = 0, failed = 0;
const failures = [];
function t(name, cond, extra) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; failures.push(name + (extra ? ' → ' + extra : '')); console.log('  ✗ ' + name + (extra ? ' → ' + extra : '')); }
}
const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

const wl53 = Array.from({ length: 53 }, function (_, i) { return { id: i + 1, exercise: 'E' + (i + 1) }; });
const wl42 = wl53.slice(0, 42);
const HTML_BLOCK = '<!doctype html><html><body>block.canopy.us — acceso bloqueado</body></html>';

let blockPosts = false;
const sb = {
  console: { log: function () {}, warn: function () {}, error: function () {} },
  PP_SYNC: { writeLog: [], lastHttp: null },
  PP_SYNCCHAIN: [],
  navigator: { onLine: true },
  state: { workoutLog: wl53.slice(), weight: [], meals: [], walks: [], expenses: [], diary: {}, profile: { nombre: 'R', onboarded: true }, onboarded: true, lastModified: '2026-08-15T08:00:00Z' },
  _syncing: false, _syncRetries: 0, _syncRetryTimer: null,
  ppUploadTrace: {},
  getCloudSession: function () { return { user: { id: 'u-123', email: 'x@y.z' }, access_token: 'tok' }; },
  getCloudConfig: function () { return { url: 'https://xyz.supabase.co', key: 'KEY' }; },
  refreshCloudSession: async function () { return sb.getCloudSession(); },
  fetch: async function (url, opts) {
    const p = String(url);
    if (opts && opts.method === 'POST') {
      if (blockPosts) {
        return { ok: true, status: 200, headers: { get: function (h) { return h.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null; } }, text: async function () { return HTML_BLOCK; } };
      }
      const body = JSON.parse(opts.body);
      return { ok: true, status: 200, headers: { get: function (h) { return h.toLowerCase() === 'content-type' ? 'application/json' : null; } }, text: async function () { return JSON.stringify([body]); } };
    }
    if (p.indexOf('personal_backups?user_id=eq.') >= 0) {
      if (blockPosts) {
        return { ok: true, status: 200, headers: { get: function () { return 'text/html'; } }, text: async function () { return HTML_BLOCK; } };
      }
      return { ok: true, status: 200, headers: { get: function () { return 'application/json'; } }, text: async function () { return JSON.stringify([{ user_id: 'u-123', data: { workoutLog: wl42 }, updated_at: '2026-08-15T09:00:00.000Z' }]); } };
    }
    return { ok: true, status: 200, headers: { get: function () { return 'application/json'; } }, text: async function () { return '[]'; } };
  },
  setSync: function (kind) { sb.lastSyncKind = kind; },
  renderSyncUI: function () {}, renderSyncChain: function () {},
  render: function () {}, finishOnboardingDecision: function () {}, normalizeAllWeights: function () {},
  syncChainPush: function (ev, det) { sb.PP_SYNCCHAIN.unshift({ evento: ev, detalle: det || '' }); },
  ppLogErr: function () {},
  safeStorage: { set: function () {}, get: function () { return null; } },
  persistStateIDB: function () {},
  ppRenderUploadTrace: function () {}
};
sb.window = sb;
vm.createContext(sb);
['ppRespBloqueada', 'cloudRest', 'cloudSave', 'mirrorGranular', 'ensureId', 'todayISO',
  '_mergeArrays', '_mergeHabitosLog', '_mergeVehiculos', '_mergeProfile', 'mergeCloudStates']
  .forEach(function (n) { vm.runInContext(extractFunc(HTML, n), sb); });
vm.runInContext((HTML.match(/var PROFILE_DEFAULTS=\{[^}]*\};/) || ['var PROFILE_DEFAULTS={};'])[0], sb);

(async function () {
  console.log('\n== Detección de respuestas interceptadas ==');
  t('B1 · Un POST con HTML de filtro (Canopy) lanza error "bloqueada/interceptada"', await (async function () {
    blockPosts = true;
    try {
      await sb.cloudRest('personal_backups?on_conflict=user_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify({ user_id: 'u-123', data: { workoutLog: wl53 }, updated_at: 'x' }) });
      return false;
    } catch (e) { return /bloquead|interceptad/i.test(String(e.message)); }
  })());

  t('B2 · Una lectura con HTML de filtro devuelve null (no trona y no se toma como datos)', await (async function () {
    blockPosts = true;
    const r = await sb.cloudRest('personal_backups?user_id=eq.u-123&select=data,updated_at');
    return r === null;
  })());

  console.log('\n== cloudSave completo con la red bloqueada ==');
  blockPosts = true;
  sb.PP_SYNCCHAIN = [];
  sb.lastSyncKind = null;
  sb._syncRetries = 0; sb._syncRetryTimer = null;
  const wlAntes = sb.state.workoutLog.length;
  await sb.cloudSave(true);
  t('B3 · No declara éxito y muestra "Sincronización bloqueada/interceptada"',
    !sb.PP_SYNCCHAIN.some(function (e) { return e.evento.indexOf('▲ Subido') >= 0; })
    && sb.PP_SYNCCHAIN.some(function (e) { return e.evento.indexOf('bloqueada/interceptada') >= 0; })
    && sb.lastSyncKind === 'error');
  t('B4 · NO reintenta (sin temporizadores ni contador de reintentos)', sb._syncRetryTimer === null && sb._syncRetries === 0);
  t('B5 · Los 53 locales quedan INTACTOS (nada se reemplazó)', sb.state.workoutLog.length === wlAntes && sb.state.workoutLog.length === 53);

  console.log('\n== Con red normal todo sigue funcionando ==');
  blockPosts = false;
  const ok = await sb.cloudRest('personal_backups?on_conflict=user_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify({ user_id: 'u-123', data: { workoutLog: wl53 }, updated_at: 'x' }) });
  t('B6 · Un POST JSON normal no lanza error y devuelve la fila', Array.isArray(ok) && ok[0].data.workoutLog.length === 53);

  console.log('\n==========================================');
  console.log('Resultado: ' + passed + ' pasaron · ' + failed + ' fallaron');
  console.log('==========================================');
  if (failed) {
    console.log('\nFallos:\n' + failures.map(function (f) { return '  ✗ ' + f; }).join('\n'));
    process.exit(1);
  }
  process.exit(0);
})();
