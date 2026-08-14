// ============================================================
// PRUEBAS v1.187.1 — RENDER REAL (DOM stub) de la rutina de hoy
// y de "Ver progreso". Ejecuta quickFitnessToday/renderSimpleFitnessProgress
// de verdad y verifica el HTML producido, no solo funciones aisladas.
// Uso: node tests/fitness-render.test.js
// ============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extractFunc(src, name) {
  const i = src.indexOf('function ' + name + '(');
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
    id, value: '', innerHTML: '', textContent: '', style: {}, open: false,
    scrollIntoView: function () {}, focus: function () {},
    querySelector: function () { return null; }, querySelectorAll: function () { return []; },
    appendChild: function () {}, setAttribute: function () {}, remove: function () {}
  };
}
const documentStub = {
  getElementById: function (id) { if (!fakeEls[id]) fakeEls[id] = makeEl(id); return fakeEls[id]; },
  querySelector: function () { return null; },
  querySelectorAll: function () { return []; },
  createElement: function () { return makeEl('_dyn' + Object.keys(fakeEls).length); },
  addEventListener: function () {},
  head: { appendChild: function () {} },
  body: { appendChild: function () {} }
};

const sandbox = {
  console,
  document: documentStub,
  todayISO: function () { return '2026-08-14'; },
  todayLocal: function () { return sandbox._hoyLocal; },
  safeText: function (s) { return String(s == null ? '' : s); },
  exLink: function (n) { return 'https://example.com/' + encodeURIComponent(n); },
  U: {
    pesoUnidad: function () { return 'lb'; },
    peso: function (x) { return x + ' lb'; }
  },
  setTimeout: function (fn) { try { fn(); } catch (e) {} },
  clearTimeout: function () {},
  save: function () { sandbox.saves = (sandbox.saves || 0) + 1; },
  alert: function () {},
  getDailyMode: function () { return { food: { k: 1200, kcalGoal: 2500, p: 80, count: 1 } }; }
};
sandbox.window = sandbox;
sandbox._hoyLocal = '2026-08-13';
vm.createContext(sandbox);

['parseRepRange', 'sugerenciaSesion', 'seriesValidasRegs', 'repsNum', 'seriesHoyEjercicio',
  'evaluarSesionHoy', 'actualizarResultadosHoy', 'fitResumenResultadoHoy', 'fitHistorialSesiones',
  'esPrimeraSesionEjercicio',
  'syncSimpleFitnessInputs', 'quickFitnessToday', 'fitPeriodLogs', 'bestByExercise', 'repsTotal',
  'renderSimpleFitnessProgress']
  .forEach(function (n) { vm.runInContext(extractFunc(HTML, n), sandbox); });

const fn = {
  quick: function () { sandbox.quickFitnessToday(); return fakeEls['simpleFitnessOut'].innerHTML; },
  progress: function () { sandbox.renderSimpleFitnessProgress(7); return fakeEls['simpleFitnessOut'].innerHTML; },
  actualizar: sandbox.actualizarResultadosHoy
};

// ---- Helpers ----
let passed = 0, failed = 0;
const failures = [];
function t(name, cond, extra) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; failures.push(name + (extra ? ' → ' + extra : '')); console.log('  ✗ ' + name + (extra ? ' → ' + extra : '')); }
}
function S(dia, ej, peso, repsArr, sid, offset) {
  return repsArr.map(function (r, i) {
    return { id: ((sid || 1) * 100000) + (offset || 0) + i, date: dia, localDate: dia, sessionId: sid || 1, exercise: ej, weight: peso, sets: 1, reps: String(r), note: 'Rutina · test · Serie ' + (i + 1) };
  });
}
function nuevoEstado() {
  sandbox.state = {
    workoutLog: [], fitnessDailyResults: [], fitnessToday: null,
    weight: [], walks: [], expenses: [], wellnessLog: [], meals: [],
    profile: { peso: 150, altura: 170, edad: 30, sexo: 'hombre', actividad: 'muy alta', objetivo: 'ganar músculo' },
    fitEffort: 'auto', fitDislikes: []
  };
  sandbox._hoyLocal = '2026-08-13';
  for (const k in fakeEls) delete fakeEls[k];
}
function packPlan(sid, plan, checked) {
  // checkedDate = hoy: si falta, quickFitnessToday resetea el checklist (comportamiento real).
  sandbox.state.fitnessToday = { date: '2026-08-14', sessionId: sid, plan: plan, checked: checked || {}, checkedDate: '2026-08-14' };
}
const AYER = '2026-08-11', HOY = '2026-08-13';

