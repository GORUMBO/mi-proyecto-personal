// ============================================================
// PRUEBAS v1.187 — Fase "Objetivo vs Resultado Real del Día"
// Sin dependencias: extrae las funciones puras de index.html
// y las ejecuta en un sandbox con Node (node tests/fitness-objetivo.test.js).
// ============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// Extrae el código fuente completo de una función nombrada (respeta strings).
function extractFunc(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('No se encontró function ' + name + ' en index.html');
  let depth = 0, j = i, q = null;
  for (; j < src.length; j++) {
    const c = src[j];
    if (q) {
      if (c === '\\') { j++; continue; }
      if (c === q) q = null;
      continue;
    }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return src.slice(i, j + 1);
    }
  }
  throw new Error('No se pudo extraer completa la función ' + name);
}

// ---- Sandbox ----
const sandbox = {
  console,
  state: { workoutLog: [], fitnessToday: null, fitnessDailyResults: [] },
  U: { pesoUnidad: function () { return 'lb'; } },
  todayLocal: function () { return '2026-08-13'; },
  todayISO: function () { return '2026-08-13'; },
  safeText: function (s) { return String(s == null ? '' : s); },
  save: function (im) { sandbox.saves = (sandbox.saves || 0) + 1; }
};
sandbox.global = sandbox;
vm.createContext(sandbox);

['parseRepRange', 'sugerenciaSesion', 'seriesValidasRegs', 'repsNum',
  'seriesHoyEjercicio', 'evaluarSesionHoy', 'actualizarResultadosHoy',
  'fitResumenResultadoHoy', 'fitHistorialSesiones', 'esPrimeraSesionEjercicio'].forEach(function (n) {
  vm.runInContext(extractFunc(HTML, n), sandbox);
});

const fn = {
  sugerencia: sandbox.sugerenciaSesion,
  seriesValidas: sandbox.seriesValidasRegs,
  seriesHoy: sandbox.seriesHoyEjercicio,
  evaluar: sandbox.evaluarSesionHoy,
  actualizar: sandbox.actualizarResultadosHoy,
  resumen: sandbox.fitResumenResultadoHoy,
  historial: sandbox.fitHistorialSesiones
};

// ---- Helpers ----
let passed = 0, failed = 0;
const failures = [];
function t(name, cond, extra) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else {
    failed++; failures.push(name + (extra ? ' → ' + extra : ''));
    console.log('  ✗ ' + name + (extra ? ' → ' + extra : ''));
  }
}
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
// Sesión: crea registros de una sesión (una entrada por serie).
function S(dia, ej, peso, repsArr, sid, offset) {
  return repsArr.map(function (r, i) {
    return {
      id: ((sid || 1) * 100000) + (offset || 0) + i,
      date: dia, localDate: dia, sessionId: sid || 1,
      exercise: ej, weight: peso, sets: 1, reps: String(r), note: 'Rutina · test'
    };
  });
}
function setLog(arr) { sandbox.state.workoutLog = arr; }

const AYER = '2026-08-11', HOY = '2026-08-13', MANANA = '2026-08-14';

console.log('\n== sugerenciaSesion (no romper lo existente) ==');

t('NUNCA suma pesos: 20×10/10/10 → target 20 (no 60)', function () {
  setLog(S(AYER, 'Press plano', 20, [10, 10, 10], 1));
  const s = fn.sugerencia('Press plano', '8-12', 3, { log: sandbox.state.workoutLog, hoy: HOY });
  return s.target === 20 && eq(s.targetReps, [11, 11, 11]);
}(), 'target=' + JSON.stringify(fn.sugerencia('Press plano', '8-12', 3, { log: sandbox.state.workoutLog, hoy: HOY })));

t('12/12/12 → subir peso: target 25 y objetivo 8/8/8 (nunca suma)', function () {
  setLog(S(AYER, 'Press plano', 20, [12, 12, 12], 1));
  const s = fn.sugerencia('Press plano', '8-12', 3, { log: sandbox.state.workoutLog, hoy: HOY });
  return s.target === 25 && eq(s.targetReps, [8, 8, 8]);
}());

t('Serie extra NO altera el objetivo (4 series → objetivo de 3)', function () {
  setLog(S(AYER, 'Press plano', 20, [10, 10, 10, 10], 1));
  const s = fn.sugerencia('Press plano', '8-12', 3, { log: sandbox.state.workoutLog, hoy: HOY });
  return s.target === 20 && eq(s.targetReps, [11, 11, 11]);
}());

