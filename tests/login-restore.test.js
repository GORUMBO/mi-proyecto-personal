// ============================================================
// PRUEBAS v1.187.7 — Restauración de perfil tras iniciar sesión
// (onboarding solo si Supabase confirma que no hay perfil; merge
// de perfil campo a campo que nunca pisa valores reales)
// Uso: node tests/login-restore.test.js
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

// ============================================================
// B · Fusión de perfiles (pura, sin DOM)
// ============================================================
console.log('\n== Fusión de perfiles ==');

const mergeSandbox = {
  console,
  PROFILE_DEFAULTS: { edad: 30, peso: 150, altura: 170, objetivo: 'ganar músculo', actividad: 'muy alta', pasosDia: 18000 }
};
vm.createContext(mergeSandbox);
['_mergeProfile', 'mergeCloudStates', '_mergeArrays', '_mergeHabitosLog', '_mergeVehiculos']
  .forEach(function (n) { vm.runInContext(extractFunc(HTML, n), mergeSandbox); });

t('B1 · Un campo vacío nunca pisa un valor real del otro lado', function () {
  const a = { nombre: '', edad: 25 };
  const b = { nombre: 'Ruben', edad: null };
  const out = mergeSandbox._mergeProfile(a, b, 0, 0);
  return out.nombre === 'Ruben' && out.edad === 25;
}());

t('B2 · Un valor por defecto del registro inicial nunca pisa un valor real', function () {
  const defaults = { edad: 30, peso: 150, altura: 170, objetivo: 'ganar músculo', pasosDia: 18000 };
  const real = { edad: 25, peso: 129, altura: 168, objetivo: 'bajar grasa', pasosDia: 9000 };
  const out = mergeSandbox._mergeProfile(defaults, real, 0, 0);
  return out.peso === 129 && out.edad === 25 && out.altura === 168 && out.objetivo === 'bajar grasa' && out.pasosDia === 9000;
}());

t('B3 · Con valores reales distintos gana el del lastModified más reciente', function () {
  const a = { peso: 129 };
  const b = { peso: 131 };
  const newerA = mergeSandbox._mergeProfile(a, b, 2000, 1000);
  const newerB = mergeSandbox._mergeProfile(a, b, 1000, 2000);
  return newerA.peso === 129 && newerB.peso === 131;
}());

t('B4 · Un perfil degradado por defaults en un dispositivo nuevo no contamina el real', function () {
  const local = { profile: { nombre: '', edad: 30, peso: 150, preferencias: '' }, weight: [], lastModified: '2026-08-14T12:00:00Z' };
  const remote = { profile: { nombre: 'Ruben', edad: 25, peso: 129, preferencias: 'sin cerdo' }, weight: [{ id: 'w1', w: 129 }], lastModified: '2026-08-10T10:00:00Z', onboarded: true };
  const out = mergeSandbox.mergeCloudStates(local, remote);
  return out.profile.nombre === 'Ruben' && out.profile.peso === 129 && out.profile.edad === 25 && out.profile.preferencias === 'sin cerdo' && out.weight.length === 1;
}());

t('B5 · El registro inicial es pegajoso (no se vuelve a pedir si ya existía)', function () {
  const local = { lastModified: '2026-08-14T12:00:00Z' };
  const remote = { onboarded: true, lastModified: '2026-08-10T10:00:00Z' };
  const out = mergeSandbox.mergeCloudStates(local, remote);
  return out.onboarded === true;
}());

// ============================================================
// A · Decisión del onboarding (con DOM y sesión simulados)
// ============================================================
console.log('\n== Decisión del registro inicial ==');

const fakeEls = {};
const removed = [];
const chain = [];
let onboardingShows = 0;
function makeEl(id) {
  return {
    id: id, innerHTML: '', textContent: '', style: {},
    remove: function () { removed.push(this.id); delete fakeEls[this.id]; },
    appendChild: function () {}
  };
}
const docStub = {
  getElementById: function (id) { return fakeEls[id] || null; },
  createElement: function () { const el = makeEl('_dyn'); return el; },
  body: { appendChild: function (el) { if (el && el.id) fakeEls[el.id] = el; } }
};
let hasSession = false;
let remoteChecked = false;
let remoteHasData = false;
let onboarded = false;

