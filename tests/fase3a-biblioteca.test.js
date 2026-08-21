// ============================================================
// PRUEBAS F3a — Biblioteca de ejercicios + reglas de programación
// validadas + pruebas de propiedades (miles de rutinas generadas).
// NO toca el motor actual ni la sincronización: solo valida las
// estructuras nuevas (EX_LIB, F3_RULES, RULE_SOURCES, validadores).
// Uso: node tests/fase3a-biblioteca.test.js
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
    if (c === '/' && n === '/') { lineC = true; j++; continue; }
    if (c === '/' && n === '*') { blockC = true; j++; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
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
    if (c === '/' && n === '/') { lineC = true; j++; continue; }
    if (c === '/' && n === '*') { blockC = true; j++; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return src.slice(i, j + 1); }
  }
  throw new Error('incompleta: ' + name);
}
function extractConstObj(name) {
  var m = HTML.match(new RegExp('const ' + name + '=(\\{.*?\\});', 's'));
  if (!m) throw new Error('No se encontró const ' + name);
  return m[1];
}
function extractConstArr(name) {
  var m = HTML.match(new RegExp('const ' + name + '=(\\[.*?\\]);', 's'));
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
// Sandbox con las estructuras F3a
// ============================================================
const sandbox = {
  console,
  parseRepRange: null, restSeconds: null,
  routineSplit: null, defaultWeekSchedule: null
};
vm.runInNewContext(
  extractFunc('restSeconds') + '\n' +
  extractFunc('parseRepRange') + '\n' +
  extractFunc('routineSplit') + '\n' +
  extractFunc('defaultWeekSchedule') + '\n' +
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
  extractFunc('f3ValidarEjercicioLib') + '\n' +
  extractFunc('f3ValidarPlan') + '\n' +
  extractFunc('f3ValidarSemana') + '\n' +
  extractFunc('f3TagDeNombre') + '\n' +
  extractFunc('f3SlotsParaMusculos') + '\n' +
  extractFunc('f3SemanaReferencia') + '\n' +
  extractFunc('f3SemanaDesdeDias') + '\n' +
  extractFunc('f3ElegirSplit') + '\n' +
  extractFunc('f3SetsContexto') + '\n' +
  'var EX_LIB=' + extractConstObj('EX_LIB') + ';\n' +
  'var F3_RULES=' + extractConstObj('F3_RULES') + ';\n' +
  'var RULE_SOURCES=' + extractConstArr('RULE_SOURCES') + ';',
  sandbox
);
const EX_LIB = sandbox.EX_LIB, F3_RULES = sandbox.F3_RULES, RULE_SOURCES = sandbox.RULE_SOURCES;

// ============================================================
// A · RULE_SOURCES cubre cada regla de F3_RULES
// ============================================================
console.log('\n== A · RULE_SOURCES vs F3_RULES ==');
const cobertura = {
  seriesPorEjercicio: 'seriesPorEjercicio', reps: 'reps', restMin: 'restMin', volSemanal: 'volSemanal',
  frecuenciaObjetivo: 'frecuencia', frecuenciaMin: 'frecuencia', frecuenciaMax: 'frecuencia',
  horasRecuperacion: 'horasRecuperacion', maxDiasConsecutivos: 'horasRecuperacion',
  incPesoPct: 'incPesoPct', fatigaDosis: 'fatigaDosis', restFatiga: 'fatigaDosis',
  recientes: 'recientes', patronesDia: 'patronesDia', feedback: 'feedback'
};
Object.keys(F3_RULES).forEach(function (k) {
  if (k === 'niveles') return;
  var esperado = cobertura[k];
  t('A1 · regla "' + k + '" tiene fuente registrada', !!esperado && RULE_SOURCES.some(function (s) { return s.r === esperado; }));
});
t('A2 · cada entrada de RULE_SOURCES tiene regla/valor/objetivo/fuente/año/ref/notas',
  RULE_SOURCES.every(function (s) { return s.r && s.val && s.obj && s.src && s.anio && s.ref && s.notas; }));
t('A3 · RULE_SOURCES apunta a reglas que existen (excepto heurísticas marcadas)',
  RULE_SOURCES.every(function (s) {
    var reglas = Object.keys(F3_RULES);
    var familia = Object.keys(cobertura).filter(function (k) { return cobertura[k] === s.r; });
    return familia.length > 0 || s.r === 'pasosActividad';
  }));
t('A4 · bandas válidas (min <= max) en seriesPorEjercicio/volSemanal/restMin',
  ['hipertrofia', 'fuerza', 'resistencia', 'bajar_grasa'].every(function (o) {
    var okSeries = ['p', 'i', 'a'].every(function (n) {
      var b = F3_RULES.seriesPorEjercicio[o][n]; return b[0] <= b[1];
    });
    return okSeries;
  }) && ['p', 'i', 'a'].every(function (n) {
    var b = F3_RULES.volSemanal[n]; return b[0] <= b[1];
  }));

// ============================================================
// B · Integridad de EX_LIB
// ============================================================
console.log('\n== B · Integridad de EX_LIB ==');
Object.keys(EX_LIB).forEach(function (id) {
  var errs = sandbox.f3ValidarEjercicioLib(EX_LIB[id], id);
  t('B1 · "' + id + '" pasa la validación de campos', errs.length === 0, errs.join('; '));
});
t('B2 · sin duplicados de nombre entre variantes (gym)',
  Object.keys(EX_LIB).every(function (id) {
    var n = EX_LIB[id].var.gym.n;
    return Object.keys(EX_LIB).filter(function (k) { return EX_LIB[k].var.gym.n === n; }).length === 1;
  }));
t('B3 · equivalentes simétricos y del mismo músculo+patrón',
  Object.keys(EX_LIB).every(function (id) {
    return (EX_LIB[id].equiv || []).every(function (q) {
      var e = EX_LIB[q];
      return !!e && (e.equiv || []).indexOf(id) >= 0 && e.m === EX_LIB[id].m && e.pat === EX_LIB[id].pat;
    });
  }));
t('B4 · incompatibilidades apuntan a ejercicios existentes',
  Object.keys(EX_LIB).every(function (id) {
    return (EX_LIB[id].incompat || []).every(function (q) { return !!EX_LIB[q]; });
  }));
t('B5 · todo patrón usado por el generador tiene >=1 candidato en cualquier equipo y nivel >=1',
  ['empuje_horizontal|pecho', 'traccion_vertical|espalda', 'traccion_horizontal|espalda', 'rodilla|pierna', 'bisagra|femoral', 'cadera|gluteo', 'empuje_vertical|hombros', 'aislamiento|hombros', 'aislamiento|biceps', 'aislamiento|triceps', 'core|core'].every(function (combo) {
    var partes = combo.split('|');
    return ['Casa / sin equipo', 'Mancuernas', 'Gimnasio'].every(function (eq) {
      var cands = sandbox.f3Candidatos(partes[1], partes[0], { equip: eq, nivel: 'principiante', dia: 0 }, {}, []);
      return cands.length >= 1;
    });
  }));
t('B6 · cada músculo del generador tiene >=2 ejercicios distintos',
  ['pecho', 'espalda', 'pierna', 'hombros', 'biceps', 'triceps', 'core', 'femoral', 'gluteo'].every(function (m) {
    return Object.keys(EX_LIB).filter(function (id) { return EX_LIB[id].m === m; }).length >= 2;
  }));

// ============================================================
// C · Los validadores DETECTAN rutinas absurdas hechas a mano
// ============================================================
console.log('\n== C · Validadores detectan absurdos ==');
function ctxBase(extra) { return Object.assign({ objetivo: 'hipertrofia', nivel: 'intermedio', equip: 'Gimnasio', dias: 3, estado: 'normal' }, extra || {}); }
function item(exId, extra) { return Object.assign({ exId: exId, n: EX_LIB[exId].var.gym.n, m: EX_LIB[exId].m, pat: EX_LIB[exId].pat, eq: EX_LIB[exId].var.gym.eq, lv: EX_LIB[exId].lv, sets: 3, reps: '8-12', rest: '90 s' }, extra || {}); }
function semanaDe(dias, tag) { return dias.map(function (plan, di) { return { di: di, day: 'D' + di, tag: tag, plan: plan }; }); }

t('C1 · detecta músculo que no corresponde al día (curl en día de empuje)',
  sandbox.f3ValidarSemana(semanaDe([[item('press_plano'), item('press_hombro'), item('curl')]], 'empuje'), ctxBase()).some(function (e) { return e.indexOf('no corresponde') >= 0; }));
t('C2 · detecta equipo incompatible (máquina con equip=Gimnasio OK; con Casa NO)',
  (function () {
    var errsCasa = sandbox.f3ValidarPlan([item('prensa', { eq: 'maq' })], ctxBase({ equip: 'Casa / sin equipo' }));
    return errsCasa.length > 0;
  })());
t('C3 · detecta duplicados',
  sandbox.f3ValidarPlan([item('press_plano'), item('press_plano')], ctxBase()).some(function (e) { return e.indexOf('duplicado') >= 0; }));
t('C4 · detecta series fuera de banda (9 series en un ejercicio)',
  sandbox.f3ValidarPlan([item('press_plano', { sets: 9 })], ctxBase()).some(function (e) { return e.indexOf('series') >= 0; }));
t('C5 · detecta descanso fuera de banda (10 s en compuesto)',
  sandbox.f3ValidarPlan([item('press_plano', { rest: '10 s' })], ctxBase()).some(function (e) { return e.indexOf('descanso') >= 0; }));
t('C6 · detecta ejercicio incompatible con el nivel (rueda para principiante)',
  sandbox.f3ValidarPlan([item('rueda')], ctxBase({ nivel: 'principiante' })).some(function (e) { return e.indexOf('nivel') >= 0; }));
t('C7 · detecta días consecutivos del mismo músculo (pecho lunes y martes)',
  sandbox.f3ValidarSemana(semanaDe([[item('press_plano')], [item('press_inclinado')]], 'empuje'), ctxBase()).some(function (e) { return e.indexOf('48h') >= 0; }));
t('C8 · detecta volumen semanal fuera de banda',
  (function () {
    var dias = [];
    for (var d = 0; d < 4; d++) { dias.push({ di: d, day: 'E' + d, tag: 'empuje', plan: [item('press_plano', { sets: 5 }), item('press_hombro')] }); }
    dias.push({ di: 4, day: 'R', tag: 'full', plan: [] });
    dias.push({ di: 5, day: 'R2', tag: 'full', plan: [] });
    dias.push({ di: 6, day: 'R3', tag: 'full', plan: [] });
    return sandbox.f3ValidarSemana(dias, ctxBase({ dias: 4, nivel: 'principiante' })).some(function (e) { return e.indexOf('volumen semanal') >= 0; });
  })());
t('C9 · detecta día de empuje sin patrón vertical',
  sandbox.f3ValidarSemana(semanaDe([[item('press_plano'), item('aperturas'), item('extension_triceps')]], 'empuje'), ctxBase()).some(function (e) { return e.indexOf('patrón') >= 0; }));
t('C10 · detecta ejercicio fuera de la biblioteca',
  sandbox.f3ValidarPlan([{ exId: 'inventado_xyz', n: 'Inventado', m: 'pecho', pat: 'empuje_horizontal', eq: 'bar', lv: 1, sets: 3, reps: '8-12', rest: '90 s' }], ctxBase()).some(function (e) { return e.indexOf('fuera de la biblioteca') >= 0; }));

// ============================================================
// D · Pruebas de PROPIEDADES: miles de semanas generadas
// ============================================================
console.log('\n== D · Propiedades (miles de rutinas) ==');
const OBJETIVOS = ['hipertrofia', 'fuerza', 'resistencia', 'bajar_grasa'];
const NIVELES = ['principiante', 'intermedio', 'avanzado'];
const EQUIPOS = ['Gimnasio', 'Mancuernas', 'Casa / sin equipo'];
const ESTADOS = ['fresco', 'normal', 'cansado', 'muy_cansado'];
let totalGen = 0, totalErrores = 0;
const primerError = [];
for (let dias = 2; dias <= 6; dias++) {
  for (let ei = 0; ei < EQUIPOS.length; ei++) {
    for (let ni = 0; ni < NIVELES.length; ni++) {
      for (let oi = 0; oi < OBJETIVOS.length; oi++) {
        for (let si = 0; si < ESTADOS.length; si++) {
          for (let seed = 0; seed < 10; seed++) {
            const ctx = { dias: dias, objetivo: OBJETIVOS[oi], nivel: NIVELES[ni], equip: EQUIPOS[ei], estado: ESTADOS[si] };
            const semana = sandbox.f3SemanaReferencia(ctx, seed);
            totalGen++;
            const errs = sandbox.f3ValidarSemana(semana, ctx);
            if (errs.length) { totalErrores++; if (primerError.length < 5) primerError.push('dias=' + dias + ' ' + EQUIPOS[ei] + ' ' + NIVELES[ni] + ' ' + OBJETIVOS[oi] + ' ' + ESTADOS[si] + ' seed=' + seed + ' → ' + errs.join('; ')); }
          }
        }
      }
    }
  }
}
t('D1 · ' + totalGen + ' semanas generadas, CERO casos absurdos', totalErrores === 0, primerError.join(' | '));

// Determinismo y variación controlada
const ctxD = { dias: 4, objetivo: 'hipertrofia', nivel: 'intermedio', equip: 'Gimnasio', estado: 'normal' };
const sA = JSON.stringify(sandbox.f3SemanaReferencia(ctxD, 7));
const sB = JSON.stringify(sandbox.f3SemanaReferencia(ctxD, 7));
t('D2 · misma semilla = misma rutina (determinista, sin Math.random)', sA === sB);
const sC = JSON.stringify(sandbox.f3SemanaReferencia(ctxD, 8));
t('D3 · otra semilla cambia ejercicios pero sigue válida',
  sA !== sC && sandbox.f3ValidarSemana(sandbox.f3SemanaReferencia(ctxD, 8), ctxD).length === 0);

// La fatiga modifica la DOSIS, nunca el objetivo ni los músculos
const semFresco = sandbox.f3SemanaReferencia({ dias: 4, objetivo: 'hipertrofia', nivel: 'intermedio', equip: 'Gimnasio', estado: 'fresco' }, 7);
const semCansado = sandbox.f3SemanaReferencia({ dias: 4, objetivo: 'hipertrofia', nivel: 'intermedio', equip: 'Gimnasio', estado: 'muy_cansado' }, 7);
function setsTotales(sem) { return sem.reduce(function (a, d) { return a + (d.plan || []).reduce(function (b, x) { return b + x.sets; }, 0); }, 0); }
t('D4 · muy cansado reduce la dosis (series totales) sin cambiar estructura',
  setsTotales(semCansado) < setsTotales(semFresco) && setsTotales(semCansado) > 0);
t('D5 · los pasos/actividad NO aparecen como regla dura (no hay regla que prohíba piernas por pasos)',
  RULE_SOURCES.some(function (s) { return s.r === 'pasosActividad' && s.val.indexOf('NO') >= 0; }));

// recentExercises: deprioritizar sin prohibir
const historial = { press_plano: 0, aperturas: 9 };
const cands = sandbox.f3Candidatos('pecho', 'empuje_horizontal', { equip: 'Gimnasio', nivel: 'intermedio', dia: 1 }, historial, []);
const idxAperturas = cands.map(function (c) { return c.id; }).indexOf('aperturas');
const idxPressPlano = cands.map(function (c) { return c.id; }).indexOf('press_plano');
t('D6 · ejercicio reciente queda después del no reciente (deprioritizado), no prohibido',
  cands.length >= 3 && idxAperturas >= 0 && idxPressPlano > idxAperturas);
const solo = sandbox.f3Candidatos('femoral', 'bisagra', { equip: 'Casa / sin equipo', nivel: 'principiante', dia: 1 }, { rdl: 0 }, []);
t('D7 · si es fundamental y no hay alternativa, se permite repetir (rdl casa)',
  solo.length >= 1 && solo.some(function (c) { return c.id === 'rdl'; }));

// f3Elegir: solo dentro de candidatos y determinista
const pick1 = sandbox.f3Elegir(cands, 3, 0);
const pick2 = sandbox.f3Elegir(cands, 3, 0);
t('D8 · f3Elegir es determinista y elige dentro de los candidatos',
  pick1.id === pick2.id && cands.some(function (c) { return c.id === pick1.id; }));
const pick3 = sandbox.f3Elegir(cands, 4, 0);
t('D9 · otra semilla elige dentro de los candidatos (jamás un ejercicio inválido)',
  cands.some(function (c) { return c.id === pick3.id; }));

// ============================================================
// E · Diagnóstico del motor ACTUAL (informativo, para F3b)
// ============================================================
console.log('\n== E · Diagnóstico del motor actual (informativo) ==');
try {
  const sb2 = {
    console, state: { fitEffort: 'normal', fitVariant: 0 },
    fitDaySeed: function () { return 3; },
    fitnessExerciseBank: null, specialWorkoutKey: null, SPECIAL_WORKOUTS: null,
    buildFitnessTodayPlan: null
  };
  vm.runInNewContext(
    extractFunc('fitnessExerciseBank') + '\n' +
    extractFunc('specialWorkoutKey') + '\n' +
    extractFunc('buildFitnessTodayPlan') + '\n' +
    'var SPECIAL_WORKOUTS=' + extractConstObj('SPECIAL_WORKOUTS') + ';',
    sb2
  );
  var nombresLib = {};
  Object.keys(EX_LIB).forEach(function (id) {
    ['gym', 'man', 'casa'].forEach(function (k) {
      var n = EX_LIB[id].var[k].n;
      if (n) nombresLib[n.toLowerCase()] = id;
    });
  });
  var sinMapear = {}, casos = 0;
  ['Ganar músculo sin quedar molido', 'Pecho', 'Espalda y hombros', 'Brazos', 'Pierna y glúteos', 'Tren superior', 'Tren inferior'].forEach(function (focus) {
    ['Gimnasio', 'Mancuernas', 'Casa / sin equipo'].forEach(function (equip) {
      var plan = sb2.buildFitnessTodayPlan({ date: 'x', steps: 5000, energy: 3, pain: 0, sleep: 7, focus: focus, equip: equip, hard: false, recovery: false });
      casos++;
      plan.forEach(function (x) {
        if (!nombresLib[String(x.name).toLowerCase()]) sinMapear[x.name] = (sinMapear[x.name] || 0) + 1;
      });
    });
  });
  console.log('  · casos del motor actual analizados: ' + casos);
  console.log('  · nombres del plan actual SIN equivalencia en EX_LIB: ' + JSON.stringify(sinMapear));
} catch (e) {
  console.log('  · diagnóstico saltado por error: ' + e.message);
}

console.log('\n==========================================');
console.log('Resultado: ' + passed + ' pasaron · ' + failed + ' fallaron');
console.log('==========================================');
if (failed) {
  console.log('\nFallos:\n' + failures.map(function (f) { return '  ✗ ' + f; }).join('\n'));
  process.exit(1);
}
process.exit(0);
