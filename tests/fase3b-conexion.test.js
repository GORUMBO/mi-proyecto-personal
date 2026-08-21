// ============================================================
// PRUEBAS F3b — El generador real ya usa EX_LIB + F3_RULES:
// A) defaultWeekSchedule(2): entrenamientos separados (lun+jue)
// B) Plan diario: nombres de la biblioteca, equipo respetado, validado
// C) Fatiga modifica dosis (no el objetivo)
// D) Plan semanal: estructura, A≠B, 2 días no consecutivos, descansos
// E) Alias: el historial viejo sigue contando (progresión continua)
// F) Historial reciente real desde workoutLog (solo lectura)
// G) Propiedades: 500 planes diarios + 100 semanas validadas
// Uso: node tests/fase3b-conexion.test.js
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
// Sandbox con el motor completo
// ============================================================
const sandbox = {
  console,
  state: { fitEffort: 'auto', fitVariant: 0, workoutLog: [] },
  fitDaySeed: function () { return 3; },
  todayISO: function () { return '2026-08-16'; },
  todayLocal: function () { return '2026-08-16'; },
  save: function () {},
  renderFitnessCoach: function () {},
  document: { getElementById: function () { return { innerHTML: '', getBoundingClientRect: function () { return { top: 0 }; } }; } }
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
  extractFunc('f3AnclarEl') + '\n' +
  extractFunc('f3IrARutina') + '\n' +
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
  extractFunc('f3SemanaDesdeDias') + '\n' +
  extractFunc('f3ElegirSplit') + '\n' +
  extractFunc('f3SetsContexto') + '\n' +
  extractFunc('f3ValidarEjercicioLib') + '\n' +
  extractFunc('f3ValidarPlan') + '\n' +
  extractFunc('f3ValidarSemana') + '\n' +
  extractFunc('f3TendenciaFeedback') + '\n' +
  extractFunc('f3EjerciciosDolor') + '\n' +
  extractFunc('f3ValidarPlanNombres') + '\n' +
  'var SPECIAL_WORKOUTS=' + extractObj('SPECIAL_WORKOUTS') + ';\n' +
  'var EX_LIB=' + extractObj('EX_LIB') + ';\n' +
  'var F3_RULES=' + extractObj('F3_RULES') + ';\n' +
  'var F3_ALIASES=' + extractObj('F3_ALIASES') + ';',
  sandbox
);
const EX_LIB = sandbox.EX_LIB;
function aPlanValidador(plan, equip, nivel, objetivo) {
  var eqKey = sandbox.f3EquipKey(equip);
  return (plan || []).map(function (x) {
    var id = sandbox.f3IdPorNombre(x.name);
    return { exId: id, n: x.name, m: x.muscle, pat: id ? EX_LIB[id].pat : null, eq: id ? EX_LIB[id].var[eqKey].eq : null, lv: id ? EX_LIB[id].lv : 1, sets: x.sets, reps: x.reps, rest: String(x.rest) + ' s' };
  });
}

// ============================================================
// A · defaultWeekSchedule con 2 días
// ============================================================
console.log('\n== A · defaultWeekSchedule ==');
const s2 = sandbox.defaultWeekSchedule(2);
t('A1 · 2 días = [lun, descanso, descanso, jue, descanso, descanso, descanso]',
  JSON.stringify(s2) === JSON.stringify([0, 'rest', 'rest', 1, 'rest', 'rest', 'rest']));
t('A2 · 2 días: nunca entrenamientos en días consecutivos',
  (function () { for (var i = 1; i < s2.length; i++) { if (s2[i] !== 'rest' && s2[i - 1] !== 'rest') return false; } return true; })());
t('A3 · 3/4/5/6 días mantienen su esquema', [3, 4, 5, 6].every(function (n) {
  var s = sandbox.defaultWeekSchedule(n);
  return s.filter(function (v) { return v !== 'rest'; }).length === n;
}));