console.log('\n== RENDER rutina de hoy (quickFitnessToday real) ==');

t('R1 · Ejercicio SIN historial registrado hoy → aparece "🆕 Primera vez registrada"', function () {
  nuevoEstado();
  sandbox.state.workoutLog = S(HOY, 'Aperturas con mancuernas', 20, [11, 11], 77);
  packPlan(77, [
    { name: 'Aperturas con mancuernas', sets: 2, reps: '8-12' },
    { name: 'Remo con barra', sets: 2, reps: '10-12' }
  ], { 0: true });
  const html = fn.quick();
  return html.indexOf('🆕 Primera vez registrada') >= 0;
}());

t('R2 · Resumen "Objetivo vs resultado de hoy" aparece desde la primera serie (sin terminar)', function () {
  nuevoEstado();
  sandbox.state.workoutLog = S(HOY, 'Aperturas con mancuernas', 20, [11, 11], 77);
  packPlan(77, [
    { name: 'Aperturas con mancuernas', sets: 2, reps: '8-12' },
    { name: 'Remo con barra', sets: 2, reps: '10-12' }
  ], { 0: true });
  const html = fn.quick();
  return html.indexOf('🏁 Objetivo vs resultado de hoy') >= 0 && html.indexOf('🎉 Terminaste') < 0;
}());

t('R3 · Objetivo cumplido: veredicto junto al ejercicio + resumen + rutina terminada', function () {
  nuevoEstado();
  sandbox.state.workoutLog = S(AYER, 'Aperturas con mancuernas', 20, [10, 10], 1)
    .concat(S(HOY, 'Aperturas con mancuernas', 20, [11, 11], 77));
  packPlan(77, [
    { name: 'Aperturas con mancuernas', sets: 2, reps: '8-12' },
    { name: 'Remo con barra', sets: 2, reps: '10-12' }
  ], { 0: true, 1: true });
  const html = fn.quick();
  const n = html.split('✓ Objetivo cumplido').length - 1;
  return html.indexOf('✓ Objetivo cumplido') >= 0
    && html.indexOf('🎯 Objetivo · 20 lb · 11 / 11') >= 0
    && html.indexOf('🎉 Terminaste la rutina.') >= 0
    && html.indexOf('sin series registradas') >= 0
    && n >= 2; // veredicto por ejercicio + resumen
}());

t('R4 · Progreso parcial 11/10 → "↗ Progreso · faltó 1 repetición"', function () {
  nuevoEstado();
  sandbox.state.workoutLog = S(AYER, 'Aperturas con mancuernas', 20, [10, 10], 1)
    .concat(S(HOY, 'Aperturas con mancuernas', 20, [11, 10], 77));
  packPlan(77, [{ name: 'Aperturas con mancuernas', sets: 2, reps: '8-12' }], { 0: true });
  const html = fn.quick();
  return html.indexOf('↗ Progreso · faltó 1 repetición') >= 0 && html.indexOf('Casi. Mantén 20 lb') >= 0;
}());

t('R5 · Sin mejora 10/10 → "→ Mantén el peso"', function () {
  nuevoEstado();
  sandbox.state.workoutLog = S(AYER, 'Aperturas con mancuernas', 20, [10, 10], 1)
    .concat(S(HOY, 'Aperturas con mancuernas', 20, [10, 10], 77));
  packPlan(77, [{ name: 'Aperturas con mancuernas', sets: 2, reps: '8-12' }], { 0: true });
  const html = fn.quick();
  return html.indexOf('→ Mantén el peso') >= 0;
}());

