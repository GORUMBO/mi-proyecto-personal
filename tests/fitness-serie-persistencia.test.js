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
  sb.f3BloqueaDebugExercise = vm.runInNewContext('(' + extractFunc('f3BloqueaDebugExercise') + ')', sb);
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

console.log('== 9 · Sesión perdida (regresión): las series de HOY nunca se ocultan ==');
(function () {
  const f3SesionVisibleHoy = vm.runInNewContext('(' + extractFunc('f3SesionVisibleHoy') + ')');
  const hoy = '2026-09-06';
  // pack SIN sessionId + serie con sessionId real (el caso reportado)
  const log1 = [{ localDate: hoy, date: '2026-09-07', sessionId: 777, exercise: 'Press banca', weight: 50, reps: '10' }];
  const r1 = f3SesionVisibleHoy(log1, hoy, 'press banca', null);
  t('pack sin sessionId → recupera la sesión real y la serie se muestra', r1.sid === 777 && r1.visibles.length === 1, JSON.stringify(r1));
  // pack con sessionId VIEJO (rutina regenerada o copia de la nube)
  const r2 = f3SesionVisibleHoy(log1, hoy, 'press banca', 999);
  t('pack con sessionId viejo → la serie de hoy NO se oculta', r2.sid === 777 && r2.visibles.length === 1);
  // dos sesiones el mismo día: si el pack tiene un id VÁLIDO, solo esa sesión
  const log2 = log1.concat([{ localDate: hoy, date: hoy, sessionId: 888, exercise: 'Press banca', weight: 55, reps: '8' }]);
  const r3 = f3SesionVisibleHoy(log2, hoy, 'press banca', 777);
  t('con sessionId válido del pack: solo esa sesión (777), no la otra (888)', r3.sid === 777 && r3.visibles.length === 1 && r3.visibles[0].weight === 50, JSON.stringify(r3));
  // series sin sessionId (guiado viejo) con pack sin id → visibles
  const log3 = [{ localDate: hoy, date: hoy, exercise: 'Sentadilla', weight: 80, reps: '10' }];
  const r4 = f3SesionVisibleHoy(log3, hoy, 'sentadilla', null);
  t('series sin sessionId con pack sin id → visibles', r4.visibles.length === 1);
  // otro ejercicio no roba la sesión del pack
  const r5 = f3SesionVisibleHoy(log2, hoy, 'sentadilla', 777);
  t('ejercicio sin series hoy → visibles vacío (no inventa)', r5.visibles.length === 0);
})();

console.log('== 10 · Paso guiado: sessionId estable + localDate + save(true) ==');
(function () {
  const sb = {};
  const inputs = { guidedWeight: { value: '50' }, guidedReps: { value: '10' }, guidedFeel: { value: 'Normal' } };
  sb.document = { getElementById: function (id) { return inputs[id] || null; } };
  sb.state = {
    activeWorkout: { step: 0, plan: [{ name: 'Press banca', sets: 3, reps: '8-12', muscle: 'Pecho', note: '' }], done: [], doneSteps: {} },
    fitnessToday: { sessionId: null }, workoutLog: []
  };
  sb.todayISO = function () { return '2026-09-07'; };
  sb.todayLocal = function () { return '2026-09-06'; };
  sb.ppUUID = vm.runInNewContext('(' + extractFunc('ppUUID') + ')', sb);
  sb.f3BloqueaDebugExercise = vm.runInNewContext('(' + extractFunc('f3BloqueaDebugExercise') + ')', sb);
  sb.nextWeightAdviceForExercise = function () { return 'Sigue igual.'; };
  sb.save = function (inmediato) { sb.saves = (sb.saves || 0) + 1; sb.ultimoInmediato = !!inmediato; };
  sb.actualizarResultadosHoy = function () {};
  sb.keepScroll = function (fn) { fn(); };
  sb.renderGuidedWorkout = function () {}; sb.renderWorkoutLog = function () {}; sb.renderFitnessProgressPanel = function () {};
  sb.safeText = function (x) { return String(x == null ? '' : x); };
  sb.saveGuidedWorkoutStep = vm.runInNewContext('(' + extractFunc('saveGuidedWorkoutStep') + ')', sb);
  sb.saveGuidedWorkoutStep();
  const e = sb.state.workoutLog[0];
  t('entrada con sessionId estable (se crea si falta y queda en el pack)', !!e.sessionId && sb.state.fitnessToday.sessionId === e.sessionId, JSON.stringify(e));
  t('entrada con localDate y fecha UTC por separado', e.localDate === '2026-09-06' && e.date === '2026-09-07');
  t('id UUID (sin colisiones de Date.now)', typeof e.id === 'string' && e.id.indexOf('-') > 0);
  t('save(true) inmediato (no debounce)', sb.ultimoInmediato === true);
  t('la serie queda visible en la rutina de hoy (f3SesionVisibleHoy)', (function () {
    const f3 = vm.runInNewContext('(' + extractFunc('f3SesionVisibleHoy') + ')');
    const r = f3(sb.state.workoutLog, '2026-09-06', 'press banca', null);
    return r.visibles.length === 1;
  })());
})();