// ============================================================
// B · Plan diario: biblioteca + validación
// ============================================================
console.log('\n== B · Plan diario ==');
const FOCOS = ['Ganar músculo sin quedar molido', 'Pecho', 'Espalda y hombros', 'Brazos', 'Pierna y glúteos', 'Tren superior', 'Tren inferior', 'Core y movilidad'];
const EQUIPOS = ['Gimnasio', 'Mancuernas', 'Casa / sin equipo'];
let casosDiarios = 0;
FOCOS.forEach(function (focus) {
  EQUIPOS.forEach(function (equip) {
    var plan = sandbox.buildFitnessTodayPlan({ steps: 5000, energy: 3, pain: 0, sleep: 7, focus: focus, equip: equip, hard: false, recovery: false });
    casosDiarios++;
    var eqKey = sandbox.f3EquipKey(equip);
    var okNombres = plan.every(function (x) {
      var id = sandbox.f3IdPorNombre(x.name);
      return !!id && EX_LIB[id].var[eqKey].n === x.name && EX_LIB[id].m === x.muscle;
    });
    t('B1 · [' + focus + ' · ' + equip + '] nombres y músculo correctos de la biblioteca', okNombres);
    t('B2 · [' + focus + ' · ' + equip + '] sin duplicados', new Set(plan.map(function (x) { return x.name; })).size === plan.length);
    t('B3 · [' + focus + ' · ' + equip + '] alternativas válidas (equipo respetado)',
      plan.every(function (x) { return (x.alts || []).every(function (a) { var id = sandbox.f3IdPorNombre(a); return !!id && EX_LIB[id].var[eqKey].n === a; }); }));
    var errs = sandbox.f3ValidarPlan(aPlanValidador(plan, equip, 'intermedio', 'hipertrofia'), { objetivo: 'hipertrofia', nivel: 'intermedio', equip: equip });
    t('B4 · [' + focus + ' · ' + equip + '] plan validado por f3ValidarPlan', errs.length === 0, errs.join('; '));
  });
});
console.log('  · planes diarios analizados: ' + casosDiarios);

// ============================================================
// C · Fatiga modifica DOSIS, no el objetivo
// ============================================================
console.log('\n== C · Fatiga y recuperación ==');
sandbox.state.fitEffort = 'auto';
var planNormal = sandbox.buildFitnessTodayPlan({ steps: 5000, energy: 3, pain: 0, sleep: 7, focus: 'Ganar músculo sin quedar molido', equip: 'Gimnasio', hard: false, recovery: false });
var planCansado = sandbox.buildFitnessTodayPlan({ steps: 5000, energy: 3, pain: 0, sleep: 7, focus: 'Ganar músculo sin quedar molido', equip: 'Gimnasio', hard: true, recovery: false });
function setsTot(plan) { return plan.reduce(function (a, x) { return a + x.sets; }, 0); }
t('C1 · día pesado reduce la dosis (series) pero mantiene el mismo tipo de plan',
  setsTot(planCansado) < setsTot(planNormal) && planCansado.length <= planNormal.length);
var planRec = sandbox.buildFitnessTodayPlan({ steps: 5000, energy: 1, pain: 3, sleep: 7, focus: 'Ganar músculo sin quedar molido', equip: 'Gimnasio', hard: true, recovery: true });
t('C2 · recuperación = solo movilidad/core suave',
  planRec.every(function (x) { return ['movilidad', 'core', 'hombros'].indexOf(x.muscle) >= 0; }));

// ============================================================
// D · Plan semanal con el motor conectado
// ============================================================
console.log('\n== D · Plan semanal ==');
[2, 3, 4, 5, 6].forEach(function (dias) {
  ['gym', 'mancuernas', 'casa'].forEach(function (equip) {
    var r = sandbox.buildCustomRoutine({ exp: 'intermedio', equip: equip, goal: 'hipertrofia', days: dias, minutes: 45 });
    var eqKey = sandbox.f3EquipKey(equip === 'casa' ? 'Casa / sin equipo' : equip === 'mancuernas' ? 'Mancuernas' : 'Gimnasio');
    t('D1 · ' + dias + 'd ' + equip + ': número de días correcto', r.days.length === dias);
    t('D2 · ' + dias + 'd ' + equip + ': todos los ejercicios de la biblioteca y equipo correcto',
      r.days.every(function (d) {
        return d.exercises.every(function (x) {
          var id = sandbox.f3IdPorNombre(x.name);
          return !!id && EX_LIB[id].var[eqKey].n === x.name && EX_LIB[id].m === x.muscle;
        });
      }));
    t('D3 · ' + dias + 'd ' + equip + ': sin duplicados dentro de cada día',
      r.days.every(function (d) { return new Set(d.exercises.map(function (x) { return x.name; })).size === d.exercises.length; }));
    t('D4 · ' + dias + 'd ' + equip + ': weekSchedule sin entrenos consecutivos cuando hay descansos disponibles',
      (function () {
        var s = r.weekSchedule;
        for (var i = 1; i < s.length; i++) { if (s[i] !== 'rest' && s[i - 1] !== 'rest' && dias <= 3) return false; }
        return true;
      })());
  });
});
var r4 = sandbox.buildCustomRoutine({ exp: 'intermedio', equip: 'gym', goal: 'hipertrofia', days: 4, minutes: 45 });
t('D5 · 4d: superior A ≠ superior B y ejercicios distintos',
  JSON.stringify(r4.days[0].exercises.map(function (x) { return x.name; })) !== JSON.stringify(r4.days[2].exercises.map(function (x) { return x.name; })));
