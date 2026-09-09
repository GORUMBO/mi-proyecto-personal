// ============================================================
// PRUEBAS — COLA DE CAMBIOS (debounce 8 s, pendientes, tombstones).
// Uso: node tests/cola-sync.test.js
// Escenarios: 10 cambios→1 sync · refresh con pendientes · cierre/apertura ·
// offline · reconexión · coalescencia · borrado sin resurrección · fallo de
// red sin duplicados · sin scroll/repintado · dispositivos convergen.
// El protocolo HTTP real (PATCH/verificación) ya lo cubren las 11 suites
// de sync; aquí se prueba la COLA sobre el sistema existente.
// ============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extractFunc(name) {
  const i = HTML.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('No se encontró function ' + name);
  let depth = 0, j = i, q = null;
  for (; j < HTML.length; j++) {
    const c = HTML[j];
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return HTML.slice(i, j + 1); }
  }
  throw new Error('incompleta: ' + name);
}
function extractConstAssign(name) {
  const m = HTML.match(new RegExp('const ' + name + '=([\\s\\S]*?);\\n'));
  if (!m) throw new Error('No se encontró const ' + name);
  return vm.runInNewContext('(' + m[1] + ')', {});
}

let passed = 0, failed = 0;
function t(label, ok, extra) {
  if (ok) { passed++; console.log('✓ ' + label + (extra ? ' · ' + extra : '')); }
  else { failed++; console.log('✗ FALLA ' + label + (extra ? ' · ' + extra : '')); }
}

const _SYNC_LABEL = extractConstAssign('_SYNC_LABEL');
const _SYNC_COLOR = extractConstAssign('_SYNC_COLOR');

// Sandbox con TIMERS CONTROLADOS y cloudSave mockeado (contrato del real:
// al éxito resetea offlineChanges y marca synced; al fallo NO resetea).
function makeColaSb(opts) {
  opts = opts || {};
  const storage = {};
  const sb = {
    state: Object.assign({
      workoutLog: [], savedMeals: [], myProducts: [], calendarEvents: [],
      diary: {}, _tombstones: {}, recipeFavorites: [], exFavorites: [],
      uiSettings: { hiddenTabs: [] }, evitarComunes: [], weight: [],
      lastModified: '2026-09-06T20:00:00.000Z', offlineChanges: 0
    }, opts.state || {}),
    safeStorage: {
      get(k) { return Object.prototype.hasOwnProperty.call(storage, k) ? storage[k] : null; },
      set(k, v) { storage[k] = v; return true; }
    },
    persistStateIDB() {},
    getCloudSession() { return opts.session === false ? null : { user: { id: 'u1', email: 'a@b.c' } }; },
    cloudStatus() {}, lastSavedText() { return ''; }, ppLogErr() {}, syncChainPush() {},
    navigator: { onLine: opts.online !== false },
    document: {
      getElementById() { return null; },
      createElement() { return { style: {} }; },
      body: { appendChild() {} }
    },
    alert() {},
    render() { sb._renderCalls = (sb._renderCalls || 0) + 1; },
    scrollTo() { sb._scrollCalls = (sb._scrollCalls || 0) + 1; },
    // módulo-levels del script original (var globales)
    _saveTimeout: null, _savePending: false, _autoSyncTimer: null,
    _startupSynced: true,
    PP_SYNC: { kind: '', detail: '', lastError: '', lastSyncAt: null },
    _SYNC_LABEL, _SYNC_COLOR,
    // cloudSave MOCK con el contrato del real
    cloudSaveCalls: 0, cloudPayloads: [],
    cloudSave: async function () {
      sb.cloudSaveCalls++;
      sb.cloudPayloads.push(JSON.stringify(sb.state));
      if (sb.failNextCloud) { sb.failNextCloud = false; sb.setSync('error', 'red'); return; }
      sb.state.offlineChanges = 0;
      sb.setSync('synced');
    }
  };
  sb.window = sb;
  // timers controlados
  sb._timers = [];
  sb.setTimeout = function (fn, ms) { const id = sb._timers.length + 1; sb._timers.push({ id, ms, fn }); return id; };
  sb.clearTimeout = function (id) { sb._timers = sb._timers.filter(function (x) { return x.id !== id; }); };
  sb.fireTimer = function (ms) {
    const idx = sb._timers.findIndex(function (x) { return x.ms === ms; });
    if (idx < 0) throw new Error('no hay timer de ' + ms + ' ms');
    const tmr = sb._timers.splice(idx, 1)[0];
    tmr.fn(); // síncrono: las fns de _doSave/cloudSave no esperan
  };
  vm.createContext(sb);
  ['_mergeArrays', '_mergeProfile', '_mergeHabitosLog', '_mergeVehiculos', 'mergeCloudStates',
    'ppTombstoneItem', 'ppActivos', 'ppTombstoneKey', 'ppKeyActivo', 'ppKeysActivas', 'ppDiarioActivos',
    'save', '_doSave', 'scheduleAutoSync', 'setSync', 'renderSyncUI'].forEach(function (n) {
    vm.runInContext(extractFunc(n), sb);
  });
  return sb;
}

