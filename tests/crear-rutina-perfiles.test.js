// ============================================================
// PRUEBAS — Constructor Fitness multi-perfil (Crear rutina)
// Actividad diaria (profesión = solo ejemplo), experiencia, tiempo
// por sesión e intensidad preferida CON recomendación. El generador
// usa las variables de verdad; rutinas antiguas y nombre/borrado
// siguen funcionando. Sin tocar zonas protegidas.
// Uso: node tests/crear-rutina-perfiles.test.js
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
function extractVarArr(name) {
  var m = HTML.match(new RegExp('var ' + name + '=(\\[.*?\\]);', 's'));
  if (!m) throw new Error('No se encontró var ' + name);
  return m[1];
}

let passed = 0, failed = 0;
const failures = [];
function t(name, cond, extra) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; failures.push(name + (extra ? ' → ' + extra : '')); console.log('  ✗ ' + name + (extra ? ' → ' + extra : '')); }
}

// ============================================================
// Sandbox con el motor completo + constructor
// ============================================================
const docEls = {};
const sandbox = {
  console,
  state: { fitEffort: 'normal', fitVariant: 0, workoutLog: [], sessionFeedbacks: [], profile: {}, savedRoutines: [] },
  fitDaySeed: function () { return 3; },
  todayISO: function () { return '2026-08-16'; },
  todayLocal: function () { return '2026-08-16'; },
  save: function () {},
  renderFitnessCoach: function () {},
  safeText: function (s) { return String(s == null ? '' : s); },
  U: { pesoUnidad: function () { return 'lb'; } },
  quickFitnessToday: function () {},
  createFitnessToday: function () {},
  alert: function () {},
  confirm: function () { return true; },
  ppUUID: function () { sandbox._uuid = (sandbox._uuid || 0) + 1; return 'uuid-' + sandbox._uuid; },
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  document: {
    getElementById: function (id) {
      if (!docEls[id]) docEls[id] = { value: '', innerHTML: '', getBoundingClientRect: function () { return { top: 0 }; } };
      return docEls[id];
    },
    addEventListener: function () {}
  }
};
sandbox.window = sandbox;
vm.runInNewContext(
  extractFunc('fitnessExerciseBank') + '\n' +
  extractFunc('specialWorkoutKey') + '\n' +
  extractFunc('buildFitnessTodayPlan') + '\n' +
  extractFunc('restSeconds') + '\n' +
  extractFunc('parseRepRange') + '\n' +
  extractFunc('exercisesPerSession') + '\n' +
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
  extractFunc('f3DiasRutina') + '\n' +
  extractFunc('f3ActividadNormalizada') + '\n' +
  extractFunc('f3MaxSimilitudGuardada') + '\n' +
  extractFunc('f3AltsBanco') + '\n' +
  extractFunc('f3AnclarEl') + '\n' +
  extractFunc('f3IrARutina') + '\n' +
  extractFunc('f3InitIrAListeners') + '\n' +
  extractFunc('sugerenciaSesion') + '\n' +
  extractFunc('f3TendenciaFeedback') + '\n' +
  extractFunc('f3EjerciciosDolor') + '\n' +
  extractFunc('routineSplit') + '\n' +
  extractFunc('defaultWeekSchedule') + '\n' +
  extractFunc('f3SemanaReferencia') + '\n' +
  extractFunc('f3SemanaDesdeDias') + '\n' +
  extractFunc('f3ElegirSplit') + '\n' +
  extractFunc('f3SetsContexto') + '\n' +
  extractFunc('f3TagDeNombre') + '\n' +
  extractFunc('f3SlotsParaMusculos') + '\n' +
  extractFunc('f3VolBand') + '\n' +
  extractFunc('f3Candidatos') + '\n' +
  extractFunc('f3Elegir') + '\n' +
  extractFunc('f3IdPorNombre') + '\n' +
  extractFunc('f3HistorialReciente') + '\n' +
  extractFunc('f3SlotsDia') + '\n' +
  extractFunc('f3SlotsExtras') + '\n' +
  extractFunc('f3ValidarPlan') + '\n' +
  extractFunc('f3ValidarPlanNombres') + '\n' +
  extractFunc('goalScheme') + '\n' +
  extractFunc('equipLabel') + '\n' +
  extractFunc('goalLabelSafe') + '\n' +
  extractFunc('f3ValidarSemana') + '\n' +
  extractFunc('buildCustomRoutine') + '\n' +
  extractFunc('f3NombreRutinaAuto') + '\n' +
  extractFunc('f3NombreMostrar') + '\n' +
  extractFunc('f3FirmaRutina') + '\n' +
  extractFunc('loadSavedRoutine') + '\n' +
  extractFunc('deleteSavedRoutine') + '\n' +
  extractFunc('f3RutinasActivas') + '\n' +
  extractFunc('f3RecomendarIntensidad') + '\n' +
  extractFunc('f3CrResumen') + '\n' +
  extractFunc('f3CrTipoCambio') + '\n' +
  extractFunc('crearRutina') + '\n' +
  extractFunc('saveCurrentRoutine') + '\n' +
  extractFunc('f3NombreAGuardar') + '\n' +
  extractFunc('f3RenombrarEnlazada') + '\n' +
  extractFunc('f3CampoNombreHTML') + '\n' +
  extractFunc('f3EquipoOpcionesHTML') + '\n' +
  extractFunc('f3InventarioOpcionesHTML') + '\n' +
  extractFunc('f3EquipoTexto') + '\n' +
  extractFunc('openCreateRoutine') + '\n' +
  extractFunc('goalOptionsAgrupados') + '\n' +
  extractFunc('diasGymTexto') + '\n' +
  'var FIT_GOALS=' + extractVarArr('FIT_GOALS') + ';\n' +
  'var INTENSIDAD_PLAN=' + extractVarArr('INTENSIDAD_PLAN') + ';\n' +
  'var DIAS_SEMANA=' + extractVarArr('DIAS_SEMANA') + ';\n' +
  'var DIAS_NOMBRE=' + extractVarArr('DIAS_NOMBRE') + ';\n' +
  'var FIT_EFFORTS=' + extractVarArr('FIT_EFFORTS') + ';\n' +
  'var SPECIAL_WORKOUTS=' + extractObj('SPECIAL_WORKOUTS') + ';\n' +
  'var EX_LIB=' + extractObj('EX_LIB') + ';\n' +
  'var F3_RULES=' + extractObj('F3_RULES') + ';\n' +
  'var F3_ALIASES=' + extractObj('F3_ALIASES') + ';\n' +
  'var ACTIVIDAD_DESC=' + extractObj('ACTIVIDAD_DESC') + ';',
  sandbox
);
const EX_LIB = sandbox.EX_LIB;