var r6 = sandbox.buildCustomRoutine({ exp: 'intermedio', equip: 'gym', goal: 'hipertrofia', days: 6, minutes: 60 });
t('D6 · 6d: Empuje A ≠ Empuje B (la variación rota entre NO recientes)',
  JSON.stringify(r6.days[0].exercises.map(function (x) { return x.name; })) !== JSON.stringify(r6.days[3].exercises.map(function (x) { return x.name; })),
  'A=' + r6.days[0].exercises.map(function (x) { return x.name; }).join(',') + ' | B=' + r6.days[3].exercises.map(function (x) { return x.name; }).join(','));
var r2 = sandbox.buildCustomRoutine({ exp: 'intermedio', equip: 'gym', goal: 'hipertrofia', days: 2, minutes: 45 });
t('D7 · 2d: los dos días quedan separados en la semana',
  r2.days.length === 2 && r2.weekSchedule[0] === 0 && r2.weekSchedule[3] === 1 && r2.weekSchedule[1] === 'rest' && r2.weekSchedule[2] === 'rest');
t('D9 · sin colisiones de nombre entre variantes del MISMO equipo',
  ['gym', 'man', 'casa'].every(function (k) {
    var nombres = Object.keys(EX_LIB).map(function (id) { return EX_LIB[id].var[k].n; });
    return new Set(nombres).size === nombres.length;
  }));
var rFza = sandbox.buildCustomRoutine({ exp: 'intermedio', equip: 'gym', goal: 'fuerza', days: 3, minutes: 45 });
sandbox.state = { customRoutine: rFza, fitnessToday: null };
sandbox.useRoutineDayToday(0);
t('D8 · fuerza cargada como "hoy": descanso real en segundos (180 s, no 2 s)',
  sandbox.state.fitnessToday && sandbox.state.fitnessToday.plan[0].rest === 180,
  'dio ' + (sandbox.state.fitnessToday && sandbox.state.fitnessToday.plan[0].rest));

// ============================================================
// E · Alias: el historial viejo sigue contando
// ============================================================
console.log('\n== E · Alias de historial ==');
const alias = [
  ['Press inclinado mancuernas', 'press_inclinado'],
  ['Tríceps cuerda', 'extension_triceps'],
  ['Plancha', 'plancha'],
  ['Plancha lateral', 'plancha_lateral'],
  ['Dead bug', 'dead_bug'],
  ['Curl 21s', 'curl_21s'],
  ['Patada de tríceps', 'patada_triceps'],
  ['Peso muerto con mancuernas', 'rdl'],
  ['Jalón al pecho', 'jalon'],
  ['Curl bíceps cable/barra', 'curl'],
  ['Hip thrust ligero', 'hip_thrust'],
  ['Elevaciones laterales', 'laterales'],
  ['Sentadilla goblet', 'sentadilla'],
  ['Prensa ligera', 'prensa']
];
alias.forEach(function (p) {
  t('E1 · "' + p[0] + '" → ' + p[1], sandbox.f3IdPorNombre(p[0]) === p[1], 'dio ' + sandbox.f3IdPorNombre(p[0]));
});

// ============================================================
// F · Historial reciente desde workoutLog real (solo lectura)
// ============================================================
console.log('\n== F · Historial reciente ==');
sandbox.state = {
  workoutLog: [
    { exercise: 'Press inclinado mancuernas', date: '2026-08-15', localDate: '2026-08-15' },
    { exercise: 'Tríceps cuerda', date: '2026-08-15', localDate: '2026-08-15' },
    { exercise: 'Sentadilla goblet', date: '2026-08-12', localDate: '2026-08-12' },
    { exercise: 'Ejercicio inventado sin alias', date: '2026-08-15', localDate: '2026-08-15' }
  ]
};
var hist = sandbox.f3HistorialReciente();
t('F1 · nombres viejos resuelven a la biblioteca', hist.press_inclinado === 1 && hist.extension_triceps === 1);
t('F2 · sentadilla goblet (hace 4 días) entra en la ventana', hist.sentadilla === 4);
t('F3 · nombres desconocidos se ignoran (no rompen)', Object.keys(hist).length === 3);