t('Sesión mala NO castiga: 20×8/8/8 → mantén 20 e intenta 9/9/9', function () {
  setLog(S(AYER, 'Press plano', 20, [8, 8, 8], 1));
  const s = fn.sugerencia('Press plano', '8-12', 3, { log: sandbox.state.workoutLog, hoy: HOY });
  return s.target === 20 && eq(s.targetReps, [9, 9, 9]);
}());

t('Sesión bajo el mínimo NO baja peso automáticamente: 20×6/6/6 → target 20', function () {
  setLog(S(AYER, 'Press plano', 20, [6, 6, 6], 1));
  const s = fn.sugerencia('Press plano', '8-12', 3, { log: sandbox.state.workoutLog, hoy: HOY });
  return s.target === 20;
}());

console.log('\n== evaluarSesionHoy (veredictos) ==');

t('Objetivo exacto cumplido: 20×11/11/11 vs objetivo 11/11/11 → cumplido', function () {
  setLog(S(AYER, 'Press plano', 20, [10, 10, 10], 1).concat(S(HOY, 'Press plano', 20, [11, 11, 11], 2)));
  const e = fn.evaluar('Press plano', '8-12', 3, HOY, sandbox.state.workoutLog, 2);
  return e.estado === 'cumplido' && e.label.indexOf('cumplido') >= 0;
}());

t('Objetivo superado: 20×12/12/12 → superado 🎉', function () {
  setLog(S(AYER, 'Press plano', 20, [10, 10, 10], 1).concat(S(HOY, 'Press plano', 20, [12, 12, 12], 2)));
  const e = fn.evaluar('Press plano', '8-12', 3, HOY, sandbox.state.workoutLog, 2);
  return e.estado === 'superado';
}());

t('Objetivo parcial: 20×11/10/10 → progreso con "Casi" y "faltó 2 repeticiones"', function () {
  setLog(S(AYER, 'Press plano', 20, [10, 10, 10], 1).concat(S(HOY, 'Press plano', 20, [11, 10, 10], 2)));
  const e = fn.evaluar('Press plano', '8-12', 3, HOY, sandbox.state.workoutLog, 2);
  return e.estado === 'progreso' && e.texto.indexOf('Casi') >= 0 && e.label.indexOf('faltó 2 repeticiones') >= 0;
}());

t('Parcial de 1 repetición: 20×11/11/10 → "faltó 1 repetición" (singular)', function () {
  setLog(S(AYER, 'Press plano', 20, [10, 10, 10], 1).concat(S(HOY, 'Press plano', 20, [11, 11, 10], 2)));
  const e = fn.evaluar('Press plano', '8-12', 3, HOY, sandbox.state.workoutLog, 2);
  return e.estado === 'progreso' && e.label.indexOf('faltó 1 repetición') >= 0;
}());

t('Sin mejora: 20×10/10/10 (igual que la anterior) → manten', function () {
  setLog(S(AYER, 'Press plano', 20, [10, 10, 10], 1).concat(S(HOY, 'Press plano', 20, [10, 10, 10], 2)));
  const e = fn.evaluar('Press plano', '8-12', 3, HOY, sandbox.state.workoutLog, 2);
  return e.estado === 'manten' && e.label.indexOf('Mantén') >= 0;
}());

t('Sesión mala: 20×8/8/8 vs anterior 10/10/10 → debajo, y el peso NO baja', function () {
  setLog(S(AYER, 'Press plano', 20, [10, 10, 10], 1).concat(S(HOY, 'Press plano', 20, [8, 8, 8], 2)));
  const e = fn.evaluar('Press plano', '8-12', 3, HOY, sandbox.state.workoutLog, 2);
  return e.estado === 'debajo' && e.goal.target === 20;
}());

t('Más peso con menos reps: 25×8/8/8 vs objetivo 20×11/11/11 → superado', function () {
  setLog(S(AYER, 'Press plano', 20, [10, 10, 10], 1).concat(S(HOY, 'Press plano', 25, [8, 8, 8], 2)));
  const e = fn.evaluar('Press plano', '8-12', 3, HOY, sandbox.state.workoutLog, 2);
  return e.estado === 'superado';
}());

t('Entrenamiento incompleto: 2 series de 3 → incompleto (mantener peso)', function () {
  setLog(S(AYER, 'Press plano', 20, [10, 10, 10], 1).concat(S(HOY, 'Press plano', 20, [11, 11], 2)));
  const e = fn.evaluar('Press plano', '8-12', 3, HOY, sandbox.state.workoutLog, 2);
  return e.estado === 'incompleto' && e.texto.indexOf('Mantén 20') >= 0;
}());

t('Día sin entrenamiento previo → primera', function () {
  setLog(S(HOY, 'Press plano', 20, [10, 10, 10], 2));
  const e = fn.evaluar('Press plano', '8-12', 3, HOY, sandbox.state.workoutLog, 2);
  return e.estado === 'primera';
}());

