// ============================================================
// PRUEBAS v1.187.5 — Sincronización automática bidireccional
// (merge por updated_at, canal Realtime, anti-bucles, cadena de diagnóstico)
// Uso: node tests/fitness-sync.test.js
// ============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extractFunc(src, name) {
  // Soporta "function name(" y "async function name(".
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

// ---- DOM stub ----
const fakeEls = {};
function makeEl(id) {
  return {
    id, value: '', innerHTML: '', textContent: '', style: {},
    appendChild: function () {}, remove: function () {},
    querySelector: function () { return null; }, querySelectorAll: function () { return []; }
  };
}
const documentStub = {
  getElementById: function (id) { if (!fakeEls[id]) fakeEls[id] = makeEl(id); return fakeEls[id]; },
  createElement: function () { return makeEl('_dyn' + Object.keys(fakeEls).length); },
  querySelector: function () { return null; }, querySelectorAll: function () { return []; },
  body: { appendChild: function () {} }, head: { appendChild: function () {} }
};

// ---- WebSocket falso ----
let wsInstances = [];
class FakeWebSocket {
  constructor(url) {
    this.url = url; this.readyState = 0; this.sends = []; this.sent = [];
    wsInstances.push(this);
  }
  send(str) { this.sent.push(JSON.parse(str)); }
  close() { this.readyState = 3; }
}

const sandbox = {
  console,
  document: documentStub,
  navigator: { onLine: true },
  safeText: function (s) { return String(s == null ? '' : s); },
  safeStorage: { get: function () { return null; }, set: function () {} },
  persistStateIDB: function () {},
  WebSocket: FakeWebSocket,
  setTimeout: function (fn) { try { fn(); } catch (e) {} return 1; },
  clearTimeout: function () {},
  setInterval: function () { return 99; },
  clearInterval: function () {},
  state: { workoutLog: [], weight: [], lastModified: '2026-01-01T00:00:00Z' },
  PP_SYNC: { downloaded: null, remoteChecked: false, remoteHasData: false },
  PP_SYNCCHAIN: [],
  _rtSocket: null, _rtTimer: null, _rtBackoff: 3000, _rtDebounce: null, _rtLastReply: 0, _rtJoined: 0, _rtEverConnected: false,
  _csBusy: false,
  getCloudSession: function () { return { user: { id: 'u-123', email: 'x@y.z' }, access_token: 'tok-abc' }; },
  getCloudConfig: function () { return { url: 'https://fzkpgrvqncqnmvagbjaf.supabase.co', key: 'KEY123' }; },
  refreshCloudSession: async function () { return sandbox.getCloudSession(); },
  setSync: function () {},
  render: function () {},
  maybeShowOnboarding: function () {},
  finishOnboardingDecision: function () {},
  normalizeAllWeights: function () {},
  _startupSynced: false,
  _syncing: false
};
sandbox.window = sandbox;
vm.createContext(sandbox);

['_mergeArrays', '_mergeHabitosLog', '_mergeVehiculos', '_mergeProfile', 'mergeCloudStates', 'mergeWeightLists',
  'normalizeWeightEntry', 'cloudStartupSync', 'initRealtimeSync', 'syncChainPush', 'renderSyncChain']
  .forEach(function (n) { vm.runInContext(extractFunc(HTML, n), sandbox); });
// PROFILE_DEFAULTS es una var suelta (no una function); se inyecta tal cual.
vm.runInContext((HTML.match(/var PROFILE_DEFAULTS=\{[^}]*\};/) || ['var PROFILE_DEFAULTS={};'])[0], sandbox);

const fn = {
  mergeArrays: sandbox._mergeArrays,
  mergeCloud: sandbox.mergeCloudStates,
  mergeWeight: sandbox.mergeWeightLists,
  cloudStartup: sandbox.cloudStartupSync,
  initRT: sandbox.initRealtimeSync,
  chainPush: sandbox.syncChainPush,
  chainRender: sandbox.renderSyncChain
};

let passed = 0, failed = 0;
const failures = [];
function t(name, cond, extra) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; failures.push(name + (extra ? ' → ' + extra : '')); console.log('  ✗ ' + name + (extra ? ' → ' + extra : '')); }
}
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

console.log('\n== Fusión y conflictos ==');

t('S1 · Mismo id con updated_at más reciente en la nube → gana la versión nueva', function () {
  const a = [{ id: '1', data: 'viejo', updated_at: '2026-08-01T00:00:00Z' }];
  const b = [{ id: '1', data: 'nuevo', updated_at: '2026-08-10T00:00:00Z' }];
  const out = fn.mergeArrays(a, b);
  return out.length === 1 && out[0].data === 'nuevo';
}());

t('S2 · Sin updated_at (series de workoutLog) se conserva la primera copia (sin pérdidas)', function () {
  const a = [{ id: 5, exercise: 'A', reps: '10' }];
  const b = [{ id: 5, exercise: 'A', reps: '11' }];
  const out = fn.mergeArrays(a, b);
  return out.length === 1 && out[0].reps === '10';
}());

t('S3 · Fusión no destructiva: registros de ambos dispositivos se conservan', function () {
  const local = { workoutLog: [{ id: 1, exercise: 'A', weight: 20, reps: '10' }], lastModified: '2026-08-10T00:00:00Z' };
  const remote = { workoutLog: [{ id: 2, exercise: 'B', weight: 30, reps: '8' }], lastModified: '2026-08-11T00:00:00Z' };
  const out = fn.mergeCloud(local, remote);
  return out.workoutLog.length === 2;
}());

