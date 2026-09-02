// ============================================================
// PRUEBAS Fitness — persistencia de serie con peso (bug iPhone:
// "Guardado" pero el peso desaparece al recargar).
// Cubre: guardar serie y reload, tres series independientes,
// peso+reps exactos, peso decimal, nube vieja no pisa local nuevo,
// render encuentra la serie tras reload, toast solo tras
// persistencia local exitosa.
// Uso: node tests/fitness-serie-persistencia.test.js
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

// Predicados EXACTOS del render de la tarjeta (quickFitnessToday) para series de hoy.
// Se extraen del HTML real para no desincronizarse del código.
const mPred = HTML.match(/var esSerieValida=function\(r\)\{[^}]*\};/);
if (!mPred) throw new Error('No se encontró esSerieValida en el template');
const esSerieValida = vm.runInNewContext('(' + mPred[0].replace('var esSerieValida=', '').replace(/;$/, '') + ')');
const mVis = HTML.match(/var esSerieVisible=function\(r\)\{[^}]*\};/);
if (!mVis) throw new Error('No se encontró esSerieVisible en el template');
const esSerieVisible = vm.runInNewContext('(' + mVis[0].replace('var esSerieVisible=', '').replace(/;$/, '') + ')', { esSerieValida });

// ---- sandbox estándar para registrar series ----
function makeSandbox(inputs) {
  const sb = {};
  sb._inputs = {
    'rlogSW_0': { value: '', innerHTML: '' },
    'rlogSR_0': { value: '', innerHTML: '' },
    'rlogW_0': { value: '', innerHTML: '' },
    'rlogR_0': { value: '', innerHTML: '' },
    'rlogOut_0': { innerHTML: '' }
  };
  sb.console = console;
  sb.state = {
    fitnessToday: { plan: [{ name: 'Press banca', sets: '3', reps: '8-12', muscle: 'Pecho' }], sessionId: 777, checked: {} },
    workoutLog: []
  };
  sb.saves = 0; sb.toast = null;
  sb.document = {
    getElementById(id) {
      if (!sb._inputs[id]) sb._inputs[id] = { value: inputs[id] !== undefined ? inputs[id] : '', innerHTML: '' };
      return sb._inputs[id];
    }
  };
  sb.f3AnclarTarjeta = function () {};
  sb.todayISO = function () { return '2026-08-30'; };
  sb.todayLocal = function () { return '2026-08-30'; };
  sb.U = { pesoUnidad() { return 'lb'; } };
  sb.save = function () { sb.saves++; sb.toast = '✓ Guardado'; };
  sb.actualizarResultadosHoy = function () {};
  sb.syncChainPush = function () {};
  sb.safeText = function (x) { return String(x == null ? '' : x); };
  sb.setTimeout = function (fn) { sb._timer = fn; return 1; };
  sb.flush = function () { if (sb._timer) { const f = sb._timer; sb._timer = null; f(); } };
  sb.globalThis = sb;
  sb.ppUUID = vm.runInNewContext('(' + extractFunc('ppUUID') + ')', sb);
  sb.logRoutineExercise = vm.runInNewContext('(' + extractFunc('logRoutineExercise') + ')', sb);
  return sb;
}

function registrar(sb, peso, reps) {
  sb._inputs['rlogSW_0'].value = peso;
  sb._inputs['rlogSR_0'].value = reps;
  sb.logRoutineExercise(0, {});
  return sb.state.workoutLog[sb.state.workoutLog.length - 1];
}

// "reload": el estado se serializa y se vuelve a leer, como al recargar la app.
function reload(state) { return JSON.parse(JSON.stringify(state)); }

console.log('== 1 · Guardar UNA serie (peso + reps) y reload ==');
(function () {
  const sb = makeSandbox({});
  const e = registrar(sb, '45', '10');
  t('entrada creada con peso y reps', e && e.weight === 45 && e.reps === '10', JSON.stringify(e));
  t('save() llamado (persistencia)', sb.saves === 1);
  const st = reload(sb.state);
  const e2 = st.workoutLog[0];
  t('la entrada sobrevive al reload', st.workoutLog.length === 1 && e2.weight === 45 && e2.reps === '10');
  t('el render la encuentra tras reload', esSerieValida(e2));
})();

