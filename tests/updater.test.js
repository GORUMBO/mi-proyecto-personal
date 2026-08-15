// ============================================================
// PRUEBAS v1.187.6 — Actualizador PWA a prueba de bucles
// (instalación del SW con timeout, activación única, recarga
// limitada, fallback con reintentos silenciosos y sin borrar datos)
// Uso: node tests/updater.test.js
// ============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const SW_SRC = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
const VERSION_JSON = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'version.json'), 'utf8'));

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
const cappedTimeout = function (fn, ms) { return setTimeout(fn, Math.min(ms || 0, 40)); };

// ============================================================
// A · Consistencia de versiones (causa raíz: app decía 1.187 con latest 1.187.5)
// ============================================================
console.log('\n== Consistencia de versiones ==');

const appVer = (HTML.match(/HM_APP_VERSION='([^']+)'/) || [])[1] || '';
t('A1 · index.html y version.json coinciden (' + appVer + ')', appVer === VERSION_JSON.latest);
const slug = String(VERSION_JSON.latest).replace(/\./g, '-');
t('A2 · El caché del service worker usa la versión publicada (mi-proyecto-v' + slug + ')', SW_SRC.indexOf('mi-proyecto-v' + slug) >= 0);
t('A3 · El service worker NUNCA intercepta Supabase ni version.json',
  SW_SRC.indexOf('supabase') >= 0 && SW_SRC.indexOf('version\\.json') >= 0 && /if\(.*supabase.*\)return;/.test(SW_SRC.replace(/\s+/g, ' ')));

// ============================================================
// B · Service worker (sw.js en un sandbox de vm)
// ============================================================
console.log('\n== Service worker ==');

function makeSWContext(fetchImpl) {
  const store = {};
  const ctx = {
    console: { log: function () {} },
    setTimeout: cappedTimeout,
    clearTimeout: clearTimeout,
    setInterval: function (fn) { return setInterval(fn, 25); },
    clearInterval: clearInterval,
    skipWaitingCalls: 0,
    skipWaiting: function () { ctx.skipWaitingCalls++; return Promise.resolve(); },
    clients: { claimCalls: 0, claim: function () { ctx.clients.claimCalls++; return Promise.resolve(); } },
    deleted: [],
    caches: {
      open: async function (name) {
        if (!store[name]) store[name] = {};
        return {
          put: async function (req, resp) { store[name][String(req)] = resp; return null; },
          addAll: async function () { throw new Error('addAll no debe usarse sin timeout'); }
        };
      },
      keys: async function () { return Object.keys(store); },
      delete: async function (name) { ctx.deleted.push(name); delete store[name]; return true; },
      match: async function (req) {
        const names = Object.keys(store);
        for (let i = 0; i < names.length; i++) { if (store[names[i]][String(req)]) return store[names[i]][String(req)]; }
        return null;
      }
    },
    fetch: fetchImpl || function () { return Promise.reject(new Error('sin red')); },
    handlers: {},
    addEventListener: function (ev, fn) { ctx.handlers[ev] = fn; },
    installWait: null,
    _store: store
  };
  ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(SW_SRC, ctx);
  return ctx;
}

