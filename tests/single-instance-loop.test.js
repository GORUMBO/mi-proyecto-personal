// ============================================================
// PRUEBAS v1.187.9 — Bucle local de UNA sola instancia
// (Pendiente → Sincronizando → Sincronizado → Pendiente, sin
// tocar nada, con el iPhone apagado).
// Causa encontrada: calcMacros() corría en CADA render (bindAll)
// y terminaba con save() INCONDICIONAL → scheduleAutoSync →
// cloudSave → eventos realtime propios → merge → render → save…
// Además pisaba el perfil con defaults (150/170/30) cuando los
// inputs de Perfil no estaban montados.
// Uso: node tests/single-instance-loop.test.js
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

// "Servidor Supabase" simulado: devuelve a la MISMA instancia sus propios
// eventos (como hace Supabase real con postgres_changes).
const server = {
  backups: {}, rows: {}, wsClients: [], uploads: 0,
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

function makeSingleInstance(user_id, renderImpl) {
  const fakeEls = {};
  const timers = [];
  let wsInstance = null;
  let renders = 0;
  let scount = 0; // veces que corre scheduleAutoSync
  class FakeWS {
    constructor(url) { this.url = url; this.readyState = 1; wsInstance = this; server.wsClients.push(this); this.user_id = user_id; this.topics = []; }
    send(str) {
      const m = JSON.parse(str);
      if (m.event === 'phx_join') {
        this.topics.push(m.topic);
        this.onmessage({
          data: JSON.stringify({ event: 'phx_reply', payload: { status: 'ok', response: { postgres_changes: [{ id: 123 }] } }, ref: m.ref, topic: m.topic })
        });
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
      querySelector: function () { return null; } // pestaña Perfil NO montada (como en Inicio)
    },
    $: function (sel) { return sb.document.querySelector(sel); },
    safeText: function (s) { return String(s == null ? '' : s); },
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
    __pendingTimers: function () { return timers.filter(function (x) { return !x.done; }).length; },
    state: {
      workoutLog: [{ id: 1, date: '2026-08-13', exercise: 'Sentadilla', weight: 50, sets: 1, reps: '8', note: 'viejo' }],
      weight: [], meals: [], walks: [], expenses: [], diary: {},
      // Macros = resultado EXACTO del recálculo con peso 129 (así calcMacros no
      // encuentra cambio material y no guarda: estabilidad real).
      profile: { nombre: 'Ruben', peso: 129, altura: 168, edad: 25, objetivo: 'bajar grasa', _onbSeen: true,
                 calorias: 2624, proteina: 111, grasa: 53, carbos: 426 },
      onboarded: true, lastModified: '2026-08-14T08:00:00Z'
    },
    PP_SYNC: { kind: 'synced', downloaded: null, remoteChecked: false, remoteHasData: false },
    PP_SYNCCHAIN: [],
    _rtSocket: null, _rtTimer: null, _rtBackoff: 3000, _rtDebounce: null, _rtLastReply: 0, _rtJoined: 0,
    _startupSynced: true, _syncing: false, _csBusy: false, _syncRetries: 0, _syncRetryTimer: null,
    _saveTimeout: null, _savePending: false, _autoSyncTimer: null,
    getCloudSession: function () { return { user: { id: user_id, email: 'solo@x.y' }, access_token: 'tok-solo' }; },
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
    setSync: function () {},
    renderSyncUI: function () {},
    renderSyncChain: function () {},
    render: function () { renders++; renderImpl && renderImpl(sb); },
    finishOnboardingDecision: function () {},
    normalizeAllWeights: function () {},
    cloudStatus: function () {},
    safeStorage: {
      get: function (k) { return Object.prototype.hasOwnProperty.call(storageStore, k) ? storageStore[k] : null; },
      set: function (k, v) { storageStore[k] = String(v); return true; }
    },
    persistStateIDB: function () {},
    ppLogErr: function () {},
    lastSavedText: function () { return ''; }
  };
  sb.window = sb;
  vm.createContext(sb);
  ['_mergeArrays', '_mergeHabitosLog', '_mergeVehiculos', '_mergeProfile', 'mergeCloudStates',
    'mergeWeightLists', 'ensureId', 'todayISO', 'cloudStartupSync', 'cloudSave',
    'mirrorGranular', 'scheduleAutoSync', 'initRealtimeSync', 'syncChainPush', 'save', '_doSave',
    'calcMacros']
    .forEach(function (n) { vm.runInContext(extractFunc(HTML, n), sb); });
  vm.runInContext((HTML.match(/var PROFILE_DEFAULTS=\{[^}]*\};/) || ['var PROFILE_DEFAULTS={};'])[0], sb);
  // Contador de scheduleAutoSync (para verificar que NADIE marca dirty sin cambio material)
  const origSc = sb.scheduleAutoSync;
  sb.scheduleAutoSync = function () { scount++; return origSc.apply(this, arguments); };
  return { sb: sb, ws: function () { return wsInstance; }, chain: function () { return sb.PP_SYNCCHAIN; }, get renders() { return renders; }, get scount() { return scount; } };
}

(async function () {
  console.log('\n== UNA sola instancia: guarda → sube → recibe SUS propios eventos ==');
  server.backups = {}; server.rows = {}; server.wsClients = []; server.uploads = 0;
  const S = makeSingleInstance('u-123', function (sb) { try { sb.calcMacros(); } catch (e) {} }); // render simula bindAll: llama calcMacros

  S.sb.initRealtimeSync();
  const wsS = S.ws();
  if (wsS && wsS.onopen) wsS.onopen();
  t('L1 · La instancia única quedó suscrita a su propio canal', !!wsS && wsS.topics.indexOf('realtime:public:personal_backups:user_id=eq.u-123') >= 0);

  // Acción inicial (como registrar un ejercicio): save(true) → sube UNA vez.
  S.sb.state.workoutLog.push({ date: '2026-08-14', exercise: 'Press banca', weight: 25, sets: 1, reps: '10', note: 'Registro simple · Normal', id: 1723632600000 });
  S.sb.save(true);
  S.sb.__flushTimers(); await sleep(30); // save → cloudSave → eventos propios
  const uploadsTrasInicial = server.uploads;
  t('L2 · La acción inicial subió a Supabase (personal_backups + espejos granulares)', uploadsTrasInicial >= 2);

  // Ahora el ciclo realtime: sus propios eventos → merge → render (calcMacros) → …
  S.sb.__flushTimers(); await sleep(30); // debounce → cloudStartupSync(skipUpload) → merge → render
  S.sb.__flushTimers(); await sleep(30); // lo que el render hubiera programado
  const uploadsTrasMerge = server.uploads;
  const rendersTrasMerge = S.renders;
  t('L3 · Tras el merge de SUS eventos, NO hubo una nueva subida', uploadsTrasMerge === uploadsTrasInicial);
  t('L4 · El render corre pero calcMacros YA NO marca dirty ni guarda (perfil con macros ya calculadas)',
    S.scount === 1 && S.sb.state.profile.peso === 129 && S.sb.state.profile.edad === 25);

  // "Varios minutos sin tocar nada": varias rondas de flush = nada nuevo pendiente.
  let stable = true;
  for (let i = 0; i < 6; i++) { S.sb.__flushTimers(); await sleep(20); }
  stable = server.uploads === uploadsTrasInicial && S.sb.__pendingTimers() === 0 && S.sb.state.offlineChanges === 0;
  t('L5 · Estable: cero uploads nuevos y cero temporizadores pendientes tras varias rondas (sin tocar nada)',
    stable && server.uploads === uploadsTrasInicial);
  t('L6 · Cadena de diagnóstico coherente (subida → cambio recibido → fusionado)',
    S.chain().some(function (e) { return e.evento.indexOf('▲ Subido') >= 0; })
    && S.chain().some(function (e) { return e.evento.indexOf('▼ Cambio recibido') >= 0; })
    && S.chain().some(function (e) { return e.evento.indexOf('Estado fusionado') >= 0; }));

  console.log('\n== calcMacros: ya no pisa el perfil ni guarda sin cambio material ==');
  // Caso B1: inputs de Perfil NO montados (otra pestaña activa).
  const perfilAntes = JSON.stringify({ peso: S.sb.state.profile.peso, altura: S.sb.state.profile.altura, edad: S.sb.state.profile.edad, objetivo: S.sb.state.profile.objetivo });
  const scAntes = S.scount;
  S.sb.calcMacros();
  t('L7 · Sin inputs montados, el perfil conserva sus valores reales (nada de 150/170/30)',
    JSON.stringify({ peso: S.sb.state.profile.peso, altura: S.sb.state.profile.altura, edad: S.sb.state.profile.edad, objetivo: S.sb.state.profile.objetivo }) === perfilAntes);
  t('L8 · Y no dispara un guardado', S.scount === scAntes);

  // Caso B2: inputs con un valor nuevo → sí recalcula y guarda (el flujo del usuario sigue vivo).
  const inputs = { '#peso': { value: '140' }, '#altura': { value: '168' }, '#edad': { value: '25' }, '#objetivo': { value: 'ganar músculo' } };
  S.sb.document.querySelector = function (sel) { return inputs[sel] || null; };
  S.sb.calcMacros();
  S.sb.__flushTimers(); await sleep(10); // save() usa debounce de 100 ms → se vacía aquí
  t('L9 · Con el input de peso en 140 sí actualiza el perfil y guarda', S.sb.state.profile.peso === 140 && S.scount === scAntes + 1);

  console.log('\n== _doSave: sin cambio material no escribe ni marca dirty ==');
  const lmAntes = S.sb.state.lastModified;
  S.sb.save(); // sin cambios reales (solo lastModified distinto)
  S.sb.__flushTimers();
  t('L10 · Un save() sin cambios materiales NO escribe ni dispara sync (lastModified intacto)',
    S.sb.state.lastModified === lmAntes && S.scount === scAntes + 1);

  console.log('\n==========================================');
  console.log('Resultado: ' + passed + ' pasaron · ' + failed + ' fallaron');
  console.log('==========================================');
  if (failed) {
    console.log('\nFallos:\n' + failures.map(function (f) { return '  ✗ ' + f; }).join('\n'));
    process.exit(1);
  }
  process.exit(0);
})();
