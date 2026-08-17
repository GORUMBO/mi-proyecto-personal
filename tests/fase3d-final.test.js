// ============================================================
// PRUEBAS F3d — Nivel, ¿Por qué? semanal, feedback visible,
// deload sugerido, Repetir esta rutina y Variar esta rutina.
// Mantiene todo lo de F3a/F3b/F3c (suite completa aparte).
// Uso: node tests/fase3d-final.test.js
// ============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extractFunc(name) {
  var src = HTML;
  let i = src.indexOf('async function ' + name + '(');
  if (i < 0) i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('No se encontró function ' + name);
  let parens = 0, j = i, q = null, lineC = false, blockC = false, bodyStart = -1;
  for (; j < src.length; j++) {
    const c = src[j], n = src[j + 1];
    if (lineC) { if (c === '\n') lineC = false; continue; }
    if (blockC) { if (c === '*' && n === '/') { blockC = false; j++; } continue; }
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '/' && n === '/') { lineC = true; j++; continue; }
    if (c === '/' && n === '*') { blockC = true; j++; continue; }
    if (c === '(') parens++;
    else if (c === ')') { parens--; if (parens === 0) { bodyStart = j + 1; break; } }
  }
  if (bodyStart < 0) throw new Error('params de ' + name);
  let depth = 0; q = null; lineC = false; blockC = false; j = bodyStart;
  for (; j < src.length; j++) {
    const c = src[j], n = src[j + 1];
    if (lineC) { if (c === '\n') lineC = false; continue; }
    if (blockC) { if (c === '*' && n === '/') { blockC = false; j++; } continue; }
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '/' && n === '/') { lineC = true; j++; continue; }
    if (c === '/' && n === '*') { blockC = true; j++; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return src.slice(i, j + 1); }
  }
  throw new Error('incompleta: ' + name);
}
function extractObj(name) {
  var m = HTML.match(new RegExp('const ' + name + '=(\\{.*?\\});', 's'));
  if (!m) throw new Error('No se encontró const ' + name);
  return m[1];
}

let passed = 0, failed = 0;
const failures = [];
function t(name, cond, extra) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; failures.push(name + (extra ? ' → ' + extra : '')); console.log('  ✗ ' + name + (extra ? ' → ' + extra : '')); }
}

// ============================================================
// Sandbox con el motor completo + funciones F3d
// ============================================================
const sandbox = {
  console,
  state: { fitEffort: 'normal', fitVariant: 0, workoutLog: [], sessionFeedbacks: [], profile: {} },
  fitDaySeed: function () { return 3; },
  todayISO: function () { return '2026-08-16'; },
  todayLocal: function () { return '2026-08-16'; },
  save: function () {},
  renderFitnessCoach: function () {},
  quickFitnessToday: function () {},
  createFitnessToday: function () {},
  alert: function () {},
  confirm: function () { return true; },
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  ppUUID: function () { return 'uuid-' + Math.random().toString(36).slice(2); },
  document: { getElementById: function () { return { innerHTML: '', textContent: '', style: { opacity: '' } }; } }
};
vm.runInNewContext(
  extractFunc('fitnessExerciseBank') + '\n' +
  extractFunc('specialWorkoutKey') + '\n' +
  extractFunc('buildFitnessTodayPlan') + '\n' +
  extractFunc('restSeconds') + '\n' +
  extractFunc('parseRepRange') + '\n' +
  extractFunc('routineSplit') + '\n' +
  extractFunc('goalScheme') + '\n' +
  extractFunc('goalLabelSafe') + '\n' +
  extractFunc('exercisesPerSession') + '\n' +
  extractFunc('defaultWeekSchedule') + '\n' +
  extractFunc('buildCustomRoutine') + '\n' +
  extractFunc('equipLabel') + '\n' +
  extractFunc('useRoutineDayToday') + '\n' +
  extractFunc('f3EquipKey') + '\n' +
  extractFunc('f3NivelNum') + '\n' +
  extractFunc('f3NivelBand') + '\n' +
  extractFunc('f3Mid') + '\n' +
  extractFunc('f3SetsBase') + '\n' +
  extractFunc('f3CapSets') + '\n' +
  extractFunc('f3RepsStr') + '\n' +
  extractFunc('f3RestSeg') + '\n' +
  extractFunc('f3FactorFatiga') + '\n' +
  extractFunc('f3VolBand') + '\n' +
  extractFunc('f3Candidatos') + '\n' +
  extractFunc('f3Elegir') + '\n' +
  extractFunc('f3IdPorNombre') + '\n' +
  extractFunc('f3HistorialReciente') + '\n' +
  extractFunc('f3SlotsDia') + '\n' +
  extractFunc('f3SlotsExtras') + '\n' +
  extractFunc('f3SlotsParaMusculos') + '\n' +
  extractFunc('f3TagDeNombre') + '\n' +
  extractFunc('f3SemanaReferencia') + '\n' +
  extractFunc('f3ValidarEjercicioLib') + '\n' +
  extractFunc('f3ValidarPlan') + '\n' +
  extractFunc('f3ValidarSemana') + '\n' +
  extractFunc('f3TendenciaFeedback') + '\n' +
  extractFunc('f3EjerciciosDolor') + '\n' +
  extractFunc('f3ValidarPlanNombres') + '\n' +
  extractFunc('f3ValidarSustitucion') + '\n' +
  extractFunc('f3GenerarSeguro') + '\n' +
  extractFunc('saveFitFeedback') + '\n' +
  extractFunc('setFitEstado') + '\n' +
  extractFunc('setNivelFit') + '\n' +
  extractFunc('f3TendenciaDificilSemanas') + '\n' +
  extractFunc('aplicarDeloadHoy') + '\n' +
  extractFunc('f3NombreRutinaAuto') + '\n' +
  extractFunc('f3NombreMostrar') + '\n' +
  extractFunc('f3NombreAGuardar') + '\n' +
  extractFunc('f3FirmaRutina') + '\n' +
  extractFunc('repetirRutina') + '\n' +
  extractFunc('f3VariarHoy') + '\n' +
  extractFunc('borrarFitFeedback') + '\n' +
  'var SPECIAL_WORKOUTS=' + extractObj('SPECIAL_WORKOUTS') + ';\n' +
  'var EX_LIB=' + extractObj('EX_LIB') + ';\n' +
  'var F3_RULES=' + extractObj('F3_RULES') + ';\n' +
  'var F3_ALIASES=' + extractObj('F3_ALIASES') + ';',
  sandbox
);
const EX_LIB = sandbox.EX_LIB;

