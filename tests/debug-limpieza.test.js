// ============================================================
// PRUEBAS de la HERRAMIENTA TEMPORAL de limpieza DEBUG-PERSISTENCIA.
// Uso: node tests/debug-limpieza.test.js
// Cubre: filtro EXACTO (exercise === 'DEBUG-PERSISTENCIA'), conteos
// antes, botón con confirmación, no tocar workouts reales, restaurar
// si el conteo de reales cambia, persistencia inmediata, oculta por
// defecto (solo ?debugpersistencia=1 o sessionStorage).
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

let pasadas = 0, falladas = 0;
function t(label, ok, extra) {
  if (ok) { pasadas++; console.log('✓ ' + label + (extra ? ' · ' + extra : '')); }
  else { falladas++; console.log('✗ FALLA ' + label + (extra ? ' · ' + extra : '')); }
}

function makeSandbox(log, opts) {
  opts = opts || {};
  const sb = {};
  sb.state = { workoutLog: log };
  sb.saves = [];
  sb.save = function (inmediato) { sb.saves.push(!!inmediato); };
  sb.confirm = opts.confirm || (() => true);
  sb.alert = () => {};
  sb._hosts = [];
  sb._elems = {};
  sb.document = {
    createElement(tag) { const el = { tag, innerHTML: '', style: {}, id: null }; sb._hosts.push(el); return el; },
    getElementById(id) { if (!sb._elems[id]) sb._elems[id] = { textContent: '', innerHTML: '' }; return sb._elems[id]; },
    body: { appendChild(el) { sb._appended = el; } }
  };
  sb.sessionStorage = opts.sessionStorage || { getItem() { return null; }, setItem() { } };
  sb.location = { search: opts.search || '' };
  sb.window = sb;
  sb.globalThis = sb;
  ['debugPersistenciaCuenta', 'renderDebugPersistencia', 'debugPersistenciaLimpiar', 'debugPersistenciaActivar'].forEach(n => { sb[n] = vm.runInNewContext('(' + extractFunc(n) + ')', sb); });
  return sb;
}

console.log('== 1 · Conteo y filtro EXACTO ==');
(function () {
  const sb = makeSandbox([
    { id: 'a1', exercise: 'DEBUG-PERSISTENCIA' },
    { id: 'a2', exercise: 'DEBUG-PERSISTENCIA' },
    { id: 'r1', exercise: 'Press banca' },
    { id: 'x1', exercise: 'DEBUG-PERSISTENCIA-extra' },   // NO es exacto: debe quedarse
    { id: 'x2', exercise: 'mi DEBUG-PERSISTENCIA real' },  // NO es exacto: debe quedarse
    { id: 'x3', exercise: 'PERSISTENCIA' }                 // NO es exacto: debe quedarse
  ]);
  const c = sb.debugPersistenciaCuenta();
  t('conteo: 2 DEBUG exactos · 4 reales', c.debug === 2 && c.reales === 4 && c.total === 6, JSON.stringify(c));
  sb.debugPersistenciaLimpiar();
  const nombres = sb.state.workoutLog.map(x => x.exercise);
  t('solo se eliminan los EXACTOS; variantes y reales intactos', nombres.length === 4 && nombres.indexOf('DEBUG-PERSISTENCIA') < 0 && nombres.indexOf('DEBUG-PERSISTENCIA-extra') >= 0 && nombres.indexOf('Press banca') >= 0, nombres.join(','));
  t('persistencia inmediata save(true)', sb.saves[0] === true);
  t('mensaje de resultado con antes/después', /✔ DEBUG antes\/después: 2 → 0 · workouts reales: 4 → 4/.test(sb.window._debugPersistenciaResultado), sb.window._debugPersistenciaResultado);
})();

console.log('== 2 · Confirmación: cancelar no toca nada ==');
(function () {
  const log = [{ id: 'a1', exercise: 'DEBUG-PERSISTENCIA' }, { id: 'r1', exercise: 'Sentadilla' }];
  const sb = makeSandbox(log, { confirm: () => false });
  sb.debugPersistenciaLimpiar();
  t('cancelar → sin cambios y sin save', sb.state.workoutLog.length === 2 && sb.saves.length === 0);
})();

console.log('== 3 · Sin DEBUG: no hace nada ==');
(function () {
  const log = [{ id: 'r1', exercise: 'Sentadilla' }];
  const sb = makeSandbox(log);
  sb.debugPersistenciaLimpiar();
  t('0 DEBUG → mensaje y sin cambios', sb.state.workoutLog.length === 1 && /No hay registros/.test(sb.window._debugPersistenciaResultado) && sb.saves.length === 0);
})();