t('R6 · Sesión por debajo 8/8 → "↓ Sesión por debajo de la anterior" sin bajar peso', function () {
  nuevoEstado();
  sandbox.state.workoutLog = S(AYER, 'Aperturas con mancuernas', 20, [10, 10], 1)
    .concat(S(HOY, 'Aperturas con mancuernas', 20, [8, 8], 77));
  packPlan(77, [{ name: 'Aperturas con mancuernas', sets: 2, reps: '8-12' }], { 0: true });
  const html = fn.quick();
  return html.indexOf('↓ Sesión por debajo de la anterior') >= 0 && html.indexOf('Mantén 20 lb') >= 0;
}());

t('R7 · Ejercicio alternativo usa SU historial (30 lb, no el del plano)', function () {
  nuevoEstado();
  sandbox.state.workoutLog = S(AYER, 'Press plano', 20, [10, 10], 1)
    .concat(S(AYER, 'Press inclinado', 30, [8, 8], 1))
    .concat(S(HOY, 'Press inclinado', 30, [9, 9], 77));
  packPlan(77, [{ name: 'Press inclinado', sets: 2, reps: '8-12' }], { 0: true });
  const html = fn.quick();
  return html.indexOf('✓ Objetivo cumplido') >= 0 && html.indexOf('🎯 Objetivo · 30 lb · 9 / 9') >= 0;
}());

t('R8 · F5: re-render con el mismo estado produce el mismo HTML', function () {
  nuevoEstado();
  sandbox.state.workoutLog = S(AYER, 'Aperturas con mancuernas', 20, [10, 10], 1)
    .concat(S(HOY, 'Aperturas con mancuernas', 20, [11, 11], 77));
  packPlan(77, [{ name: 'Aperturas con mancuernas', sets: 2, reps: '8-12' }], { 0: true });
  const h1 = fn.quick();
  const h2 = fn.quick();
  return h1 === h2 && h1.indexOf('✓ Objetivo cumplido') >= 0;
}());

t('R9 · Cerrar/abrir: el estado redondo (JSON) vuelve a renderizar igual', function () {
  nuevoEstado();
  sandbox.state.workoutLog = S(AYER, 'Aperturas con mancuernas', 20, [10, 10], 1)
    .concat(S(HOY, 'Aperturas con mancuernas', 20, [11, 11], 77));
  packPlan(77, [{ name: 'Aperturas con mancuernas', sets: 2, reps: '8-12' }], { 0: true });
  const h1 = fn.quick();
  sandbox.state = JSON.parse(JSON.stringify(sandbox.state)); // simula guardar y volver a cargar
  const h2 = fn.quick();
  return h1 === h2 && h2.indexOf('✓ Objetivo cumplido') >= 0;
}());

t('R10 · Cambio de día: 0 series hoy y el objetivo se reconstruye desde ayer', function () {
  nuevoEstado();
  sandbox.state.workoutLog = S(HOY, 'Aperturas con mancuernas', 20, [11, 11], 77); // "ayer" para el nuevo día
  packPlan(77, [{ name: 'Aperturas con mancuernas', sets: 2, reps: '8-12' }], {});
  sandbox._hoyLocal = '2026-08-14'; // mañana
  const html = fn.quick();
  return html.indexOf('Series de hoy: 0/2') >= 0
    && html.indexOf('🎯 Objetivo · 20 lb · 12 / 12') >= 0
    && html.indexOf('Objetivo cumplido') < 0;
}());

t('R11 · Rutina nueva sin ninguna serie → sin resumen ni veredictos', function () {
  nuevoEstado();
  packPlan(77, [{ name: 'Aperturas con mancuernas', sets: 2, reps: '8-12' }], {});
  const html = fn.quick();
  return html.indexOf('🏁 Objetivo vs resultado') < 0 && html.indexOf('Objetivo cumplido') < 0;
}());

