// ============================================================
// PRUEBAS v1.187.11 — El arranque sin red no pierde los datos:
// iPhone local=53, Supabase remoto=42, Windows local=42.
// Al recuperar la red, el iPhone DEBE promover sus 53 y la
// nube queda en 53 para siempre (ningún dispositivo viejo la regresa).
// Uso: node tests/reconnect-promotes-local.test.js
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

// Estados sintéticos: ids 1..42 = base; 1001..1011 = los 11 del iPhone (Remo=1011).
function mkWorkouts(n) {
  const out = [];
  for (let i = 1; i <= n; i++) {
    out.push({ id: i, date: '2026-08-1' + (i % 10), exercise: 'Ejercicio ' + i, weight: 10, sets: 1, reps: '10', note: '' });
  }
  return out;
}
function mkIphoneWorkouts() {
  const out = mkWorkouts(42);
  for (let i = 0; i < 10; i++) out.push({ id: 1001 + i, date: '2026-08-14', exercise: 'Ejercicio nuevo ' + (i + 1), weight: 25, sets: 1, reps: '10', note: '' });
  out.push({ id: 1011, date: '2026-08-14', exercise: 'Remo', weight: 30, sets: 1, reps: '12', note: 'Registro simple · Normal' });
  return out;
}

const server = {
  backups: {}, rows: {}, wsClients: [], uploads: 0, backupWrites: 0,
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

function makeDevice(name, user_id, workouts, onLine) {
  const fakeEls = {};
  const timers = [];
  let wsInstance = null;
  let renders = 0;
  class FakeWS {
    constructor(url) { this.url = url; this.readyState = 1; wsInstance = this; server.wsClients.push(this); this.user_id = user_id; this.topics = []; }
    send(str) {
      const m = JSON.parse(str);
      if (m.event === 'phx_join') {
        this.topics.push(m.topic);
        this.onmessage({ data: JSON.stringify({ event: 'phx_reply', payload: { status: 'ok', response: { postgres_changes: [{ id: 1 }] } }, ref: m.ref, topic: m.topic }) });
      }
    }
    close() { this.readyState = 3; }
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
    navigator: { onLine: !!onLine },
    WebSocket: FakeWS,
    setTimeout: function (fn, ms) { const h = { fn: fn, ms: ms, done: false }; timers.push(h); return h; },
    clearTimeout: function (h) { if (h) h.done = true; },
    setInterval: function () { return 99; },
    clearInterval: function () {},
    __flushTimers: function () {
      const pend = timers.filter(function (x) { return !x.done; });
      timers.length = 0;
      pend.forEach(function (x) { x.done = true; try { x.fn(); } catch (e) {} });
    },
    state: {
      workoutLog: workouts.slice(), weight: [], meals: [], walks: [], expenses: [], diary: {},
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
      if (String(p).indexOf('peso?user_id=eq.') >= 0) return [];
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
    'mergeWeightLists', 'ensureId', 'todayISO', 'cloudStartupSync', 'cloudSave',
    'mirrorGranular', 'scheduleAutoSync', 'initRealtimeSync', 'syncChainPush', 'save', '_doSave']
    .forEach(function (n) { vm.runInContext(extractFunc(HTML, n), sb); });
  vm.runInContext((HTML.match(/var PROFILE_DEFAULTS=\{[^}]*\};/) || ['var PROFILE_DEFAULTS={};'])[0], sb);
  return { sb: sb, ws: function () { return wsInstance; }, chain: function () { return sb.PP_SYNCCHAIN; }, get renders() { return renders; } };
}

(async function () {
  // Estado inicial: Supabase remoto = 42 (los datos reales del usuario).
  server.backups = {}; server.rows = {}; server.wsClients = []; server.uploads = 0; server.backupWrites = 0;
  server.backups['u-123'] = { user_id: 'u-123', data: { workoutLog: mkWorkouts(42), weight: [], profile: { nombre: 'Ruben' }, onboarded: true, lastModified: '2026-08-14T07:00:00Z' }, updated_at: '2026-08-14T07:00:00Z' };

  console.log('\n== iPhone arranca SIN red (suspensión/apagado) ==');
  const I = makeDevice('iphone', 'u-123', mkIphoneWorkouts(), false); // local=53, sin red
  await I.sb.cloudStartupSync();
  t('R1 · Sin red, el arranque NO sube nada y NO pierde sus 53 locales',
    server.backupWrites === 0 && I.sb.state.workoutLog.length === 53);

  console.log('\n== Windows (local=42, abierto y suscrito) espera el evento ==');
  const W = makeDevice('windows', 'u-123', mkWorkouts(42), true);
  W.sb.initRealtimeSync();
  const wsW = W.ws();
  if (wsW && wsW.onopen) wsW.onopen();      // primera conexión de W (sin promoción)

  console.log('\n== Vuelve la red: el WS del iPhone reconecta y DEBE promover los 53 ==');
  I.sb.navigator.onLine = true;
  I.sb.initRealtimeSync();
  const ws1 = I.ws();
  if (ws1 && ws1.onopen) ws1.onopen();      // primera conexión (sin promoción)
  ws1.close();                              // la red se cayó estando abierto
  I.sb.__flushTimers();                     // backoff → nueva conexión
  const ws2 = I.ws();
  if (ws2 && ws2.onopen) ws2.onopen();      // RECONEXIÓN → programa el sync de promoción
  I.sb.__flushTimers();                     // corre la promoción (1.5 s → aquí inmediato)
  await sleep(40);
  const nube = server.backups['u-123'];
  t('R2 · Al reconectar, el iPhone subió la UNIÓN: Supabase queda en 53 con Remo',
    server.backupWrites === 1 && nube.data.workoutLog.length === 53 && nube.data.workoutLog.some(function (x) { return x.exercise === 'Remo'; }));
  t('R3 · La cadena del iPhone muestra la subida con el conteo real',
    I.chain().some(function (e) { return e.evento.indexOf('▲ Subido') >= 0 && e.detalle.indexOf('workoutLog: 53') >= 0; }));

  console.log('\n== Windows procesa el evento del iPhone ==');
  W.sb.__flushTimers();                     // debounce del evento recibido
  await sleep(40);
  t('R4 · Windows descargó y fusionó: queda en 53 con Remo, sin tocar nada',
    W.sb.state.workoutLog.length === 53 && W.sb.state.workoutLog.some(function (x) { return x.exercise === 'Remo'; }));
  t('R5 · Windows NO re-subió (skipUpload, sin ping-pong)', server.backupWrites === 1);

  console.log('\n== Caso inverso: un dispositivo con copia vieja NO puede regresar la nube ==');
  const C = makeDevice('windows-viejo', 'u-123', mkWorkouts(42), true); // copia vieja de 42, sin canal
  C.sb.save(true);
  C.sb.__flushTimers();
  await sleep(40);
  const nube2 = server.backups['u-123'];
  t('R6 · La subida del dispositivo viejo conserva los 53 (fusión previa, sin regresión)',
    nube2.data.workoutLog.length === 53 && nube2.data.workoutLog.some(function (x) { return x.exercise === 'Remo'; }));

  console.log('\n==========================================');
  console.log('Resultado: ' + passed + ' pasaron · ' + failed + ' fallaron');
  console.log('==========================================');
  if (failed) {
    console.log('\nFallos:\n' + failures.map(function (f) { return '  ✗ ' + f; }).join('\n'));
    process.exit(1);
  }
  process.exit(0);
})();