console.log('== 11 · Guarda de fecha local: la sesión NO se regenera por la tarde (UTC) ==');
(function () {
  const f3MismaFechaLocal = vm.runInNewContext('(' + extractFunc('f3MismaFechaLocal') + ')');
  // Hawaii: mañana creó la sesión (date UTC = 09-06); por la tarde ctxDate(UTC) = 09-07
  t('mismo día local (date UTC viejo + localDate hoy) → MISMA sesión', f3MismaFechaLocal({ date: '2026-09-06', localDate: '2026-09-06' }, '2026-09-07', '2026-09-06') === true);
  t('mismo día UTC → misma sesión', f3MismaFechaLocal({ date: '2026-09-06' }, '2026-09-06', '2026-09-06') === true);
  t('día realmente nuevo → regenera', f3MismaFechaLocal({ date: '2026-09-06', localDate: '2026-09-06' }, '2026-09-07', '2026-09-07') === false);
  t('sin pack → regenera', f3MismaFechaLocal(null, '2026-09-07', '2026-09-07') === false);
})();

console.log('== 12 · 1-tap ENTRENÉ/DESCANSÉ: save(true) + anti doble-click ==');
(function () {
  const sb = { state: { workoutLog: [] }, saves: [], toast: null };
  sb.ppUUID = vm.runInNewContext('(' + extractFunc('ppUUID') + ')', sb);
  sb.f3BloqueaDebugExercise = vm.runInNewContext('(' + extractFunc('f3BloqueaDebugExercise') + ')', sb);
  sb._hoy = function () { return '2026-09-06'; };
  sb.save = function (inmediato) { sb.saves.push(!!inmediato); };
  sb.refrescarInicio = function () {};
  sb.toastReg = function (t) { sb.toast = t; };
  sb.guardarEjercicio = vm.runInNewContext('(' + extractFunc('guardarEjercicio') + ')', sb);
  sb.guardarEjercicio('Entrené');
  const e = sb.state.workoutLog[0];
  t('registra la entrada y persiste con save(true)', sb.state.workoutLog.length === 1 && e.exercise === 'Entrené' && sb.saves[0] === true, JSON.stringify(e));
  t('sobrevive a reload (JSON roundtrip)', JSON.parse(JSON.stringify(sb.state)).workoutLog.length === 1);
  sb.guardarEjercicio('Entrené'); // doble click inmediato
  t('doble click del MISMO tipo <2 s → NO duplica', sb.state.workoutLog.length === 1);
  sb.guardarEjercicio._t = 0; // simula que pasó el tiempo
  sb.guardarEjercicio('Descansé');
  t('otro tipo sí registra', sb.state.workoutLog.length === 2 && sb.state.workoutLog[0].exercise === 'Descansé');
})();

console.log('== 13 · Terminar rutina guiada: save(true) + anti doble ejecución ==');
(function () {
  const sb = { state: { activeWorkout: { step: 0, done: [{ name: 'Press banca' }, { name: 'Sentadilla' }], doneSteps: { 0: {}, 1: {} }, plan: [{ name: 'Press banca' }, { name: 'Sentadilla' }], fromRoutine: false, dia: null, routineDayName: null, routineDayIndex: null }, workoutLog: [{ id: 'a', exercise: 'Press banca' }], customRoutine: null, lastGuidedPlan: null }, saves: [] };
  sb.weekdayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  sb.todayISO = function () { return '2026-09-07'; };
  sb.todayWeekdayIndex = function () { return 0; };
  sb.f3IdPorNombre = function () { return null; };
  sb.save = function (inmediato) { sb.saves.push(!!inmediato); };
  sb.renderFitnessProgressPanel = function () {}; sb.renderRoutineToday = function () {}; sb.renderFitStatsPanel = function () {};
  sb.getFitnessMainOut = function () { return { innerHTML: '' }; };
  sb.safeText = function (x) { return String(x == null ? '' : x); };
  sb.finishGuidedWorkout = vm.runInNewContext('(' + extractFunc('finishGuidedWorkout') + ')', sb);
  sb.finishGuidedWorkout();
  t('termina con save(true) inmediato', sb.saves[0] === true, JSON.stringify(sb.saves));
  t('la sesión queda cerrada y el historial INTACTO', sb.state.activeWorkout === null && sb.state.workoutLog.length === 1);
  sb.finishGuidedWorkout(); // doble ejecución
  t('doble ejecución de Terminar es no-op (sin duplicar historial)', sb.state.workoutLog.length === 1 && sb.saves.length === 1, 'saves=' + sb.saves.length);
})();