function ctxDiario(focus, equip) {
  return { steps: 5000, energy: 3, pain: 0, sleep: 7, focus: focus, equip: equip, hard: false, recovery: false };
}
function setsTot(plan) { return plan.reduce(function (a, x) { return a + x.sets; }, 0); }

// ============================================================
// A · Selector de nivel alimenta state.profile.nivelFit
// ============================================================
console.log('\n== A · Nivel ==');
t('A1 · la UI tiene el selector de nivel', HTML.indexOf('Nivel de entrenamiento') >= 0 && HTML.indexOf('simpleFitNivel') >= 0);
sandbox.state = { fitEffort: 'normal', fitVariant: 0, workoutLog: [], sessionFeedbacks: [], profile: {} };
sandbox.setNivelFit('principiante');
t('A2 · setNivelFit guarda en state.profile.nivelFit', sandbox.state.profile.nivelFit === 'principiante');
var planP = sandbox.buildFitnessTodayPlan(ctxDiario('Ganar músculo sin quedar molido', 'Gimnasio'));
sandbox.state.profile.nivelFit = 'avanzado';
var planA = sandbox.buildFitnessTodayPlan(ctxDiario('Ganar músculo sin quedar molido', 'Gimnasio'));
t('A3 · el nivel cambia las series dentro de las bandas (avanzado >= principiante)',
  setsTot(planA) >= setsTot(planP)
  && sandbox.f3ValidarPlanNombres(planP, { objetivo: 'hipertrofia', nivel: 'principiante', equip: 'Gimnasio' }).length === 0
  && sandbox.f3ValidarPlanNombres(planA, { objetivo: 'hipertrofia', nivel: 'avanzado', equip: 'Gimnasio' }).length === 0);

// ============================================================
// B · ¿Por qué esta rutina? en el plan semanal
// ============================================================
console.log('\n== B · ¿Por qué? semanal ==');
var r = sandbox.buildCustomRoutine({ exp: 'intermedio', equip: 'gym', goal: 'hipertrofia', days: 4, minutes: 45 });
t('B1 · la rutina semanal trae su explicación', Array.isArray(r.porque) && r.porque.length >= 3);
t('B2 · la explicación menciona objetivo, nivel y días REALES',
  r.porque.join(' ').indexOf('Hipertrofia') >= 0 && r.porque.join(' ').indexOf('intermedio') >= 0 && r.porque.join(' ').indexOf('4') >= 0);
t('B3 · la vista semanal muestra el botón "¿Por qué esta rutina?"',
  HTML.indexOf('❓ ¿Por qué esta rutina?') >= 0);

