// ============================================================
// PRUEBAS F3c — Estado del día (🟢🟡🟠🔴), feedback gradual y
// "¿Por qué esta rutina?". El estado modifica DOSIS, nunca el
// objetivo; una sola respuesta de feedback no cambia nada; dolor
// solo advierte (sin diagnóstico); generación con reintentos y
// validación completa.
// Uso: node tests/fase3c-estado.test.js
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
// Sandbox con el motor completo + funciones F3c
// ============================================================
const sandbox = {
  console,
  state: { fitEffort: 'normal', fitVariant: 0, workoutLog: [], sessionFeedbacks: [] },
  fitDaySeed: function () { return 3; },
  todayISO: function () { return '2026-08-16'; },
  todayLocal: function () { return '2026-08-16'; },
  save: function () {},
  renderFitnessCoach: function () {}
};
vm.runInNewContext(
  extractFunc('fitnessExerciseBank') + '\n' +
  extractFunc('specialWorkoutKey') + '\n' +
  extractFunc('buildFitnessTodayPlan') + '\n' +
  extractFunc('restSeconds') + '\n' +
  extractFunc('parseRepRange') + '\n' +
  extractFunc('routineSplit') + '\n' +
  extractFunc('goalScheme') + '\n' +
  extractFunc('exercisesPerSession') + '\n' +
  extractFunc('defaultWeekSchedule') + '\n' +
  extractFunc('buildCustomRoutine') + '\n' +
  extractFunc('equipLabel') + '\n' +
  extractFunc('useRoutineDayToday') + '\n' +
  extractFunc('f3EqsPermitidos') + '\n' +
  extractFunc('f3KeyEquipo') + '\n' +
  extractFunc('f3InventarioEquipo') + '\n' +
  extractFunc('f3EquipoActualLabel') + '\n' +
  extractFunc('f3EquipKey') + '\n' +
  extractFunc('f3NivelNum') + '\n' +
  extractFunc('f3NivelBand') + '\n' +
  extractFunc('f3Mid') + '\n' +
  extractFunc('f3SetsBase') + '\n' +
  extractFunc('f3CapSets') + '\n' +
  extractFunc('f3RepsStr') + '\n' +
  extractFunc('f3RestSeg') + '\n' +
  extractFunc('f3FactorFatiga') + '\n' +
  extractFunc('f3FactorActividad') + '\n' +
  extractFunc('fitEffortHoy') + '\n' +
  extractFunc('f3ActividadNormalizada') + '\n' +
  extractFunc('f3MaxSimilitudGuardada') + '\n' +
  extractFunc('f3AltsBanco') + '\n' +
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
  'var SPECIAL_WORKOUTS=' + extractObj('SPECIAL_WORKOUTS') + ';\n' +
  'var EX_LIB=' + extractObj('EX_LIB') + ';\n' +
  'var F3_RULES=' + extractObj('F3_RULES') + ';\n' +
  'var F3_ALIASES=' + extractObj('F3_ALIASES') + ';',
  sandbox
);
const EX_LIB = sandbox.EX_LIB;

function ctxDiario(focus, equip, extra) {
  return Object.assign({ steps: 5000, energy: 3, pain: 0, sleep: 7, focus: focus, equip: equip, hard: false, recovery: false }, extra || {});
}
function musculosDe(plan) { return (plan || []).map(function (x) { return x.muscle; }).join(','); }
function setsTot(plan) { return (plan || []).reduce(function (a, x) { return a + x.sets; }, 0); }
function restTot(plan) { return (plan || []).reduce(function (a, x) { return a + x.rest; }, 0); }