const sb = {
  console,
  document: docStub,
  state: { onboarded: false },
  PP_SYNC: { remoteChecked: false, remoteHasData: false },
  PP_SYNCCHAIN: chain,
  getCloudSession: function () { return hasSession ? { user: { id: 'u-123', email: 'x@y.z' } } : null; },
  syncChainPush: function (msg, detail) { chain.push(msg + '|' + detail); },
  showOnboarding: function () {
    if (sb.state.onboarded) return;
    if (fakeEls.onboardingModal) return;
    onboardingShows++;
    const el = makeEl('onboardingModal');
    fakeEls.onboardingModal = el;
  },
  maybeShowOnboarding: function () { if (!sb.state.onboarded) sb.showOnboarding(); }
};
sb.window = sb;
vm.createContext(sb);
// Se extraen SOLO las funciones bajo prueba; maybeShowOnboarding/showOnboarding
// quedan como stubs contadores (el modal real necesita DOM completo y KITCHEN_*).
['finishOnboardingDecision', 'closeLoginScreen'].forEach(function (n) {
  vm.runInContext(extractFunc(HTML, n), sb);
});
// state.onboarded se re-lee del sandbox en cada test vía esta ref
function setFlags(sess, checked, hasData, onb) {
  hasSession = sess; remoteChecked = checked; remoteHasData = hasData; onboarded = onb;
  sb.state.onboarded = onb;
  sb.PP_SYNC.remoteChecked = checked;
  sb.PP_SYNC.remoteHasData = hasData;
  sb.PP_SYNC._onbNoteShown = false;
  Object.keys(fakeEls).forEach(function (k) { delete fakeEls[k]; });
  onboardingShows = 0; chain.length = 0;
}

// A1/A2: closeLoginScreen no dispara onboarding cuando hay sesión.
setFlags(false, false, false, false);
sb.closeLoginScreen();
t('A1 · "Seguir sin cuenta" (sin sesión) sí muestra el registro inicial', onboardingShows === 1);

setFlags(true, false, false, false);
sb.closeLoginScreen();
t('A2 · Tras iniciar sesión NO se muestra el registro inicial (se decide tras el sync)', onboardingShows === 0);

// A3: si el perfil llega y el modal quedó abierto, se cierra.
setFlags(true, true, true, false);
sb.showOnboarding(); // modal abierto por un flujo viejo
sb.state.onboarded = true; // llegó el perfil de la nube
sb.finishOnboardingDecision();
t('A3 · Al llegar el perfil se cierra el modal que hubiera quedado abierto', fakeEls.onboardingModal === undefined);

// A4: Supabase confirma que NO hay perfil → se pide el registro.
setFlags(true, true, false, false);
sb.finishOnboardingDecision();
t('A4 · Solo si Supabase confirma que no hay perfil se pide el registro inicial', onboardingShows === 1 && chain.length === 1);

// A5: sin respuesta de Supabase (sync pendiente/fallido) → NO se pide.
setFlags(true, false, false, false);
sb.finishOnboardingDecision();
sb.finishOnboardingDecision();
t('A5 · Sin respuesta de Supabase NO se pide el registro (y la nota sale una sola vez)', onboardingShows === 0 && chain.length === 1);

// A6: con perfil remoto y local aún no marcado → no se pide (lo restaura el sync).
setFlags(true, true, true, false);
sb.finishOnboardingDecision();
t('A6 · Con perfil en la nube nunca se pide el registro', onboardingShows === 0);

// ============================================================
// C · cloudStartupSync restaura el perfil antes de decidir
// ============================================================
console.log('\n== Startup sync: restauración ==');