function ctxDiario(focus, equip) {
  return { steps: 5000, energy: 3, pain: 0, sleep: 7, focus: focus, equip: equip, hard: false, recovery: false };
}
function setsTot(plan) { return (plan || []).reduce(function (a, x) { return a + x.sets; }, 0); }
function estadoLimpio() {
  sandbox.state = { fitEffort: 'normal', fitVariant: 0, workoutLog: [], sessionFeedbacks: [], profile: {}, savedRoutines: [] };
}

// ============================================================
// A · Campos del constructor
// ============================================================
console.log('\n== A · Campos en Crear rutina ==');
t('A1 · campo de actividad diaria', HTML.indexOf('crActividad') >= 0 && HTML.indexOf('¿Cómo es tu actividad diaria?') >= 0);
t('A2 · campo de experiencia', HTML.indexOf('crExperiencia') >= 0 && HTML.indexOf('¿Cuál es tu experiencia entrenando?') >= 0);
t('A3 · campo de tiempo por sesión', HTML.indexOf('crTiempo') >= 0 && HTML.indexOf('¿Cuánto tiempo tienes para entrenar?') >= 0);
t('A4 · intensidad renombrada a preferencia', HTML.indexOf('🔥 Intensidad preferida') >= 0);
t('A5 · resumen con recomendación antes de crear', HTML.indexOf('crResumenOut') >= 0);
t('A6 · sin profesiones: descripciones neutrales y lógica por NIVEL de carga',
  HTML.indexOf('Casi todo el día sentado.') >= 0
  && String(sandbox.ACTIVIDAD_DESC).indexOf('jardinería') < 0 && String(sandbox.ACTIVIDAD_DESC).indexOf('oficina') < 0
  && String(sandbox.f3ActividadNormalizada).indexOf('legado') >= 0);