console.log('== 14 · Registro rápido: save(true) ya inmediato + anti doble-click ==');
(function () {
  const sb = {};
  sb._inputs = { rlogW_0: { value: '50' }, rlogR_0: { value: '10' } };
  sb.document = { getElementById: function (id) { return sb._inputs[id] || null; } };
  sb.state = { fitnessToday: { plan: [{ name: 'Press banca', sets: 3, muscle: 'Pecho' }], sessionId: 777, checked: {} }, workoutLog: [] };
  sb.saves = [];
  sb.f3AnclarTarjeta = function () {};
  sb.ppUUID = vm.runInNewContext('(' + extractFunc('ppUUID') + ')', sb);
  sb.f3BloqueaDebugExercise = vm.runInNewContext('(' + extractFunc('f3BloqueaDebugExercise') + ')', sb);
  sb.todayISO = function () { return '2026-09-07'; };
  sb.todayLocal = function () { return '2026-09-06'; };
  sb.save = function (inmediato) { sb.saves.push(!!inmediato); };
  sb.actualizarResultadosHoy = function () {};
  sb.quickFitnessToday = function () {};
  sb.safeText = function (x) { return String(x == null ? '' : x); };
  sb.logRoutineQuick = vm.runInNewContext('(' + extractFunc('logRoutineQuick') + ')', sb);
  sb.logRoutineQuick(0);
  t('registra las series del goal con save(true) inmediato', sb.state.workoutLog.length === 3 && sb.saves[0] === true, 'series=' + sb.state.workoutLog.length + ' saves=' + JSON.stringify(sb.saves));
  t('sobreviven a reload', JSON.parse(JSON.stringify(sb.state)).workoutLog.length === 3);
  sb.logRoutineQuick(0); // doble click
  t('doble click del rápido NO duplica (goal ya cubierto)', sb.state.workoutLog.length === 3);
  t('ids únicos por serie', new Set(sb.state.workoutLog.map(r => r.id)).size === 3);
})();

console.log('== 15 · Protección permanente: el nombre de pruebas nunca se registra ==');
(function () {
  const f3BloqueaDebugExercise = vm.runInNewContext('(' + extractFunc('f3BloqueaDebugExercise') + ')');
  t('bloquea el nombre EXACTO de pruebas', f3BloqueaDebugExercise('DEBUG-PERSISTENCIA') === true && f3BloqueaDebugExercise('  debug-persistencia  ') === true);
  t('NO bloquea variantes ni ejercicios reales', f3BloqueaDebugExercise('DEBUG-PERSISTENCIA-extra') === false && f3BloqueaDebugExercise('Press banca') === false && f3BloqueaDebugExercise('') === false);
  // flujo real: guardarEjercicio ignora el nombre reservado
  const sb = { state: { workoutLog: [] }, saves: 0 };
  sb.ppUUID = vm.runInNewContext('(' + extractFunc('ppUUID') + ')', sb);
  sb.f3BloqueaDebugExercise = vm.runInNewContext('(' + extractFunc('f3BloqueaDebugExercise') + ')', sb);
  sb._hoy = function () { return '2026-09-06'; };
  sb.save = function (inmediato) { sb.saves++; };
  sb.refrescarInicio = function () {};
  sb.toastReg = function () {};
  sb.guardarEjercicio = vm.runInNewContext('(' + extractFunc('guardarEjercicio') + ')', sb);
  sb.guardarEjercicio('DEBUG-PERSISTENCIA');
  t('guardarEjercicio("DEBUG-PERSISTENCIA") no crea registro', sb.state.workoutLog.length === 0 && sb.saves === 0);
  sb.guardarEjercicio('Entrené');
  t('los ejercicios reales siguen registrándose', sb.state.workoutLog.length === 1);
  // flujo real: registro rápido ignora el nombre reservado
  const sb2 = {};
  sb2._inputs = { rlogW_0: { value: '50' }, rlogR_0: { value: '10' } };
  sb2.document = { getElementById: function (id) { return sb2._inputs[id] || null; } };
  sb2.state = { fitnessToday: { plan: [{ name: 'DEBUG-PERSISTENCIA', sets: 3, muscle: 'pecho' }], sessionId: 777, checked: {} }, workoutLog: [] };
  sb2.f3AnclarTarjeta = function () {};
  sb2.ppUUID = vm.runInNewContext('(' + extractFunc('ppUUID') + ')', sb2);
  sb2.f3BloqueaDebugExercise = vm.runInNewContext('(' + extractFunc('f3BloqueaDebugExercise') + ')', sb2);
  sb2.todayISO = function () { return '2026-09-07'; };
  sb2.todayLocal = function () { return '2026-09-06'; };
  sb2.save = function () {};
  sb2.actualizarResultadosHoy = function () {};
  sb2.quickFitnessToday = function () {};
  sb2.safeText = function (x) { return String(x == null ? '' : x); };
  sb2.logRoutineQuick = vm.runInNewContext('(' + extractFunc('logRoutineQuick') + ')', sb2);
  sb2.logRoutineQuick(0);
  t('logRoutineQuick con nombre reservado no crea series', sb2.state.workoutLog.length === 0);
})();

console.log('===== RESULTADO: ' + pasadas + ' PASS / ' + falladas + ' FAIL =====');
if (falladas) process.exit(1);