t('Sin registros hoy → sinResultado', function () {
  setLog(S(AYER, 'Press plano', 20, [10, 10, 10], 1));
  const e = fn.evaluar('Press plano', '8-12', 3, HOY, sandbox.state.workoutLog, 2);
  return e.estado === 'sinResultado';
}());

t('Varios ejercicios el mismo día: veredictos independientes', function () {
  setLog(
    S(AYER, 'Press plano', 20, [10, 10, 10], 1)
      .concat(S(AYER, 'Curl bíceps', 15, [10, 10, 10], 1))
      .concat(S(HOY, 'Press plano', 20, [11, 11, 11], 2))
      .concat(S(HOY, 'Curl bíceps', 15, [8, 8, 8], 2))
  );
  const a = fn.evaluar('Press plano', '8-12', 3, HOY, sandbox.state.workoutLog, 2);
  const b = fn.evaluar('Curl bíceps', '8-12', 3, HOY, sandbox.state.workoutLog, 2);
  return a.estado === 'cumplido' && b.estado === 'debajo';
}());

t('Ejercicio alternativo usa SU historial (Press inclinado no mezcla con plano)', function () {
  setLog(
    S(AYER, 'Press plano', 20, [10, 10, 10], 1)
      .concat(S(AYER, 'Press inclinado', 30, [8, 8, 8], 1))
      .concat(S(HOY, 'Press inclinado', 30, [9, 9, 9], 2))
  );
  const e = fn.evaluar('Press inclinado', '8-12', 3, HOY, sandbox.state.workoutLog, 2);
  return e.estado === 'cumplido' && e.goal.target === 30;
}());

t('Registros duplicados (mismo id) no inflan las series', function () {
  const hoyRegs = S(HOY, 'Press plano', 20, [11, 11, 11], 2);
  hoyRegs.push(Object.assign({}, hoyRegs[0])); // duplicado exacto con el mismo id
  setLog(S(AYER, 'Press plano', 20, [10, 10, 10], 1).concat(hoyRegs));
  const e = fn.evaluar('Press plano', '8-12', 3, HOY, sandbox.state.workoutLog, 2);
  return e.actual.length === 3 && e.estado === 'cumplido';
}());

t('Serie extra repetida (doble click) más allá de las normales no rompe cumplido', function () {
  setLog(S(AYER, 'Press plano', 20, [10, 10, 10], 1).concat(S(HOY, 'Press plano', 20, [11, 11, 11, 11], 2)));
  const e = fn.evaluar('Press plano', '8-12', 3, HOY, sandbox.state.workoutLog, 2);
  return e.estado === 'cumplido';
}());

t('Cambio de día: el objetivo de mañana se calcula desde la sesión de hoy', function () {
  setLog(S(AYER, 'Press plano', 20, [10, 10, 10], 1).concat(S(HOY, 'Press plano', 20, [11, 11, 11], 2)));
  const manana = fn.evaluar('Press plano', '8-12', 3, MANANA, sandbox.state.workoutLog, 3);
  return manana.estado === 'sinResultado' && eq(manana.goal.targetReps, [12, 12, 12]) && manana.goal.target === 20;
}());

t('Cambio de día: las series "actuales" solo son del día evaluado (no mezcla días)', function () {
  setLog(S(AYER, 'Press plano', 20, [10, 10, 10], 1).concat(S(HOY, 'Press plano', 20, [11, 11, 11], 2)));
  const e = fn.evaluar('Press plano', '8-12', 3, AYER, sandbox.state.workoutLog, 1);
  // El resultado (actual) solo contiene series del día evaluado; las de HOY no se mezclan.
  return e.actual.length === 3 && e.actual.every(function (r) { return (r.localDate || r.date) === AYER; });
}());

t('Determinismo: dos evaluaciones con los mismos datos dan el mismo veredicto (F5 seguro)', function () {
  setLog(S(AYER, 'Press plano', 20, [10, 10, 10], 1).concat(S(HOY, 'Press plano', 20, [11, 10, 10], 2)));
  const a = fn.evaluar('Press plano', '8-12', 3, HOY, sandbox.state.workoutLog, 2);
  const b = fn.evaluar('Press plano', '8-12', 3, HOY, sandbox.state.workoutLog, 2);
  return a.estado === b.estado && a.label === b.label;
}());