t('R12 · actualizarResultadosHoy anota "primera" (🆕) en el storage', function () {
  nuevoEstado();
  sandbox.state.workoutLog = S(HOY, 'Aperturas con mancuernas', 20, [11, 11], 77);
  packPlan(77, [{ name: 'Aperturas con mancuernas', sets: 2, reps: '8-12' }], { 0: true });
  fn.actualizar();
  const ann = sandbox.state.fitnessDailyResults[0];
  return !!ann && ann.estado === 'primera' && ann.icon === '🆕';
}());

console.log('\n== RENDER Ver progreso (renderSimpleFitnessProgress real) ==');

t('R13 · "Historial de sesiones" visible con fecha → ejercicio → peso → reps → resultado', function () {
  nuevoEstado();
  sandbox.state.workoutLog = S(AYER, 'Aperturas con mancuernas', 20, [10, 10], 1)
    .concat(S(HOY, 'Aperturas con mancuernas', 20, [11, 11], 77));
  packPlan(77, [{ name: 'Aperturas con mancuernas', sets: 2, reps: '8-12' }], { 0: true });
  fn.actualizar();
  const html = fn.progress();
  return html.indexOf('📜 Historial de sesiones') >= 0
    && html.indexOf('Aperturas con mancuernas') >= 0
    && html.indexOf('20 lb') >= 0
    && html.indexOf('11/11') >= 0
    && html.indexOf('✓ Objetivo cumplido') >= 0;
}());

t('R14 · El sistema viejo "Tu mejor peso por ejercicio" sigue presente', function () {
  nuevoEstado();
  sandbox.state.workoutLog = S(AYER, 'Aperturas con mancuernas', 20, [10, 10], 1)
    .concat(S(HOY, 'Aperturas con mancuernas', 20, [11, 11], 77));
  packPlan(77, [{ name: 'Aperturas con mancuernas', sets: 2, reps: '8-12' }], { 0: true });
  const html = fn.progress();
  return html.indexOf('Tu mejor peso por ejercicio') >= 0;
}());

t('R15 · Primera sesión sin anotación guardada → historial muestra "🆕 Primera vez" (no "—")', function () {
  nuevoEstado();
  sandbox.state.workoutLog = S(HOY, 'Aperturas con mancuernas', 20, [11, 11], 77);
  sandbox.state.fitnessDailyResults = [];
  const html = fn.progress();
  return html.indexOf('📜 Historial de sesiones') >= 0
    && html.indexOf('Aperturas con mancuernas') >= 0
    && html.indexOf('11/11') >= 0
    && html.indexOf('🆕 Primera vez') >= 0;
}());

t('R22 · Sin anotación pero CON sesión anterior → la más vieja es "🆕 Primera vez" y la nueva "—"', function () {
  nuevoEstado();
  sandbox.state.workoutLog = S(AYER, 'Aperturas con mancuernas', 20, [10, 10], 8)
    .concat(S(HOY, 'Aperturas con mancuernas', 20, [11, 11], 77));
  sandbox.state.fitnessDailyResults = [];
  const html = fn.progress();
  return html.indexOf('🆕 Primera vez') >= 0 && html.indexOf('<span class="muted">—</span>') >= 0;
}());

t('R23 · Anotación guardada de "primera" también muestra "🆕 Primera vez"', function () {
  nuevoEstado();
  sandbox.state.workoutLog = S(HOY, 'Aperturas con mancuernas', 20, [11, 11], 77);
  packPlan(77, [{ name: 'Aperturas con mancuernas', sets: 2, reps: '8-12' }], { 0: true });
  fn.actualizar();
  const html = fn.progress();
  return html.indexOf('🆕 Primera vez') >= 0;
}());

console.log('\n== PERIODOS Semana / 2 semanas / Mes (fitPeriodLogs) ==');

