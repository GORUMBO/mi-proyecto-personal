// ============================================================
// PRUEBAS v1.187.26 — Sincronización normal por el puente Worker
// iPhone 53 + Supabase 42 → unión 53 sin pérdidas ni duplicados;
// un dispositivo con 42 no puede regresar la nube.
// Uso: node tests/worker-sync-union.test.js
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

function mkBase42() { return Array.from({ length: 42 }, function (_, i) { return { id: i + 1, date: '2026-08-10', exercise: 'E' + (i + 1) }; }); }
function mk53() {
  const out = mkBase42();
  for (let i = 0; i < 10; i++) out.push({ id: 1001 + i, date: '2026-08-14', exercise: 'Nuevo ' + (i + 1) });
  out.push({ id: 1011, date: '2026-08-14', exercise: 'Remo', weight: 30, reps: '12' });
  return out;
}

// "Supabase vía Worker" simulado: guarda la fila y aplica el retardo de lectura.
const server = {
  row: { user_id: 'u-123', data: { workoutLog: mkBase42(), profile: { nombre: 'R' }, onboarded: true }, updated_at: '2026-08-16T05:00:00.000+00:00' },
  lagNext: 0, // tras un POST, las siguientes N lecturas devuelven la copia vieja
  posts: 0
};

function makeDevice(name, workouts, useWorker) {
  const fakeEls = {};
  const storageStore = {};
  if (useWorker) storageStore['pp_worker_cfg'] = JSON.stringify({ url: 'https://mi-proyecto-sync.rubenalanfloo.workers.dev' });
  const sb = {
    console: { log: function () {}, warn: function () {}, error: function () {} },
    alert: function () {},
    document: {
      getElementById: function (id) { if (!fakeEls[id]) fakeEls[id] = { innerHTML: '', textContent: '', style: {}, remove: function () {}, appendChild: function () {} }; return fakeEls[id]; },
      createElement: function () { return { style: {}, appendChild: function () {}, remove: function () {} }; },
      body: { appendChild: function () {} }, head: { appendChild: function () {} },
      querySelector: function () { return null; }
    },
    $: function (sel) { return sb.document.querySelector(sel); },
    safeText: function (s) { return String(s == null ? '' : s); },
    navigator: { onLine: true },
    setTimeout: function (fn, ms) { return setTimeout(fn, ms); },
    clearTimeout: function () {},
    setInterval: function () { return 99; },
    clearInterval: function () {},
    state: {
      workoutLog: workouts.slice(), weight: [], meals: [], walks: [], expenses: [], diary: {},
      profile: { nombre: 'R', peso: 129, altura: 168, edad: 25, objetivo: 'bajar grasa', _onbSeen: true, calorias: 2624, proteina: 111, grasa: 53, carbos: 426 },
      onboarded: true, lastModified: '2026-08-16T05:10:00.000Z'
    },
    PP_SYNC: { kind: 'synced', downloaded: null, remoteChecked: false, remoteHasData: false },
    PP_SYNCCHAIN: [],
    _rtSocket: null, _rtTimer: null, _rtBackoff: 3000, _rtDebounce: null, _rtLastReply: 0, _rtJoined: 0, _rtEverConnected: false,
    _startupSynced: true, _syncing: false, _csBusy: false, _syncRetries: 0, _syncRetryTimer: null,
    _saveTimeout: null, _savePending: false, _autoSyncTimer: null,
    getCloudSession: function () { return { user: { id: 'u-123', email: name + '@x.y' }, access_token: 'tok-' + name }; },
    getCloudConfig: function () { return { url: 'https://xyz.supabase.co', key: 'KEY' }; },
    refreshCloudSession: async function () { return sb.getCloudSession(); },
    fetch: async function (url, opts) {
      const u = String(url);
      if (u.indexOf('/sync/') >= 0) {
        const isPost = (opts && opts.method === 'POST');
        const isPatch = (opts && opts.method === 'PATCH');
        const esBackups = u.indexOf('personal_backups') >= 0;
        if ((isPost || isPatch) && esBackups) {
          const body = JSON.parse(opts.body);
          server.posts++;
          server.lagNext = 1; // la lectura inmediata siguiente devuelve la copia vieja
          server.row = { user_id: 'u-123', data: body.data, updated_at: body.updated_at || '2026-08-16T05:11:00.000+00:00' };
          return { ok: true, status: 200, text: async function () { return JSON.stringify({ ok: true, status: 200, workoutLogCount: server.row.data.workoutLog.length, updatedAt: server.row.updated_at, sub: 'u-123', rowUserId: 'u-123', data: [server.row], diag: { metodo: isPatch ? 'PATCH' : 'POST' } }); } };
        }
        if (isPost || isPatch) {
          // Espejos granulares (ejercicios, peso…): se aceptan sin tocar la fila.
          return { ok: true, status: 200, text: async function () { return JSON.stringify({ ok: true, status: 200, data: [], diag: { metodo: 'POST' } }); } };
        }
        // GET: aplicar el retardo simulado (lectura tras escritura).
        const row = server.lagNext > 0 ? { user_id: 'u-123', data: { workoutLog: mkBase42() }, updated_at: '2026-08-16T05:00:00.000+00:00' } : server.row;
        if (server.lagNext > 0) server.lagNext--;
        return { ok: true, status: 200, text: async function () { return JSON.stringify({ ok: true, status: 200, workoutLogCount: row.data.workoutLog.length, updatedAt: row.updated_at, sub: 'u-123', rowUserId: 'u-123', data: [row], diag: { metodo: 'GET' } }); } };
      }
      // Ruta DIRECTA (sin worker): servir la fila igual que Supabase.
      if (u.indexOf('xyz.supabase.co/rest/v1/personal_backups') >= 0) {
        const isPost = (opts && opts.method === 'POST');
        if (isPost) {
          const body = JSON.parse(opts.body);
          server.posts++;
          server.row = { user_id: 'u-123', data: body.data, updated_at: body.updated_at || '2026-08-16T05:11:00.000+00:00' };
          return { ok: true, status: 200, text: async function () { return JSON.stringify([server.row]); } };
        }
        return { ok: true, status: 200, text: async function () { return JSON.stringify([server.row]); } };
      }
      return { ok: true, status: 200, text: async function () { return '[]'; } };
    },
    setSync: function () {}, renderSyncUI: function () {}, renderSyncChain: function () {},
    render: function () {}, finishOnboardingDecision: function () {}, normalizeAllWeights: function () {}, cloudStatus: function () {},
    safeStorage: { get: function (k) { return Object.prototype.hasOwnProperty.call(storageStore, k) ? storageStore[k] : null; }, set: function (k, v) { storageStore[k] = String(v); return true; } },
    persistStateIDB: function () {}, ppLogErr: function () {}, lastSavedText: function () { return ''; },
    ppRenderUploadTrace: function () {}
  };
  sb.window = sb;
  vm.createContext(sb);
  ['ppWorkerUrl', 'ppWorkerOn', 'ppToggleWorker', 'ppRespBloqueada', 'cloudRest', 'cloudSave', 'cloudStartupSync',
    'mirrorGranular', 'ensureId', 'ppUUID', 'todayISO', 'mergeCloudStates', '_mergeArrays', '_mergeHabitosLog',
    '_mergeVehiculos', '_mergeProfile', 'mergeWeightLists', 'normalizeWeightEntry', 'initRealtimeSync', 'syncChainPush']
    .forEach(function (n) { vm.runInContext(extractFunc(HTML, n), sb); });
  vm.runInContext((HTML.match(/var PROFILE_DEFAULTS=\{[^}]*\};/) || ['var PROFILE_DEFAULTS={};'])[0], sb);
  return sb;
}