// ============================================================
// A · Los 4 estados modifican DOSIS, nunca el objetivo
// ============================================================
console.log('\n== A · Estados del día ==');
const ESTADOS = ['excelente', 'normal', 'cansado', 'muy_fatigado'];
['Ganar músculo sin quedar molido', 'Pecho', 'Pierna y glúteos', 'Espalda y hombros'].forEach(function (focus) {
  ['Gimnasio', 'Casa / sin equipo'].forEach(function (equip) {
    var planes = {};
    ESTADOS.forEach(function (es) {
      sandbox.state.fitEstado = es;
      sandbox.state.fitEstadoDate = '2026-08-16';
      sandbox.state.sessionFeedbacks = [];
      planes[es] = sandbox.buildFitnessTodayPlan(ctxDiario(focus, equip));
    });
    var muscRef = musculosDe(planes.normal);
    t('A1 · [' + focus + ' · ' + equip + '] mismo objetivo/músculos en los 4 estados',
      ESTADOS.every(function (es) { return musculosDe(planes[es]) === muscRef; }));
    t('A2 · [' + focus + ' · ' + equip + '] dosis decreciente: excelente >= normal >= cansado >= muy fatigado',
      setsTot(planes.excelente) >= setsTot(planes.normal) && setsTot(planes.normal) >= setsTot(planes.cansado) && setsTot(planes.cansado) >= setsTot(planes.muy_fatigado));
    t('A3 · [' + focus + ' · ' + equip + '] muy fatigado reduce de verdad la dosis',
      setsTot(planes.muy_fatigado) < setsTot(planes.normal));
    t('A4 · [' + focus + ' · ' + equip + '] descansos iguales o más largos al empeorar el estado',
      restTot(planes.excelente) <= restTot(planes.cansado) && restTot(planes.normal) <= restTot(planes.muy_fatigado));
    ESTADOS.forEach(function (es) {
      var errs = sandbox.f3ValidarPlanNombres(planes[es], { objetivo: 'hipertrofia', nivel: 'intermedio', equip: equip });
      t('A5 · [' + focus + ' · ' + equip + ' · ' + es + '] plan validado', errs.length === 0, errs.join('; '));
    });
  });
});
// Estado explícito solo aplica HOY; al día siguiente vuelve a derivarse
sandbox.state.fitEstado = 'muy_fatigado';
sandbox.state.fitEstadoDate = '2026-08-15';
var planAyer = sandbox.buildFitnessTodayPlan(ctxDiario('Ganar músculo sin quedar molido', 'Gimnasio'));
t('A6 · el estado de ayer no aplica hoy (se deriva como siempre)',
  setsTot(planAyer) === setsTot((function () { sandbox.state.fitEstado = undefined; sandbox.state.fitEstadoDate = undefined; var p = sandbox.buildFitnessTodayPlan(ctxDiario('Ganar músculo sin quedar molido', 'Gimnasio')); sandbox.state.fitEstado = 'muy_fatigado'; sandbox.state.fitEstadoDate = '2026-08-15'; return p; })()));

// ============================================================
// B · Feedback gradual y separado de workoutLog
// ============================================================
console.log('\n== B · Feedback ==');
sandbox.state = { fitEffort: 'normal', fitVariant: 0, workoutLog: [{ exercise: 'X', date: '2026-08-01' }], sessionFeedbacks: [], fitnessToday: { ctx: { focus: 'Pecho' }, plan: [{ name: 'Press banca con barra', muscle: 'pecho', sets: 3, reps: '6-15', rest: 135 }] } };
sandbox.saveFitFeedback('muy_facil');
t('B1 · el feedback se guarda en sessionFeedbacks (NO en workoutLog)',
  sandbox.state.sessionFeedbacks.length === 1 && sandbox.state.workoutLog.length === 1);
