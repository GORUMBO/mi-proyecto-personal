// ============================================================
// PRUEBAS v1.205.3 — Peso y historial POR EJERCICIO en la tarjeta
// (bug: "Press militar con barra" y "Curl 21s" mostraban el mismo
//  "Último" y campos 12/30 de borradores ajenos por índice).
// 1) historiales distintos por ejercicio
// 2) borrador anclado al ejercicio (no al índice)
// 3) sin historial → campo vacío (no inventa)
// 4) guardar y reabrir conserva peso/reps del ejercicio correcto
// 5) corregir serie actualiza sin duplicar
// 6) conversión de unidad: 1 lb = 0.453592 kg
// 7) la sesión no se mezcla entre ejercicios
// Uso: node tests/fitness-peso-ejercicio.test.js
// ============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extractFuncLast(src, name) {
  let idx = src.lastIndexOf('function ' + name + '(');
  if (idx < 0) throw new Error('No se encontró function ' + name);
  let depth = 0, j = idx, q = null, tplStack = [];
  for (; j < src.length; j++) {
    const c = src[j];
    if (q === '`') {
      if (c === '\\') { j++; continue; }
      if (c === '`') { q = null; continue; }
      if (c === '$' && src[j + 1] === '{') { j += 2; tplStack.push(depth); depth++; q = null; continue; }
      continue;
    }
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (tplStack.length && depth === tplStack[tplStack.length - 1]) { tplStack.pop(); q = '`'; }
      if (depth === 0) return src.slice(idx, j + 1);
    }
  }
  throw new Error('incompleta: ' + name);
}
function extractConst(src, name) {
  const i = src.indexOf('const ' + name + '=');
  if (i < 0) throw new Error('No const ' + name);
  let j = src.indexOf('=', i) + 1, d = 0, k = j, started = false;
  for (; k < src.length; k++) {
    const c = src[k];
    if (c === '{') { d++; started = true; }
    else if (c === '}') { d--; if (d === 0 && started) { k++; break; } }
  }
  return src.slice(j, k);
}

const F3_EQ_LABELS_RAW = HTML.match(/var F3_EQ_LABELS=(\{[^;]*\});/);
const F3_LB_RAW = HTML.match(/const F3_LB_A_KG=([^;]+);/);
const bundle = [
  F3_LB_RAW ? 'const F3_LB_A_KG=' + F3_LB_RAW[1] + ';' : 'const F3_LB_A_KG=0.453592;',
  'var EX_LIB=' + extractConst(HTML, 'EX_LIB'),
  'var EX_MAPA=' + extractConst(HTML, 'EX_MAPA'),
  'var F3_ALIASES=' + extractConst(HTML, 'F3_ALIASES'),
  F3_EQ_LABELS_RAW ? 'var F3_EQ_LABELS=' + F3_EQ_LABELS_RAW[1] + ';' : 'var F3_EQ_LABELS={};',
  extractFuncLast(HTML, 'f3IdPorNombre'),
  extractFuncLast(HTML, 'f3EquipoEjercicio'),
  extractFuncLast(HTML, 'f3EquipoLinea'),
  extractFuncLast(HTML, 'f3EsPesoCorporal'),
  extractFuncLast(HTML, 'f3SesionVisibleHoy'),
  extractFuncLast(HTML, 'f3SeriesEjercicio'),
  extractFuncLast(HTML, 'f3EstadoEjercicio'),
  extractFuncLast(HTML, 'f3GoalSets'),
  extractFuncLast(HTML, 'workoutHistoryForExercise'),
  extractFuncLast(HTML, 'lastWorkoutForExercise'),
  extractFuncLast(HTML, 'parseRepRange'),
  extractFuncLast(HTML, 'sugerenciaSesion'),
  extractFuncLast(HTML, 'f3LbAKg'),
  extractFuncLast(HTML, 'f3KgALb'),
  extractFuncLast(HTML, 'f3PesoRegistro'),
  extractFuncLast(HTML, 'f3PesoTexto'),
  extractFuncLast(HTML, 'f3PesoCompactoHTML'),
  extractFuncLast(HTML, 'f3PesoInputsHTML'),
  extractFuncLast(HTML, 'f3TarjetaRapidaHTML'),
  extractFuncLast(HTML, 'f3RapidoGuardarBorrador'),
  extractFuncLast(HTML, 'f3RegistrarSerieActual'),
  extractFuncLast(HTML, 'f3BloqueaDebugExercise'),
].join('\n');