// ============================================================
// B · Resumen + recomendación
// ============================================================
console.log('\n== B · Resumen y recomendación ==');
sandbox.state.profile = { diasGym: [0, 1, 2, 3, 4], actividadDiaria: 'trabajo_intenso', nivelFit: 'intermedio', minutosSesion: '60', objetivoFit: 'Ganar músculo sin quedar molido', intensidadPlan: 'fuerte', pasosDia: 22000 };
sandbox.f3CrResumen();
var resumen = docEls.crResumenOut ? docEls.crResumenOut.innerHTML : '';
t('B1 · resumen muestra los datos del plan', resumen.indexOf('5 días') >= 0 && resumen.indexOf('Trabajo físico intenso') >= 0 && resumen.indexOf('Intermedio') >= 0 && resumen.indexOf('60 min') >= 0);
t('B2 · con trabajo intenso recomienda Suave (no Fuerte) con explicación real',
  resumen.indexOf('Intensidad recomendada: Suave') >= 0 && resumen.toLowerCase().indexOf('recomendamos') >= 0 && resumen.indexOf('esfuerzo físico fuerte') >= 0);
sandbox.state.profile = { actividadDiaria: 'sedentario', nivelFit: 'avanzado', intensidadPlan: 'normal' };
t('B3 · sedentario + avanzado recomienda Fuerte', sandbox.f3RecomendarIntensidad() === 'fuerte');
sandbox.state.profile = { actividadDiaria: 'activo', pasosDia: 22000 };
t('B4 · muchos pasos recomiendan Normal (pasos ≠ profesión)', sandbox.f3RecomendarIntensidad() === 'normal');
sandbox.state.profile = { actividadDiaria: 'activo', pasosDia: 5000, nivelFit: 'intermedio' };
t('B5 · perfil tranquilo recomienda Normal por defecto', sandbox.f3RecomendarIntensidad() === 'normal');

// ============================================================
// C · crearRutina guarda los valores (persistencia)
// ============================================================
console.log('\n== C · Persistencia de los valores ==');
estadoLimpio();
docEls.crActividad = { value: 'trabajo_intenso' };
docEls.crExperiencia = { value: 'avanzado' };
docEls.crTiempo = { value: '60' };
sandbox.crearRutina();
t('C1 · actividad, experiencia y tiempo quedan en el perfil',
  sandbox.state.profile.actividadDiaria === 'trabajo_intenso'
  && sandbox.state.profile.nivelFit === 'avanzado'
  && sandbox.state.profile.minutosSesion === '60');

// ============================================================
// D · El generador USA las variables
// ============================================================
console.log('\n== D · El generador usa las variables ==');
estadoLimpio();
sandbox.state.profile = { actividadDiaria: 'sedentario', nivelFit: 'intermedio', minutosSesion: '75+' };
var planSed = sandbox.buildFitnessTodayPlan(ctxDiario('Ganar músculo sin quedar molido', 'Gimnasio'));
sandbox.state.profile = { actividadDiaria: 'trabajo_intenso', nivelFit: 'intermedio', minutosSesion: '75+' };
var planIntenso = sandbox.buildFitnessTodayPlan(ctxDiario('Ganar músculo sin quedar molido', 'Gimnasio'));
t('D1 · trabajo físico intenso reduce la dosis vs sedentario (mismo objetivo)',
  setsTot(planIntenso) < setsTot(planSed), setsTot(planIntenso) + ' vs ' + setsTot(planSed));