t('B2 · una sola respuesta NO crea tendencia', sandbox.f3TendenciaFeedback('Pecho') === null);
sandbox.state.sessionFeedbacks = [
  { date: '2026-08-12', focus: 'Pecho', feel: 'muy_facil', exIds: ['press_plano'] },
  { date: '2026-08-13', focus: 'Pecho', feel: 'muy_facil', exIds: ['press_plano'] },
  { date: '2026-08-15', focus: 'Pecho', feel: 'muy_facil', exIds: ['press_plano'] }
];
t('B3 · 3 de 5 "muy fácil" → tendencia muy_facil', sandbox.f3TendenciaFeedback('Pecho') === 'muy_facil');
sandbox.state.sessionFeedbacks = [
  { date: '2026-08-12', focus: 'Pecho', feel: 'dificil', exIds: ['press_plano'] },
  { date: '2026-08-13', focus: 'Pecho', feel: 'demasiado', exIds: ['press_plano'] },
  { date: '2026-08-15', focus: 'Pecho', feel: 'dificil', exIds: ['press_plano'] }
];
t('B4 · 3 difíciles/demasiado → tendencia dificil', sandbox.f3TendenciaFeedback('Pecho') === 'dificil');
// Efecto en el plan
function planConFeedback(trend) {
  sandbox.state.fitEstado = undefined; sandbox.state.fitEstadoDate = undefined;
  sandbox.state.sessionFeedbacks = (trend === 'muy_facil')
    ? [{ date: '2026-08-12', focus: 'Pecho', feel: 'muy_facil', exIds: [] }, { date: '2026-08-13', focus: 'Pecho', feel: 'muy_facil', exIds: [] }, { date: '2026-08-15', focus: 'Pecho', feel: 'muy_facil', exIds: [] }]
    : (trend === 'dificil')
      ? [{ date: '2026-08-12', focus: 'Pecho', feel: 'dificil', exIds: [] }, { date: '2026-08-13', focus: 'Pecho', feel: 'demasiado', exIds: [] }, { date: '2026-08-15', focus: 'Pecho', feel: 'dificil', exIds: [] }]
      : [];
  return sandbox.buildFitnessTodayPlan(ctxDiario('Pecho', 'Gimnasio'));
}
var planSinFb = planConFeedback('ninguna');
var planFacil = planConFeedback('muy_facil');
var planDificil = planConFeedback('dificil');
t('B5 · tendencia difícil: reduce 1 serie por ejercicio (máximo)',
  planDificil.every(function (x, i) { return x.sets === Math.max(1, planSinFb[i].sets - 1); }));
t('B6 · tendencia fácil: NO sube series automáticamente (solo sugiere en la nota)',
  setsTot(planFacil) === setsTot(planSinFb) && planFacil.every(function (x) { return x.note.indexOf('dominando') >= 0; }));
t('B7 · el feedback jamás saca el plan de las bandas',
  sandbox.f3ValidarPlanNombres(planDificil, { objetivo: 'hipertrofia', nivel: 'intermedio', equip: 'Gimnasio' }).length === 0
  && sandbox.f3ValidarPlanNombres(planFacil, { objetivo: 'hipertrofia', nivel: 'intermedio', equip: 'Gimnasio' }).length === 0);
// Dolor: advertencia sin diagnóstico y sin progresar
sandbox.state.sessionFeedbacks = [{ date: '2026-08-15', focus: 'Pecho', feel: 'dolor', exIds: ['press_plano'] }];
var dolorIds = sandbox.f3EjerciciosDolor();
t('B8 · dolor detecta el ejercicio de las últimas 2 semanas', !!dolorIds.press_plano);
// Marcar con dolor el ejercicio que el plan REALMENTE eligió (determinista)
sandbox.state.sessionFeedbacks = [];
var planBase = planConFeedback('ninguna');
var idElegido = sandbox.f3IdPorNombre(planBase[0].name);
sandbox.state.sessionFeedbacks = [{ date: '2026-08-15', focus: 'Pecho', feel: 'dolor', exIds: [idElegido] }];
var planDolor = sandbox.buildFitnessTodayPlan(ctxDiario('Pecho', 'Gimnasio'));
t('B9 · el plan con ejercicio dolorido muestra advertencia prudente (sin diagnóstico)',
  planDolor.some(function (x) { return x.note.indexOf('molestia') >= 0 && x.note.indexOf('No es diagnóstico') >= 0; }));