let passed = 0, failed = 0;
const failures = [];
function t(name, cond, extra) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; failures.push(name + (extra ? ' → ' + extra : '')); console.log('  ✗ ' + name + (extra ? ' → ' + extra : '')); }
}
const cerca = function (a, b, tol) { return Math.abs(a - b) <= (tol || 0.005); };

function makeSandbox() {
  const fakeEls = {};
  const makeEl = function (id) {
    return { id, value: '', innerHTML: '', textContent: '', style: {}, checked: false, focus: function () {} };
  };
  const sb = {
    console,
    document: {
      getElementById: function (id) { if (!fakeEls[id]) fakeEls[id] = makeEl(id); return fakeEls[id]; },
      querySelector: function () { return null; }, querySelectorAll: function () { return []; },
      createElement: function () { return makeEl('_dyn'); }
    },
    window: null,
    todayISO: function () { return '2026-10-10'; },
    todayLocal: function () { return '2026-10-10'; },
    safeText: function (s) { return String(s == null ? '' : s); },
    U: { pesoUnidad: function () { return 'kg'; } },
    exBuscar: function () { return null; },
    exBuscarDemo: function () { return null; },
    exAnimacionHTML: function () { return '<div>DEMO</div>'; },
    exAnimar: function () {},
    exTieneFoto: function () { return false; },
    exFoto: function () { return ''; },
    exNormal: function (s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); },
    f3AnclarTarjeta: function () {},
    quickFitnessToday: function () {},
    f3ModoVista: function () { return 'rapido'; },
    f3ModoBarHTML: function () { return ''; },
    f3RapidoIndice: function () { return 0; },
    f3RapidoMover: function () {},
    f3RapidoFinalizar: function () {},
    f3SerieSeleccionar: function () {},
    f3MarcarSerie: function () {},
    f3DesmarcarSerie: function () {},
    f3RapidoCompleto: function () {},
    f3CambiarEjercicio: function () {},
    f3CronoIniciar: function () {},
    f3AltsHTML: function () { return ''; },
    f3MarcarEjercicioTerminado: function () {},
    f3OmitirEjercicio: function () {},
    swapToFirstAlt: function () {},
    dislikeExercise: function () {},
    toastReg: function () {},
    actualizarResultadosHoy: function () {},
    ppUUID: function () { return 'id' + (++sb._u); },
    save: function () { sb.saves = (sb.saves || 0) + 1; },
    _u: 0,
    saves: 0,
    setTimeout: function () {},
    clearTimeout: function () {},
    _fitSerieSel: null,
    state: null,
  };
  sb.window = sb;
  vm.createContext(sb);
  vm.runInContext(bundle, sb);
  return sb;
}
function planBase() {
  return [
    { name: 'Press militar con barra', muscle: 'hombros', sets: 3, reps: '8-12', rest: 90 },
    { name: 'Curl 21s', muscle: 'biceps', sets: 2, reps: '10-15', rest: 60 },
  ];
}
function estadoBase() {
  return {
    workoutLog: [],
    fitnessToday: { date: '2026-10-10', sessionId: 'sesA', ctx: {}, plan: planBase(), checked: {}, estado: {} },
    uiSettings: {},
  };
}
function campoDe(html, id) {
  const m = html.match(new RegExp('id="' + id + '"[^>]*value="([^"]*)"'));
  return m ? m[1] : null;
}
function ultimoDe(html) {
  const m = html.match(/fit-rapida-ult[^>]*>(.*?)<\/div>/);
  return m ? m[1] : null;
}

// ============================================================
console.log('\n== 1 · Historiales distintos por ejercicio ==');
{
  const sb = makeSandbox();
  sb.state = estadoBase();
  sb.state.workoutLog = [
    { id: 1, date: '2026-10-09', localDate: '2026-10-09', sessionId: 's1', exercise: 'Press militar con barra', weight: 60, reps: '12', note: '' },
    { id: 2, date: '2026-10-09', localDate: '2026-10-09', sessionId: 's1', exercise: 'Curl 21s', weight: 30, reps: '8', note: '' },
  ];
  const c0 = sb.f3TarjetaRapidaHTML(0, sb.state.fitnessToday);
  const c1 = sb.f3TarjetaRapidaHTML(1, sb.state.fitnessToday);
  t('T1a · Press militar muestra SU último (60 kg × 12)', (ultimoDe(c0) || '').indexOf('60 kg × 12') >= 0, ultimoDe(c0));
  t('T1b · Curl 21s muestra SU último (30 kg × 8), no el de Press', (ultimoDe(c1) || '').indexOf('30 kg × 8') >= 0 && (ultimoDe(c1) || '').indexOf('60') < 0, ultimoDe(c1));
  t('T1c · campos distintos: Peso 60 vs 30', campoDe(c0, 'rlogW_0') === '60' && campoDe(c1, 'rlogW_1') === '30', campoDe(c0, 'rlogW_0') + ' vs ' + campoDe(c1, 'rlogW_1'));
}