let remoteRows = null; // filas de personal_backups que devolverá cloudRest
let failCloud = false;
let decisionCalls = 0;
const syncSb = {
  console,
  navigator: { onLine: true },
  state: { weight: [], lastModified: '2026-08-14T12:00:00Z', profile: {}, onboarded: false },
  PP_SYNC: { downloaded: null, remoteChecked: false, remoteHasData: false },
  PP_SYNCCHAIN: chain,
  getCloudSession: function () { return { user: { id: 'u-123', email: 'x@y.z' }, access_token: 'tok' }; },
  getCloudConfig: function () { return { url: 'https://x.supabase.co', key: 'k' }; },
  refreshCloudSession: async function () { return syncSb.getCloudSession(); },
  cloudRest: async function (p) {
    if (failCloud) throw new Error('sin red');
    if (String(p).indexOf('personal_backups') >= 0) return remoteRows;
    return [];
  },
  mergeWeightLists: function (a, b) { return a.concat(b); },
  normalizeAllWeights: function () {},
  safeStorage: { set: function () {} },
  persistStateIDB: function () {},
  render: function () {},
  setSync: function () {},
  initRealtimeSync: function () {},
  cloudSave: async function () {},
  syncChainPush: function (msg, detail) { chain.push(msg + '|' + detail); },
  finishOnboardingDecision: function () { decisionCalls++; },
  _startupSynced: false,
  _syncing: false,
  _csBusy: false
};
syncSb.window = syncSb;
vm.createContext(syncSb);
['_mergeArrays', '_mergeHabitosLog', '_mergeVehiculos', '_mergeProfile', 'mergeCloudStates',
  'cloudStartupSync'].forEach(function (n) { vm.runInContext(extractFunc(HTML, n), syncSb); });
vm.runInContext((HTML.match(/var PROFILE_DEFAULTS=\{[^}]*\};/) || ['var PROFILE_DEFAULTS={};'])[0], syncSb);

(async function () {
  // C1: la nube tiene perfil/datos y el dispositivo está vacío → restaura y omite onboarding.
  // (sin skipUpload: ejercita también cloudSave y la entrada "Conectado" del diagnóstico)
  chain.length = 0; decisionCalls = 0; failCloud = false;
  syncSb.PP_SYNC.remoteChecked = false; syncSb.PP_SYNC.remoteHasData = false;
  remoteRows = [{ data: { profile: { nombre: 'Ruben', peso: 129, _onbSeen: true }, weight: [{ id: 'w1', w: 129 }], onboarded: true, lastModified: '2026-08-10T10:00:00Z' } }];
  syncSb.state = { weight: [], lastModified: '2026-08-14T12:00:00Z', profile: {}, onboarded: false };
  await syncSb.cloudStartupSync();
  t('C1 · Con perfil en la nube y dispositivo vacío: restaura y salta el registro inicial',
    syncSb.state.onboarded === true && syncSb.state.profile._onbSeen === true && syncSb.state.profile.nombre === 'Ruben' && syncSb.state.weight.length === 1);
  t('C2 · Marca remoteChecked/remoteHasData y deja el usuario en la cadena de diagnóstico',
    syncSb.PP_SYNC.remoteChecked === true && syncSb.PP_SYNC.remoteHasData === true && chain.some(function (x) { return x.indexOf('Conectado') >= 0; }));

  // C3: la nube NO tiene datos para este usuario → no restaura (el registro sí procede).
  chain.length = 0; decisionCalls = 0;
  syncSb.PP_SYNC.remoteChecked = false; syncSb.PP_SYNC.remoteHasData = false;
  remoteRows = [];
  syncSb.state = { weight: [], lastModified: '2026-08-14T12:00:00Z', profile: {}, onboarded: false };
  await syncSb.cloudStartupSync({ skipUpload: true });
  t('C3 · Sin datos en la nube: remoteHasData=false y NO se marca onboarded',
    syncSb.PP_SYNC.remoteChecked === true && syncSb.PP_SYNC.remoteHasData === false && syncSb.state.onboarded === false);

  // C4: fallo de red → no se marca remoteChecked y la decisión queda en manos del fallback.
  chain.length = 0; decisionCalls = 0;
  syncSb.PP_SYNC.remoteChecked = false; syncSb.PP_SYNC.remoteHasData = false;
  failCloud = true;
  syncSb.state = { weight: [], lastModified: '2026-08-14T12:00:00Z', profile: {}, onboarded: false };
  await syncSb.cloudStartupSync({ skipUpload: true });
  t('C4 · Con error de red no se confirma nada y se deja la app usable (sin registro inicial)',
    syncSb.PP_SYNC.remoteChecked === false && syncSb.state.onboarded === false && decisionCalls >= 1);

  console.log('\n==========================================');
  console.log('Resultado: ' + passed + ' pasaron · ' + failed + ' fallaron');
  console.log('==========================================');
  if (failed) {
    console.log('\nFallos:\n' + failures.map(function (f) { return '  ✗ ' + f; }).join('\n'));
    process.exit(1);
  }
  process.exit(0);
})();
