// ============================================================
// PRUEBAS FASE 2 — Motor de rutinas reales (sin tocar sync):
// A) Parser de descansos (30s/2 min/2-3 min/2–3 min/1:30)
// B) Casa / sin equipo: NUNCA máquinas, poleas ni barra (plan y variantes)
// C) Mancuernas: sin máquinas ni poleas
// D) Gimnasio: determinista, con alternativas
// E) Días A ≠ B en la rutina semanal (ejercicios distintos, mismo músculo)
// F) useRoutineDayToday usa restSeconds (2-3 min = 150 s, no 2 s)
// G) Coherencia básica: sets/reps/descanso/volumen/variedad/duplicados
// Uso: node tests/fase2-rutinas.test.js
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
  // fase 1: encontrar el fin de los parámetros (saltando strings y comentarios)
  let parens = 0, j = i, q = null, lineC = false, blockC = false, bodyStart = -1;
  for (; j < src.length; j++) {
    const c = src[j], n = src[j + 1];
    if (lineC) { if (c === '\n') lineC = false; continue; }
    if (blockC) { if (c === '*' && n === '/') { blockC = false; j++; } continue; }
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === '/' && n === '/') { lineC = true; j++; continue; }
    if (c === '/' && n === '*') { blockC = true; j++; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '(') parens++;
    else if (c === ')') { parens--; if (parens === 0) { bodyStart = j + 1; break; } }
  }
  if (bodyStart < 0) throw new Error('params de ' + name);
  // fase 2: llaves (saltando strings y comentarios)
  let depth = 0; q = null; lineC = false; blockC = false; j = bodyStart;
  for (; j < src.length; j++) {
    const c = src[j], n = src[j + 1];
    if (lineC) { if (c === '\n') lineC = false; continue; }
    if (blockC) { if (c === '*' && n === '/') { blockC = false; j++; } continue; }
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === '/' && n === '/') { lineC = true; j++; continue; }
    if (c === '/' && n === '*') { blockC = true; j++; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return src.slice(i, j + 1); }
  }
  throw new Error('incompleta: ' + name);
}
function extractConst(name) {
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
// Sandbox compartido con el motor real extraído de index.html
// ============================================================
const sandbox = {
  console,
  state: { fitEffort: 'normal', fitVariant: 0 },
  fitDaySeed: function () { return 3; }, // semilla determinista
  todayISO: function () { return '2026-08-15'; },
  save: function () {},
  renderFitnessCoach: function () {},
  document: { getElementById: function () { return { innerHTML: '' }; } }
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
  extractFunc('f3VolBand') + '\n' +
  extractFunc('f3CapSets') + '\n' +
  extractFunc('f3SetsBase') + '\n' +
  extractFunc('f3RepsStr') + '\n' +
  extractFunc('f3RestSeg') + '\n' +
  extractFunc('f3FactorFatiga') + '\n' +
  extractFunc('f3Candidatos') + '\n' +
  extractFunc('f3Elegir') + '\n' +
  extractFunc('f3IdPorNombre') + '\n' +
  extractFunc('f3HistorialReciente') + '\n' +
  extractFunc('f3SlotsDia') + '\n' +
  extractFunc('f3SlotsExtras') + '\n' +
  extractFunc('f3SlotsParaMusculos') + '\n' +
  extractFunc('f3TagDeNombre') + '\n' +
  extractFunc('f3SemanaReferencia') + '\n' +
  extractFunc('f3TendenciaFeedback') + '\n' +
  extractFunc('f3EjerciciosDolor') + '\n' +
  extractFunc('f3ValidarPlan') + '\n' +
  extractFunc('f3ValidarSemana') + '\n' +
  extractFunc('f3ValidarPlanNombres') + '\n' +
  'var SPECIAL_WORKOUTS=' + extractConst('SPECIAL_WORKOUTS') + ';\n' +
  'var routineDB=' + extractConst('routineDB') + ';\n' +
  'var EX_LIB=' + extractConst('EX_LIB') + ';\n' +
  'var F3_RULES=' + extractConst('F3_RULES') + ';\n' +
  'var F3_ALIASES=' + extractConst('F3_ALIASES') + ';',
  sandbox
);
const bank = sandbox.fitnessExerciseBank();
// F3b: el plan diario se genera desde EX_LIB; las uniones de nombres válidos
// por equipo salen de las variantes de la biblioteca.
const unionCasa = Object.keys(sandbox.EX_LIB).reduce((a, k) => a.concat([sandbox.EX_LIB[k].var.casa.n]), []);
const unionMan = Object.keys(sandbox.EX_LIB).reduce((a, k) => a.concat([sandbox.EX_LIB[k].var.man.n]), []);
const unionGym = Object.keys(sandbox.EX_LIB).reduce((a, k) => a.concat([sandbox.EX_LIB[k].var.gym.n]), []);
const MAQUINA = /máquina|cable|polea|smith|prensa|pec deck|banco inclinado|hack|extensión de cuádriceps|curl femoral|rompecráneos/i;

function ctxFor(focus, equip) {
  return { date: '2026-08-15', steps: 5000, energy: 3, pain: 0, sleep: 7, focus, equip, hard: false, recovery: false };
}

// ============================================================
// A · Parser de descansos
// ============================================================
console.log('\n== A · Descansos (restSeconds) ==');
const rs = sandbox.restSeconds;
const exactos = [
  ['30 s', 30], ['60 s', 60], ['90 s', 90], ['2 min', 120], ['1:30', 90],
  ['2 h', 7200], ['', 75], ['5', 5], ['45-60 seg', 53]
];
exactos.forEach(function (p) { t('A1 · "' + p[0] + '" → ' + p[1] + ' s', rs(p[0]) === p[1], 'dio ' + rs(p[0])); });
t('A2 · "2-3 min" entre 120 y 180 (NUNCA 2 o 3 segundos)', rs('2-3 min') >= 120 && rs('2-3 min') <= 180, 'dio ' + rs('2-3 min'));
t('A3 · "2–3 min" (guion largo) entre 120 y 180', rs('2–3 min') >= 120 && rs('2–3 min') <= 180, 'dio ' + rs('2–3 min'));
t('A4 · "30-45 seg" entre 30 y 45', rs('30-45 seg') >= 30 && rs('30-45 seg') <= 45, 'dio ' + rs('30-45 seg'));
t('A5 · "2-3 min" > 60 s (regresión del bug de 2 s)', rs('2-3 min') > 60);

// ============================================================
// B · Casa / sin equipo: nunca máquinas
// ============================================================
console.log('\n== B · Casa / sin equipo ==');
Object.keys(bank).forEach(function (k) {
  t('B1 · slot "' + k + '" tiene ≥2 opciones de casa', (bank[k].casa || []).length >= 2);
  t('B2 · slot "' + k + '" tiene ≥2 opciones de mancuernas', (bank[k].man || []).length >= 2);
});
t('B3 · ningún ejercicio del pool de casa contiene máquinas/poleas/barra',
  unionCasa.every(function (n) { return !MAQUINA.test(n); }),
  unionCasa.filter(function (n) { return MAQUINA.test(n); }).join(', '));

const FOCOS = ['Ganar músculo sin quedar molido', 'Pecho', 'Espalda y hombros', 'Brazos', 'Pierna y glúteos', 'Tren superior', 'Tren inferior', 'Core y movilidad'];
FOCOS.forEach(function (focus) {
  var plan = sandbox.buildFitnessTodayPlan(ctxFor(focus, 'Casa / sin equipo'));
  var names = plan.map(function (x) { return x.name; });
  var alts = plan.reduce(function (a, x) { return a.concat(x.alts || []); }, []);
  var fuera = names.concat(alts).filter(function (n) { return unionCasa.indexOf(n) < 0; });
  t('B4 · [' + focus + '] todos los ejercicios son de casa', fuera.length === 0, fuera.join(', '));
  t('B5 · [' + focus + '] sin máquinas en plan ni alternativas',
    names.concat(alts).every(function (n) { return !MAQUINA.test(n); }));
  t('B6 · [' + focus + '] sin duplicados', new Set(names).size === names.length, names.join(' | '));
  t('B7 · [' + focus + '] entre 3 y 8 ejercicios', plan.length >= 3 && plan.length <= 8, 'hay ' + plan.length);
  t('B8 · [' + focus + '] sets/reps/descanso coherentes',
    plan.every(function (x) {
      var pr = sandbox.parseRepRange(x.reps || '');
      return x.sets >= 2 && x.sets <= 4 && pr.min >= 5 && pr.max <= 60 && rs(x.rest) >= 20 && rs(x.rest) <= 300;
    }));
});

// "Variar ejercicios" en casa: cambia la semilla y TODO sigue siendo de casa
sandbox.state.fitVariant = 1;
FOCOS.forEach(function (focus) {
  var plan = sandbox.buildFitnessTodayPlan(ctxFor(focus, 'Casa / sin equipo'));
  var names = plan.map(function (x) { return x.name; });
  var alts = plan.reduce(function (a, x) { return a.concat(x.alts || []); }, []);
  var fuera = names.concat(alts).filter(function (n) { return unionCasa.indexOf(n) < 0; });
  t('B9 · Variar [' + focus + '] sigue siendo 100% casa', fuera.length === 0, fuera.join(', '));
});
sandbox.state.fitVariant = 0;
var planCasa0 = sandbox.buildFitnessTodayPlan(ctxFor('Ganar músculo sin quedar molido', 'Casa / sin equipo'));
sandbox.state.fitVariant = 1;
var planCasa1 = sandbox.buildFitnessTodayPlan(ctxFor('Ganar músculo sin quedar molido', 'Casa / sin equipo'));
t('B10 · "Variar" cambia de verdad los ejercicios en casa',
  JSON.stringify(planCasa0.map(x => x.name)) !== JSON.stringify(planCasa1.map(x => x.name)));
sandbox.state.fitVariant = 0;

// Esfuerzo fuerte y extremo también respetan casa
sandbox.state.fitEffort = 'fuerte';
var planFuerte = sandbox.buildFitnessTodayPlan(ctxFor('Ganar músculo sin quedar molido', 'Casa / sin equipo'));
t('B11 · Fuerte en casa: 6 ejercicios, todos de casa',
  planFuerte.length === 6 && planFuerte.every(function (x) { return unionCasa.indexOf(x.name) >= 0; }));
sandbox.state.fitEffort = 'extremo';
var planExtremo = sandbox.buildFitnessTodayPlan(ctxFor('Ganar músculo sin quedar molido', 'Casa / sin equipo'));
t('B12 · Extremo en casa: hasta 8 ejercicios, todos de casa',
  planExtremo.length <= 8 && planExtremo.every(function (x) { return unionCasa.indexOf(x.name) >= 0; }));
sandbox.state.fitEffort = 'normal';

// Calistenia en casa (forma especial de entrenar): sin MÁQUINAS de gimnasio
// (la barra de dominadas es parte del equipo de calistenia, no una máquina)
var MAQUINA_SOLO = /máquina|cable|polea|smith|prensa|pec deck|hack|extensión de cuádriceps|curl femoral/i;
var planCali = sandbox.buildFitnessTodayPlan(ctxFor('Calistenia', 'Casa / sin equipo'));
t('B13 · Calistenia en casa funciona y sin máquinas de gimnasio',
  planCali.length >= 3 && planCali.every(function (x) { return !MAQUINA_SOLO.test(x.name); }));

// ============================================================
// C · Mancuernas: sin máquinas ni poleas
// ============================================================
console.log('\n== C · Mancuernas ==');
FOCOS.forEach(function (focus) {
  var plan = sandbox.buildFitnessTodayPlan(ctxFor(focus, 'Mancuernas'));
  var names = plan.map(function (x) { return x.name; });
  var alts = plan.reduce(function (a, x) { return a.concat(x.alts || []); }, []);
  var fuera = names.concat(alts).filter(function (n) { return unionMan.indexOf(n) < 0; });
  t('C1 · [' + focus + '] todos los ejercicios permitidos con mancuernas', fuera.length === 0, fuera.join(', '));
  t('C2 · [' + focus + '] sin máquinas/poleas/barra', names.concat(alts).every(function (n) { return !MAQUINA.test(n); }));
  t('C3 · [' + focus + '] sin duplicados', new Set(names).size === names.length, names.join(' | '));
});

// ============================================================
// D · Gimnasio: determinista y con alternativas
// ============================================================
console.log('\n== D · Gimnasio ==');
sandbox.state.fitVariant = 0;
var planGymA = sandbox.buildFitnessTodayPlan(ctxFor('Ganar músculo sin quedar molido', 'Gimnasio'));
var planGymB = sandbox.buildFitnessTodayPlan(ctxFor('Ganar músculo sin quedar molido', 'Gimnasio'));
t('D1 · mismo día y semilla = misma rutina (determinista)',
  JSON.stringify(planGymA.map(x => x.name)) === JSON.stringify(planGymB.map(x => x.name)));
t('D2 · gimnasio usa el catálogo completo (sin restricción de casa)',
  planGymA.every(function (x) { return unionGym.indexOf(x.name) >= 0; }));
t('D3 · cada ejercicio tiene alternativas y son del catálogo',
  planGymA.every(function (x) {
    return (x.alts || []).length > 0 && x.alts.every(function (a) { return unionGym.indexOf(a) >= 0; });
  }));
t('D4 · sin duplicados en el plan de gimnasio', new Set(planGymA.map(x => x.name)).size === planGymA.length);

// ============================================================
// E · Días A ≠ B en la rutina semanal
// ============================================================
console.log('\n== E · Días A ≠ B (plan semanal) ==');
function nombres(dia) { return dia.exercises.map(function (x) { return x.name; }); }
function nombresDistintos(a, b) {
  var sa = nombres(a), sb = nombres(b);
  return JSON.stringify(sa) !== JSON.stringify(sb);
}
function verificaDia(r, cfg, di) {
  var dia = r.days[di];
  var equip3 = cfg.equip === 'casa' ? 'Casa / sin equipo' : cfg.equip === 'mancuernas' ? 'Mancuernas' : 'Gimnasio';
  var eqKey = sandbox.f3EquipKey(equip3);
  var okMusc = dia.exercises.every(function (x) {
    var id = sandbox.f3IdPorNombre(x.name);
    return !!id && sandbox.EX_LIB[id].m === x.muscle && sandbox.EX_LIB[id].var[eqKey].n === x.name;
  });
  var sinDup = new Set(nombres(dia)).size === dia.exercises.length;
  var cohe = dia.exercises.every(function (x) {
    return x.sets >= 2 && x.sets <= 5 && rs(x.rest) >= 20 && rs(x.rest) <= 200 && /[0-9]/.test(String(x.reps));
  });
  return { okMusc, sinDup, cohe };
}

var cfg4 = { exp: 'intermedio', equip: 'gym', goal: 'hipertrofia', days: 4, minutes: 45 };
var r4 = sandbox.buildCustomRoutine(cfg4);
t('E1 · 4 días: Tren superior A ≠ Tren superior B', nombresDistintos(r4.days[0], r4.days[2]),
  'A=' + nombres(r4.days[0]).join(',') + ' | B=' + nombres(r4.days[2]).join(','));
t('E2 · 4 días: Tren inferior A ≠ Tren inferior B', nombresDistintos(r4.days[1], r4.days[3]),
  'A=' + nombres(r4.days[1]).join(',') + ' | B=' + nombres(r4.days[3]).join(','));
t('E3 · 4 días: ejercicios pertenecen al músculo del día y son del equipo correcto',
  [0, 1, 2, 3].every(function (di) { return verificaDia(r4, cfg4, di).okMusc; }));
t('E4 · 4 días: sin duplicados dentro de cada día',
  [0, 1, 2, 3].every(function (di) { return verificaDia(r4, cfg4, di).sinDup; }));
t('E5 · 4 días: sets/reps/descanso coherentes',
  [0, 1, 2, 3].every(function (di) { return verificaDia(r4, cfg4, di).cohe; }));

var cfg6 = { exp: 'intermedio', equip: 'gym', goal: 'hipertrofia', days: 6, minutes: 60 };
var r6 = sandbox.buildCustomRoutine(cfg6);
t('E6 · 6 días: Empuje A ≠ Empuje B', nombresDistintos(r6.days[0], r6.days[3]),
  'A=' + nombres(r6.days[0]).join(',') + ' | B=' + nombres(r6.days[3]).join(','));
t('E7 · 6 días: Jalón A ≠ Jalón B', nombresDistintos(r6.days[1], r6.days[4]));
t('E8 · 6 días: Pierna A ≠ Pierna B', nombresDistintos(r6.days[2], r6.days[5]));
t('E9 · 6 días: ejercicios del músculo y equipo correctos',
  [0, 1, 2, 3, 4, 5].every(function (di) { return verificaDia(r6, cfg6, di).okMusc; }));

var cfgCasa = { exp: 'principiante', equip: 'casa', goal: 'hipertrofia', days: 4, minutes: 30 };
var rCasa = sandbox.buildCustomRoutine(cfgCasa);
t('E10 · casa: todos los ejercicios son la variante de casa del músculo',
  [0, 1, 2, 3].every(function (di) { return verificaDia(rCasa, cfgCasa, di).okMusc; }));
t('E11 · casa: A ≠ B también con principiante', nombresDistintos(rCasa.days[0], rCasa.days[2]));

var cfgFza = { exp: 'intermedio', equip: 'gym', goal: 'fuerza', days: 3, minutes: 45 };
var rFza = sandbox.buildCustomRoutine(cfgFza);
t('E12 · fuerza: descanso "2-3 min" queda entre 120 y 180 s en cada ejercicio',
  rFza.days.every(function (d) { return d.exercises.every(function (x) { return rs(x.rest) >= 120 && rs(x.rest) <= 180; }); }));

// ============================================================
// F · useRoutineDayToday: el descanso se convierte bien
// ============================================================
console.log('\n== F · useRoutineDayToday (descanso) ==');
sandbox.state = {
  customRoutine: { days: [{ day: 'Pierna', exercises: [{ name: 'Sentadilla con barra', muscle: 'pierna', sets: 3, reps: '8-12', rest: '2-3 min' }] }], cfg: { equip: 'gym' } },
  fitnessToday: null
};
sandbox.useRoutineDayToday(0);
t('F1 · "2-3 min" → 150 s en la rutina de hoy (antes quedaba en 2 s)',
  sandbox.state.fitnessToday && sandbox.state.fitnessToday.plan[0].rest === 150,
  'dio ' + (sandbox.state.fitnessToday && sandbox.state.fitnessToday.plan[0].rest));

// ============================================================
// G · Coherencia global del banco
// ============================================================
console.log('\n== G · Coherencia del banco ==');
Object.keys(bank).forEach(function (k) {
  var s = bank[k];
  t('G1 · slot "' + k + '" tiene nombre, músculo y reps con números',
    !!s.name && !!s.muscle && /[0-9]/.test(String(s.reps)));
  t('G2 · slot "' + k + '" tiene series (2-3) y descanso (30-120 s) sensatos',
    s.sets >= 2 && s.sets <= 3 && s.rest >= 30 && s.rest <= 120);
  t('G3 · slot "' + k + '" sin nombres duplicados en gimnasio',
    new Set([s.name].concat(s.alts || [])).size === [s.name].concat(s.alts || []).length);
});

console.log('\n==========================================');
console.log('Resultado: ' + passed + ' pasaron · ' + failed + ' fallaron');
console.log('==========================================');
if (failed) {
  console.log('\nFallos:\n' + failures.map(function (f) { return '  ✗ ' + f; }).join('\n'));
  process.exit(1);
}
process.exit(0);