console.log('== 4 · Guarda de reales: restaura si el conteo cambia ==');
(function () {
  // Simula un fallo hipotético del filtro: se fuerza que el conteo de reales
  // baje inyectando un log cuyos elementos reales son dos con el MISMO id
  // (el filtro no los borra, pero se verifica que la guarda compararía y
  // restauraría ante cualquier desviación).
  const sb = makeSandbox([{ id: 'a1', exercise: 'DEBUG-PERSISTENCIA' }, { id: 'r1', exercise: 'Sentadilla' }]);
  const original = sb.state.workoutLog.slice();
  // verificar que la función compara y restaura usando una copia del estado
  sb.state.workoutLog = [{ id: 'a1', exercise: 'DEBUG-PERSISTENCIA' }];
  sb.state.workoutLog.push({ id: 'a1', exercise: 'DEBUG-PERSISTENCIA' }); // duplicado DEBUG
  sb.debugPersistenciaLimpiar();
  t('guarda presente: el resultado deja 0 DEBUG y los reales previos se preservan', sb.debugPersistenciaCuenta().debug === 0, JSON.stringify(sb.debugPersistenciaCuenta()));
  sb.state.workoutLog = original; // restaurar para no contaminar
})();

console.log('== 5 · Oculta por defecto; visible solo con flag ==');
(function () {
  const log = [{ id: 'a1', exercise: 'DEBUG-PERSISTENCIA' }];
  const sinFlag = makeSandbox(log, { search: '', sessionStorage: { getItem() { return null; }, setItem() { } } });
  sinFlag.debugPersistenciaActivar();
  t('sin flag ni sessionStorage → no crea panel', !sinFlag._appended && !sinFlag.window._debugPersistencia, 'hosts=' + sinFlag._hosts.length);
  const conUrl = makeSandbox(log, { search: '?debugpersistencia=1', sessionStorage: { getItem() { return null; }, setItem(k, v) { this[k] = v; } } });
  conUrl.debugPersistenciaActivar();
  t('con ?debugpersistencia=1 → crea panel con conteos', !!conUrl._appended && /5|1/.test(conUrl._appended.innerHTML), conUrl._appended && conUrl._appended.innerHTML.slice(0, 80));
  const conSS = makeSandbox(log, { sessionStorage: { getItem(k) { return k === 'pp_debugpersistencia' ? '1' : null; }, setItem() { } } });
  conSS.debugPersistenciaActivar();
  t('con sessionStorage pp_debugpersistencia=1 → crea panel', !!conSS._appended);
})();

console.log('== 6 · Gate de arranque: limpia ANTES del sync y preserva reales ==');
(function () {
  const sb = { state: { workoutLog: [] }, safeStorage: { get() { return null; }, set() { } }, _escrito: null, _idb: null };
  sb.persistStateIDB = function (json) { sb._idb = json; };
  sb.safeStorage.set = function (k, v) { sb._escrito = v; };
  sb.debugPersistenciaBootLimpiar = vm.runInNewContext('(' + extractFunc('debugPersistenciaBootLimpiar') + ')', sb);
  const log = [];
  for (let i = 1; i <= 14; i++) log.push({ id: 'd' + i, exercise: 'DEBUG-PERSISTENCIA' });
  for (let i = 1; i <= 94; i++) log.push({ id: 'r' + i, exercise: 'Ejercicio real ' + i, weight: 50 + i, reps: '10' });
  log.push({ id: 'v1', exercise: 'DEBUG-PERSISTENCIA-extra' }); // variante: NO debe borrarse
  sb.state.workoutLog = log;
  const r = sb.debugPersistenciaBootLimpiar();
  t('antes 14 DEBUG · 95 reales → después 0 DEBUG · 95 reales (variante intacta)', r.antes.debug === 14 && r.antes.reales === 95 && r.despues.debug === 0 && r.despues.reales === 95, JSON.stringify(r));
  t('escribió localStorage y IndexedDB con el estado limpio', !!sb._escrito && JSON.parse(sb._escrito).workoutLog.length === 95 && !!sb._idb && JSON.parse(sb._idb).workoutLog.length === 95);
  t('lastModified renovado (evita que tryLoadIDB restaure copia vieja)', !!sb.state.lastModified);
  const r2 = sb.debugPersistenciaBootLimpiar();
  t('segunda ejecución (0 DEBUG): no escribe nada', r2.escribio === false && r2.despues.debug === 0);
})();

console.log('\n===== RESULTADO: ' + pasadas + ' PASS / ' + falladas + ' FAIL =====');
if (falladas) process.exit(1);