t('D2 · ambos siguen siendo planes válidos',
  sandbox.f3ValidarPlanNombres(planIntenso, { objetivo: 'hipertrofia', nivel: 'intermedio', equip: 'Gimnasio' }).length === 0
  && sandbox.f3ValidarPlanNombres(planSed, { objetivo: 'hipertrofia', nivel: 'intermedio', equip: 'Gimnasio' }).length === 0);
// Tiempo por sesión limita ejercicios
estadoLimpio();
[['30', 4], ['45', 5], ['60', 6]].forEach(function (par) {
  sandbox.state.profile = { actividadDiaria: 'activo', nivelFit: 'intermedio', minutosSesion: par[0] };
  var plan = sandbox.buildFitnessTodayPlan(ctxDiario('Ganar músculo sin quedar molido', 'Gimnasio'));
  t('D3 · ' + par[0] + ' min limita a ≤' + par[1] + ' ejercicios', plan.length <= par[1], 'hay ' + plan.length);
});
sandbox.state.profile = { actividadDiaria: 'activo', nivelFit: 'intermedio', minutosSesion: '75+' };
var planLargo = sandbox.buildFitnessTodayPlan(ctxDiario('Ganar músculo sin quedar molido', 'Gimnasio'));
sandbox.state.profile = { actividadDiaria: 'activo', nivelFit: 'intermedio', minutosSesion: '30' };
var planCorto = sandbox.buildFitnessTodayPlan(ctxDiario('Ganar músculo sin quedar molido', 'Gimnasio'));
t('D4 · 30 min también reduce series', setsTot(planCorto) < setsTot(planLargo));
// Experiencia afecta series y selección de ejercicios
estadoLimpio();
sandbox.state.profile = { actividadDiaria: 'activo', nivelFit: 'principiante', minutosSesion: '75+' };
var planP = sandbox.buildFitnessTodayPlan(ctxDiario('Ganar músculo sin quedar molido', 'Gimnasio'));
sandbox.state.profile = { actividadDiaria: 'activo', nivelFit: 'avanzado', minutosSesion: '75+' };
var planA = sandbox.buildFitnessTodayPlan(ctxDiario('Ganar músculo sin quedar molido', 'Gimnasio'));
t('D5 · principiante: solo ejercicios de nivel 1',
  planP.every(function (x) { var id = sandbox.f3IdPorNombre(x.name); return id && EX_LIB[id].lv === 1; }));
t('D6 · avanzado: más volumen y ejercicios de mayor nivel disponibles',
  setsTot(planA) >= setsTot(planP) && planA.some(function (x) { var id = sandbox.f3IdPorNombre(x.name); return id && EX_LIB[id].lv >= 2; }));
// Intensidad preferida con trabajo pesado: sin extra de volumen
estadoLimpio();
sandbox.state.fitEffort = 'fuerte';
sandbox.state.profile = { actividadDiaria: 'sedentario', nivelFit: 'intermedio', minutosSesion: '75+' };
var planFuerteSed = sandbox.buildFitnessTodayPlan(ctxDiario('Ganar músculo sin quedar molido', 'Gimnasio'));
sandbox.state.profile = { actividadDiaria: 'trabajo_intenso', nivelFit: 'intermedio', minutosSesion: '75+' };
var planFuerteIntenso = sandbox.buildFitnessTodayPlan(ctxDiario('Ganar músculo sin quedar molido', 'Gimnasio'));
t('D7 · Fuerte con trabajo intenso: el volumen no se infla (preferencia, no orden)',
  setsTot(planFuerteIntenso) <= setsTot(planFuerteSed));
// Valores ANTIGUOS guardados se normalizan sin romper perfiles
sandbox.state.profile = { actividadDiaria: 'pesado', nivelFit: 'intermedio', minutosSesion: '75+' };
t('D8 · perfil antiguo (pesado) se normaliza a trabajo_intenso con la misma dosis',
  sandbox.f3ActividadNormalizada() === 'trabajo_intenso' && sandbox.f3FactorActividad() === 0.7);
