// ============================================================
// PRUEBAS v1.187.12 — Inicialización idempotente
// La app abierta varios minutos, sin tocar nada, debe quedarse
// estable: 1 canal realtime, sin descargas repetitivas de peso,
// sin uploads repetidos, sin ciclos sync/render, y la reconexión
// tras perder internet funciona sin duplicar nada.
// Uso: node tests/idempotent-init.test.js
// ============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extractFunc(src, name) {
  let i = src.indexOf('async function ' + name + '(');
  if (i < 0) i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('No se encontró function ' + name);
  let depth = 0, j = i, q = null;
  for (; j < src.length; j++) {
    const c = src[j];
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; continue; }
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

const server = {
  backups: {}, rows: {}, wsClients: [], uploads: 0, backupWrites: 0, weightLoads: 0,
  broadcast: function (tabla, user_id, record) {
    server.wsClients.forEach(function (c) {
      if (c.user_id !== user_id) return;
      if (!c.topics.some(function (tp) { return tp.indexOf(':' + tabla + ':') >= 0; })) return;
      c.onmessage({
        data: JSON.stringify({
          event: 'postgres_changes',
          payload: {
            data: { schema: 'public', table: tabla, type: 'UPDATE', commit_timestamp: new Date().toISOString(), errors: null, record: record, old_record: {}, columns: [] },
            ids: ['id-' + tabla + '-' + user_id]
          },
          topic: 'realtime:public:' + tabla + ':user_id=eq.' + user_id
        })
      });
    });
  }
};

function makeDevice(name, user_id, workouts) {
  const fakeEls = {};
  const timers = [];
  let wsCount = 0;
  let wsInstance = null;
  let renders = 0;
  let syncs = 0;
  class FakeWS {
    constructor(url) { this.url = url; this.readyState = 1; wsInstance = this; wsCount++; server.wsClients.push(this); this.user_id = user_id; this.topics = []; }
    send(str) {
      const m = JSON.parse(str);
      if (m.event === 'phx_join') {
        this.topics.push(m.topic);
        this.onmessage({ data: JSON.stringify({ event: 'phx_reply', payload: { status: 'ok', response: { postgres_changes: [{ id: 1 }] } }, ref: m.ref, topic: m.topic }) });
      }
    }
    close() { this.readyState = 3; if (this.onclose) this.onclose({ code: 1000, reason: '' }); }
  }
  const storageStore = {};
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
    WebSocket: FakeWS,
    setTimeout: function (fn, ms) { const h = { fn: fn, ms: ms, done: false }; timers.push(h); return h; },
    clearTimeout: function (h) { if (h) h.done = true; },
    setInterval: function (fn) { sb._intervalFn = fn; return 99; },
    clearInterval: function () { sb._intervalFn = null; },
    __flushTimers: function () {
      const pend = timers.filter(function (x) { return !x.done; });
      timers.length = 0;
      pend.forEach(function (x) { x.done = true; try { x.fn(); } catch (e) {} });
    },
    __pendingTimers: function () { return timers.filter(function (x) { return !x.done; }).length; },
    state: {
      workoutLog: workouts.slice(), weight: [{ client_id: 'w1', d: '2026-08-10', w: 129, updated_at: '2026-08-10T00:00:00Z' }],
      meals: [], walks: [], expenses: [], diary: {},
      profile: { nombre: 'Ruben', peso: 129, altura: 168, edad: 25, objetivo: 'bajar grasa', _onbSeen: true, calorias: 2624, proteina: 111, grasa: 53, carbos: 426 },
      onboarded: true, lastModified: '2026-08-14T08:00:00Z'
    },
    PP_SYNC: { kind: 'synced', downloaded: null, remoteChecked: false, remoteHasData: false },
    PP_SYNCCHAIN: [],
    _rtSocket: null, _rtTimer: null, _rtBackoff: 3000, _rtDebounce: null, _rtLastReply: 0, _rtJoined: 0, _rtEverConnected: false,
    _startupSynced: true, _syncing: false, _csBusy: false, _syncRetries: 0, _syncRetryTimer: null,
    _saveTimeout: null, _savePending: false, _autoSyncTimer: null,
    getCloudSession: function () { return { user: { id: user_id, email: name + '@x.y' }, access_token: 'tok-' + name }; },
    getCloudConfig: function () { return { url: 'https://xyz.supabase.co', key: 'KEY' }; },
    refreshCloudSession: async function () { return sb.getCloudSession(); },
    cloudRest: async function (p, options) {
      if (String(p).indexOf('personal_backups?user_id=eq.') >= 0) {
        const b = server.backups[user_id];
        return b ? [{ data: b.data, updated_at: b.updated_at }] : [];
      }
      if (String(p).indexOf('peso?user_id=eq.') >= 0) {
        server.weightLoads++;
        return [{ client_id: 'w1', data: { d: '2026-08-10', w: 129 }, updated_at: '2026-08-10T00:00:00Z' }];
      }
      if (options && options.method === 'POST') {
        server.uploads++;
        const body = JSON.parse(options.body);
        if (String(p).indexOf('personal_backups') >= 0) {
          server.backupWrites++;
          server.backups[user_id] = body;
          server.broadcast('personal_backups', user_id, body);
        } else {
          const tabla = String(p).split('?')[0];
          server.rows[tabla] = server.rows[tabla] || [];
          const rows = Array.isArray(body) ? body : [body];
          rows.forEach(function (r) { server.rows[tabla].push(r); server.broadcast(tabla, user_id, r); });
        }
        return [];
      }
      return [];
    },
    setSync: function () {}, renderSyncUI: function () {}, renderSyncChain: function () {},
    render: function () { renders++; },
    finishOnboardingDecision: function () {}, normalizeAllWeights: function () {}, cloudStatus: function () {},
    safeStorage: { get: function (k) { return Object.prototype.hasOwnProperty.call(storageStore, k) ? storageStore[k] : null; }, set: function (k, v) { storageStore[k] = String(v); return true; } },
    persistStateIDB: function () {}, ppLogErr: function () {}, lastSavedText: function () { return ''; }
  };
  sb.window = sb;
  vm.createContext(sb);
  ['_mergeArrays', '_mergeHabitosLog', '_mergeVehiculos', '_mergeProfile', 'mergeCloudStates',
    'mergeWeightLists', 'normalizeWeightEntry', 'ensureId', 'ppUUID', 'todayISO', 'cloudStartupSync', 'cloudSave',
    'mirrorGranular', 'scheduleAutoSync', 'initRealtimeSync', 'syncChainPush', 'save', '_doSave']
    .forEach(function (n) { vm.runInContext(extractFunc(HTML, n), sb); });
  vm.runInContext((HTML.match(/var PROFILE_DEFAULTS=\{[^}]*\};/) || ['var PROFILE_DEFAULTS={};'])[0], sb);
  const origCS = sb.cloudStartupSync;
  sb.cloudStartupSync = function (o) { syncs++; return origCS(o); };
  return { sb: sb, ws: function () { return wsInstance; }, wsCount: function () { return wsCount; }, chain: function () { return sb.PP_SYNCCHAIN; }, get renders() { return renders; }, get syncs() { return syncs; } };
}