// ============================================================
// C · Historial de feedback visible y borrable
// ============================================================
console.log('\n== C · Feedback visible ==');
sandbox.state = { fitEffort: 'normal', fitVariant: 0, workoutLog: [], sessionFeedbacks: [], fitEstado: 'cansado', fitEstadoDate: '2026-08-16', fitnessToday: { ctx: { focus: 'Pecho' }, plan: [{ name: 'Press banca con barra', muscle: 'pecho', sets: 3, reps: '6-15', rest: 135 }] } };
sandbox.saveFitFeedback('dificil');
t('C1 · el feedback guarda también el estado del día', sandbox.state.sessionFeedbacks[0].estado === 'cansado');
t('C2 · la UI muestra el historial de feedback', HTML.indexOf('Feedback reciente') >= 0);
sandbox.borrarFitFeedback(0);
t('C3 · borrar una entrada la elimina (con confirmación)', sandbox.state.sessionFeedbacks.length === 0);

// ============================================================
// D · Deload: SOLO sugerir, nunca automático
// ============================================================
console.log('\n== D · Deload sugerido ==');
sandbox.state = { fitEffort: 'normal', fitVariant: 0, workoutLog: [], sessionFeedbacks: [], profile: {} };
var sinDeload = sandbox.buildFitnessTodayPlan(ctxDiario('Pecho', 'Gimnasio'));
sandbox.state.sessionFeedbacks = [
  { date: '2026-08-08', focus: 'Pecho', feel: 'dificil', exIds: [] },
  { date: '2026-08-12', focus: 'Pecho', feel: 'demasiado', exIds: [] },
  { date: '2026-08-15', focus: 'Pecho', feel: 'dificil', exIds: [] }
];
t('D1 · 3 sesiones difíciles en 14 días con >=7 días de separación → sugerencia',
  sandbox.f3TendenciaDificilSemanas() === true);
// Sin pulsar el botón, el plan NO lleva la nota de semana ligera (solo la
// tendencia de feedback de F3c, que es un efecto distinto y acotado a -1 serie)
var planSinDeload = sandbox.buildFitnessTodayPlan(ctxDiario('Pecho', 'Gimnasio'));
t('D2 · la semana ligera NO se aplica sola (sin el botón no aparece la nota)',
  planSinDeload.every(function (x) { return x.note.indexOf('Semana ligera') < 0; }));
sandbox.aplicarDeloadHoy();
var conDeload = sandbox.buildFitnessTodayPlan(ctxDiario('Pecho', 'Gimnasio'));
t('D3 · solo cuando el usuario pulsa "Aplicar" baja el volumen (~30%)',
  setsTot(conDeload) < setsTot(planSinDeload) && conDeload.every(function (x) { return x.note.indexOf('Semana ligera') >= 0; }));
t('D4 · el deload activado sigue dentro de los validadores',
  sandbox.f3ValidarPlanNombres(conDeload, { objetivo: 'hipertrofia', nivel: 'intermedio', equip: 'Gimnasio' }).length === 0);
t('D5 · el deload aplica SOLO hoy (ayer no)',
  (function () {
    sandbox.state.deloadFecha = '2026-08-15';
    var p = sandbox.buildFitnessTodayPlan(ctxDiario('Pecho', 'Gimnasio'));
    var ok = p.every(function (x) { return x.note.indexOf('Semana ligera') < 0; }) && setsTot(p) === setsTot(planSinDeload);
    sandbox.state.deloadFecha = '2026-08-16';
    return ok;
  })());
t('D6 · 2 difíciles no bastan (sin falsa alarma)',
  (function () { sandbox.state.sessionFeedbacks = [{ date: '2026-08-12', focus: 'P', feel: 'dificil', exIds: [] }, { date: '2026-08-15', focus: 'P', feel: 'dificil', exIds: [] }]; var r2 = sandbox.f3TendenciaDificilSemanas(); sandbox.state.sessionFeedbacks = []; return r2 === false; })());

// ============================================================
// E · 🔁 Repetir esta rutina
// ============================================================
console.log('\n== E · Repetir esta rutina ==');
sandbox.state = {
  fitEffort: 'normal', fitVariant: 0, workoutLog: [], sessionFeedbacks: [], profile: {},
  fitnessToday: {
    date: '2026-08-16',
    ctx: { focus: 'Pecho' },
    plan: [
      { name: 'Press banca con barra', muscle: 'pecho', sets: 3, reps: '6-15', rest: 135, alts: [], note: 'x' },
      { name: 'Press militar con barra', muscle: 'hombros', sets: 3, reps: '6-15', rest: 135, alts: [], note: 'x' }
    ]
  },
  savedRoutines: []
};
sandbox.repetirRutina();
t('E1 · guarda la rutina en Rutinas guardadas', sandbox.state.savedRoutines.length === 1);
t('E2 · conserva ejercicios, orden y estructura EXACTOS (no genera nada nuevo)',
  JSON.stringify(sandbox.state.savedRoutines[0].plan.map(function (x) { return x.name; })) === JSON.stringify(['Press banca con barra', 'Press militar con barra']));