// ============================================================
console.log('\n== 2 · Borrador anclado al EJERCICIO (no al índice) ==');
{
  const sb = makeSandbox();
  sb.state = estadoBase();
  sb.state.workoutLog = [
    { id: 1, date: '2026-10-09', localDate: '2026-10-09', sessionId: 's1', exercise: 'Press militar con barra', weight: 60, reps: '12', note: '' },
  ];
  // borrador viejo de OTRO ejercicio guardado bajo el índice 0 (formato legado)
  sb.state.uiSettings.fitBorrador = { 0: { w: '12', r: '12' } };
  const c0 = sb.f3TarjetaRapidaHTML(0, sb.state.fitnessToday);
  t('T2a · el borrador legado por índice ya NO pisa el peso real (60, no 12)', campoDe(c0, 'rlogW_0') === '60', campoDe(c0, 'rlogW_0'));

  // borrador por NOMBRE del ejercicio A no debe aparecer en B, ni al reordenar
  sb.state.uiSettings.fitBorrador = { 'press militar con barra': { w: '62', r: '10' } };
  sb.state.fitnessToday.plan = [planBase()[1], planBase()[0]]; // Curl primero
  const cCurl = sb.f3TarjetaRapidaHTML(0, sb.state.fitnessToday);
  const cPress = sb.f3TarjetaRapidaHTML(1, sb.state.fitnessToday);
  t('T2b · al reordenar, Curl (idx0) NO conserva el peso del ejercicio anterior (Press 62)', campoDe(cCurl, 'rlogW_0') !== '62', campoDe(cCurl, 'rlogW_0'));
  t('T2c · Press (ahora idx1) conserva SU borrador 62', campoDe(cPress, 'rlogW_1') === '62', campoDe(cPress, 'rlogW_1'));

  // el guardado del borrador usa el nombre del ejercicio actual
  sb.state.fitnessToday.plan = planBase();
  const inp = { id: 'rlogW_1', value: '33' };
  sb.f3RapidoGuardarBorrador(1, inp);
  t('T2d · f3RapidoGuardarBorrador guarda por NOMBRE (curl 21s), no por índice', sb.state.uiSettings.fitBorrador['curl 21s'] && sb.state.uiSettings.fitBorrador['curl 21s'].w === '33' && !sb.state.uiSettings.fitBorrador['1'], JSON.stringify(sb.state.uiSettings.fitBorrador));
}

// ============================================================
console.log('\n== 3 · Sin historial: campo vacío, no inventa ==');
{
  const sb = makeSandbox();
  sb.state = estadoBase();
  const c0 = sb.f3TarjetaRapidaHTML(0, sb.state.fitnessToday);
  t('T3a · sin historial el campo Peso queda vacío', campoDe(c0, 'rlogW_0') === '');
  t('T3b · sin historial NO hay línea "Último"', ultimoDe(c0) == null);
}

