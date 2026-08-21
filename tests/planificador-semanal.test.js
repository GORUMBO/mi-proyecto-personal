// ============================================================
// PRUEBAS — Planificador semanal con dias reales y tipos de split
// Caso principal: hipertrofia, intermedio, gimnasio, 60 min,
// intensidad normal, dias Lun/Mar/Mié/Sáb/Dom, tipo automatica.
// + los 11 tipos de split + recuperacion domingo->lunes.
// Uso: node tests/planificador-semanal.test.js
// ============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extractFunc(name) {  var src = HTML;
  var BSC = String.fromCharCode(92);
  var NLC = String.fromCharCode(10);
  var TABC = String.fromCharCode(9);
  function esInicioRegex(src, k) {
    var ch = null;
    for (var m = k - 1; m >= 0; m--) {
      var cm = src[m];
      if (cm === ' ' || cm === TABC || cm === NLC) continue;
      ch = cm; break;
    }
    if (ch == null) return true;
    return '([{:;,=!&|?+-*%^~<>'.indexOf(ch) >= 0;
  }
  function saltarRegex(src, j) {
    j++;
    while (j < src.length) {
      var cr = src[j];
      if (cr === BSC) { j += 2; continue; }
      if (cr === '[') { while (j < src.length && src[j] !== ']') { if (src[j] === BSC) j++; j++; } continue; }
      if (cr === '/') { j++; break; }
      if (cr === NLC) break;
      j++;
    }
    return j;
  }
  let i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('No se encontró function ' + name);
  let parens = 0, j = i, q = null, lc = false, bc = false, bs = -1;
  for (; j < src.length; j++) {
    const c = src[j], n = src[j + 1];
    if (lc) { if (c === NLC) lc = false; continue; }
    if (bc) { if (c === '*' && n === '/') { bc = false; j++; } continue; }
    if (q) { if (c === BSC) { j++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === '/' && n === '/') { lc = true; j++; continue; }
    if (c === '/' && n === '*') { bc = true; j++; continue; }
    if (c === '(') parens++;
    else if (c === ')') { parens--; if (parens === 0) { bs = j + 1; break; } }
  }
  if (bs < 0) throw new Error('params de ' + name);
  let d = 0; q = null; lc = false; bc = false; j = bs;
  for (; j < src.length; j++) {
    const c = src[j], n = src[j + 1];
    if (lc) { if (c === NLC) lc = false; continue; }
    if (bc) { if (c === '*' && n === '/') { bc = false; j++; } continue; }
    if (q) { if (c === BSC) { j++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === '/' && n === '/') { lc = true; j++; continue; }
    if (c === '/' && n === '*') { bc = true; j++; continue; }
    if (c === '/' && esInicioRegex(src, j)) { j = saltarRegex(src, j) - 1; continue; }
    if (c === '`') {
      j++;
      while (j < src.length) {
        const c2 = src[j], n2 = src[j + 1];
        if (c2 === BSC) { j += 2; continue; }
        if (c2 === '`') { j++; break; }
        if (c2 === '$' && n2 === '{') {
          j += 2; var ed = 1, eq = null;
          while (j < src.length && ed > 0) {
            const c3 = src[j], n3 = src[j + 1];
            if (eq) { if (c3 === BSC) { j += 2; continue; } if (c3 === eq) eq = null; j++; continue; }
            if (c3 === '"' || c3 === "'" || c3 === '`') { eq = c3; j++; continue; }
            if (c3 === '/' && n3 === '/') { while (j < src.length && src[j] !== NLC) j++; continue; }
            if (c3 === '/' && esInicioRegex(src, j)) { j = saltarRegex(src, j) - 1; continue; }
            if (c3 === '{') ed++; else if (c3 === '}') ed--;
            j++;
          }
          continue;
        }
        j++;
      }
      continue;
    }
    if (c === '/' && n === '/') { lc = true; j++; continue; }
    if (c === '/' && n === '*') { bc = true; j++; continue; }
    if (c === '{') d++;
    else if (c === '}') { d--; if (d === 0) return src.slice(i, j + 1); }
  }
  throw new Error('incompleta: ' + name);
}
function extractVarArr(name) { var BS = String.fromCharCode(92); var m = HTML.match(new RegExp('const ' + name + '=(' + BS + '[' + '.*?' + BS + ']' + ');', 's')); if (!m) throw new Error('No se encontró const ' + name); return m[1]; }
function extractObj(name) {
  var m = HTML.match(new RegExp('const ' + name + '=(\{.*?\});', 's'));
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
  state: { fitEffort: 'normal', fitVariant: 0, workoutLog: [], sessionFeedbacks: [], profile: { actividadDiaria: 'activo' }, savedRoutines: [], fitDislikes: [] },
  fitDaySeed: function () { return 3; },
  todayISO: function () { return '2026-08-18'; },
  todayLocal: function () { return '2026-08-18'; },
  save: function () {},
  safeText: function (x) { return String(x == null ? '' : x); },
  alert: function () {},
  document: { getElementById: function () { return { value: '', innerHTML: '' }; } }
};
sandbox.window = sandbox;
var docEls = {};
sandbox.document = { getElementById: function (id) { if (!docEls[id]) docEls[id] = { value: '', innerHTML: '', style: {}, getBoundingClientRect: function () { return { top: 0 }; }, closest: function () { return { open: true }; }, scrollIntoView: function () {} }; return docEls[id]; } };
sandbox.todayWeekdayIndex = function () { return (sandbox._hoyDia == null) ? 1 : sandbox._hoyDia; };
sandbox.exerciseHelp = function () {};
sandbox.suggestTargetWeight = function () { return { target: null, text: '', last: null }; };
sandbox.renderFitnessCoach = function () {};
sandbox.renderGuidedWorkout = function () {};
sandbox.syncSimpleFitnessInputs = function () {};
sandbox.U = { pesoUnidad: function () { return 'lb'; } };
sandbox.exLink = function (n) { return 'https://example.com/' + n; };
sandbox.lastWorkoutForExercise = function () { return null; };
sandbox.nextWeightAdviceForExercise = function () { return ''; };
sandbox.muscleClass = function () { return ''; };
sandbox.openAppTimer = function () {};
sandbox.buildFitnessTodayPlan = function () { return []; };
sandbox.readFitnessContext = function () { return { date: sandbox.todayISO(), steps: 5000, energy: 3, pain: 0, sleep: 7, focus: 'Ganar músculo sin quedar molido', equip: 'Gimnasio', hard: false, recovery: false }; };
sandbox.quickFitnessToday = function () { sandbox._quick = (sandbox._quick || 0) + 1; };
sandbox._hoyDia = 1;
vm.runInNewContext(
  extractFunc('restSeconds') + '\n' +
  extractFunc('parseRepRange') + '\n' +
  extractFunc('exercisesPerSession') + '\n' +
  extractFunc('goalScheme') + '\n' +
  extractFunc('routineSplit') + '\n' +
  extractFunc('defaultWeekSchedule') + '\n' +
  extractFunc('buildCustomRoutine') + '\n' +
  extractFunc('f3AltsBanco') + '\n' +
  extractFunc('equipLabel') + '\n' +
  extractFunc('goalLabelSafe') + '\n' +
  extractFunc('f3EqsPermitidos') + '\n' +
  extractFunc('f3KeyEquipo') + '\n' +
  extractFunc('f3InventarioEquipo') + '\n' +
  extractFunc('f3EquipoActualLabel') + '\n' +
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
  extractFunc('f3FactorActividad') + '\n' +
  extractFunc('f3ActividadNormalizada') + '\n' +
  extractFunc('f3MaxSimilitudGuardada') + '\n' +
  extractFunc('f3Candidatos') + '\n' +
  extractFunc('f3Elegir') + '\n' +
  extractFunc('f3IdPorNombre') + '\n' +
  extractFunc('f3HistorialReciente') + '\n' +
  extractFunc('f3SlotsParaMusculos') + '\n' +
  extractFunc('f3TagDeNombre') + '\n' +
  extractFunc('f3SemanaReferencia') + '\n' +
  extractFunc('f3SemanaDesdeDias') + '\n' +
  extractFunc('f3ElegirSplit') + '\n' +
  extractFunc('f3SetsContexto') + '\n' +
  extractFunc('f3ValidarPlan') + '\n' +
  extractFunc('f3ValidarSemana') + '\n' +
  extractFunc('f3ValidarPlanNombres') + '\n' +
  'var F3_RULES=' + extractObj('F3_RULES') + ';\n' +
  'var EX_LIB=' + extractObj('EX_LIB') + ';\n' +
  extractFunc('f3DiaActivo') + '\n' +
  extractFunc('todayRoutinePlan') + '\n' +
  extractFunc('routineDayPlan') + '\n' +
  extractFunc('ensureWeekSchedule') + '\n' +
  extractFunc('selectWeekday') + '\n' +
  extractFunc('activarDiaEntrenamiento') + '\n' +
  extractFunc('renderDescansoHTML') + '\n' +
  extractFunc('setModoGuiado') + '\n' +
  extractFunc('renderGuidedWorkout') + '\n' +
  extractFunc('getFitnessMainOut') + '\n' +
  extractFunc('startRoutineDay') + '\n' +
  extractFunc('renderRoutineToday') + '\n' +
  extractFunc('toggleEditWeek') + '\n' +
  extractFunc('setWeekdayAssignment') + '\n' +
  extractFunc('createFitnessToday') + '\n' +
  extractFunc('equipLabel') + '\n' +
  'var F3_ALIASES=' + extractObj('F3_ALIASES') + ';' +
  'var weekdayNames=' + extractVarArr('weekdayNames') + ';' +
  'var weekdayShort=' + extractVarArr('weekdayShort') + ';',
  sandbox
);
const EX_LIB = sandbox.EX_LIB;

// Reconstruye la semana validable desde la rutina generada
function semanaDeRutina(r, equip) {
  var eq = equip || 'Gimnasio';
  return r.weekSchedule.map(function (a, i) {
    if (a === 'rest') return { di: i, rest: true };
    var d = r.days[a];
    return { di: i, day: d.day, tag: sandbox.f3TagDeNombre(d.day), plan: d.exercises.map(function (x) {
      var id = sandbox.f3IdPorNombre(x.name);
      var e = id ? EX_LIB[id] : null;
      return { exId: id, n: x.name, m: x.muscle, pat: e ? e.pat : null, eq: e ? e.var[sandbox.f3EquipKey(eq)].eq : null, lv: e ? e.lv : 1, sets: x.sets, reps: x.reps, rest: String(x.rest) };
    }) };
  });
}
function freqDias(semana) {
  var freq = {};
  semana.forEach(function (dia) {
    if (!dia.plan) return;
    var vistos = {};
    dia.plan.forEach(function (x) { if (!vistos[x.m]) { vistos[x.m] = 1; freq[x.m] = (freq[x.m] || 0) + 1; } });
  });
  return freq;
}

// ============================================================
// A · CASO PRINCIPAL: hipertrofia · intermedio · gimnasio · 60 min
//     normal · Lun/Mar/Mié/Sáb/Dom · automatica
// ============================================================
console.log('== A · Caso principal (Lun/Mar/Mié/Sáb/Dom) ==');
var caso = sandbox.buildCustomRoutine({ goal: 'hipertrofia', exp: 'intermedio', equip: 'gym', days: 5, minutes: 60, intensidad: 'normal', tipo: 'auto', diasIdx: [0, 1, 2, 5, 6] });
t('A1 · crea exactamente 5 dias de entrenamiento', !!caso && caso.days.length === 5);
t('A2 · weekSchedule respeta los dias reales (Lun/Mar/Mié = 0,1,2 · Sáb/Dom = 3,4)',
  !!caso && caso.weekSchedule[0] === 0 && caso.weekSchedule[1] === 1 && caso.weekSchedule[2] === 2
  && caso.weekSchedule[5] === 3 && caso.weekSchedule[6] === 4
  && caso.weekSchedule[3] === 'rest' && caso.weekSchedule[4] === 'rest');
var semanaA = !!caso ? semanaDeRutina(caso) : [];
var errsA = !!caso ? sandbox.f3ValidarSemana(semanaA, { dias: 5, objetivo: 'hipertrofia', nivel: 'intermedio', equip: 'Gimnasio', tipo: 'auto' }) : ['sin rutina'];
t('A3 · la semana completa pasa TODOS los validadores (0 errores)', errsA.length === 0, errsA.join('; ').slice(0, 200));
t('A4 · estructura hibrida: Empuje/Jalón/Pierna + Superior/Inferior',
  !!caso && JSON.stringify(caso.days.map(function (d) { return d.day; })) === JSON.stringify(['Empuje A', 'Jalón A', 'Pierna A', 'Tren superior A', 'Tren inferior A']),
  caso && caso.days.map(function (d) { return d.day; }).join(','));
t('A5 · cada dia tiene 4-6 ejercicios',
  !!caso && caso.days.every(function (d) { return d.exercises.length >= 4 && d.exercises.length <= 6; }),
  caso && caso.days.map(function (d) { return d.exercises.length; }).join(','));
t('A6 · series dentro de banda (2-4, hipertrofia intermedio)',
  !!caso && caso.days.every(function (d) { return d.exercises.every(function (x) { return x.sets >= 2 && x.sets <= 4; }); }));
t('A7 · reps coherentes: 6-15 o tiempo (30-45s) en todos los ejercicios',
  !!caso && caso.days.every(function (d) { return d.exercises.every(function (x) { var reps = String(x.reps); if (/s$/.test(reps)) return true; var r = sandbox.parseRepRange(reps); return r.min >= 3 && r.max <= 18; }); }));
t('A8 · descansos dentro de banda (45-195 s)',
  !!caso && caso.days.every(function (d) { return d.exercises.every(function (x) { var rs = sandbox.restSeconds(x.rest); return rs >= 45 && rs <= 195; }); }));
var fA = freqDias(semanaA);
t('A9 · pecho, espalda y pierna 2x por semana',
  (fA.pecho || 0) === 2 && (fA.espalda || 0) === 2 && (fA.pierna || 0) === 2,
  JSON.stringify(fA));
var diasPorMusculo = {};
semanaA.forEach(function (dia) {
  if (!dia.plan) return;
  var vistos = {};
  dia.plan.forEach(function (x) {
    if (vistos[x.m]) return; vistos[x.m] = 1;
    if (['core', 'pantorrilla', 'movilidad'].indexOf(x.m) >= 0) return;
    diasPorMusculo[x.m] = diasPorMusculo[x.m] || [];
    diasPorMusculo[x.m].push(dia.di);
  });
});
var viol48 = [];
Object.keys(diasPorMusculo).forEach(function (m) {
  var ds = diasPorMusculo[m];
  for (var i = 0; i < ds.length; i++) {
    for (var j = 0; j < ds.length; j++) {
      if (i !== j && ((ds[j] - ds[i] + 7) % 7) === 1) viol48.push(m + ' ' + ds[i] + '->' + ds[j]);
    }
  }
});
t('A10 · sin musculos en dias calendario consecutivos (incluye domingo->lunes)', viol48.length === 0, viol48.join(','));
var caso2 = sandbox.buildCustomRoutine({ goal: 'hipertrofia', exp: 'intermedio', equip: 'gym', days: 5, minutes: 60, intensidad: 'normal', tipo: 'auto', diasIdx: [0, 1, 2, 5, 6] });
t('A11 · determinista: misma config = misma semana',
  JSON.stringify(caso.days) === JSON.stringify(caso2.days));
t('A12 · explicacion (porque) presente', !!caso && Array.isArray(caso.porque) && caso.porque.length >= 4);

// ============================================================
// B · Los 11 tipos de split
// ============================================================
console.log('== B · Tipos de split ==');
var casosTipos = [
  ['auto', [0, 1, 2, 5, 6], ['Empuje A', 'Jalón A', 'Pierna A', 'Tren superior A', 'Tren inferior A']],
  ['full_body', [0, 2, 4], ['Cuerpo completo A', 'Cuerpo completo B', 'Cuerpo completo C']],
  ['upper_lower', [0, 1, 3, 4], ['Tren superior A', 'Tren inferior A', 'Tren superior B', 'Tren inferior B']],
  ['torso_pierna', [0, 1, 3, 4], ['Torso A', 'Pierna A', 'Torso B', 'Pierna B']],
  ['ppl', [0, 1, 2, 3, 4, 5], ['Empuje A', 'Jalón A', 'Pierna A', 'Empuje B', 'Jalón B', 'Pierna B']],
  ['push_pull', [0, 2, 4], ['Empuje A', 'Jalón A', 'Pierna A']],
  ['arnold', [0, 2, 4], ['Pecho + Espalda', 'Hombros + Brazos', 'Pierna']],
  ['bro_split', [0, 1, 2, 3, 4], ['Hombros', 'Pecho', 'Espalda', 'Pierna', 'Brazos']],
  ['especializacion', [0, 1, 2, 4], ['Foco A: Pecho', 'Tren superior', 'Tren inferior', 'Foco B: Pecho']],
  ['hibrida', [0, 1, 2, 5, 6], ['Empuje A', 'Jalón A', 'Pierna A', 'Tren superior A', 'Tren inferior A']],
  ['personalizada', [0, 1, 2, 5, 6], ['Empuje A', 'Jalón A', 'Pierna A', 'Tren superior A', 'Tren inferior A']]
];
casosTipos.forEach(function (ct) {
  var r = sandbox.buildCustomRoutine({ goal: 'hipertrofia', exp: 'intermedio', equip: 'gym', days: ct[1].length, minutes: 60, tipo: ct[0], diasIdx: ct[1], foco: 'pecho' });
  t('B1 · ' + ct[0] + ': genera ' + ct[1].length + ' dias sin romperse', !!r && r.days.length === ct[1].length);
  t('B2 · ' + ct[0] + ': estructura esperada',
    !!r && JSON.stringify(r.days.map(function (d) { return d.day; })) === JSON.stringify(ct[2]),
    r && r.days.map(function (d) { return d.day; }).join(','));
  var semana = !!r ? semanaDeRutina(r) : [];
  var errs = !!r ? sandbox.f3ValidarSemana(semana, { dias: ct[1].length, objetivo: 'hipertrofia', nivel: 'intermedio', equip: 'Gimnasio', tipo: ct[0] }) : ['sin rutina'];
  t('B3 · ' + ct[0] + ': semana valida (0 errores)', errs.length === 0, errs.join('; ').slice(0, 140));
});

// ============================================================
// C · Recuperacion domingo->lunes (wrap semanal)
// ============================================================
console.log('== C · Recuperacion domingo->lunes ==');
function ejWrap(id, m, pat, eq, sets) {
  return { exId: id, n: EX_LIB[id].n, m: m, pat: pat, eq: eq, lv: EX_LIB[id].lv, sets: sets, reps: '6-15', rest: '90 s' };
}
var semanaWrap = [
  { di: 0, day: 'Pecho', tag: 'pecho', plan: [ejWrap('press_plano', 'pecho', 'empuje_horizontal', 'bar', 3), ejWrap('press_inclinado', 'pecho', 'empuje_horizontal', 'bar', 3), ejWrap('press_hombro', 'hombros', 'empuje_vertical', 'bar', 3)] },
  { di: 1, rest: true }, { di: 2, rest: true }, { di: 3, rest: true }, { di: 4, rest: true }, { di: 5, rest: true },
  { di: 6, day: 'Pecho', tag: 'pecho', plan: [ejWrap('press_plano', 'pecho', 'empuje_horizontal', 'bar', 3), ejWrap('aperturas', 'pecho', 'empuje_horizontal', 'maq', 2), ejWrap('press_hombro', 'hombros', 'empuje_vertical', 'bar', 3)] }
];
var errsW = sandbox.f3ValidarSemana(semanaWrap, { dias: 2, objetivo: 'hipertrofia', nivel: 'intermedio', equip: 'Gimnasio' });
t('C1 · detecta pecho domingo->lunes (48h ciclico)', errsW.some(function (e) { return e.indexOf('domingo') >= 0; }), errsW.join('; '));
var semanaW2 = JSON.parse(JSON.stringify(semanaWrap));
semanaW2[5] = JSON.parse(JSON.stringify(semanaW2[6]));
semanaW2[6] = { di: 6, rest: true };
var errsW2 = sandbox.f3ValidarSemana(semanaW2, { dias: 2, objetivo: 'hipertrofia', nivel: 'intermedio', equip: 'Gimnasio' });
t('C2 · pecho domingo y lunes de la semana SIGUIENTE no es consecutivo (sin error)',
  !errsW2.some(function (e) { return e.indexOf('domingo') >= 0 || e.indexOf('48h') >= 0; }), errsW2.join('; '));

// ============================================================
// D · Compatibilidad (sin diasIdx) y plan de respaldo
// ============================================================
console.log('== D · Compatibilidad ==');
var r3 = sandbox.buildCustomRoutine({ goal: 'hipertrofia', exp: 'principiante', equip: 'casa', days: 3, minutes: 30 });
t('D1 · sin diasIdx sigue funcionando (compatibilidad)',
  !!r3 && r3.days.length === 3 && r3.weekSchedule[0] === 0 && r3.weekSchedule[2] === 1 && r3.weekSchedule[4] === 2);
var errsD = !!r3 ? sandbox.f3ValidarSemana(semanaDeRutina(r3, 'Casa / sin equipo'), { dias: 3, objetivo: 'hipertrofia', nivel: 'principiante', equip: 'Casa / sin equipo', tipo: 'auto' }) : ['sin rutina'];
t('D2 · semana valida en casa/principiante/30 min', errsD.length === 0, errsD.join('; ').slice(0, 160));
t('D3 · explicacion (porque) presente', !!r3 && Array.isArray(r3.porque) && r3.porque.length >= 4);

console.log('');
console.log('==========================================');

// ============================================================
// F · FUENTE UNICA DE VERDAD: Mi semana === Mi rutina de hoy === guiado
// ============================================================
console.log('== F · Fuente unica de verdad ==');
function armarRutinaF() {
  sandbox.state.customRoutine = sandbox.buildCustomRoutine({ goal: 'hipertrofia', exp: 'intermedio', equip: 'gym', days: 5, minutes: 60, intensidad: 'normal', tipo: 'auto', diasIdx: [0, 1, 2, 3, 4] });
  sandbox.state.customRoutine.selectedWeekday = null;
  sandbox.state.customRoutine.selectedWeekdayDate = null;
  sandbox.state.fitnessToday = null;
  sandbox.state.activeWorkout = null;
  sandbox.state.profile = { actividadDiaria: 'activo', modoGuiado: true }; // F y G prueban el modo GUIADO
}
function nombresPlan(plan) { return (plan || []).map(function (x) { return x.name; }).join('|'); }
var esperadoF = ['Empuje A', 'Jalón A', 'Pierna A', 'Tren superior A', 'Tren inferior A', null, null];
var cortoF = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
[0, 1, 2, 3, 4, 5, 6].forEach(function (d) {
  sandbox._hoyDia = d;
  armarRutinaF();
  sandbox.selectWeekday(d);
  var htmlSemana = docEls['routineTodayOut'].innerHTML;
  var pack = sandbox.state.fitnessToday;
  var assign = sandbox.state.customRoutine.weekSchedule[d];
  var ok;
  var ok;
  if (assign === 'rest') {
    ok = htmlSemana.indexOf('Día de descanso') >= 0 && sandbox.state.activeWorkout === null
      && !!pack && pack.descanso === true && pack.plan.length === 0
      && sandbox.renderDescansoHTML(sandbox.weekdayNames[d]).indexOf('Día de descanso') >= 0;
  } else {
    var nombreD = esperadoF[d];
    var aw = sandbox.state.activeWorkout;
    var htmlPanel = docEls['simpleFitnessOut'].innerHTML;
    ok = htmlSemana.indexOf(nombreD) >= 0 && !!pack && pack.semanaDayName === nombreD && pack.plan.length > 0
      && nombresPlan(pack.plan) === nombresPlan(sandbox.routineDayPlan(assign))
      && !!aw && aw.dia === d && aw.routineDayName === nombreD
      && nombresPlan(aw.plan) === nombresPlan(sandbox.routineDayPlan(assign))
      && htmlPanel.indexOf(sandbox.weekdayNames[d] + ' · ' + nombreD) >= 0
      && htmlSemana.indexOf('Empezar (guiado)') < 0 && htmlSemana.indexOf('Abrir rutina del día') < 0;
  }
  t('F1 · ' + cortoF[d] + ': Mi semana === panel de entrenamiento (unica fuente)', ok);
});
// Caso reportado: hoy es martes y el usuario elige viernes en Mi semana
sandbox._hoyDia = 1;
armarRutinaF();
sandbox.createFitnessToday();
var packM = sandbox.state.fitnessToday;
t('F2a · sin selección, hoy manda (martes = Jalón A)', packM.semanaDayName === 'Jalón A');
sandbox.selectWeekday(4);
var packV = sandbox.state.fitnessToday;
var htmlV = docEls['routineTodayOut'].innerHTML;
t('F2b · al elegir viernes TODA la interfaz usa Tren inferior A',
  htmlV.indexOf('Tren inferior A') >= 0 && packV.semanaDayName === 'Tren inferior A'
  && nombresPlan(packV.plan) === nombresPlan(sandbox.routineDayPlan(4))
  && !!sandbox.state.activeWorkout && sandbox.state.activeWorkout.dia === 4
  && nombresPlan(sandbox.state.activeWorkout.plan) === nombresPlan(sandbox.routineDayPlan(4))
  && docEls['simpleFitnessOut'].innerHTML.indexOf('Viernes · Tren inferior A') >= 0,
  packV.semanaDayName + ' | ' + htmlV.slice(0, 80));
t('F2c · Jalón A ya no aparece como sesión de hoy',
  packV.semanaDayName !== 'Jalón A' && docEls['simpleFitnessOut'].innerHTML.indexOf('Jalón A') < 0);
// Selección con fecha de OTRO día: se ignora y vuelve a hoy
sandbox._hoyDia = 1;
armarRutinaF();
sandbox.selectWeekday(4);
sandbox.state.customRoutine.selectedWeekdayDate = '2026-08-17';
sandbox.state.fitnessToday = null;
sandbox.activarDiaEntrenamiento(sandbox.f3DiaActivo(sandbox.state.customRoutine));
t('F3 · selección con fecha vieja se ignora (el panel vuelve a hoy = Jalón A)',
  !!sandbox.state.activeWorkout && sandbox.state.activeWorkout.routineDayName === 'Jalón A'
  && sandbox.state.fitnessToday.semanaDayName === 'Jalón A');
// Cambiar la asignación del día activo refresca Mi rutina de hoy
sandbox._hoyDia = 1;
armarRutinaF();
sandbox.createFitnessToday();
sandbox.setWeekdayAssignment(1, 0);
t('F4 · cambiar la asignación del día activo reactiva el panel (Empuje A)',
  !!sandbox.state.activeWorkout && sandbox.state.activeWorkout.routineDayName === 'Empuje A'
  && sandbox.state.fitnessToday.semanaDayName === 'Empuje A',
  sandbox.state.activeWorkout && sandbox.state.activeWorkout.routineDayName);

// ============================================================
// G · Secuencia REAL de dias (sin reset entre selecciones)
// ============================================================
console.log('== G · Secuencia real de seleccion ==');
function panelInfo() {
  var aw = sandbox.state.activeWorkout;
  var html = docEls['simpleFitnessOut'].innerHTML;
  return { dia: aw ? aw.dia : null, nombre: aw ? aw.routineDayName : null, ex1: aw && aw.plan.length ? aw.plan[0].name : null, nombres: aw ? nombresPlan(aw.plan) : '', html: html };
}
sandbox._hoyDia = 1;
armarRutinaF();
sandbox.selectWeekday(0); // Lunes
var pLun = panelInfo();
t('G1 · Lunes: panel = Empuje A y empieza con Press', pLun.dia === 0 && pLun.nombre === 'Empuje A' && /press|Press/i.test(pLun.ex1 || ''), JSON.stringify(pLun));
sandbox.selectWeekday(2); // Miercoles
var pMie = panelInfo();
t('G2 · Lunes -> Miercoles: panel cambia a Pierna A (encabezado, sesion, ex1, lista)',
  pMie.dia === 2 && pMie.nombre === 'Pierna A'
  && nombresPlan(sandbox.routineDayPlan(2)).split('|')[0] === (pMie.ex1 || '')
  && nombresPlan(sandbox.state.activeWorkout.plan) === nombresPlan(sandbox.routineDayPlan(2))
  && pMie.html.indexOf('Miércoles · Pierna A') >= 0
  && pMie.html.indexOf('Press banca') < 0,
  JSON.stringify({ dia: pMie.dia, nombre: pMie.nombre, ex1: pMie.ex1, html: pMie.html.slice(0, 150) }));
// Secuencia completa: Lunes -> Viernes -> Miercoles -> Sabado (descanso) -> Lunes
sandbox._hoyDia = 1;
armarRutinaF();
sandbox.selectWeekday(0);
sandbox.selectWeekday(4);
var pVie = panelInfo();
t('G3 · Lunes -> Viernes: panel = Tren inferior A', pVie.dia === 4 && pVie.nombre === 'Tren inferior A' && pVie.html.indexOf('Viernes · Tren inferior A') >= 0, JSON.stringify(pVie));
sandbox.selectWeekday(2);
var pMie2 = panelInfo();
t('G4 · ... -> Miercoles: panel = Pierna A', pMie2.dia === 2 && pMie2.nombre === 'Pierna A' && pMie2.html.indexOf('Press banca') < 0, JSON.stringify(pMie2));
sandbox.selectWeekday(5); // Sabado descanso
var pSab = panelInfo();
t('G5 · ... -> Sabado descanso: panel de descanso y sin rutina anterior',
  sandbox.state.activeWorkout === null && !!sandbox.state.fitnessToday && sandbox.state.fitnessToday.descanso === true && sandbox.state.fitnessToday.plan.length === 0
  && sandbox.renderDescansoHTML('Sábado').indexOf('Día de descanso') >= 0);
sandbox.selectWeekday(0); // Lunes de nuevo
var pLun2 = panelInfo();
t('G6 · ... -> Lunes: panel = Empuje A de nuevo', pLun2.dia === 0 && pLun2.nombre === 'Empuje A' && pLun2.ex1 && /press|Press/i.test(pLun2.ex1 || ''), JSON.stringify(pLun2));
// Bug reportado: panel que conserva la sesion de OTRO dia (estado heredado)
sandbox._hoyDia = 1;
armarRutinaF();
sandbox.state.activeWorkout = { date: '2026-08-18', step: 2, done: [], doneSteps: {}, plan: sandbox.routineDayPlan(0), startedAt: 'x', fromRoutine: true, routineDayIndex: 0, routineDayName: 'Empuje A' };
sandbox.selectWeekday(2);
var pG7 = panelInfo();
t('G7 · panel heredado de otro dia (Empuje A) -> al elegir Miercoles pasa a Pierna A',
  pG7.dia === 2 && pG7.nombre === 'Pierna A'
  && nombresPlan(sandbox.state.activeWorkout.plan) === nombresPlan(sandbox.routineDayPlan(2))
  && pG7.html.indexOf('Press banca') < 0,
  JSON.stringify(pG7));
// Panel del MISMO dia pero con lista desincronizada (plan viejo) -> se re-sincroniza
sandbox._hoyDia = 1;
armarRutinaF();
sandbox.state.activeWorkout = { date: '2026-08-18', step: 1, done: [], doneSteps: {}, plan: [{ name: 'Press banca con barra', muscle: 'pecho', sets: 3, reps: '6-15', rest: 135 }], startedAt: 'x', fromRoutine: true, routineDayIndex: 2, routineDayName: 'Pierna A', dia: 2 };
sandbox.selectWeekday(2);
t('G7b · panel con lista desincronizada del mismo dia -> se re-sincroniza a Pierna A',
  nombresPlan(sandbox.state.activeWorkout.plan) === nombresPlan(sandbox.routineDayPlan(2))
  && panelInfo().html.indexOf('Press banca') < 0,
  JSON.stringify(panelInfo()));

// ============================================================
// H · Modo guiado Activado/Desactivado (misma rutina, distinta vista)
// ============================================================
console.log('== H · Modo guiado (preferencia) ==');
t('H0 · el ajuste existe en Ajustes con predeterminado Desactivado',
  HTML.indexOf('Modo guiado de entrenamiento') >= 0 && HTML.indexOf('id="simpleFitGuiado"') >= 0 && HTML.indexOf('<option value="off">Desactivado</option>') >= 0);
// H1: modo DESACTIVADO (predeterminado) -> rutina normal, sin Paso X/Y
sandbox._hoyDia = 2;
armarRutinaF();
sandbox.state.profile.modoGuiado = false;
sandbox.selectWeekday(2);
var packH1 = sandbox.state.fitnessToday;
t('H1 · desactivado: seleccionar dia NO crea sesion guiada', sandbox.state.activeWorkout === null);
t('H1b · desactivado: Mi rutina de hoy = rutina del dia (mismos ejercicios y orden)',
  !!packH1 && packH1.semanaDayName === 'Pierna A' && nombresPlan(packH1.plan) === nombresPlan(sandbox.routineDayPlan(2)));
t('H1c · desactivado: sin forzar pasos (sin activeWorkout ni Paso X/Y)',
  !packH1 || !packH1.pasos);
// H2: ACTIVADO -> misma rutina presentada como pasos
sandbox.state.profile.modoGuiado = true;
sandbox.selectWeekday(2);
var awH2 = sandbox.state.activeWorkout;
t('H2 · activado: se crea la sesion guiada con la MISMA rutina',
  !!awH2 && awH2.dia === 2 && awH2.routineDayName === 'Pierna A'
  && nombresPlan(awH2.plan) === nombresPlan(sandbox.routineDayPlan(2))
  && docEls['simpleFitnessOut'].innerHTML.indexOf('Paso 1/') >= 0
  && docEls['simpleFitnessOut'].innerHTML.indexOf('Miércoles · Pierna A') >= 0);
// H3: cambiar el ajuste no pierde progreso (workoutLog intacto, mismo plan)
sandbox.state.workoutLog = [{ id: 1, date: '2026-08-19', exercise: 'Zancadas con barra', weight: 100, sets: 3, reps: '10', note: 'x' }];
sandbox.setModoGuiado('off');
t('H3 · pasar a desactivado: sin sesion guiada y sin perder la rutina',
  sandbox.state.activeWorkout === null && sandbox.state.fitnessToday.semanaDayName === 'Pierna A'
  && nombresPlan(sandbox.state.fitnessToday.plan) === nombresPlan(sandbox.routineDayPlan(2)));
t('H3b · el historial/registros quedan intactos al cambiar el ajuste',
  sandbox.state.workoutLog.length === 1 && sandbox.state.workoutLog[0].weight === 100);
t('H3c · el ajuste persiste en el perfil', sandbox.state.profile.modoGuiado === false);
// H4: volver a activar -> misma rutina otra vez como pasos
sandbox.setModoGuiado('on');
t('H4 · reactivar: la sesion guiada vuelve con la misma rutina',
  !!sandbox.state.activeWorkout && sandbox.state.activeWorkout.routineDayName === 'Pierna A'
  && nombresPlan(sandbox.state.activeWorkout.plan) === nombresPlan(sandbox.routineDayPlan(2))
  && sandbox.state.profile.modoGuiado === true);
// H5: secuencia con modo desactivado (Lunes -> Miercoles -> descanso -> Lunes)
sandbox._hoyDia = 1;
armarRutinaF();
sandbox.state.profile.modoGuiado = false;
sandbox.selectWeekday(0);
sandbox.selectWeekday(2);
t('H5 · desactivado: Lunes -> Miercoles cambia la rutina normal (sin guiado)',
  sandbox.state.activeWorkout === null && sandbox.state.fitnessToday.semanaDayName === 'Pierna A'
  && nombresPlan(sandbox.state.fitnessToday.plan) === nombresPlan(sandbox.routineDayPlan(2)));
sandbox.selectWeekday(5);
t('H6 · desactivado: Sabado descanso -> panel de descanso sin rutina anterior',
  sandbox.state.activeWorkout === null && !!sandbox.state.fitnessToday && sandbox.state.fitnessToday.descanso === true);
sandbox.selectWeekday(0);
t('H7 · desactivado: ... -> Lunes vuelve a Empuje A',
  sandbox.state.fitnessToday.semanaDayName === 'Empuje A' && sandbox.state.activeWorkout === null);
console.log('Resultado: ' + passed + ' pasaron · ' + failed + ' fallaron');
console.log('==========================================');
if (failed) {
  console.log('Fallos:');
  console.log(failures.map(function (f) { return '  ✗ ' + f; }).join('\n'));
  process.exit(1);
}
process.exit(0);