(async function () {
  console.log('\n== Una sola instancia, abierta "varios minutos" ==');
  server.backups = {}; server.rows = {}; server.wsClients = []; server.uploads = 0; server.backupWrites = 0; server.weightLoads = 0;
  const S = makeDevice('solo', 'u-123', [{ id: 1, date: '2026-08-13', exercise: 'Sentadilla', weight: 50, sets: 1, reps: '8', note: '' }]);

  // Arranque normal: sync de arranque (sube una vez) + canal.
  await S.sb.cloudStartupSync({ _origin: 'arranque', skipUpload: false });
  await sleep(30);
  S.sb.__flushTimers(); await sleep(30); // eco propio → merge (skipUpload) → sin subida
  const wsInicial = S.ws();
  if (wsInicial && wsInicial.onopen) wsInicial.onopen(); // el navegador abre solo (captura el latido)

  // I1: el canal es ÚNICO aunque se pida varias veces.
  const wsAntes = S.wsCount();
  S.sb.initRealtimeSync('fin-sync');
  S.sb.initRealtimeSync('online');
  S.sb.initRealtimeSync('reconexion-backoff');
  t('I1 · Un solo canal realtime aunque initRealtimeSync se llame varias veces', S.wsCount() === wsAntes);

  // I2: "minutos" sin tocar nada: sin descargas de peso repetidas, sin uploads, sin temporizadores.
  const pesosAntes = server.weightLoads, uploadsAntes = server.backupWrites, syncsAntes = S.syncs;
  for (let i = 0; i < 12; i++) { S.sb.__flushTimers(); await sleep(25); }
  t('I2 · Sin descargas repetitivas de peso (solo la del sync inicial)', server.weightLoads === pesosAntes);
  t('I3 · Cero uploads nuevos en reposo', server.backupWrites === uploadsAntes);
  t('I4 · Sin syncs crecientes ni temporizadores pendientes', S.syncs === syncsAntes && S.sb.__pendingTimers() === 0);

  // I5: el watchdog NO mata el canal cuando llegan mensajes aunque no haya phx_reply
  // (cualquier mensaje cuenta como "vivo" — antes solo phx_reply, y un latido sin
  // respuesta forzaba cierre → reconexión → sync completo → el ciclo de logs).
  const wsAntesW = S.wsCount();
  S.sb._rtLastReply = Date.now() - 60000; // hace 60 s sin phx_reply…
  server.broadcast('personal_backups', 'u-123', server.backups['u-123']); // …pero llegan eventos
  if (S.sb._intervalFn) S.sb._intervalFn(); // corre el latido/watchdog (25 s → aquí manual)
  t('I5 · Con mensajes entrando, el watchdog NO fuerza cierre (canal vivo)', S.wsCount() === wsAntesW);

  // I6: silencio REAL de 75 s → el watchdog cierra y la reconexión recupera SIN duplicar ni subir de más.
  S.sb._rtLastReply = Date.now() - 80000;
  if (S.sb._intervalFn) S.sb._intervalFn();
  S.sb.__flushTimers(); // backoff → reconexión (nuevo socket)
  await sleep(20);
  const wsNew = S.ws();
  if (wsNew && wsNew.onopen) wsNew.onopen(); // el navegador abre solo
  S.sb.__flushTimers(); // promoción de reconexión (skipUpload)
  await sleep(30);
  t('I6 · Reconexión tras silencio real: canal nuevo y funcional', S.wsCount() === wsAntesW + 1);
  t('I7 · La reconexión NO re-subió (sin registros propios pendientes)', server.backupWrites === uploadsAntes);
  t('I8 · El workoutLog en la nube sigue intacto (sin regresión)',
    server.backups['u-123'].data.workoutLog.length === S.sb.state.workoutLog.length);

  console.log('\n==========================================');
  console.log('Resultado: ' + passed + ' pasaron · ' + failed + ' fallaron');
  console.log('==========================================');
  if (failed) {
    console.log('\nFallos:\n' + failures.map(function (f) { return '  ✗ ' + f; }).join('\n'));
    process.exit(1);
  }
  process.exit(0);
})();