// ============================================================
console.log('\n== 4 · Guardar y reabrir conserva peso/reps del ejercicio correcto ==');
{
  const sb = makeSandbox();
  sb.state = estadoBase();
  // simular el tecleo en los campos del ejercicio 0
  sb.document.getElementById('rlogW_0').value = '60';
  sb.document.getElementById('rlogR_0').value = '12';
  sb.f3RegistrarSerieActual(0);
  const reg = sb.state.workoutLog[0];
  t('T4a · el registro guarda el EJERCICIO correcto', !!reg && reg.exercise === 'Press militar con barra', reg && reg.exercise);
  t('T4b · guarda peso 60 y reps 12', !!reg && +reg.weight === 60 && reg.reps === '12', JSON.stringify(reg));
  t('T4c · guarda la unidad (weightUnit kg)', !!reg && reg.weightUnit === 'kg', reg && reg.weightUnit);
  t('T4d · guarda la sesión del pack (sesA)', !!reg && reg.sessionId === 'sesA', reg && reg.sessionId);

  // "reabrir": el estado se persistió (mismo objeto); volver a renderizar
  const visibles = sb.f3SeriesEjercicio(sb.state.fitnessToday.plan[0], sb.state.fitnessToday).visibles;
  t('T4e · al reabrir la serie sigue visible', visibles.length === 1, JSON.stringify(visibles));
  const chipCard = sb.f3TarjetaRapidaHTML(0, sb.state.fitnessToday);
  t('T4f · la tarjeta muestra la serie guardada 60 kg × 12', chipCard.indexOf('60 kg × 12') >= 0);

  // registrar la segunda serie del MISMO ejercicio y confirmar que no toca Curl
  sb.document.getElementById('rlogW_0').value = '62';
  sb.document.getElementById('rlogR_0').value = '11';
  sb.f3RegistrarSerieActual(0);
  t('T4g · las dos series quedan asociadas a Press militar (no a Curl 21s)', sb.state.workoutLog.length === 2 && sb.state.workoutLog.every(function (r) { return r.exercise === 'Press militar con barra'; }));
  t('T4h · el historial de Curl 21s sigue VACÍO (no heredó nada)', sb.lastWorkoutForExercise('Curl 21s') == null);
}

// ============================================================
console.log('\n== 5 · Corregir serie actualiza SIN duplicar ==');
{
  const sb = makeSandbox();
  sb.state = estadoBase();
  sb.document.getElementById('rlogW_0').value = '60';
  sb.document.getElementById('rlogR_0').value = '12';
  sb.f3RegistrarSerieActual(0);
  // tocar la serie 1 (la existente) para corregirla
  sb._fitSerieSel = { i: 0, s: 0, completa: true };
  sb.document.getElementById('f3SerieChk').checked = true;
  sb.document.getElementById('rlogW_0').value = '65';
  sb.document.getElementById('rlogR_0').value = '10';
  sb.f3RegistrarSerieActual(0);
  t('T5a · corregir actualiza el peso en su lugar (65, no 60)', sb.state.workoutLog.length === 1 && +sb.state.workoutLog[0].weight === 65 && sb.state.workoutLog[0].reps === '10', JSON.stringify(sb.state.workoutLog));
}

// ============================================================
console.log('\n== 6 · Conversión de unidad: 1 lb = 0.453592 kg ==');
{
  const sb = makeSandbox();
  sb.state = estadoBase();
  t('T6a · f3LbAKg(1) = 0.453592', cerca(sb.f3LbAKg(1), 0.453592, 1e-9));
  t('T6b · f3KgALb(0.453592) = 1', cerca(sb.f3KgALb(0.453592), 1, 1e-9));
  t('T6c · registro en lb se muestra convertido a kg (100 lb = 45.36 kg)', sb.f3PesoTexto({ weight: 100, weightUnit: 'lb' }) === '45.36 kg', sb.f3PesoTexto({ weight: 100, weightUnit: 'lb' }));
  t('T6d · registro en kg se muestra igual (60 kg)', sb.f3PesoTexto({ weight: 60, weightUnit: 'kg' }) === '60 kg');
  t('T6e · registro viejo SIN weightUnit se muestra tal cual (no inventa conversión)', sb.f3PesoTexto({ weight: 60 }) === '60 kg');
}

// ============================================================
console.log('\n== 7 · La sesión NO se mezcla entre ejercicios ==');
{
  const sb = makeSandbox();
  sb.state = estadoBase();
  sb.state.workoutLog = [
    { id: 1, date: '2026-10-10', localDate: '2026-10-10', sessionId: 'sCurl', exercise: 'Curl 21s', weight: 30, reps: '8' },
  ];
  const r = sb.f3SesionVisibleHoy(sb.state.workoutLog, '2026-10-10', 'press militar con barra', null);
  t('T7 · al preguntar por Press militar NO se adopta la sesión de Curl 21s', !r.sid || r.sid !== 'sCurl', r.sid);
}

console.log('\n==========================================');
console.log('Resultado: ' + passed + ' pasaron · ' + failed + ' fallaron');
console.log('==========================================');
if (failed) {
  console.log('\nFallos:\n' + failures.map(function (f) { return '  ✗ ' + f; }).join('\n'));
  process.exit(1);
}
process.exit(0);