// Trabajo físico + tiempo limitado: un ejercicio menos de margen
estadoLimpio();
sandbox.state.profile = { actividadDiaria: 'trabajo_fisico', nivelFit: 'intermedio', minutosSesion: '60' };
var planTrabajo60 = sandbox.buildFitnessTodayPlan(ctxDiario('Ganar músculo sin quedar molido', 'Gimnasio'));
t('D9 · trabajo físico con 60 min deja margen (≤5 ejercicios)', planTrabajo60.length <= 5, 'hay ' + planTrabajo60.length);
// Distribución semanal: la actividad también reduce el volumen semanal
estadoLimpio();
sandbox.state.profile = { actividadDiaria: 'sedentario', nivelFit: 'intermedio', minutosSesion: '75+' };
var semSed = sandbox.f3SemanaReferencia({ dias: 3, objetivo: 'hipertrofia', nivel: 'intermedio', equip: 'Gimnasio', estado: 'normal' }, 0);
sandbox.state.profile = { actividadDiaria: 'trabajo_intenso', nivelFit: 'intermedio', minutosSesion: '75+' };
var semIntenso = sandbox.f3SemanaReferencia({ dias: 3, objetivo: 'hipertrofia', nivel: 'intermedio', equip: 'Gimnasio', estado: 'normal' }, 0);
function setsSem(sem) { return sem.reduce(function (a, d) { return a + (d.plan || []).reduce(function (b, x) { return b + x.sets; }, 0); }, 0); }
t('D10 · la semana con trabajo intenso reduce el volumen semanal (recuperación)',
  setsSem(semIntenso) < setsSem(semSed), setsSem(semIntenso) + ' vs ' + setsSem(semSed));

// ============================================================
// E · Compatibilidad: rutinas antiguas, nombre y borrado
// ============================================================
console.log('\n== E · Compatibilidad ==');
estadoLimpio();
sandbox.state.savedRoutines = [{ id: 'vieja1', plan: [{ name: 'Press banca con barra', muscle: 'pecho', sets: 3, reps: '8-12', rest: 90 }], date: '2026-05-01' }];
sandbox.state.fitnessToday = null;
sandbox.loadSavedRoutine('vieja1');
t('E1 · rutina antigua sin campos nuevos carga bien',
  sandbox.state.fitnessToday.loadedName === 'Pecho · 1 may' && sandbox.state.fitnessToday.loadedRoutineId === 'vieja1');
t('E2 · perfil sin campos nuevos: defaults seguros (sin cambios de comportamiento)',
  (function () { sandbox.state.profile = {}; var p = sandbox.buildFitnessTodayPlan(ctxDiario('Pecho', 'Gimnasio')); return p.length > 0 && setsTot(p) > 0; })());
sandbox.deleteSavedRoutine('vieja1');
t('E3 · eliminación persistente sigue funcionando (tombstone)',
  sandbox.f3RutinasActivas().length === 0 && sandbox.state.savedRoutines[0].deleted === true);
t('E4 · workoutLog permanece intacto', (sandbox.state.workoutLog || []).length === 0);

// ============================================================
// W · Crear rutina = SIEMPRE nueva (nunca renombra por contenido)
// ============================================================
console.log('\n== W · Crear rutina siempre nueva ==');
estadoLimpio();
sandbox.createFitnessToday = function () {
  sandbox.state.fitnessToday = {
    date: '2026-08-16',
    ctx: { focus: 'Pecho' },
    plan: [{ name: 'Press banca con barra', muscle: 'pecho', sets: 3, reps: '6-15', rest: 135 }]
  };
};
docEls.crActividad = { value: 'activo' };
docEls.crExperiencia = { value: 'intermedio' };
docEls.crTiempo = { value: '60' };
sandbox.window._routineName = 'ruben';
sandbox.crearRutina();
t('W1 · crear A con nombre "ruben" la guarda como nueva', sandbox.state.savedRoutines.length === 1 && sandbox.state.savedRoutines[0].name === 'ruben');
var idA = sandbox.state.savedRoutines[0].id;
// Entrar de nuevo a Crear rutina limpia el enlace y el nombre pendiente
sandbox.state.fitnessToday.loadedRoutineId = idA;
sandbox.window._routineName = 'basura';
sandbox.openCreateRoutine();
t('W2 · entrar a Crear rutina desenlaza la rutina anterior y limpia el campo',
  sandbox.state.fitnessToday.loadedRoutineId === null && sandbox.window._routineName === '');