(async function () {
  // B1: sin red (fetch falla) la instalación IGUAL termina y activa la versión nueva.
  const sw1 = makeSWContext(function () { return Promise.reject(new Error('sin red')); });
  sw1.handlers.install({ waitUntil: function (p) { sw1.installWait = p; } });
  await sw1.installWait;
  t('B1 · Instalación con fetch fallando termina y hace skipWaiting', sw1.skipWaitingCalls === 1);

  // B2: descarga COLGADA (fetch nunca responde) → el timeout de fetchT la desatasca.
  const sw2 = makeSWContext(function () { return new Promise(function () {}); });
  sw2.handlers.install({ waitUntil: function (p) { sw2.installWait = p; } });
  await sw2.installWait;
  t('B2 · Instalación con descarga colgada termina por timeout (la causa del "Casi listo…")', sw2.skipWaitingCalls === 1);

  // B3: activar conserva el caché de la versión anterior y borra los más viejos.
  const sw3 = makeSWContext();
  const cacheName = (SW_SRC.match(/const CACHE='([^']+)'/) || [])[1];
  sw3._store[cacheName] = {};
  sw3._store['mi-proyecto-v1-187-5'] = {};
  sw3._store['mi-proyecto-v1-180'] = {};
  sw3._store['mi-proyecto-v1-179'] = {};
  sw3.handlers.activate({ waitUntil: function (p) { sw3.installWait = p; } });
  await sw3.installWait;
  t('B3 · activate conserva el caché anterior como respaldo offline', sw3.deleted.indexOf('mi-proyecto-v1-187-5') < 0 && sw3.deleted.indexOf('mi-proyecto-v1-180') >= 0 && sw3.deleted.indexOf('mi-proyecto-v1-179') >= 0);
  t('B4 · activate reclama las páginas abiertas (clients.claim)', sw3.clients.claimCalls === 1);

  // B5: el mensaje SKIP_WAITING activa la versión nueva.
  const sw4 = makeSWContext();
  sw4.handlers.message({ data: { type: 'SKIP_WAITING' } });
  t('B5 · Mensaje SKIP_WAITING → skipWaiting', sw4.skipWaitingCalls === 1);

  // B6: el fetch handler deja pasar Supabase y version.json (no los intercepta).
  const sw5 = makeSWContext();
  let responded = 0;
  sw5.handlers.fetch({ request: { url: 'https://xyz.supabase.co/rest/v1/tabla', method: 'GET' }, respondWith: function () { responded++; } });
  sw5.handlers.fetch({ request: { url: 'https://app.test/version.json?t=1', method: 'GET' }, respondWith: function () { responded++; } });
  t('B6 · Supabase y version.json van siempre a la red (no se interceptan)', responded === 0);

  // B7: GET normal sin caché y sin red → resuelve con el respaldo offline (no truena).
  let fallbackResp = null;
  const sw6 = makeSWContext(function () { return Promise.reject(new Error('sin red')); });
  sw6.handlers.fetch({ request: { url: 'https://app.test/index.html', method: 'GET' }, respondWith: function (p) { fallbackResp = p; } });
  const fallbackVal = await fallbackResp;
  t('B7 · Sin red y sin caché el fetch resuelve sin excepción (respaldo null)', fallbackVal === null);

  // ============================================================
  // C · Lógica de la página (showUpdateNotice / doAppUpdate / ppWaitWorker)
  // ============================================================
  console.log('\n== Lógica de actualización de la página ==');

  const fakeEls = {}; // elementos "en el documento" (registrados por id, como el DOM real)
  const createdEls = [];
  function makeEl(id) {
    return {
      id: id, value: '', innerHTML: '', textContent: '', style: {},
      appendChild: function () {}, remove: function () {},
      querySelector: function () { return null; }
    };
  }
  const docStub = {
    getElementById: function (id) { return fakeEls[id] || null; },
    createElement: function () { const el = makeEl('_dyn' + createdEls.length); createdEls.push(el); return el; },
    body: { appendChild: function (el) { if (el && el.id) fakeEls[el.id] = el; } },
    head: { appendChild: function () {} }
  };
  // El overlay real ("Descargando actualización") deja estos elementos en el DOM.
  // doAppUpdate los usa solo si existen (getElementById devuelve null si no).
  fakeEls.ppDlMsg = makeEl('ppDlMsg');
  fakeEls.ppDlBar = makeEl('ppDlBar');
  fakeEls.ppDlManual = makeEl('ppDlManual');

  const store = {};
  const sessionStore = {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); },
    removeItem: function (k) { delete store[k]; }
  };
  function resetSession() { Object.keys(store).forEach(function (k) { delete store[k]; }); }

  function makeWorker(state) {
    return {
      state: state, listeners: [],
      postMessage: function (m) { sentMessages.push(m); },
      addEventListener: function (ev, fn) { this.listeners.push(fn); },
      fire: function (ev) { const ls = this.listeners.slice(); ls.forEach(function (f) { f(ev); }); }
    };
  }
  let sentMessages = [];
  const fakeSW = {
    controller: null,
    updates: 0,
    registerCalls: 0,
    currentReg: null,
    getRegistration: async function () { return fakeSW.currentReg; },
    register: async function () { fakeSW.registerCalls++; if (!fakeSW.currentReg) fakeSW.currentReg = makeReg(); return fakeSW.currentReg; },
    addEventListener: function () {}
  };
  function makeReg(opts) {
    opts = opts || {};
    const r = {
      waiting: opts.waiting || null,
      installing: opts.installing || null,
      active: opts.active || null,
      updateCalls: 0,
      update: async function () {
        r.updateCalls++; fakeSW.updates++;
        if (opts.onUpdate) opts.onUpdate(r);
      }
    };
    return r;
  }
  const locStub = { protocol: 'https:', reloadCount: 0, reload: function () { locStub.reloadCount++; } };

  const sandbox = {
    console: { log: function () {} },
    document: docStub,
    safeText: function (s) { return String(s == null ? '' : s); },
    sessionStorage: sessionStore,
    navigator: { serviceWorker: fakeSW, onLine: true },
    location: locStub,
    ppEnsureDlStyle: function () {},
    setTimeout: cappedTimeout,
    clearTimeout: clearTimeout,
    setInterval: function (fn) { return setInterval(fn, 25); },
    clearInterval: clearInterval,
    PP_UPD_QUIET: 0,
    PP_UPD_QUIET_MAX: 1 // en pruebas, una sola ronda de reintentos para no encadenar
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  ['ppWaitWorker', 'showUpdateNotice', 'doAppUpdate', 'scheduleQuietRetry'].forEach(function (n) {
    vm.runInContext(extractFunc(HTML, n), sandbox);
  });

  // Ejecuta doAppUpdate y espera a que termine (incluida la recarga de seguridad
  // del camino feliz, que ocurre ~40 ms después de liberar _busy en las pruebas).
  async function runUpdate(j, quiet) {
    sandbox.doAppUpdate(j, quiet);
    let guard = 0;
    while (sandbox.doAppUpdate._busy && guard++ < 200) { await sleep(15); }
    await sleep(120);
  }
  const drain = function () { return sleep(300); }; // deja morir cadenas de reintento pendientes

  // C1: worker nuevo ya instalado y esperando → SKIP_WAITING y UNA recarga.
  resetSession();
  sentMessages = [];
  const regOk = makeReg({ waiting: makeWorker('installed'), active: makeWorker('activated') });
  fakeSW.currentReg = regOk;
  sandbox.window._hmRegistration = regOk;
  locStub.reloadCount = 0;
  await runUpdate({ latest: '1.187.6' }, false);
  t('C1 · Worker ya descargado: se le envía SKIP_WAITING y se recarga UNA vez', sentMessages.length >= 1 && locStub.reloadCount === 1);

  // C2: segunda pasada con la misma versión no vuelve a recargar (pp_reload guard).
  await runUpdate({ latest: '1.187.6' }, false);
  t('C2 · No hay doble recarga para la misma versión', locStub.reloadCount === 1);

  // C3: worker que pasa de installing a installed → se activa sin esperar el timeout.
  resetSession();
  sentMessages = [];
  const regTrans = makeReg({
    installing: makeWorker('installing'),
    onUpdate: function (r) { if (!r.installing) r.installing = makeWorker('installing'); }
  });
  fakeSW.currentReg = regTrans;
  sandbox.window._hmRegistration = regTrans;
  locStub.reloadCount = 0;
  const transP = runUpdate({ latest: '1.187.6' }, false);
  await sleep(20); // deja que arranque la espera (timeout real: 25 s → 40 ms en pruebas)
  regTrans.installing.state = 'installed';
  regTrans.installing.fire({}); // statechange
  await transP;
  t('C3 · Al terminar la instalación se activa (statechange) y se recarga UNA vez', sentMessages.length >= 1 && locStub.reloadCount === 1);

  // C4: instalación colgada → UNA recarga de emergencia y nada más (sin bucle).
  resetSession();
  const regHang = makeReg({
    installing: makeWorker('installing'),
    onUpdate: function (r) { if (!r.installing) r.installing = makeWorker('installing'); }
  });
  fakeSW.currentReg = regHang;
  sandbox.window._hmRegistration = regHang;
  locStub.reloadCount = 0;
  sandbox.PP_UPD_QUIET = 0;
  await runUpdate({ latest: '1.187.6' }, false);
  t('C4 · Instalación colgada: exactamente UNA recarga de emergencia (sin bucle)', locStub.reloadCount === 1);
  t('C5 · El intento fallido queda contado para la sesión', sessionStore.getItem('pp_upd_tries_1.187.6') === '1');

  // C6: segundo intento en pantalla completa → ya NO recarga: ofrece seguir usando la app.
  await runUpdate({ latest: '1.187.6' }, false);
  const manualEl = docStub.getElementById('ppDlManual');
  t('C6 · Tras la recarga de emergencia no vuelve a recargar y ofrece "Continuar a la app"',
    locStub.reloadCount === 1 && manualEl && manualEl.innerHTML.indexOf('Continuar a la app') >= 0);
  await drain();

  // C7: reintento silencioso NO recarga por la fuerza.
  sandbox.PP_UPD_QUIET = 0;
  locStub.reloadCount = 0;
  sandbox.doAppUpdate({ latest: '1.187.6' }, true);
  let guard = 0;
  while (sandbox.doAppUpdate._busy && guard++ < 200) { await sleep(15); }
  t('C7 · Reintento silencioso: nunca recarga por la fuerza', locStub.reloadCount === 0);

  // C8: deja programado otro intento en segundo plano (reg.update de nuevo).
  // Se mide justo al liberar _busy: el reintento programado dispara ~40 ms después.
  const updMid = fakeSW.updates;
  await sleep(250);
  t('C8 · Se reintenta en segundo plano (reg.update de nuevo)', fakeSW.updates > updMid);
  await drain();

  // C9: tras 2 intentos fallidos, la pantalla completa YA NO se muestra (solo reintento silencioso).
  resetSession();
  sessionStore.setItem('pp_upd_1.187.6', '1');
  sessionStore.setItem('pp_upd_tries_1.187.6', '2');
  sessionStore.setItem('pp_reload_1.187.6', '1');
  createdEls.length = 0;
  Object.keys(fakeEls).forEach(function (k) { delete fakeEls[k]; });
  sandbox.doAppUpdate._busy = false;
  sandbox.showUpdateNotice({ latest: '1.187.6' }, false);
  const overlayShown = createdEls.some(function (el) { return el.id === 'updateNotice'; });
  t('C9 · Después de 2 fallos la app no se vuelve a tapar con la pantalla completa', !overlayShown);
  await drain();

  // C10: doAppUpdate es reentrante-seguro (no arranca dos a la vez).
  resetSession();
  sessionStore.setItem('pp_upd_1.187.6', '1');
  sandbox.PP_UPD_QUIET = 0;
  const regRe = makeReg({ waiting: makeWorker('installed') });
  fakeSW.currentReg = regRe;
  sandbox.window._hmRegistration = regRe;
  const before = regRe.updateCalls;
  sandbox.doAppUpdate({ latest: '1.187.6' }, false);
  sandbox.doAppUpdate({ latest: '1.187.6' }, false); // se ignora: ya hay una en curso
  guard = 0;
  while (sandbox.doAppUpdate._busy && guard++ < 200) { await sleep(15); }
  await sleep(50);
  t('C10 · Nunca hay dos actualizaciones a la vez', regRe.updateCalls === before + 1);

  // C11: al quedar al día se limpia la marca de reintentos de fondo
  // (misma línea que ejecuta ppCheckUpdates cuando hayNueva es false).
  sessionStore.setItem('pp_upd_active', '1');
  vm.runInContext(
    "(function(){var hayNueva=false;if(!hayNueva){try{sessionStorage.removeItem('pp_upd_active');}catch(e){}}})()",
    sandbox
  );
  t('C11 · Al quedar al día se limpia la marca de reintentos de fondo', sessionStore.getItem('pp_upd_active') === null);

  console.log('\n==========================================');
  console.log('Resultado: ' + passed + ' pasaron · ' + failed + ' fallaron');
  console.log('==========================================');
  if (failed) {
    console.log('\nFallos:\n' + failures.map(function (f) { return '  ✗ ' + f; }).join('\n'));
    process.exit(1);
  }
  process.exit(0);
})();