t('B10 · dolor NO aumenta series (no se progresa sobre molestia)',
  planDolor.every(function (x, i) { return x.sets <= planSinFb[i].sets; }));
// Retención
sandbox.state.sessionFeedbacks = [];
for (var k = 0; k < 35; k++) { sandbox.state.sessionFeedbacks.push({ date: '2026-08-01', focus: 'P', feel: 'bien', exIds: [] }); }
sandbox.state.fitnessToday = { ctx: { focus: 'P' }, plan: [{ name: 'Press banca con barra', muscle: 'pecho', sets: 3, reps: '6-15', rest: 135 }] };
sandbox.saveFitFeedback('bien');
t('B11 · el historial de feedback se limita a 30', sandbox.state.sessionFeedbacks.length === 30);

// ============================================================
// C · "¿Por qué esta rutina?" (explicación real)
// ============================================================
console.log('\n== C · ¿Por qué esta rutina? ==');
sandbox.state = { fitEffort: 'normal', fitVariant: 0, workoutLog: [], sessionFeedbacks: [], fitEstado: 'cansado', fitEstadoDate: '2026-08-16' };
var planPorque = sandbox.buildFitnessTodayPlan(ctxDiario('Pecho', 'Casa / sin equipo'));
t('C1 · la rutina trae su explicación', Array.isArray(planPorque.porque) && planPorque.porque.length >= 4);
t('C2 · la explicación menciona el foco y el estado REALES',
  planPorque.porque.join(' ').indexOf('Pecho') >= 0 && planPorque.porque.join(' ').indexOf('Cansado') >= 0);
t('C3 · la explicación dice la verdad del equipo (casa, sin máquinas)',
  planPorque.porque.join(' ').indexOf('Casa') >= 0 && planPorque.porque.join(' ').indexOf('máquina') < 0);
sandbox.state.fitEstado = 'normal';
var planPorque2 = sandbox.buildFitnessTodayPlan(ctxDiario('Ganar músculo sin quedar molido', 'Gimnasio'));
t('C4 · explica por qué eligió cada ejercicio (líneas por ejercicio)',
  planPorque2.porque.filter(function (s) { return s.indexOf('elegí') >= 0; }).length === planPorque2.length);

// ============================================================
// D · Generación segura (descarta y reintenta)
// ============================================================
console.log('\n== D · Generación segura ==');
var intentos = 0;
var resultado = sandbox.f3GenerarSeguro(
  function (i) { intentos++; if (i < 2) return [{ name: 'Ejercicio inventado', muscle: 'pecho', sets: 99, reps: '99-99', rest: 1 }]; return [{ name: 'Press banca con barra', muscle: 'pecho', sets: 3, reps: '6-15', rest: 135 }]; },
  { objetivo: 'hipertrofia', nivel: 'intermedio', equip: 'Gimnasio' },
  function (plan) { return sandbox.f3ValidarPlanNombres(plan, { objetivo: 'hipertrofia', nivel: 'intermedio', equip: 'Gimnasio' }); }
);
t('D1 · descarta generaciones inválidas y usa la siguiente válida', !!resultado && intentos === 3 && resultado[0].name === 'Press banca con barra');
var intentos2 = 0;
var resultado2 = sandbox.f3GenerarSeguro(
  function () { intentos2++; return [{ name: 'Inventado', muscle: 'pecho', sets: 99, reps: '99-99', rest: 1 }]; },
  { objetivo: 'hipertrofia', nivel: 'intermedio', equip: 'Gimnasio' },
  function (plan) { return sandbox.f3ValidarPlanNombres(plan, { objetivo: 'hipertrofia', nivel: 'intermedio', equip: 'Gimnasio' }); }
);
t('D2 · si TODO falla devuelve null (el llamador usa el plan mínimo de seguridad)', resultado2 === null && intentos2 === 5);
t('D3 · sustitución válida = mismo músculo Y mismo patrón',
  sandbox.f3ValidarSustitucion('press_plano', 'press_inclinado') === true
  && sandbox.f3ValidarSustitucion('press_plano', 'extension_triceps') === false
  && sandbox.f3ValidarSustitucion('press_plano', 'inventado_xyz') === false);