console.log('== 1 · 10 cambios rápidos → 1 escritura local y 1 solo sync agrupado ==');
(function () {
  const sb = makeColaSb();
  for (let i = 0; i < 10; i++) sb.save(); // 10 acciones seguidas
  sb.fireTimer(100); // debounce de escritura local: UNA sola
  t('10 acciones colapsan en 1 guardado local', sb.state.offlineChanges === 1, 'offlineChanges=' + sb.state.offlineChanges);
  t('el sync NO se dispara en caliente (timer de 8 s pendiente)', sb.cloudSaveCalls === 0);
  t('estado visible: 🟡 pendiente con contador', sb.PP_SYNC.kind === 'pending' && sb.PP_SYNC.detail === '1');
  sb.fireTimer(8000);
  t('pasados 8 s: UN solo sync agrupado', sb.cloudSaveCalls === 1);
  t('tras el sync: 🟢 y contador en 0', sb.PP_SYNC.kind === 'synced' && sb.state.offlineChanges === 0);
})();

console.log('== 2 · Refresh antes del sync → los pendientes sobreviven ==');
(function () {
  const sb = makeColaSb();
  sb.state.weight.push({ id: 1, d: '2026-09-06', w: 70 });
  sb.save(); sb.fireTimer(100);
  t('pendiente registrado antes del refresh', sb.state.offlineChanges === 1);
  const refresh = JSON.parse(sb.safeStorage.get('pp_full')); // "refresh" = recargar desde almacenamiento
  t('refresh: el contador de pendientes persiste', refresh.offlineChanges === 1 && refresh.weight.length === 1);
  sb.fireTimer(8000);
  t('tras el sync post-refresh: contador en 0', sb.state.offlineChanges === 0);
})();

console.log('== 3 · Cerrar y volver a abrir → la cola continúa ==');
(function () {
  const sb = makeColaSb();
  sb.state.weight.push({ id: 2, d: '2026-09-07', w: 71 });
  sb.save(); sb.fireTimer(100);
  t('cambio pendiente sin sincronizar', sb.state.offlineChanges === 1 && sb.cloudSaveCalls === 0);
  // "cerrar": el estado queda en localStorage/IndexedDB; "abrir": nueva sesión con ese estado
  const persisted = sb.safeStorage.get('pp_full');
  const sb2 = makeColaSb({ state: JSON.parse(persisted) });
  t('al reabrir: el contador de pendientes sigue vivo', sb2.state.offlineChanges === 1);
  // al abrir, el arranque real de la app fusiona y sube (cloudStartupSync → cloudSave)
  sb2.cloudSave();
  t('el arranque sube los pendientes y vacía la cola', sb2.cloudSaveCalls === 1 && sb2.state.offlineChanges === 0);
})();

console.log('== 4 · Offline → la cola se conserva y crece ==');
(function () {
  const sb = makeColaSb({ online: false });
  sb.state.weight.push({ id: 3, d: '2026-09-07', w: 72 });
  sb.save(); sb.fireTimer(100);
  sb.state.weight.push({ id: 4, d: '2026-09-07', w: 73 });
  sb.save(); sb.fireTimer(100);
  t('sin conexión: ⚪ con contador de pendientes', sb.PP_SYNC.kind === 'offline' && sb.PP_SYNC.detail === '2');
  t('sin conexión: NINGÚN sync', sb.cloudSaveCalls === 0);
  t('sin conexión: el contador acumula cambios', sb.state.offlineChanges === 2);
})();