// Crear B con los MISMOS ejercicios y nombre "alan"
sandbox.window._routineName = 'alan';
sandbox.crearRutina();
t('W3 · crear B con los mismos ejercicios NO renombra A: ambas coexisten',
  sandbox.state.savedRoutines.length === 2
  && sandbox.state.savedRoutines[0].name === 'ruben'
  && sandbox.state.savedRoutines[1].name === 'alan');
t('W4 · cada una tiene su propio ID', sandbox.state.savedRoutines[0].id !== sandbox.state.savedRoutines[1].id && sandbox.state.savedRoutines[1].id !== idA);
var idB = sandbox.state.savedRoutines[1].id;
// Renombrar alan NO cambia ruben
sandbox.f3RenombrarEnlazada(idB, 'Alan 2');
t('W5 · renombrar alan no cambia ruben',
  sandbox.state.savedRoutines[0].name === 'ruben'
  && sandbox.state.savedRoutines.find(function (r) { return r.id === idB; }).name === 'Alan 2');
// Eliminar alan NO afecta ruben
sandbox.deleteSavedRoutine(idB);
t('W6 · eliminar alan no afecta ruben',
  sandbox.f3RutinasActivas().length === 1 && sandbox.f3RutinasActivas()[0].name === 'ruben');
t('W7 · workoutLog permanece intacto', (sandbox.state.workoutLog || []).length === 0);

// ============================================================
// X · Variedad REAL: la generación automática no copia rutinas guardadas
// ============================================================
console.log('\n== X · Variedad entre rutinas ==');
estadoLimpio();
sandbox.state.profile = { actividadDiaria: 'activo', nivelFit: 'intermedio', minutosSesion: '75+' };
// Primera rutina generada hoy y guardada
var plan1 = sandbox.buildFitnessTodayPlan(ctxDiario('Ganar músculo sin quedar molido', 'Gimnasio'));
sandbox.state.savedRoutines = [{ id: 'g1', name: 'Primera', plan: JSON.parse(JSON.stringify(plan1)), date: '2026-08-16' }];
// Segunda generación automática el mismo día: debe ser REALMENTE distinta
var plan2 = sandbox.buildFitnessTodayPlan(ctxDiario('Ganar músculo sin quedar molido', 'Gimnasio'));
function similitud(a, b) {
  var inter = a.filter(function (n) { return b.indexOf(n) >= 0; }).length;
  return inter / Math.max(a.length, b.length);
}
var sim = similitud(plan1.map(function (x) { return x.name; }), plan2.map(function (x) { return x.name; }));
t('X1 · dos generaciones seguidas no son copias casi idénticas (similitud < 75%)',
  sim < 0.75, 'similitud=' + sim + ' · plan1=' + plan1.map(function (x) { return x.name; }).join(',') + ' · plan2=' + plan2.map(function (x) { return x.name; }).join(','));
t('X2 · la segunda sigue siendo un plan válido y coherente',
  sandbox.f3ValidarPlanNombres(plan2, { objetivo: 'hipertrofia', nivel: 'intermedio', equip: 'Gimnasio' }).length === 0);
t('X3 · conserva los mismos músculos objetivo (misma estructura)',
  plan1.map(function (x) { return x.muscle; }).join(',') === plan2.map(function (x) { return x.muscle; }).join(','));
t('X4 · la creación DELIBERADA de la misma rutina sigue permitida (W3 ya lo cubre)',
  (function () { sandbox.window._routineName = 'copia'; sandbox.createFitnessToday = function () { sandbox.state.fitnessToday = { date: '2026-08-16', ctx: { focus: 'Pecho' }, plan: JSON.parse(JSON.stringify(plan1)) }; }; sandbox.crearRutina(); return sandbox.state.savedRoutines.length === 2 && sandbox.state.savedRoutines[1].name === 'copia'; })());