// ============================================================
// E · Propiedades: miles de combinaciones deterministas
// ============================================================
console.log('\n== E · Propiedades (objetivo×nivel×equipo×estado×historial×feedback) ==');
const FOCOS = ['Ganar músculo sin quedar molido', 'Pecho', 'Espalda y hombros', 'Brazos', 'Pierna y glúteos', 'Tren superior', 'Tren inferior', 'Core y movilidad'];
const EQUIPOS = ['Gimnasio', 'Mancuernas', 'Casa / sin equipo'];
const NIVELES = ['principiante', 'intermedio', 'avanzado'];
const TENDENCIAS = ['ninguna', 'muy_facil', 'dificil'];
let malos = 0, total = 0;
const muestraErrores = [];
FOCOS.forEach(function (focus) {
  EQUIPOS.forEach(function (equip) {
    NIVELES.forEach(function (nivel) {
      ESTADOS.forEach(function (es) {
        TENDENCIAS.forEach(function (trend) {
          for (let v = 0; v < 5; v++) {
            sandbox.state = {
              fitEffort: 'normal', fitVariant: v,
              workoutLog: [],
              sessionFeedbacks: trend === 'ninguna' ? [] :
                (trend === 'muy_facil' ? [1, 2, 3].map(function (d) { return { date: '2026-08-' + (15 - d), focus: focus, feel: 'muy_facil', exIds: [] }; }) :
                  [{ date: '2026-08-13', focus: focus, feel: 'dificil', exIds: [] }, { date: '2026-08-14', focus: focus, feel: 'demasiado', exIds: [] }, { date: '2026-08-15', focus: focus, feel: 'dificil', exIds: [] }]),
              fitEstado: es, fitEstadoDate: '2026-08-16',
              profile: { nivelFit: nivel }
            };
            var plan = sandbox.buildFitnessTodayPlan(ctxDiario(focus, equip));
            total++;
            var errs = sandbox.f3ValidarPlanNombres(plan, { objetivo: 'hipertrofia', nivel: nivel, equip: equip });
            if (errs.length) { malos++; if (muestraErrores.length < 4) muestraErrores.push(focus + ' ' + equip + ' ' + nivel + ' ' + es + ' ' + trend + ' v' + v + ' → ' + errs.join('; ')); }
          }
        });
      });
    });
  });
});
t('E1 · ' + total + ' planes generados (todas las combinaciones), CERO inválidos', malos === 0, muestraErrores.join(' | '));
// Invariante: el estado nunca cambia la secuencia de músculos (el objetivo se conserva)
var viola = 0;
FOCOS.forEach(function (focus) {
  EQUIPOS.forEach(function (equip) {
    var ref = null;
    ESTADOS.forEach(function (es) {
      sandbox.state = { fitEffort: 'normal', fitVariant: 0, workoutLog: [], sessionFeedbacks: [], fitEstado: es, fitEstadoDate: '2026-08-16' };
      var p = sandbox.buildFitnessTodayPlan(ctxDiario(focus, equip));
      var musc = p.map(function (x) { return x.muscle; }).join(',');
      if (ref === null) ref = musc;
      else if (ref !== musc) viola++;
    });
  });
});
t('E2 · en ' + (FOCOS.length * EQUIPOS.length * ESTADOS.length) + ' casos el estado NUNCA cambió la secuencia de músculos', viola === 0);

console.log('\n==========================================');
console.log('Resultado: ' + passed + ' pasaron · ' + failed + ' fallaron');
console.log('==========================================');
if (failed) {
  console.log('\nFallos:\n' + failures.map(function (f) { return '  ✗ ' + f; }).join('\n'));
  process.exit(1);
}
process.exit(0);