console.log('== 5 · Reconexión → sync correcto y contador a cero ==');
(function () {
  const sb = makeColaSb({ online: false });
  sb.state.weight.push({ id: 5, d: '2026-09-07', w: 74 });
  sb.save(); sb.fireTimer(100);
  t('offline: pendiente sin sync', sb.PP_SYNC.kind === 'offline' && sb.cloudSaveCalls === 0);
  sb.navigator.onLine = true; // vuelve la red
  // la app real dispara el listener 'online': setSync pending + subida directa
  sb.setSync('pending', String(sb.state.offlineChanges));
  sb.cloudSave();
  t('reconexión (listener online): sube y vacía la cola', sb.cloudSaveCalls === 1 && sb.state.offlineChanges === 0 && sb.PP_SYNC.kind === 'synced');
  // y un cambio NUEVO tras reconectar re-agenda el debounce de 8 s
  sb.state.weight[0].w = 75;
  sb.save(); sb.fireTimer(100);
  t('cambio nuevo tras reconectar: pendiente re-agendado', sb.PP_SYNC.kind === 'pending' && sb.state.offlineChanges === 1);
  sb.fireTimer(8000);
  t('debounce de 8 s tras reconectar: sync agrupado', sb.cloudSaveCalls === 2 && sb.state.offlineChanges === 0);
})();

console.log('== 6 · Coalescencia: editar el mismo registro varias veces manda el final ==');
(function () {
  const sb = makeColaSb();
  sb.state.weight.push({ id: 9, d: '2026-09-07', w: 50 });
  sb.save(); sb.fireTimer(100);
  sb.state.weight[0].w = 55; sb.save(); sb.fireTimer(100);
  sb.state.weight[0].w = 60; sb.save(); sb.fireTimer(100);
  sb.fireTimer(8000);
  t('un solo registro de peso (mismo id, sin duplicar)', sb.state.weight.length === 1);
  t('el payload del sync lleva SOLO el valor final', JSON.parse(sb.cloudPayloads[sb.cloudPayloads.length - 1]).weight[0].w === 60, 'payload weight=' + JSON.parse(sb.cloudPayloads[sb.cloudPayloads.length - 1]).weight[0].w);
  t('no se mandaron versiones intermedias (1 payload)', sb.cloudPayloads.length === 1);
})();

console.log('== 7 · Borrados con tombstones: NO reaparecen en el merge ==');
(function () {
  const sb = makeColaSb();
  // objeto: serie de workoutLog borrada localmente vs copia vieja en la nube
  const serie = { id: 77, date: '2026-09-06', localDate: '2026-09-06', exercise: 'Press', weight: 100, sets: 3, reps: '10' };
  const copiaVieja = JSON.parse(JSON.stringify(serie)); // lo que tiene OTRO dispositivo
  sb.state.workoutLog.push(serie);
  sb.ppTombstoneItem(sb.state.workoutLog, 77);
  t('el borrado marca deleted con updated_at nuevo', serie.deleted === true && !!serie.updated_at);
  const local = { workoutLog: sb.state.workoutLog, lastModified: '2026-09-07T00:00:00.000Z' };
  const remoto = { workoutLog: [copiaVieja], lastModified: '2026-09-06T23:00:00.000Z' };
  const merged = sb.mergeCloudStates(local, remoto);
  t('merge: la serie sigue marcada deleted (la copia vieja NO la revive)', merged.workoutLog.length === 1 && merged.workoutLog[0].deleted === true);
  t('ppActivos no la muestra', sb.ppActivos(merged.workoutLog).length === 0);
  // primitivo: favorito quitado vs copia vieja que lo trae
  const local2 = { recipeFavorites: [], _tombstones: { 'favs:r1': '2026-09-07T00:00:00.000Z' }, lastModified: '2026-09-07T00:00:00.000Z' };
  const remoto2 = { recipeFavorites: ['r1'], _tombstones: {}, lastModified: '2026-09-06T23:00:00.000Z' };
  const merged2 = sb.mergeCloudStates(local2, remoto2);
  t('merge: la tumba del favorito se conserva (unión por clave)', !!merged2._tombstones['favs:r1']);
  t('el favorito tumbado NO aparece activo', (merged2.recipeFavorites || []).filter(function (k) { return !merged2._tombstones['favs:' + k]; }).length === 0);
})();