// ============================================================
// Y · Progresión por EJERCICIO (peso y reps precargados)
// ============================================================
console.log('\n== Y · Progresión por ejercicio ==');
sandbox.state = {
  fitEffort: 'normal', fitVariant: 0, profile: {}, savedRoutines: [],
  workoutLog: [
    { id: 1, date: '2026-08-13', localDate: '2026-08-13', sessionId: 1, exercise: 'Jalón al pecho', weight: 150, sets: 1, reps: '6', note: 'Rutina A · test' },
    { id: 2, date: '2026-08-13', localDate: '2026-08-13', sessionId: 1, exercise: 'Jalón al pecho', weight: 150, sets: 1, reps: '6', note: 'Rutina A · test' },
    { id: 3, date: '2026-08-13', localDate: '2026-08-13', sessionId: 1, exercise: 'Jalón al pecho', weight: 150, sets: 1, reps: '6', note: 'Rutina A · test' }
  ]
};
var sugY = sandbox.sugerenciaSesion('Jalón al pecho', '6-15', 3, { log: sandbox.state.workoutLog, hoy: '2026-08-16' });
t('Y1 · 150 lb × 6 con rango 6-15 → sugiere mantener 150 y subir a 7 reps (no subir peso aún)',
  sugY.target === 150 && JSON.stringify(sugY.targetReps) === JSON.stringify([7, 7, 7]),
  JSON.stringify({ target: sugY.target, reps: sugY.targetReps }));
sandbox.state.workoutLog = [
  { id: 4, date: '2026-08-13', localDate: '2026-08-13', sessionId: 1, exercise: 'Jalón al pecho', weight: 150, sets: 1, reps: '15', note: 'x' },
  { id: 5, date: '2026-08-13', localDate: '2026-08-13', sessionId: 1, exercise: 'Jalón al pecho', weight: 150, sets: 1, reps: '15', note: 'x' },
  { id: 6, date: '2026-08-13', localDate: '2026-08-13', sessionId: 1, exercise: 'Jalón al pecho', weight: 150, sets: 1, reps: '15', note: 'x' }
];
var sugY2 = sandbox.sugerenciaSesion('Jalón al pecho', '6-15', 3, { log: sandbox.state.workoutLog, hoy: '2026-08-16' });
t('Y2 · tope del rango consistente (15,15,15) → entonces sí recomienda subir peso',
  sugY2.target > 150, 'target=' + sugY2.target);
// El historial pertenece al EJERCICIO: misma sugerencia aunque el registro sea de otra rutina
var sugY3 = sandbox.sugerenciaSesion('Jalón al pecho', '6-15', 3, { log: [{ id: 7, date: '2026-08-13', localDate: '2026-08-13', sessionId: 9, exercise: 'Jalón al pecho', weight: 150, sets: 1, reps: '6', note: 'De Otra Rutina' }], hoy: '2026-08-16' });
t('Y3 · el progreso sigue al ejercicio aunque venga de otra rutina',
  sugY3.target === 150 && JSON.stringify(sugY3.targetReps) === JSON.stringify([7]));


// ============================================================
// D11 · Crear plan semanal: la SEMANA se construye con los dias reales marcados
// ============================================================
console.log('\n== D11 · Dias reales en la semana ==');
sandbox.state = { fitEffort: 'normal', fitVariant: 0, workoutLog: [], sessionFeedbacks: [], savedRoutines: [], profile: { diasGym: [0, 1, 2, 5, 6], nivelFit: 'intermedio', minutosSesion: '60', intensidadPlan: 'normal', actividadDiaria: 'activo' } };
sandbox.createFitnessToday = function () { sandbox.state.fitnessToday = { date: '2026-08-16', ctx: { focus: 'Ganar músculo sin quedar molido' }, plan: [] }; };
sandbox.quickFitnessToday = function () {};
sandbox.window._routineName = '';
sandbox.crearRutina();
var rD11 = sandbox.state.customRoutine;
t('D11.1 · crearRutina construye la semana con los dias reales',
  !!rD11 && rD11.days.length === 5, rD11 ? rD11.days.length + ' dias' : 'sin semana');