(async function () {
  console.log('\n== iPhone (53) sincroniza POR EL WORKER contra Supabase (42) ==');
  const A = makeDevice('iphone', mk53(), true);
  t('U1 · El puente está activo en el dispositivo', A.ppWorkerOn() === true);
  await A.cloudStartupSync({ _origin: 'arranque' });
  const fila = server.row;
  const uniq = new Set(fila.data.workoutLog.map(function (x) { return x.id; })).size;
  t('U2 · Supabase queda en 53 con la UNIÓN (sin pérdidas: contiene los 11 nuevos y la base)',
    fila.data.workoutLog.length === 53 && fila.data.workoutLog.some(function (x) { return x.exercise === 'Remo'; }));
  t('U3 · Sin duplicados: 53 ids únicos', uniq === 53);
  t('U4 · El iPhone conserva sus 53 locales', A.state.workoutLog.length === 53);
  t('U5 · La subida quedó confirmada con el conteo real (53)',
    A.ppUploadTrace && A.ppUploadTrace.result === 'ok' && A.ppUploadTrace.releida === 53 && A.ppUploadTrace.payload === 53);
  t('U6 · La verificación superó el retardo de lectura (confirmado, no fallo)',
    A.ppUploadTrace && A.ppUploadTrace.result === 'ok' && A.ppUploadTrace.noAplico === false);

  console.log('\n== Windows (42) sincroniza después y recibe la unión ==');
  const B = makeDevice('windows', mkBase42(), false); // directo, como hoy
  await B.cloudStartupSync({ _origin: 'arranque' });
  t('U7 · Windows queda en 53 con Remo visible', B.state.workoutLog.length === 53 && B.state.workoutLog.some(function (x) { return x.exercise === 'Remo'; }));

  console.log('\n== Un dispositivo con copia vieja NO regresa la nube ==');
  server.row = { user_id: 'u-123', data: { workoutLog: mk53() }, updated_at: '2026-08-16T05:12:00.000+00:00' };
  const C = makeDevice('viejo', mkBase42(), true);
  await C.cloudSave(true);
  t('U8 · La subida del dispositivo viejo conserva los 53', server.row.data.workoutLog.length === 53);

  console.log('\n==========================================');
  console.log('Resultado: ' + passed + ' pasaron · ' + failed + ' fallaron');
  console.log('==========================================');
  if (failed) {
    console.log('\nFallos:\n' + failures.map(function (f) { return '  ✗ ' + f; }).join('\n'));
    process.exit(1);
  }
  process.exit(0);
})();