t('Registros inválidos (peso 0 o reps "no registradas") se ignoran', function () {
  setLog(S(AYER, 'Press plano', 20, [10, 10, 10], 1).concat([
    { id: 9001, date: HOY, localDate: HOY, sessionId: 2, exercise: 'Press plano', weight: 0, sets: 1, reps: '12', note: '' },
    { id: 9002, date: HOY, localDate: HOY, sessionId: 2, exercise: 'Press plano', weight: 20, sets: 1, reps: 'no registradas', note: '' },
    { id: 9003, date: HOY, localDate: HOY, sessionId: 2, exercise: 'Press plano', weight: 20, sets: 1, reps: '8-12', note: '' }
  ]));
  const e = fn.evaluar('Press plano', '8-12', 3, HOY, sandbox.state.workoutLog, 2);
  return e.estado === 'sinResultado';
}());

console.log('\n== Persistencia (actualizarResultadosHoy) ==');

t('Guarda veredicto en fitnessDailyResults y sobrevive recarga (JSON round-trip)', function () {
  sandbox.state.workoutLog = S(AYER, 'Press plano', 20, [10, 10, 10], 1).concat(S(HOY, 'Press plano', 20, [11, 11, 11], 77));
  sandbox.state.fitnessDailyResults = [];
  sandbox.state.fitnessToday = { date: HOY, sessionId: 77, plan: [{ name: 'Press plano', sets: 3, reps: '8-12' }] };
  sandbox.saves = 0;
  fn.actualizar();
  const raw = JSON.parse(JSON.stringify(sandbox.state));
  const ann = raw.fitnessDailyResults[0];
  if (!ann) return false;
  // Tras "recargar" (round-trip), la anotación sigue ahí con el veredicto
  return ann.estado === 'cumplido' && ann.date === HOY && ann.exercise === 'Press plano' && sandbox.saves >= 1;
}());

t('Upsert idempotente: llamar dos veces no duplica anotaciones', function () {
  fn.actualizar();
  fn.actualizar();
  const n = sandbox.state.fitnessDailyResults.length;
  return n === 1;
}());

t('Al borrar todas las series de hoy, la anotación desaparece', function () {
  sandbox.state.workoutLog = S(AYER, 'Press plano', 20, [10, 10, 10], 1);
  fn.actualizar();
  return sandbox.state.fitnessDailyResults.length === 0;
}());

console.log('\n== Construcción de HTML (sin DOM) ==');

t('Resumen al terminar la rutina incluye los veredictos por ejercicio', function () {
  sandbox.state.workoutLog = S(AYER, 'Press plano', 20, [10, 10, 10], 1)
    .concat(S(HOY, 'Press plano', 20, [11, 11, 11], 77))
    .concat(S(AYER, 'Curl bíceps', 15, [10, 10, 10], 1))
    .concat(S(HOY, 'Curl bíceps', 15, [8, 8, 8], 77));
  sandbox.state.fitnessToday = { date: HOY, sessionId: 77, plan: [
    { name: 'Press plano', sets: 3, reps: '8-12' },
    { name: 'Curl bíceps', sets: 3, reps: '8-12' }
  ] };
  const html = fn.resumen();
  return html.indexOf('Objetivo vs resultado') >= 0
    && html.indexOf('Objetivo cumplido') >= 0
    && html.indexOf('Sesión por debajo') >= 0;
}());

t('Historial de sesiones: fecha → ejercicio → peso → reps → marca ✓', function () {
  sandbox.state.workoutLog = S(AYER, 'Press plano', 20, [10, 10, 10], 1)
    .concat(S(HOY, 'Press plano', 20, [11, 11, 11], 77));
  sandbox.state.fitnessToday = { date: HOY, sessionId: 77, plan: [{ name: 'Press plano', sets: 3, reps: '8-12' }] };
  sandbox.state.fitnessDailyResults = [];
  fn.actualizar();
  const html = fn.historial();
  return html.indexOf('Historial de sesiones') >= 0
    && html.indexOf('Press plano') >= 0
    && html.indexOf('20 lb') >= 0
    && html.indexOf('11/11/11') >= 0
    && html.indexOf('✓ Objetivo cumplido') >= 0
    && html.indexOf('11 ago') >= 0;
}());

t('Historial no requiere la segunda base: lee de workoutLog (datos existentes)', function () {
  sandbox.state.fitnessDailyResults = [];
  const html = fn.historial();
  return html.indexOf('Press plano') >= 0 && html.indexOf('10/10/10') >= 0;
}());

console.log('\n== Anti-regresión (nunca sumar pesos, global) ==');
t('Ningún objetivo numérico es la suma de los pesos de las series', function () {
  setLog(S(AYER, 'Press plano', 20, [10, 10, 10], 1).concat(S(HOY, 'Press plano', 20, [10, 10, 10], 2)));
  const s = fn.sugerencia('Press plano', '8-12', 3, { log: sandbox.state.workoutLog, hoy: HOY });
  return s.target !== 60 && s.target !== 40 && s.target === 20;
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