t('D11.2 · weekSchedule: Lun/Mar/Mié = 0,1,2 · Sáb/Dom = 3,4',
  !!rD11 && rD11.weekSchedule[0] === 0 && rD11.weekSchedule[1] === 1 && rD11.weekSchedule[2] === 2 && rD11.weekSchedule[5] === 3 && rD11.weekSchedule[6] === 4 && rD11.weekSchedule[3] === 'rest' && rD11.weekSchedule[4] === 'rest');
var semanaD11 = !!rD11 ? rD11.weekSchedule.map(function (a, i) {
  if (a === 'rest') return { di: i, rest: true };
  var d = rD11.days[a];
  return { di: i, day: d.day, tag: sandbox.f3TagDeNombre(d.day), plan: d.exercises.map(function (x) {
    var id = sandbox.f3IdPorNombre(x.name);
    return { exId: id, n: x.name, m: x.muscle, pat: id ? EX_LIB[id].pat : null, eq: id ? EX_LIB[id].var[sandbox.f3EquipKey('Gimnasio')].eq : null, lv: id ? EX_LIB[id].lv : 1, sets: x.sets, reps: x.reps, rest: String(x.rest) };
  }) };
}) : [];
var errsD11 = !!rD11 ? sandbox.f3ValidarSemana(semanaD11, { dias: 5, objetivo: 'hipertrofia', nivel: 'intermedio', equip: 'Gimnasio', tipo: 'auto' }) : ['sin semana'];
t('D11.3 · la semana completa es válida (0 errores)', errsD11.length === 0, errsD11.join('; ').slice(0, 160));

// ============================================================
// D12 · El tipo y el foco elegidos llegan al generador (UX de un solo selector)
// ============================================================
console.log('\n== D12 · Tipo de rutina llega al generador ==');
var gReal = sandbox.document.getElementById;
var focoStyle = {};
sandbox.document.getElementById = function (id) {
  if (id === 'crTipo') return { value: 'especializacion' };
  if (id === 'crFoco') return { value: 'espalda' };
  if (id === 'crFocoRow') return { style: focoStyle };
  return gReal(id);
};
sandbox.state = { fitEffort: 'normal', fitVariant: 0, workoutLog: [], sessionFeedbacks: [], savedRoutines: [], profile: { diasGym: [0, 2, 4, 5], nivelFit: 'intermedio', minutosSesion: '60', intensidadPlan: 'normal', actividadDiaria: 'activo' } };
sandbox.createFitnessToday = function () { sandbox.state.fitnessToday = { date: '2026-08-16', ctx: { focus: 'Ganar músculo sin quedar molido' }, plan: [] }; };
sandbox.quickFitnessToday = function () {};
sandbox.window._routineName = '';
sandbox.crearRutina();
var rD12 = sandbox.state.customRoutine;
t('D12.1 · el tipo elegido llega al generador', !!rD12 && rD12.cfg.tipo === 'especializacion', rD12 && rD12.cfg.tipo);
t('D12.2 · el foco elegido llega al generador y define la semana',
  !!rD12 && rD12.cfg.foco === 'espalda' && rD12.days[0].day === 'Foco A: Espalda', rD12 && rD12.days[0].day);
sandbox.f3CrTipoCambio();
t('D12.3 · con Especialización el selector de foco queda visible', focoStyle.display === 'block', String(focoStyle.display));
sandbox.document.getElementById = function (id) {
  if (id === 'crTipo') return { value: 'auto' };
  if (id === 'crFocoRow') return { style: focoStyle };
  return gReal(id);
};
sandbox.f3CrTipoCambio();
t('D12.4 · con Automática el selector de foco queda oculto', focoStyle.display === 'none', String(focoStyle.display));
sandbox.document.getElementById = gReal;
console.log('\n==========================================');
console.log('Resultado: ' + passed + ' pasaron · ' + failed + ' fallaron');
console.log('==========================================');
if (failed) {
  console.log('\nFallos:\n' + failures.map(function (f) { return '  ✗ ' + f; }).join('\n'));
  process.exit(1);
}
process.exit(0);

