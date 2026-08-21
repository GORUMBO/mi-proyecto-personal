// ============================================================
// PRUEBAS SEMÁNTICAS — calidad real de las rutinas (auditoría)
// Coherencia de splits, recuperación, equipo, patrones, aliases.
// Uso: node tests/fitness-semantica.test.js
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

const sandbox = {
  console,
  state: { fitEffort: 'normal', fitVariant: 0, workoutLog: [], sessionFeedbacks: [], profile: {}, fitDislikes: [], savedRoutines: [] },
  fitDaySeed: function () { return 3; },
  todayISO: function () { return '2026-08-18'; },
  todayLocal: function () { return '2026-08-18'; },
  save: function () {},
  renderFitnessCoach: function () {},
  renderGuidedWorkout: function () {},
  quickFitnessToday: function () {},
  alert: function () {},
  safeText: function (s) { return String(s == null ? '' : s); }
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInNewContext(
  extractFunc('fitnessExerciseBank') + '\n' +
  extractFunc('specialWorkoutKey') + '\n' +
  extractFunc('buildFitnessTodayPlan') + '\n' +
  extractFunc('buildCustomRoutine') + '\n' +
  extractFunc('restSeconds') + '\n' +
  extractFunc('parseRepRange') + '\n' +
  extractFunc('exercisesPerSession') + '\n' +
  extractFunc('goalScheme') + '\n' +
  extractFunc('routineSplit') + '\n' +
  extractFunc('defaultWeekSchedule') + '\n' +
  extractFunc('f3SemanaReferencia') + '\n' +
  extractFunc('f3SemanaDesdeDias') + '\n' +
  extractFunc('f3ElegirSplit') + '\n' +
  extractFunc('f3SetsContexto') + '\n' +
  extractFunc('f3TagDeNombre') + '\n' +
  extractFunc('f3SlotsParaMusculos') + '\n' +
  extractFunc('f3SlotsDia') + '\n' +
  extractFunc('f3SlotsExtras') + '\n' +
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
  extractFunc('f3ActividadNormalizada') + '\n' +
  extractFunc('f3VolBand') + '\n' +
  extractFunc('f3Candidatos') + '\n' +
  extractFunc('f3Elegir') + '\n' +
  extractFunc('f3IdPorNombre') + '\n' +
  extractFunc('f3HistorialReciente') + '\n' +
  extractFunc('f3TendenciaFeedback') + '\n' +
  extractFunc('f3EjerciciosDolor') + '\n' +
  extractFunc('f3ValidarPlan') + '\n' +
  extractFunc('f3ValidarPlanNombres') + '\n' +
  extractFunc('f3ValidarSemana') + '\n' +
  extractFunc('f3MaxSimilitudGuardada') + '\n' +
  extractFunc('f3AltsBanco') + '\n' +
  extractFunc('fitEffortHoy') + '\n' +
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
function musculos(plan) { return (plan || []).map(function (x) { return x.muscle; }); }
function patrones(plan) {
  return (plan || []).map(function (x) {
    var id = sandbox.f3IdPorNombre(x.name);
    return id && EX_LIB[id] ? EX_LIB[id].pat : '?';
  });
}
function esfuerzoFuerte() { sandbox.state.fitEffort = 'fuerte'; sandbox.state.fitEffortDate = sandbox.todayISO(); }
function esfuerzoNormal() { sandbox.state.fitEffort = 'normal'; sandbox.state.fitEffortDate = null; }
function semanaValida(cfg) {
  var semana = sandbox.f3SemanaReferencia({ dias: cfg.days, objetivo: 'hipertrofia', nivel: cfg.exp || 'intermedio', equip: cfg.equip || 'Gimnasio', estado: 'normal' }, 0);
  return { semana: semana, errs: sandbox.f3ValidarSemana(semana, { dias: cfg.days, objetivo: 'hipertrofia', nivel: cfg.exp || 'intermedio', equip: cfg.equip || 'Gimnasio', estado: 'normal' }) };
}

console.log('\n== 1 · Coherencia de splits (plan diario) ==');
esfuerzoFuerte(); // activa los extras (el caso reportado)
var planEsp = sandbox.buildFitnessTodayPlan(ctxDiario('Espalda y hombros', 'Gimnasio'));
t('1.1 · Espalda + bíceps NO mete pierna/glúteo aunque el esfuerzo sea Fuerte',
  musculos(planEsp).indexOf('pierna') < 0 && musculos(planEsp).indexOf('gluteo') < 0 && musculos(planEsp).indexOf('femoral') < 0,
  musculos(planEsp).join(','));
var planBra = sandbox.buildFitnessTodayPlan(ctxDiario('Brazos', 'Gimnasio'));
t('1.2 · Brazos NO mete sentadilla/pierna (ni con Fuerte)',
  musculos(planBra).indexOf('pierna') < 0 && musculos(planBra).indexOf('gluteo') < 0,
  musculos(planBra).join(','));
esfuerzoNormal();
var planPush = sandbox.buildFitnessTodayPlan(ctxDiario('Pecho', 'Gimnasio'));
t('1.3 · Push no mete tirones como ejercicio principal', patrones(planPush).every(function (p) { return p.indexOf('traccion') < 0; }), patrones(planPush).join(','));
var planPull = sandbox.buildFitnessTodayPlan(ctxDiario('Espalda y hombros', 'Gimnasio'));
t('1.4 · Pull no mete press de pecho', patrones(planPull).every(function (p) { return p.indexOf('empuje') < 0; }), patrones(planPull).join(','));
var planLegs = sandbox.buildFitnessTodayPlan(ctxDiario('Pierna y glúteos', 'Gimnasio'));
var principales = musculos(planLegs).filter(function (m) { return ['pierna', 'femoral', 'gluteo', 'pantorrilla'].indexOf(m) >= 0; });
t('1.5 · Legs prioriza pierna (al menos 3 de los ejercicios)', principales.length >= 3, musculos(planLegs).join(','));
var planFB = sandbox.buildFitnessTodayPlan(ctxDiario('Ganar músculo sin quedar molido', 'Gimnasio'));
var mFB = musculos(planFB);
t('1.6 · Full Body sí mezcla grupos (pecho + espalda + pierna)',
  mFB.indexOf('pecho') >= 0 && mFB.indexOf('espalda') >= 0 && (mFB.indexOf('pierna') >= 0 || mFB.indexOf('femoral') >= 0 || mFB.indexOf('gluteo') >= 0),
  mFB.join(','));

console.log('\n== 2 · Equipo ==');
var nombresCasa = {};
Object.keys(EX_LIB).forEach(function (id) {
  var v = EX_LIB[id].var && EX_LIB[id].var.casa;
  if (v && v.n) nombresCasa[v.n] = 1;
});
var planCasa = sandbox.buildFitnessTodayPlan(ctxDiario('Ganar músculo sin quedar molido', 'Casa / sin equipo'));
t('2.1 · Casa no propone máquinas de gimnasio',
  planCasa.every(function (x) { return !!nombresCasa[x.name]; }),
  planCasa.map(function (x) { return x.name; }).join(','));
var candsGym = sandbox.f3Candidatos('pecho', 'empuje_horizontal', { equip: 'Gimnasio', nivel: 'intermedio', dia: 0 }, {}, []);
t('2.2 · Gimnasio puede usar máquinas', candsGym.some(function (c) { return c.var.gym.eq === 'maq'; }));

console.log('\n== 3 · Semana: 3/5/6/7 días ==');
[3, 5, 6, 7].forEach(function (dias) {
  var r = semanaValida({ days: dias });
  t('3.1 · ' + dias + ' días: semana válida (0 errores)', r.errs.length === 0, r.errs.join('; ').slice(0, 160));
});
var r7 = semanaValida({ days: 7 });
var dia7 = r7.semana[6];
t('3.2 · 7 días: el 7º es recuperación activa (no una sesión pesada)',
  dia7 && !dia7.rest && /recuperaci/i.test(dia7.day) && dia7.plan.every(function (x) { return x.m === 'core' || x.m === 'movilidad'; }),
  dia7 ? dia7.day : 'sin día 7');
var r6 = semanaValida({ days: 6 });
t('3.3 · 6 días respeta recuperación (validado, sin días consecutivos del mismo músculo)', r6.errs.length === 0);
t('3.4 · cada día de la semana trae su explicación (motivo)', r7.semana.every(function (d) { return d.rest || !!d.motivo; }));

console.log('\n== 4 · Alternativas y duplicados ==');
esfuerzoNormal();
var planAlt = sandbox.buildFitnessTodayPlan(ctxDiario('Espalda y hombros', 'Gimnasio'));
var familia = { empuje_horizontal: 'empuje', empuje_vertical: 'empuje', traccion_horizontal: 'traccion', traccion_vertical: 'traccion', rodilla: 'pierna', bisagra: 'pierna', cadera: 'pierna', pantorrilla: 'pierna', core: 'core', movilidad: 'movilidad', aislamiento: 'aislamiento' };
var altsOk = planAlt.every(function (x) {
  if (!x.alts || !x.alts.length) return true;
  var idX = sandbox.f3IdPorNombre(x.name);
  var patX = idX && EX_LIB[idX] ? EX_LIB[idX].pat : null;
  if (!patX) return true;
  // Cada alternativa conserva la FAMILIA de movimiento (un tirón horizontal
  // puede ofrecer un tirón vertical, pero jamás un empuje). Prioridad: mismo
  // patrón primero cuando el pool lo permite.
  return x.alts.every(function (a) {
    var idA = sandbox.f3IdPorNombre(a);
    var patA = idA && EX_LIB[idA] ? EX_LIB[idA].pat : null;
    return patA && (patA === patX || familia[patA] === familia[patX]);
  });
});
t('4.1 · las alternativas conservan la familia de movimiento (nunca algo de propósito distinto)', altsOk);
var idsPlan = planAlt.map(function (x) { return sandbox.f3IdPorNombre(x.name); }).filter(Boolean);
t('4.2 · sin duplicados por alias (ids normalizados únicos)', new Set(idsPlan).size === idsPlan.length, idsPlan.join(','));

console.log('\n==========================================');
console.log('Resultado: ' + passed + ' pasaron · ' + failed + ' fallaron');
console.log('==========================================');
if (failed) {
  console.log('\nFallos:\n' + failures.map(function (f) { return '  ✗ ' + f; }).join('\n'));
  process.exit(1);
}
process.exit(0);
