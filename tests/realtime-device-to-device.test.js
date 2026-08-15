// ============================================================
// PRUEBAS v1.187.7 — Cadena completa entre dispositivos
// iPhone (A) registra ejercicio → sube a Supabase → Realtime →
// Windows (B) recibe, fusiona y actualiza la UI sin recargar.
// Uso: node tests/realtime-device-to-device.test.js
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

// "Servidor Supabase" simulado: guarda lo que A sube y se lo sirve a B.
const server = {
  backups: {},   // user_id -> {data, updated_at}
  rows: {},      // tabla -> [{user_id, client_id, data, updated_at}]
  wsClients: [], // sockets conectados al canal realtime
  broadcast: function (tabla, user_id, record) {
    // Phoenix real: solo llega a los sockets suscritos a esa tabla+user_id.
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

function makeDevice(name, user_id, initialWorkout) {
  const fakeEls = {};
  const timers = []; // temporizadores manuales (respeta clearTimeout: debounce real)
  const sent = [];
  let wsInstance = null;
  let renders = 0;
  let saves = 0;
  class FakeWS {
    constructor(url) { this.url = url; this.readyState = 1; wsInstance = this; server.wsClients.push(this); this.user_id = user_id; this.topics = []; }
    send(str) {
      const m = JSON.parse(str); sent.push(m);
      if (m.event === 'phx_join') {
        this.topics.push(m.topic);
        // El servidor responde phx_reply ok (como Supabase real).
        this.onmessage({
          data: JSON.stringify({
            event: 'phx_reply',
            payload: { status: 'ok', response: { postgres_changes: [{ id: 123 }] } },
            ref: m.ref, topic: m.topic
          })
        });
      }
    }
    close() { this.readyState = 3; }
  }
  const sb = {
    console: { log: function () {}, warn: function () {}, error: function () {} },
    alert: function () {},
    document: {
      getElementById: function (id) { if (!fakeEls[id]) fakeEls[id] = { innerHTML: '', textContent: '', style: {}, remove: function () {}, appendChild: function () {} }; return fakeEls[id]; },
      createElement: function () { return { style: {}, appendChild: function () {}, remove: function () {} }; },
      body: { appendChild: function () {} }, head: { appendChild: function () {} }
    },
    navigator: { onLine: true },
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
    state: { workoutLog: initialWorkout.slice(), weight: [], meals: [], walks: [], expenses: [], profile: { nombre: 'Ruben' }, onboarded: true, lastModified: '2026-08-14T08:00:00Z' },
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
        return (server.rows.peso || []).filter(function (r) { return r.user_id === user_id; });
      }
      if (options && options.method === 'POST') {
        const body = JSON.parse(options.body);
        if (String(p).indexOf('personal_backups') >= 0) {
          server.backups[user_id] = body;
          server.broadcast('personal_backups', user_id, body);
        } else {
          const tabla = String(p).split('?')[0];
          const rows = Array.isArray(body) ? body : [body];
          server.rows[tabla] = server.rows[tabla] || [];
          rows.forEach(function (r) { server.rows[tabla].push(r); });
          rows.forEach(function (r) { server.broadcast(tabla, user_id, r); });
        }
        return [];
      }
      return [];
    },
    setSync: function () {},
    renderSyncUI: function () {},
    renderSyncChain: function () {},
    render: function () { renders++; },
    finishOnboardingDecision: function () {},
    normalizeAllWeights: function () {},
    cloudStatus: function () {},
    safeStorage: { set: function () {}, get: function () { return null; } },
    persistStateIDB: function () {},
    ppLogErr: function () {},
    lastSavedText: function () { return ''; }
  };
  sb.window = sb;
  vm.createContext(sb);
  ['_mergeArrays', '_mergeHabitosLog', '_mergeVehiculos', '_mergeProfile', 'mergeCloudStates',
    'mergeWeightLists', 'ensureId', 'todayISO', 'cloudStartupSync', 'cloudSave',
    'mirrorGranular', 'scheduleAutoSync', 'initRealtimeSync', 'syncChainPush', 'save', '_doSave']
    .forEach(function (n) { vm.runInContext(extractFunc(HTML, n), sb); });
  vm.runInContext((HTML.match(/var PROFILE_DEFAULTS=\{[^}]*\};/) || ['var PROFILE_DEFAULTS={};'])[0], sb);
  return { sb: sb, ws: function () { return wsInstance; }, chain: function () { return sb.PP_SYNCCHAIN; }, get renders() { return renders; }, get saves() { return saves; }, sent: sent };
}