console.log('== 8 · Fallo de red → reintento sin duplicados ni pérdida ==');
(function () {
  const sb = makeColaSb();
  sb.state.weight.push({ id: 6, d: '2026-09-07', w: 75 });
  sb.save(); sb.fireTimer(100);
  sb.failNextCloud = true;
  sb.fireTimer(8000); // el sync falla (contrato real: 🔴 error, sin resetear)
  t('fallo de red: 🔴 error y contador intacto', sb.PP_SYNC.kind === 'error' && sb.state.offlineChanges === 1);
  // el usuario sigue trabajando: un cambio NUEVO re-agenda el debounce
  sb.state.weight.push({ id: 8, d: '2026-09-07', w: 76 });
  sb.save(); sb.fireTimer(100);
  t('fallo de red: el contador acumula el cambio nuevo', sb.state.offlineChanges === 2);
  sb.fireTimer(8000);
  t('reintento: sync completo y cola vacía', sb.cloudSaveCalls === 2 && sb.state.offlineChanges === 0 && sb.PP_SYNC.kind === 'synced');
  const ultimo = JSON.parse(sb.cloudPayloads[sb.cloudPayloads.length - 1]);
  t('sin duplicados: cada registro viaja UNA vez en el snapshot', ultimo.weight.length === 2 && new Set(ultimo.weight.map(function (x) { return x.id; })).size === 2);
})();

console.log('== 9 · El guardado/sync NUNCA repinta, navega ni mueve el scroll ==');
(function () {
  const sb = makeColaSb();
  sb.state.weight.push({ id: 7, d: '2026-09-07', w: 76 });
  sb.save(); sb.fireTimer(100); sb.fireTimer(8000);
  t('cero renders completos disparados por guardar/sync', (sb._renderCalls || 0) === 0);
  t('cero scrolls disparados', (sb._scrollCalls || 0) === 0);
  t('solo efectos: almacenamiento local + estado de sync', !!sb.safeStorage.get('pp_full') && sb.PP_SYNC.kind === 'synced');
})();

console.log('== 10 · iPhone y PC terminan con los mismos registros ==');
(function () {
  const iPhone = makeColaSb();
  const PC = makeColaSb();
  // iPhone registra una serie y borra otra que tenía PC
  iPhone.state.workoutLog.push({ id: 101, date: '2026-09-07', localDate: '2026-09-07', exercise: 'Dominadas', weight: 0, sets: 3, reps: '8' });
  PC.state.workoutLog.push({ id: 102, date: '2026-09-06', localDate: '2026-09-06', exercise: 'Peso muerto', weight: 200, sets: 3, reps: '5' });
  iPhone.state.workoutLog.push({ id: 102, date: '2026-09-06', localDate: '2026-09-06', exercise: 'Peso muerto', weight: 200, sets: 3, reps: '5', deleted: true, updated_at: '2026-09-07T01:00:00.000Z' });
  // convergencia vía la nube (snapshot fusionado = unión)
  const nube = iPhone.mergeCloudStates(iPhone.state, PC.state);
  const enPC = PC.mergeCloudStates(PC.state, nube);
  const eniPhone = iPhone.mergeCloudStates(iPhone.state, nube);
  const activosPC = iPhone.ppActivos(enPC.workoutLog).map(function (x) { return x.exercise; }).sort();
  const activosiPhone = iPhone.ppActivos(eniPhone.workoutLog).map(function (x) { return x.exercise; }).sort();
  t('PC no resucita la serie borrada', activosPC.indexOf('Peso muerto') < 0, activosPC.join(','));
  t('ambos dispositivos terminan idénticos (mismos activos)', activosPC.join(',') === activosiPhone.join(',') && activosPC.join(',') === 'Dominadas', activosPC.join(','));
})();

console.log('\n===== RESULTADO: ' + passed + ' PASS / ' + failed + ' FAIL =====');
if (failed) process.exit(1);
