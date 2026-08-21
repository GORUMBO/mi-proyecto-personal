// ============================================================
// PRUEBAS DE REGRESIÓN PERMANENTE — "Cambiar ejercicio"
// hasta 10 alternativas compatibles + botón 🎲 Otras opciones
// (rotación sin repetir inmediatamente la misma selección).
// Está ocupado = sustitución SOLO de la sesión; No me gusta usa
// fitDislikes existente; historial/workoutLog intactos.
// Uso: node tests/fitness-alternativas.test.js
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
    // Regex literal (p. ej. /'/g): saltarlo para no desbalancear comillas
    if (c === '/' && (n === "'" || n === '"' || n === '\\') && /[\(,=:\[!&|?;{]\s*$/.test(src.slice(Math.max(0, j - 4), j))) {
      j++; while (j < src.length && !(src[j] === '/' && src[j - 1] !== '\\')) j++;
      continue;
    }
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
    // Regex literal (p. ej. /'/g): saltarlo para no desbalancear comillas
    if (c === '/' && (n === "'" || n === '"' || n === '\\') && /[\(,=:\[!&|?;{]\s*$/.test(src.slice(Math.max(0, j - 4), j))) {
      j++; while (j < src.length && !(src[j] === '/' && src[j - 1] !== '\\')) j++;
      continue;
    }
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
// Sandbox: motor + alternativas
// ============================================================
const sandbox = {
  console,
  state: { fitEffort: 'normal', fitVariant: 0, workoutLog: [], sessionFeedbacks: [], profile: {}, fitDislikes: [] },
  fitDaySeed: function () { return 3; },
  todayISO: function () { return '2026-08-17'; },
  todayLocal: function () { return '2026-08-17'; },
  save: function () {},
  renderFitnessCoach: function () {},
  renderGuidedWorkout: function () {},
  quickFitnessToday: function () {},
  alert: function () {},
  keepScroll: function (fn) { fn(); },
  safeText: function (s) { return String(s == null ? '' : s); }
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
  extractFunc('f3ActividadNormalizada') + '\n' +
  extractFunc('f3VolBand') + '\n' +
  extractFunc('f3Candidatos') + '\n' +
  extractFunc('f3Elegir') + '\n' +
  extractFunc('f3IdPorNombre') + '\n' +
  extractFunc('f3HistorialReciente') + '\n' +
  extractFunc('f3SlotsDia') + '\n' +
  extractFunc('f3SlotsExtras') + '\n' +
  extractFunc('f3TendenciaFeedback') + '\n' +
  extractFunc('f3EjerciciosDolor') + '\n' +
  extractFunc('f3ValidarPlan') + '\n' +
  extractFunc('f3ValidarPlanNombres') + '\n' +
  extractFunc('f3MaxSimilitudGuardada') + '\n' +
  extractFunc('f3AltsBanco') + '\n' +
  extractFunc('f3AltsHTML') + '\n' +
  extractFunc('f3RotarAlts') + '\n' +
  extractFunc('f3AnclarTarjeta') + '\n' +
  extractFunc('swapToFirstAlt') + '\n' +
  extractFunc('replaceFitnessExercise') + '\n' +
  extractFunc('dislikeExercise') + '\n' +
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

// ============================================================
// A · Hasta 10 alternativas válidas (banco clásico reconectado)
// ============================================================
console.log('\n== A · Hasta 10 alternativas ==');
var altPecho = sandbox.f3AltsBanco({ musc: 'pecho', equip: 'Gimnasio', nivel: 'intermedio' });
t('A1 · pecho en gimnasio tiene >=8 alternativas', altPecho.length >= 8, 'hay ' + altPecho.length);
t('A2 · todas pertenecen al mismo músculo (mapeadas a EX_LIB)',
  altPecho.every(function (n) { var id = sandbox.f3IdPorNombre(n); return !!id && EX_LIB[id].m === 'pecho'; }));
var plan = sandbox.buildFitnessTodayPlan(ctxDiario('Ganar músculo sin quedar molido', 'Gimnasio'));
t('A3 · cada ejercicio del plan trae sus alternativas amplias',
  plan.every(function (x) { return Array.isArray(x.altsCompletas) && x.altsCompletas.length >= 4; }));
t('A4 · el plan sigue siendo válido (la sustitución no rompe la generación)',
  sandbox.f3ValidarPlanNombres(plan, { objetivo: 'hipertrofia', nivel: 'intermedio', equip: 'Gimnasio' }).length === 0);
// Casa: alternativas sin máquinas
var altCasa = sandbox.f3AltsBanco({ musc: 'pecho', equip: 'Casa / sin equipo', nivel: 'intermedio' });
t('A5 · casa: alternativas sin máquinas/poleas/barra',
  altCasa.length >= 2 && altCasa.every(function (n) { return !/máquina|cable|polea|smith|prensa|barra/i.test(n); }));
// Nivel: principiante excluye ejercicios de nivel superior
var altPechoP = sandbox.f3AltsBanco({ musc: 'pecho', equip: 'Gimnasio', nivel: 'principiante' });
t('A6 · nivel principiante filtra ejercicios de mayor nivel',
  altPechoP.every(function (n) { var id = sandbox.f3IdPorNombre(n); return !!id && EX_LIB[id].lv === 1; })
  && altPechoP.indexOf('Fondos de pecho') < 0);

// ============================================================
// B · 🎲 Otras opciones: rota sin repetir inmediatamente
// ============================================================
console.log('\n== B · Otras opciones (Random) ==');
var pool10 = altPecho;
var html0 = sandbox.f3AltsHTML(0, { name: 'NO EXISTE', altsCompletas: pool10 });
var nBotones = (html0.match(/onclick="replaceFitnessExercise/g) || []).length;
t('B1 · muestra una página compacta (5) con contador de mostradas', nBotones === 5 && html0.indexOf('5 de 9 mostradas') >= 0, 'hay ' + nBotones);
t('B2 · incluye el botón 🎲 Otras opciones', html0.indexOf('🎲 Otras opciones') >= 0);
t('B3 · el layout es responsive (flex-wrap) y compacto', html0.indexOf('flex-wrap') >= 0);
// f3RotarAlts escribe en document.getElementById; usamos un stub
sandbox.document = {
  getElementById: function (id) {
    sandbox._rowEl = sandbox._rowEl || { innerHTML: '', getBoundingClientRect: function () { return { top: 0 }; } };
    return sandbox._rowEl;
  }
};
function nombresDe(html) {
  var m = html.match(/onclick="replaceFitnessExercise\(\d+,'([^']*)'\)/g) || [];
  return m.map(function (s) { return s.match(/'([^']*)'\)/)[1]; });
}
sandbox.state.fitnessToday = { plan: [{ name: 'NO EXISTE', altsCompletas: pool10 }] };
sandbox.f3RotarAlts(0);
var h1 = sandbox._rowEl.innerHTML;
var t1 = nombresDe(h1);
sandbox.f3RotarAlts(0);
var h2 = sandbox._rowEl.innerHTML;
var t2 = nombresDe(h2);
var inter = t1.filter(function (n) { return t2.indexOf(n) >= 0; });
t('B4 · 🎲 muestra OTROS ejercicios: intersección VACÍA entre lo mostrado y la pulsación',
  inter.length === 0, 'intersección: ' + inter.join(','));
t('B5 · la primera pulsación muestra el SEGUNDO bloque (4, sin repetir los 5 iniciales)',
  t1.length === 4 && (h1.match(/onclick="replaceFitnessExercise/g) || []).length === 4);
sandbox.f3RotarAlts(0); // agotado → nueva rotación (aquí sí se permite repetir)
var h3 = sandbox._rowEl.innerHTML;
var t3 = nombresDe(h3);
t('B6 · solo al AGOTAR el pool comienza una nueva rotación (continúa bloque a bloque)',
  JSON.stringify(t3) === JSON.stringify(t1) && h3.indexOf('rotación 2') >= 0);

// ============================================================
// D · CASO REAL del usuario: "Press inclinado con barra" con plan antiguo
// ============================================================
console.log('\n== D · Caso real: Press inclinado con barra ==');
sandbox.window._altRot = {}; // rotación fresca por ejercicio (como en la app real)
sandbox.state = {
  fitDislikes: [],
  profile: { nivelFit: 'intermedio' },
  fitnessToday: { ctx: { equip: 'Gimnasio' }, plan: [{ name: 'Press inclinado con barra', muscle: 'pecho' }] }
};
// Plan ANTIGUO: sin altsCompletas y con solo 3 alternativas EX_LIB
var itemAntiguo = {
  name: 'Press inclinado con barra', muscle: 'pecho',
  alts: ['Press banca con barra', 'Aperturas en máquina (pec deck)', 'Cruce de poleas']
};
var htmlD = sandbox.f3AltsHTML(0, itemAntiguo);
function nombresD(html) { var m = html.match(/onclick="replaceFitnessExercise\(\d+,'([^']*)'\)/g) || []; return m.map(function (s) { return s.match(/'([^']*)'\)/)[1]; }); }
var altsD = nombresD(htmlD);
t('D1 · el caso real ya NO se queda en 3: el banco amplio aporta 5+ alternativas',
  altsD.length >= 5, 'hay ' + altsD.length + ': ' + altsD.join(','));
t('D2 · el ejercicio actual NO aparece como alternativa (ni por alias)',
  altsD.indexOf('Press inclinado con barra') < 0
  && altsD.every(function (n) { return sandbox.f3IdPorNombre(n) !== sandbox.f3IdPorNombre('Press inclinado con barra'); }));
t('D3 · páginas disjuntas con el caso real (Página 2 sin repetir Página 1)',
  (function () {
    sandbox.window._altRot = { 0: 0 };
    sandbox._rowEl = { innerHTML: '', getBoundingClientRect: function () { return { top: 0 }; } };
    sandbox.document = { getElementById: function () { return sandbox._rowEl; } };
    sandbox.state.fitnessToday = { ctx: { equip: 'Gimnasio' }, plan: [itemAntiguo] };
    sandbox.f3RotarAlts(0);
    var p2 = nombresD(sandbox._rowEl.innerHTML);
    var inter = altsD.filter(function (n) { return p2.indexOf(n) >= 0; });
    return inter.length === 0 && p2.length >= 1;
  })());

// ============================================================
// C · Está ocupado y No me gusta
// ============================================================
console.log('\n== C · Está ocupado / No me gusta ==');
sandbox.state = { fitEffort: 'normal', fitVariant: 0, workoutLog: [{ id: 1, date: '2026-08-16', localDate: '2026-08-16', exercise: 'Press banca con barra', weight: 100, sets: 1, reps: '10' }], sessionFeedbacks: [], profile: {}, fitDislikes: [] };
sandbox.state.fitnessToday = { date: '2026-08-17', plan: [{ name: 'Press banca con barra', muscle: 'pecho', sets: 3, reps: '6-15', rest: 135, altsCompletas: pool10, alts: [] }, { name: 'Jalón al pecho', muscle: 'espalda', sets: 3, reps: '6-15', rest: 135, altsCompletas: pool10, alts: [] }] };
sandbox.swapToFirstAlt(0);
t('C1 · Está ocupado cambia SOLO ese ejercicio', sandbox.state.fitnessToday.plan[0].name !== 'Press banca con barra' && sandbox.state.fitnessToday.plan[1].name === 'Jalón al pecho');
t('C2 · el resto de la rutina y workoutLog quedan intactos',
  sandbox.state.fitnessToday.plan.length === 2 && sandbox.state.workoutLog.length === 1);
t('C3 · el ejercicio original sigue disponible para futuras rutinas (en la biblioteca del generador)',
  sandbox.f3Candidatos('pecho', 'empuje_horizontal', { equip: 'Gimnasio', nivel: 'intermedio', dia: 0 }, {}, [])
    .some(function (c) { return c.var.gym.n === 'Press banca con barra'; }));
sandbox.dislikeExercise('Press banca con barra');
t('C4 · No me gusta usa fitDislikes (sistema existente)', sandbox.state.fitDislikes.indexOf('Press banca con barra') >= 0);
var htmlD = sandbox.f3AltsHTML(0, { name: 'Press inclinado con barra', altsCompletas: pool10 });
t('C5 · las alternativas excluyen el ejercicio marcado como No me gusta', htmlD.indexOf('Press banca con barra') < 0);

console.log('\n==========================================');

// ============================================================
// E · Suficiencia de alternativas por grupo muscular (auditoria)
// Regresion del caso 'Crunch en polea' (1 alternativa) y de grupos
// con catalogo insuficiente (core, biceps, triceps).
// ============================================================
console.log('== E · Suficiencia de alternativas por grupo ==');
function poolEfectivo(musc, nombreActual, equip, nivel) {
  var b = sandbox.f3AltsBanco({ musc: musc, equip: equip, nivel: nivel });
  var idA = sandbox.f3IdPorNombre(nombreActual);
  return b.filter(function (a) {
    if (a === nombreActual) return false;
    var id = sandbox.f3IdPorNombre(a);
    return !(idA && id === idA);
  });
}
// Caso reportado: Crunch en polea debe tener VARIAS alternativas reales
var poolCrunch = poolEfectivo('core', 'Crunch en polea', 'Gimnasio', 'intermedio');
t('E1 · Crunch en polea tiene >=5 alternativas (antes solo 1)', poolCrunch.length >= 5, JSON.stringify(poolCrunch));
t('E2 · Elevación de piernas sigue entre ellas', poolCrunch.indexOf('Elevación de piernas') >= 0);
t('E3 · el ejercicio actual nunca aparece (ni por alias)',
  poolCrunch.indexOf('Crunch en polea') < 0 && poolCrunch.indexOf('Crunch suave') < 0);
t('E4 · todas las alternativas de core son del mismo musculo (core)',
  poolCrunch.every(function (n) { var id = sandbox.f3IdPorNombre(n); return !id || EX_LIB[id].m === 'core'; }));
// Todos los grupos musculares, gimnasio intermedio
var grupos = [
  ['pecho', 'Press banca con barra'], ['espalda', 'Jalón al pecho'],
  ['hombros', 'Press militar con barra'], ['biceps', 'Curl con barra'],
  ['triceps', 'Extensión de tríceps en cuerda'], ['pierna', 'Sentadilla con barra'],
  ['gluteo', 'Hip thrust con barra'], ['core', 'Crunch en polea']
];
grupos.forEach(function (g) {
  var pool = poolEfectivo(g[0], g[1], 'Gimnasio', 'intermedio');
  t('E5 · ' + g[0] + ' tiene >=5 alternativas en gimnasio', pool.length >= 5, g[0] + '=' + pool.length);
});
// Casa: el pool respeta el equipo (sin maquinas/poleas/barra) y da >=3
var poolCasa = poolEfectivo('core', 'Plancha', 'Casa / sin equipo', 'intermedio');
t('E6 · core en casa tiene >=3 alternativas sin equipo de gimnasio',
  poolCasa.length >= 3 && poolCasa.every(function (n) { return !/maquina|polea|barra|prensa|jalon|cable|press/i.test(n); }),
  JSON.stringify(poolCasa));
// El pool del HTML muestra 5 y el resto queda para Otras opciones
sandbox.window._altRot = {};
var htmlCrunch = sandbox.f3AltsHTML(0, { name: 'Crunch en polea', muscle: 'core', altsCompletas: poolCrunch });
t('E7 · el HTML muestra 5 y anuncia el resto (5 de N mostradas)',
  htmlCrunch.indexOf('5 alternativas') >= 0 && /5 de \d+ mostradas/.test(htmlCrunch), htmlCrunch.slice(0, 120));
t('E8 · Otras opciones sigue presente', htmlCrunch.indexOf('Otras opciones') >= 0);
console.log('Resultado: ' + passed + ' pasaron · ' + failed + ' fallaron');
console.log('==========================================');
if (failed) {
  console.log('\nFallos:\n' + failures.map(function (f) { return '  ✗ ' + f; }).join('\n'));
  process.exit(1);
}
process.exit(0);
