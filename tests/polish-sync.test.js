// ============================================================
// PRUEBAS v1.188.1 — Pulido alrededor de la sincronización
// (sin tocar el motor): instantánea diaria, registro sin internet
// y conflicto entre dispositivos (unión sin pérdidas).
// Uso: node tests/polish-sync.test.js
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

function mkBase(n) { return Array.from({ length: n }, function (_, i) { return { id: i + 1, date: '2026-08-10', exercise: 'E' + (i + 1) }; }); }

// ============================================================
// P1–P3: instantánea automática diaria (IndexedDB falso)
// ============================================================
console.log('\n== Instantánea automática diaria ==');

const fakeBackups = {};
const fakeData = {};
function makeStore(items) {
  return {
    get: function (label) { const r = { result: items[label] || null }; setTimeout(function () { r.onsuccess && r.onsuccess(); }, 0); return r; },
    put: function (obj, label) { items[label] = obj; const r = {}; setTimeout(function () { r.onsuccess && r.onsuccess(); }, 0); return r; },
    getAll: function () { const r = { result: Object.keys(items).map(function (k) { return items[k]; }) }; setTimeout(function () { r.onsuccess && r.onsuccess(); }, 0); return r; },
    delete: function (label) { delete items[label]; const r = {}; setTimeout(function () { r.onsuccess && r.onsuccess(); }, 0); return r; }
  };
}
const fakeDB = {
  transaction: function (name) {
    return { objectStore: function (s) { return s === 'backups' ? makeStore(fakeBackups) : makeStore(fakeData); } };
  }
};
const snapSb = {
  console: { log: function () {}, warn: function () {}, error: function () {} },
  openPersonalDB: async function () { return fakeDB; },
  saveVersionSnapshot: undefined, // se extrae la real
  state: { workoutLog: mkBase(42), profile: { nombre: 'R' }, lastModified: '2026-08-16T05:00:00Z' }
};
snapSb.window = snapSb;
vm.createContext(snapSb);
['saveVersionSnapshot', 'ppAutoSnapshot'].forEach(function (n) { vm.runInContext(extractFunc(HTML, n), snapSb); });