// ============================================================
// G · Propiedades: cientos de planes y semanas validadas
// ============================================================
console.log('\n== G · Propiedades ==');
sandbox.state = { fitEffort: 'auto', fitVariant: 0, workoutLog: [] };
let malos = 0, totalPlan = 0;
FOCOS.forEach(function (focus) {
  EQUIPOS.forEach(function (equip) {
    ['suave', 'auto', 'normal', 'fuerte', 'extremo'].forEach(function (eff) {
      for (let v = 0; v < 5; v++) {
        sandbox.state.fitEffort = eff;
        sandbox.state.fitVariant = v;
        var plan = sandbox.buildFitnessTodayPlan({ steps: (eff === 'auto' && v % 2 === 0) ? 25000 : 5000, energy: 3, pain: 0, sleep: 7, focus: focus, equip: equip, hard: false, recovery: false });
        totalPlan++;
        var errs = sandbox.f3ValidarPlan(aPlanValidador(plan, equip, 'intermedio', 'hipertrofia'), { objetivo: 'hipertrofia', nivel: 'intermedio', equip: equip });
        if (errs.length) { malos++; if (malos < 4) console.log('  ✗ malo: ' + focus + ' ' + equip + ' ' + eff + ' v' + v + ' → ' + errs.join('; ')); }
      }
    });
  });
});
t('G1 · ' + totalPlan + ' planes diarios generados y validados, CERO inválidos', malos === 0);

let malasSemanas = 0, totalSem = 0;
[2, 3, 4, 5, 6].forEach(function (dias) {
  ['gym', 'mancuernas', 'casa'].forEach(function (equip) {
    ['hipertrofia', 'fuerza', 'resistencia', 'bajar grasa'].forEach(function (goal) {
      ['principiante', 'intermedio', 'avanzado'].forEach(function (exp) {
        var r = sandbox.buildCustomRoutine({ exp: exp, equip: equip, goal: goal, days: dias, minutes: 45 });
        totalSem++;
        var ctx = { objetivo: goal === 'fuerza' ? 'fuerza' : goal === 'resistencia' ? 'resistencia' : goal === 'bajar grasa' ? 'bajar_grasa' : 'hipertrofia', nivel: exp, equip: equip === 'casa' ? 'Casa / sin equipo' : equip === 'mancuernas' ? 'Mancuernas' : 'Gimnasio', dias: dias };
        var semanaV = r.weekSchedule.map(function (a, i) {
          if (a === 'rest') return { di: i, rest: true };
          var d = r.days[a];
          return { di: i, day: d ? d.day : 'D', tag: sandbox.f3TagDeNombre(d ? d.day : ''), plan: d ? d.exercises.map(function (x) {
            var id = sandbox.f3IdPorNombre(x.name);
            return { exId: id, n: x.name, m: x.muscle, pat: id ? EX_LIB[id].pat : null, eq: id ? EX_LIB[id].var[sandbox.f3EquipKey(ctx.equip)].eq : null, lv: id ? EX_LIB[id].lv : 1, sets: x.sets, reps: x.reps, rest: String(sandbox.restSeconds(x.rest)) + ' s' };
          }) : [] };
        });
        var errs = sandbox.f3ValidarSemana(semanaV, ctx);
        if (errs.length) { malasSemanas++; if (malasSemanas < 4) console.log('  ✗ semana mala: ' + dias + 'd ' + equip + ' ' + goal + ' ' + exp + ' → ' + errs.join('; ')); }
      });
    });
  });
});
t('G2 · ' + totalSem + ' semanas generadas y validadas, CERO inválidas', malasSemanas === 0);

console.log('\n==========================================');
console.log('Resultado: ' + passed + ' pasaron · ' + failed + ' fallaron');
console.log('==========================================');
if (failed) {
  console.log('\nFallos:\n' + failures.map(function (f) { return '  ✗ ' + f; }).join('\n'));
  process.exit(1);
}
process.exit(0);