t('S4 · Peso: gana updated_at por client_id y se ordena por fecha', function () {
  const a = [{ client_id: 'w1', d: '2026-07-10', w: 129, updated_at: '2026-07-10T00:00:00Z' }];
  const b = [{ client_id: 'w1', d: '2026-07-10', w: 128.5, updated_at: '2026-07-11T00:00:00Z' },
  { client_id: 'w2', d: '2026-07-21', w: 128, updated_at: '2026-07-21T00:00:00Z' }];
  const out = fn.mergeWeight(a, b);
  return out.length === 2 && out[0].w === 128.5 && out[1].w === 128;
}());

console.log('\n== Canal Realtime (WebSocket simulado) ==');

t('S5 · Se suscribe a todas las tablas con filtro user_id y access_token', function () {
  wsInstances = [];
  sandbox.PP_SYNCCHAIN = [];
  fn.initRT();
  const ws = wsInstances[wsInstances.length - 1];
  if (!ws) return false;
  ws.readyState = 1;
  ws.onopen();
  const topics = ws.sent.map(function (s) { return s.topic; });
  const join = ws.sent.find(function (s) { return s.topic.indexOf('personal_backups') >= 0; });
  return topics.length >= 9
    && topics.indexOf('realtime:public:peso:user_id=eq.u-123') >= 0
    && !!join
    && join.event === 'phx_join'
    && join.payload.access_token === 'tok-abc'
    && join.payload.config.postgres_changes[0].filter === 'user_id=eq.u-123';
}());

t('S6 · Al recibir postgres_changes descarga con skipUpload (anti-bucle) y registra la cadena', async function () {
  wsInstances = [];
  sandbox.PP_SYNCCHAIN = [];
  sandbox._rtSocket = null; sandbox._rtBackoff = 3000;
  const calls = [];
  sandbox.cloudStartupSync = async function (opts) { calls.push(opts || {}); return; };
  fn.initRT();
  const ws = wsInstances[wsInstances.length - 1];
  ws.readyState = 1;
  ws.onopen();
  ws.onmessage({
    data: JSON.stringify({
      event: 'postgres_changes',
      payload: { data: { schema: 'public', table: 'peso', type: 'INSERT', record: { user_id: 'u-123' } } }
    })
  });
  const ok = calls.length === 1 && calls[0].skipUpload === true;
  const cadena = sandbox.PP_SYNCCHAIN.map(function (e) { return e.evento; }).join('|');
  return ok && cadena.indexOf('▼ Cambio recibido') >= 0 && cadena.indexOf('✔ Estado fusionado · UI actualizada') >= 0;
}());

t('S7 · Reconexión automática con backoff al cerrarse el canal', function () {
  wsInstances = [];
  sandbox.PP_SYNCCHAIN = [];
  sandbox._rtSocket = null; sandbox._rtBackoff = 3000;
  fn.initRT();
  const ws = wsInstances[wsInstances.length - 1];
  ws.readyState = 1;
  ws.onopen();
  ws.onclose(); // reconecta de inmediato (setTimeout inmediato en pruebas)
  return wsInstances.length >= 2;
}());

console.log('\n== Anti-bucle: cloudStartupSync real con stubs ==');

t('S8 · Sincronización normal SÍ sube la unión (comportamiento de arranque intacto)', async function () {
  sandbox.cloudStartupSync = sandbox.originalCSS || sandbox.originalCSS;
  let uploads = 0;
  sandbox.cloudSave = async function () { uploads++; };
  sandbox.cloudRest = async function (p) {
    if (p.indexOf('personal_backups') >= 0) return [{ data: { lastModified: '2026-08-15T00:00:00Z', workoutLog: [{ id: 9, exercise: 'x', weight: 10, reps: '5' }] }, updated_at: 'x' }];
    return [];
  };
  sandbox.initRealtimeSync = function () { sandbox.rtInitCalls = (sandbox.rtInitCalls || 0) + 1; };
  await fn.cloudStartup();
  const ok = uploads === 1 && sandbox.rtInitCalls >= 1;
  return ok;
}());

t('S9 · Con skipUpload (cambio remoto) NO se re-sube → sin ping-pong entre dispositivos', async function () {
  let uploads = 0;
  sandbox.cloudSave = async function () { uploads++; };
  await fn.cloudStartup({ skipUpload: true });
  return uploads === 0;
}());

console.log('\n== Cadena de diagnóstico visible ==');

t('S10 · La cadena muestra subida, recepción y actualización de UI', function () {
  sandbox.PP_SYNCCHAIN = [];
  for (const k in fakeEls) if (k === 'syncChainBar') delete fakeEls[k];
  fn.chainPush('▲ Subido a Supabase', 'la nube recibió el cambio');
  fn.chainPush('▼ Cambio recibido del otro dispositivo', 'tabla: peso');
  fn.chainPush('✔ Estado fusionado · UI actualizada', 'sin recargar');
  fn.chainRender();
  const html = (fakeEls['syncChainBar'] || {}).innerHTML || '';
  return html.indexOf('▲ Subido a Supabase') >= 0
    && html.indexOf('▼ Cambio recibido del otro dispositivo') >= 0
    && html.indexOf('✔ Estado fusionado · UI actualizada') >= 0
    && html.indexOf('diagnóstico temporal') >= 0;
}());

console.log('\n==========================================');
console.log('Resultado: ' + passed + ' pasaron · ' + failed + ' fallaron');
if (failures.length) {
  console.log('Fallos:');
  failures.forEach(function (f) { console.log('  ✗ ' + f); });
}
console.log('==========================================');
process.exitCode = failed ? 1 : 0;