console.log('== 2 · Peso SIN reps (flujo móvil típico): guarda y el render debe mostrarla ==');
(function () {
  const sb = makeSandbox({});
  const e = registrar(sb, '45', '');
  t('entrada creada con peso aunque reps vacío', e && e.weight === 45 && e.reps === '—', JSON.stringify(e));
  t('persiste tras reload', reload(sb.state).workoutLog.length === 1);
  // COMPORTAMIENTO DESEADO: una serie con peso debe ser VISIBLE aunque no tenga reps.
  t('el render la muestra tras reload (peso>0 aunque reps vacío)', esSerieVisible(reload(sb.state).workoutLog[0]));
})();

console.log('== 3 · Tres series independientes ==');
(function () {
  const sb = makeSandbox({});
  registrar(sb, '45', '10');
  registrar(sb, '50', '9');
  registrar(sb, '55', '8');
  t('3 entradas', sb.state.workoutLog.length === 3);
  t('pesos en orden', sb.state.workoutLog.map(r => r.weight).join(',') === '45,50,55');
  const ids = new Set(sb.state.workoutLog.map(r => r.id));
  t('ids DISTINTOS por serie (bug: Date.now() colisiona en el mismo ms)', ids.size === 3, 'ids=' + [...ids].join(','));
  t('las 3 visibles tras reload', reload(sb.state).workoutLog.filter(esSerieValida).length === 3);
  const merge = vm.runInNewContext('(' + extractFunc('_mergeArrays') + ')');
  const unido = merge(sb.state.workoutLog, []); // merge local+nube-vacía
  t('merge con nube vacía no deduplica series', unido.length === 3, 'quedaron ' + unido.length);
})();

console.log('== 4 · Peso decimal ==');
(function () {
  const sb = makeSandbox({});
  const e = registrar(sb, '45.5', '8');
  t('decimal guardado exacto', e && e.weight === 45.5, JSON.stringify(e));
  t('visible tras reload', esSerieValida(reload(sb.state).workoutLog[0]));
})();

console.log('== 5 · Nube vieja NO pisa el registro local nuevo ==');
(function () {
  const sb = makeSandbox({});
  registrar(sb, '50', '10');
  const merge = vm.runInNewContext('(' + extractFunc('_mergeArrays') + ')');
  // nube vieja: workoutLog vacío (o con otras series); la serie local nueva debe sobrevivir
  const unido = merge(sb.state.workoutLog, [{ id: 999, date: '2026-08-01', exercise: 'Remo', weight: 30, reps: '12' }]);
  t('serie local nueva sobrevive al merge con nube vieja', unido.some(r => r.weight === 50 && r.exercise === 'Press banca'));
  t('serie de la nube también se une (no destructivo)', unido.length === 2);
})();

console.log('== 6 · Toast de éxito SOLO tras persistencia local exitosa ==');
(function () {
  const okLocal = { value: true };
  const sb = {
    console, state: { lastModified: '2026-08-30T00:00:00.000Z', offlineChanges: 0 },
    safeStorage: {
      get() { return null; },
      set() { return okLocal.value; }
    },
    persistStateIDB() {}, scheduleAutoSync() {}, ppLogErr() {},
    document: {
      getElementById() { return null; },
      createElement() { return { style: {} }; },
      body: { appendChild() {} }
    },
    setTimeout() { return 1; }, clearTimeout() {}, alert() {}
  };
  sb.globalThis = sb;
  const doSave = vm.runInNewContext('(' + extractFunc('_doSave') + ')', sb);
  const toast = sb.document.getElementById('saveToast') ? sb.document.getElementById('saveToast').innerHTML : null;
  // forzar la creación del toast
  const created = { innerHTML: '', style: {} };
  sb.document.getElementById = function (id) { return id === 'saveToast' ? created : null; };
  doSave.call(sb);
  t('persistencia OK → toast "✓ Guardado"', created.innerHTML === '✓ Guardado', created.innerHTML);
  okLocal.value = false;
  created.innerHTML = '';
  doSave.call(sb);
  t('persistencia FALLIDA → NO dice "Guardado"', created.innerHTML.indexOf('Guardado') < 0 && created.innerHTML.indexOf('Poco espacio') >= 0, created.innerHTML);
})();

console.log('===== RESULTADO: ' + pasadas + ' PASS / ' + falladas + ' FAIL =====');
if (falladas) process.exit(1);