// Fecha local del sistema (los tests corren "hoy", sea la hora que sea).
function sysLocal(offsetDays) {
  const d = new Date(Date.now() + (offsetDays || 0) * 86400000);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
// Registros como los REALES del usuario: localDate = día local, date = día UTC (puede ser "mañana").
function regsRealesHoy() {
  const local = sysLocal(0);
  const utc = new Date(Date.now() + 24 * 3600000).toISOString().slice(0, 10);
  return [
    { id: 101, date: utc, localDate: local, sessionId: 9, exercise: 'Aperturas con mancuernas', weight: 20, sets: 1, reps: '11', note: 'Rutina · Pecho · Serie 1' },
    { id: 102, date: utc, localDate: local, sessionId: 9, exercise: 'Aperturas con mancuernas', weight: 20, sets: 1, reps: '11', note: 'Rutina · Pecho · Serie 2' }
  ];
}

t('R16 · Semana: cuenta los registros de HOY aunque x.date sea UTC de "mañana"', function () {
  nuevoEstado();
  sandbox.state.workoutLog = regsRealesHoy();
  const n = sandbox.fitPeriodLogs(7, 0).length;
  return n === 2;
}(), 'fitPeriodLogs(7,0)=' + sandbox.fitPeriodLogs(7, 0).length);

t('R17 · 2 semanas y Mes también cuentan los registros de hoy', function () {
  nuevoEstado();
  sandbox.state.workoutLog = regsRealesHoy();
  return sandbox.fitPeriodLogs(14, 0).length === 2 && sandbox.fitPeriodLogs(30, 0).length === 2;
}());

t('R18 · Progreso Semana con datos reales: 1 día, 1 ejercicio con peso, 440 lb de volumen', function () {
  nuevoEstado();
  sandbox.state.workoutLog = regsRealesHoy();
  const html = fn.progress();
  return html.indexOf('<b>1</b><span>días entrenados</span>') >= 0
    && html.indexOf('<b>1</b><span>ejercicios con peso</span>') >= 0
    && html.indexOf('440 lb movidas') >= 0;
}());

t('R19 · Registro viejo SIN localDate (solo date) sigue contando (sin regresión)', function () {
  nuevoEstado();
  const ayer = sysLocal(-1);
  sandbox.state.workoutLog = regsRealesHoy().concat([
    { id: 103, date: ayer, sessionId: 8, exercise: 'Remo con barra', weight: 25, sets: 1, reps: '10', note: 'legacy' }
  ]);
  return sandbox.fitPeriodLogs(7, 0).length === 3;
}());

t('R20 · Registro de hace 40 días queda FUERA del Mes', function () {
  nuevoEstado();
  sandbox.state.workoutLog = regsRealesHoy().concat([
    { id: 104, date: sysLocal(-40), localDate: sysLocal(-40), sessionId: 7, exercise: 'Curl bíceps', weight: 15, sets: 1, reps: '10', note: 'viejo' }
  ]);
  return sandbox.fitPeriodLogs(30, 0).length === 2 && sandbox.fitPeriodLogs(7, 0).length === 2;
}());

t('R21 · Semana, 2 semanas y Mes renderizan sin romperse', function () {
  nuevoEstado();
  sandbox.state.workoutLog = regsRealesHoy();
  const h7 = sandbox.renderSimpleFitnessProgress(7), html7 = fakeEls['simpleFitnessOut'].innerHTML;
  const h14 = sandbox.renderSimpleFitnessProgress(14), html14 = fakeEls['simpleFitnessOut'].innerHTML;
  const h30 = sandbox.renderSimpleFitnessProgress(30), html30 = fakeEls['simpleFitnessOut'].innerHTML;
  return html7.indexOf('📊 Progreso · Semana') >= 0
    && html14.indexOf('📊 Progreso · 2 semanas') >= 0
    && html30.indexOf('📊 Progreso · Mes') >= 0
    && html7.indexOf('440') >= 0 && html14.indexOf('440') >= 0 && html30.indexOf('440') >= 0;
}());

// ---- Resumen ----
console.log('\n==========================================');
console.log('Resultado: ' + passed + ' pasaron · ' + failed + ' fallaron');
if (failures.length) {
  console.log('Fallos:');
  failures.forEach(function (f) { console.log('  ✗ ' + f); });
}
console.log('==========================================');
process.exitCode = failed ? 1 : 0;