(async function () {
  const hoy = new Date().toISOString().slice(0, 10);
  await snapSb.ppAutoSnapshot();
  await snapSb.ppAutoSnapshot(); // segundo intento el mismo día
  t('P1 · La instantánea diaria se crea UNA vez por día (auto-<fecha>)',
    Object.keys(fakeBackups).length === 1 && !!fakeBackups['auto-' + hoy]);
  const estadoAntes = JSON.stringify(snapSb.state);
  t('P2 · La instantánea NUNCA sobrescribe el estado actual (solo escribe en backups)',
    JSON.stringify(snapSb.state) === estadoAntes && Object.keys(fakeData).length === 0);

  // P3: conserva máximo 10.
  for (let i = 0; i < 12; i++) fakeBackups['extra-' + i] = { label: 'extra-' + i, date: '2026-08-0' + (i % 10) + 'T00:00:00Z', json: '{}' };
  delete fakeBackups['auto-' + hoy];
  await snapSb.ppAutoSnapshot();
  t('P3 · Se conservan como máximo las 10 instantáneas más recientes', Object.keys(fakeBackups).length <= 10);

  // ============================================================
  // P4–P6: registro SIN internet → local → al volver sincroniza
  // ============================================================
  console.log('\n== Registro sin internet ==');
  const server = { row: { user_id: 'u-123', data: { workoutLog: mkBase(42), profile: { nombre: 'R' }, onboarded: true }, updated_at: '2026-08-16T05:00:00Z' }, uploads: 0 };

  function makeDevice(name, workouts, onLine) {
    const store = {};
    const sb = {
      console: { log: function () {}, warn: function () {}, error: function () {} },
      alert: function () {},
      document: {
        getElementById: function () { return { innerHTML: '', textContent: '', style: {}, remove: function () {}, appendChild: function () {} }; },
        createElement: function () { return { style: {}, appendChild: function () {}, remove: function () {} }; },
        body: { appendChild: function () {} }, head: { appendChild: function () {} },
        querySelector: function () { return null; }
      },
      $: function () { return null; },
      safeText: function (s) { return String(s == null ? '' : s); },
      navigator: { onLine: onLine },
      setTimeout: function (fn, ms) { return setTimeout(fn, ms); },
      clearTimeout: function () {},
      setInterval: function () { return 99; },
      clearInterval: function () {},
      state: { workoutLog: workouts.slice(), weight: [], meals: [], walks: [], expenses: [], diary: {}, profile: { nombre: 'R', onboarded: true }, onboarded: true, lastModified: '2026-08-16T05:10:00Z' },
      PP_SYNC: { kind: 'synced', downloaded: null, remoteChecked: false, remoteHasData: false },
      PP_SYNCCHAIN: [],
      _rtSocket: null, _rtTimer: null, _rtBackoff: 3000, _rtDebounce: null, _rtLastReply: 0, _rtJoined: 0, _rtEverConnected: false,
      _startupSynced: true, _syncing: false, _csBusy: false, _syncRetries: 0, _syncRetryTimer: null,
      _saveTimeout: null, _savePending: false, _autoSyncTimer: null,
      getCloudSession: function () { return { user: { id: 'u-123', email: name + '@x.y' }, access_token: 'tok-' + name }; },
      getCloudConfig: function () { return { url: 'https://xyz.supabase.co', key: 'KEY' }; },
      refreshCloudSession: async function () { return sb.getCloudSession(); },
      cloudRest: async function (p, options) {
        if (String(p).indexOf('personal_backups?user_id=eq.') >= 0) return [{ data: server.row.data, updated_at: server.row.updated_at }];
        if (String(p).indexOf('peso?user_id=eq.') >= 0) return [];
        if (options && options.method === 'POST') {
          server.uploads++;
          if (String(p).indexOf('personal_backups') >= 0) {
            const body = JSON.parse(options.body);
            server.row = { user_id: 'u-123', data: body.data, updated_at: body.updated_at || '2026-08-16T06:00:00Z' };
            return [server.row];
          }
          return []; // espejos granulares: no tocan la fila
        }
        return [];
      },
      setSync: function (kind, det) { sb.lastSyncKind = kind; },
      renderSyncUI: function () {}, renderSyncChain: function () {},
      render: function () {}, finishOnboardingDecision: function () {}, normalizeAllWeights: function () {}, cloudStatus: function () {},
      safeStorage: { get: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; }, set: function (k, v) { store[k] = String(v); return true; } },
      persistStateIDB: function () {}, ppLogErr: function () {}, lastSavedText: function () { return ''; },
      ppRenderUploadTrace: function () {}
    };
    sb.window = sb;
    vm.createContext(sb);
    ['_mergeArrays', '_mergeHabitosLog', '_mergeVehiculos', '_mergeProfile', 'mergeCloudStates',
      'mergeWeightLists', 'normalizeWeightEntry', 'ensureId', 'ppUUID', 'todayISO',
      'cloudSave', 'cloudStartupSync', 'mirrorGranular', 'scheduleAutoSync', 'save', '_doSave',
      'syncChainPush', 'ppRespBloqueada', 'ppWorkerOn', 'ppWorkerUrl']
      .forEach(function (n) { vm.runInContext(extractFunc(HTML, n), sb); });
    vm.runInContext((HTML.match(/var PROFILE_DEFAULTS=\{[^}]*\};/) || ['var PROFILE_DEFAULTS={};'])[0], sb);
    return sb;
  }

  const F = makeDevice('iphone-offline', mkBase(42), false); // sin internet
  F.state.workoutLog.push({ id: 9001, date: '2026-08-16', exercise: 'Remo offline', weight: 30, reps: '12' });
  F.save(true);
  await sleep(30);
  const guardado = JSON.parse(F.safeStorage.get('pp_full'));
  t('P4 · El registro sin internet queda guardado LOCALMENTE (y nada se sube)',
    guardado.workoutLog.length === 43 && server.uploads === 0);

  console.log('\n== Vuelve internet (flujo existente) ==');
  F.navigator.onLine = true;
  await F.cloudStartupSync({ _origin: 'online' });
  t('P5 · Al volver internet, el flujo EXISTENTE sube la unión (43 con Remo offline)',
    server.row.data.workoutLog.length === 43 && server.row.data.workoutLog.some(function (x) { return x.exercise === 'Remo offline'; }));
  t('P6 · Nada se perdió: la base de 42 sigue completa dentro de los 43',
    server.row.data.workoutLog.filter(function (x) { return x.id <= 42; }).length === 42);

  // ============================================================
  // P7–P8: conflicto entre dispositivos (ambos cambian antes de sincronizar)
  // ============================================================
  console.log('\n== Conflicto entre dispositivos ==');
  server.row = { user_id: 'u-123', data: { workoutLog: mkBase(42), profile: { nombre: 'R' }, onboarded: true }, updated_at: '2026-08-16T05:00:00Z' };
  const I2 = makeDevice('iphone', mkBase(42), false);
  const W2 = makeDevice('windows', mkBase(42), false);
  I2.state.workoutLog.push({ id: 7001, date: '2026-08-16', exercise: 'Remo (iPhone)', weight: 30, reps: '12' });
  W2.state.workoutLog.push({ id: 7002, date: '2026-08-16', exercise: 'Curl (Windows)', weight: 15, reps: '10' });
  I2.navigator.onLine = true; W2.navigator.onLine = true;
  await I2.cloudStartupSync({ _origin: 'online' }); // iPhone sube primero
  await W2.cloudStartupSync({ _origin: 'online' }); // Windows después
  t('P7 · La unión conserva AMBOS cambios (Remo del iPhone y Curl de Windows)',
    server.row.data.workoutLog.some(function (x) { return x.exercise === 'Remo (iPhone)'; })
    && server.row.data.workoutLog.some(function (x) { return x.exercise === 'Curl (Windows)'; }));
  t('P8 · Ningún dispositivo perdió sus registros (nube = 44 con ambos; el iPhone conserva su Remo)',
    server.row.data.workoutLog.length === 44
    && W2.state.workoutLog.length === 44
    && I2.state.workoutLog.length === 43
    && I2.state.workoutLog.some(function (x) { return x.exercise === 'Remo (iPhone)'; }));

  console.log('\n==========================================');
  console.log('Resultado: ' + passed + ' pasaron · ' + failed + ' fallaron');
  console.log('==========================================');
  if (failed) {
    console.log('\nFallos:\n' + failures.map(function (f) { return '  ✗ ' + f; }).join('\n'));
    process.exit(1);
  }
  process.exit(0);
})();