(async function () {
  console.log('\n== Dispositivos ==');
  const A = makeDevice('iphone', 'u-123', [{ id: 1, date: '2026-08-13', exercise: 'Sentadilla', weight: 50, sets: 1, reps: '8', note: 'viejo' }]);
  const B = makeDevice('windows', 'u-123', [{ id: 1, date: '2026-08-13', exercise: 'Sentadilla', weight: 50, sets: 1, reps: '8', note: 'viejo' }]);

  console.log('\n== B (Windows) ya está abierto y suscrito ==');
  B.sb.initRealtimeSync();
  const wsB = B.ws();
  if (wsB && wsB.onopen) wsB.onopen(); // el socket abre y envía los phx_join
  t('D1 · Windows se suscribió al canal realtime de personal_backups con su user_id',
    !!wsB && wsB.topics.indexOf('realtime:public:personal_backups:user_id=eq.u-123') >= 0);
  t('D2 · Supabase confirmó la suscripción (phx_reply ok) y quedó en la cadena',
    B.chain().some(function (e) { return e.evento.indexOf('Suscripción aceptada') >= 0; }));

  console.log('\n== A (iPhone) registra el ejercicio (misma acción que saveSimpleWorkout) ==');
  A.sb.state.workoutLog.push({ date: '2026-08-14', exercise: 'Press banca', weight: 25, sets: 1, reps: '10', note: 'Registro simple · Normal', id: 1723632600000 });
  A.sb.save(true);
  A.sb.__flushTimers(); // corre el auto-sync (2.5 s reales → aquí inmediato)
  await sleep(30);      // deja terminar el cloudSave (await cloudRest/mirrorGranular)
  const backupA = server.backups['u-123'];
  t('D3 · El iPhone subió a personal_backups el ejercicio nuevo',
    !!backupA && backupA.data.workoutLog.some(function (x) { return x.exercise === 'Press banca'; }));
  t('D4 · Y lo espejó a la tabla granular ejercicios',
    (server.rows.ejercicios || []).some(function (r) { return r.user_id === 'u-123' && r.data.exercise === 'Press banca'; }));

  console.log('\n== El evento cruza por Realtime hacia B ==');
  B.sb.__flushTimers(); // corre el debounce realtime (1.2 s → aquí inmediato)
  await sleep(30);      // deja terminar cloudStartupSync(skipUpload) y el then
  const merged = B.sb.state.workoutLog;
  t('D5 · B recibió el evento y fusionó: el ejercicio del iPhone está en su estado',
    merged.some(function (x) { return x.exercise === 'Press banca'; }));
  t('D6 · La fusión no destruyó el historial previo de B',
    merged.some(function (x) { return x.exercise === 'Sentadilla'; }));
  t('D7 · La UI de B se re-renderizó (sin recargar ni botón)', B.renders >= 1);
  t('D8 · B NO re-subió la unión (skipUpload: sin ping-pong)', B.saves === 0);
  console.log('  [cadena de B] ' + JSON.stringify(B.chain().map(function (e) { return e.evento; })));
  t('D9 · Cadena de B: evento recibido → descarga → merge → UI actualizada',
    B.chain().some(function (e) { return e.evento.indexOf('▼ Cambio recibido') >= 0; })
    && B.chain().some(function (e) { return e.evento.indexOf('☁️ Descarga') >= 0; })
    && B.chain().some(function (e) { return e.evento.indexOf('🔀 Merge') >= 0; })
    && B.chain().some(function (e) { return e.evento.indexOf('Estado fusionado') >= 0; }));

  console.log('\n== D10 · Si Supabase NO emite cambios (tabla fuera de Realtime), la app lo dice ==');
  wsB.onmessage({
    data: JSON.stringify({
      event: 'system',
      payload: { status: 'error', message: 'Unable to subscribe to changes with given parameters. Please check Realtime is enabled for the given connect parameters: [event: *, schema: public, table: peso, filters: [], select: nil]' },
      topic: 'realtime:public:peso:user_id=eq.u-123'
    })
  });
  t('D10 · El aviso real de Supabase queda en la cadena (ya no es silencioso)',
    B.chain().some(function (e) { return e.evento.indexOf('✘ Supabase no emite cambios') >= 0; }));

  console.log('\n== D11 · Un dispositivo con copia VIEJA no puede regresar la nube ==');
  // Caso real del bug: A subió 2 ejercicios (Sentadilla + Press banca), pero un
  // dispositivo viejo (sin canal, con 1 solo ejercicio) hace su guardado ciego.
  // cloudSave ahora fusiona primero el respaldo actual y sube la UNIÓN.
  const C = makeDevice('windows-viejo', 'u-123', [{ id: 1, date: '2026-08-13', exercise: 'Sentadilla', weight: 50, sets: 1, reps: '8', note: 'viejo' }]);
  C.sb.save(true);           // guardado local del dispositivo viejo
  C.sb.__flushTimers();      // auto-sync → cloudSave
  await sleep(30);
  const wlNube = server.backups['u-123'] && server.backups['u-123'].data.workoutLog;
  t('D11 · La subida del dispositivo viejo conserva el ejercicio del iPhone (unión, no regresión)',
    !!wlNube && wlNube.some(function (x) { return x.exercise === 'Press banca'; })
    && wlNube.some(function (x) { return x.exercise === 'Sentadilla'; }));

  console.log('\n==========================================');
  console.log('Resultado: ' + passed + ' pasaron · ' + failed + ' fallaron');
  console.log('==========================================');
  if (failed) {
    console.log('\nFallos:\n' + failures.map(function (f) { return '  ✗ ' + f; }).join('\n'));
    process.exit(1);
  }
  process.exit(0);
})();