sandbox.repetirRutina();
t('E3 · repetir dos veces el mismo día no duplica', sandbox.state.savedRoutines.length === 1);
t('E4 · la UI tiene el botón Repetir', HTML.indexOf('Repetir esta rutina') >= 0);

// ============================================================
// F · 🎲 Variar esta rutina (alternativa válida o mantener con explicación)
// ============================================================
console.log('\n== F · Variar esta rutina ==');
sandbox.state = { fitEffort: 'normal', fitVariant: 0, workoutLog: [], sessionFeedbacks: [], profile: {} };
sandbox.createFitnessToday = function () {
  var plan = sandbox.buildFitnessTodayPlan(ctxDiario('Ganar músculo sin quedar molido', 'Gimnasio'));
  sandbox.state.fitnessToday = { date: '2026-08-16', ctx: { focus: 'Ganar músculo sin quedar molido' }, plan: plan };
};
sandbox.createFitnessToday();
var rVar = sandbox.f3VariarHoy();
t('F1 · variar genera una alternativa diferente y válida', rVar.cambio === true && rVar.mensaje.indexOf('alternativas válidas') >= 0);
t('F2 · la alternativa pasa TODOS los validadores',
  sandbox.f3ValidarPlanNombres(sandbox.state.fitnessToday.plan, { objetivo: 'hipertrofia', nivel: 'intermedio', equip: 'Gimnasio' }).length === 0);
t('F3 · la alternativa conserva los mismos músculos',
  (function () { var musc = sandbox.state.fitnessToday.plan.map(function (x) { return x.muscle; }).join(','); return musc === sandbox.buildFitnessTodayPlan(ctxDiario('Ganar músculo sin quedar molido', 'Gimnasio')).map(function (x) { return x.muscle; }).join(','); })());
// Caso sin alternativa: createFitnessToday no regenera → se mantiene y explica
sandbox.createFitnessToday = function () { /* sin alternativa: no regenera */ };
var rNo = sandbox.f3VariarHoy();
t('F4 · sin alternativa válida mantiene la rutina y lo explica',
  rNo.cambio === false && rNo.mensaje.indexOf('No hay alternativa') >= 0);

// ============================================================
// G · Propiedades con nivel + deload + variación
// ============================================================
console.log('\n== G · Propiedades ==');
const FOCOS = ['Ganar músculo sin quedar molido', 'Pecho', 'Espalda y hombros', 'Brazos', 'Pierna y glúteos', 'Tren superior', 'Tren inferior', 'Core y movilidad'];
const EQUIPOS = ['Gimnasio', 'Mancuernas', 'Casa / sin equipo'];
const NIVELES = ['principiante', 'intermedio', 'avanzado'];
let malos = 0, total = 0;
FOCOS.forEach(function (focus) {
  EQUIPOS.forEach(function (equip) {
    NIVELES.forEach(function (nivel) {
      [false, true].forEach(function (deload) {
        for (let v = 0; v < 5; v++) {
          sandbox.state = { fitEffort: 'normal', fitVariant: v, workoutLog: [], sessionFeedbacks: [], profile: { nivelFit: nivel }, deloadFecha: deload ? '2026-08-16' : '2026-08-01' };
          var plan = sandbox.buildFitnessTodayPlan(ctxDiario(focus, equip));
          total++;
          var errs = sandbox.f3ValidarPlanNombres(plan, { objetivo: 'hipertrofia', nivel: nivel, equip: equip });
          if (errs.length) { malos++; if (malos < 4) console.log('  ✗ malo: ' + focus + ' ' + equip + ' ' + nivel + ' deload=' + deload + ' v' + v + ' → ' + errs.join('; ')); }
        }
      });
    });
  });
});
t('G1 · ' + total + ' planes con nivel/deload/variación, CERO inválidos', malos === 0);
[2, 3, 4, 5, 6].forEach(function (dias) {
  ['gym', 'mancuernas', 'casa'].forEach(function (equip) {
    var rr = sandbox.buildCustomRoutine({ exp: 'intermedio', equip: equip, goal: 'hipertrofia', days: dias, minutes: 45 });
    t('G2 · ' + dias + 'd ' + equip + ': rutina semanal con explicación', Array.isArray(rr.porque) && rr.porque.length >= 3);
  });
});

console.log('\n==========================================');
console.log('Resultado: ' + passed + ' pasaron · ' + failed + ' fallaron');
console.log('==========================================');
if (failed) {
  console.log('\nFallos:\n' + failures.map(function (f) { return '  ✗ ' + f; }).join('\n'));
  process.exit(1);
}
process.exit(0);
