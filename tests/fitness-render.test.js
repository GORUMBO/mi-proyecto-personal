// ============================================================
// PRUEBAS v1.187.1 — RENDER REAL (DOM stub) de la rutina de hoy
// y de "Ver progreso". Ejecuta quickFitnessToday/renderSimpleFitnessProgress
// de verdad y verifica el HTML producido, no solo funciones aisladas.
// Uso: node tests/fitness-render.test.js
// ============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extractFunc(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('No se encontró function ' + name);
  let depth = 0, j = i, q = null, tplStack = [];
  for (; j < src.length; j++) {
    const c = src[j];
    if (q === '`') {
      if (c === '\\') { j++; continue; }
      if (c === '`') { q = null; continue; }
      if (c === '$' && src[j + 1] === '{') { j += 2; tplStack.push(depth); depth++; q = null; continue; } // expresión ${…} (se parsea como código)
      continue;
    }
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    // Regex literal con comillas (p. ej. /'/g): saltarlo para no desbalancear q.
    if (c === '/' && (src[j + 1] === "'" || src[j + 1] === '"' || src[j + 1] === '\\') && /[\(,=:\[!&|?;{+\-*%~^<>]\s*$/.test(src.slice(Math.max(0, j - 4), j))) {
      j++;
      while (j < src.length && !(src[j] === '/' && src[j - 1] !== '\\')) j++;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (tplStack.length && depth === tplStack[tplStack.length - 1]) { tplStack.pop(); q = '`'; } // cerró la expresión ${…}: volver al template
      if (depth === 0) return src.slice(i, j + 1);
    }
  }
  throw new Error('incompleta: ' + name);
}

// ---- DOM stub ----
const fakeEls = {};
function makeEl(id) {
  return {
    id, value: '', innerHTML: '', textContent: '', style: {}, open: false,
    getBoundingClientRect: function () { return { top: 0 }; },
    scrollIntoView: function () {}, focus: function () {},
    querySelector: function () { return null; }, querySelectorAll: function () { return []; },
    appendChild: function () {}, setAttribute: function () {}, remove: function () {}
  };
}
const documentStub = {
  getElementById: function (id) { if (!fakeEls[id]) fakeEls[id] = makeEl(id); return fakeEls[id]; },
  querySelector: function (sel) { if (sel === '.fit-list-compact' && sandbox._vistaRutina) return { id: 'vistaRutina' }; return null; },
  querySelectorAll: function () { return []; },
  createElement: function () { return makeEl('_dyn' + Object.keys(fakeEls).length); },
  addEventListener: function () {},
  head: { appendChild: function () {} },
  body: { appendChild: function () {}, scrollTop: 0 },
  documentElement: { scrollTop: 0 }
};

const sandbox = {
  console,
  document: documentStub,
  todayISO: function () { return '2026-08-14'; },
  todayLocal: function () { return sandbox._hoyLocal; },
  safeText: function (s) { return String(s == null ? '' : s); },
  exLink: function (n) { return 'https://example.com/' + encodeURIComponent(n); },
  U: {
    pesoUnidad: function () { return 'lb'; },
    peso: function (x) { return x + ' lb'; }
  },
  setTimeout: function (fn) { try { fn(); } catch (e) {} },
  clearTimeout: function () {},
  requestAnimationFrame: function (fn) { try { fn(); } catch (e) {} },
  save: function () { sandbox.saves = (sandbox.saves || 0) + 1; },
  alert: function () {},
  getDailyMode: function () { return { food: { k: 1200, kcalGoal: 2500, p: 80, count: 1 } }; }
};
sandbox.window = sandbox;
sandbox._hoyLocal = '2026-08-13';
vm.createContext(sandbox);

['parseRepRange', 'sugerenciaSesion', 'seriesValidasRegs', 'repsNum', 'seriesHoyEjercicio',
  'evaluarSesionHoy', 'actualizarResultadosHoy', 'fitResumenResultadoHoy', 'fitHistorialSesiones',
  'esPrimeraSesionEjercicio', 'f3TendenciaDificilSemanas',
  'f3NombreRutinaAuto', 'f3NombreMostrar', 'f3CampoNombreHTML',
  'f3AltsHTML', 'f3RotarAlts',
  'f3AnclarTarjeta', 'f3AnclarEl', 'f3IrARutina', 'f3AplicarIrA', 'f3ClearIrA', 'f3InitIrAListeners',
  'hmForceTopScroll', 'scrollActiveTabTop', 'showSavedRoutines', 'loadSavedRoutine', 'render',
  'syncSimpleFitnessInputs', 'quickFitnessToday', 'fitPeriodLogs', 'bestByExercise', 'repsTotal',
  'renderSimpleFitnessProgress',
  'logRoutineQuick', 'swapToFirstAlt', 'replaceFitnessExercise', 'setFitEffort', 'setFitEstado', 'f3RenombrarEnlazada',
  'fitEffortHoy', 'toggleSimpleFitDone',
  'f3DiasRutina', 'f3DiaDePlan', 'f3CfgCopia', 'f3MusculosDia', 'f3PropuestaDia', 'openRoutineConfig', 'renderRoutineConfig',
  'cfgToggleDia', 'cfgCopiarDia', 'cfgDiaEditar', 'cfgSetNombre', 'cfgGuardar', 'cfgCancelar',
  'cfgExAgregar', 'cfgExQuitar', 'cfgExMover', 'cfgExSet', 'f3CfgBancoHTML', 'cfgDiaIdx', 'f3EquipKey', 'f3CfgFilaExs', 'f3AltsBanco', 'f3NivelNum']
  .forEach(function (n) { vm.runInContext(extractFunc(HTML, n), sandbox); });

const fn = {
  quick: function () { sandbox.quickFitnessToday(); return fakeEls['simpleFitnessOut'].innerHTML; },
  progress: function () { sandbox.renderSimpleFitnessProgress(7); return fakeEls['simpleFitnessOut'].innerHTML; },
  actualizar: sandbox.actualizarResultadosHoy
};

// ---- Helpers ----
let passed = 0, failed = 0;
const failures = [];
function t(name, cond, extra) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; failures.push(name + (extra ? ' → ' + extra : '')); console.log('  ✗ ' + name + (extra ? ' → ' + extra : '')); }
}
function S(dia, ej, peso, repsArr, sid, offset) {
  return repsArr.map(function (r, i) {
    return { id: ((sid || 1) * 100000) + (offset || 0) + i, date: dia, localDate: dia, sessionId: sid || 1, exercise: ej, weight: peso, sets: 1, reps: String(r), note: 'Rutina · test · Serie ' + (i + 1) };
  });
}
function nuevoEstado() {
  sandbox.state = {
    workoutLog: [], fitnessDailyResults: [], fitnessToday: null,
    weight: [], walks: [], expenses: [], wellnessLog: [], meals: [],
    profile: { peso: 150, altura: 170, edad: 30, sexo: 'hombre', actividad: 'muy alta', objetivo: 'ganar músculo' },
    fitEffort: 'auto', fitDislikes: []
  };
  sandbox._hoyLocal = '2026-08-13';
  for (const k in fakeEls) delete fakeEls[k];
}
function packPlan(sid, plan, checked) {
  // checkedDate = hoy: si falta, quickFitnessToday resetea el checklist (comportamiento real).
  sandbox.state.fitnessToday = { date: '2026-08-14', sessionId: sid, plan: plan, checked: checked || {}, checkedDate: '2026-08-14' };
}
const AYER = '2026-08-11', HOY = '2026-08-13';

console.log('\n== RENDER rutina de hoy (quickFitnessToday real) ==');

t('R1 · Ejercicio SIN historial registrado hoy → aparece "🆕 Primera vez registrada"', function () {
  nuevoEstado();
  sandbox.state.workoutLog = S(HOY, 'Aperturas con mancuernas', 20, [11, 11], 77);
  packPlan(77, [
    { name: 'Aperturas con mancuernas', sets: 2, reps: '8-12' },
    { name: 'Remo con barra', sets: 2, reps: '10-12' }
  ], { 0: true });
  const html = fn.quick();
  return html.indexOf('🆕 Primera vez registrada') >= 0;
}());

t('R2 · Resumen "Objetivo vs resultado de hoy" aparece desde la primera serie (sin terminar)', function () {
  nuevoEstado();
  sandbox.state.workoutLog = S(HOY, 'Aperturas con mancuernas', 20, [11, 11], 77);
  packPlan(77, [
    { name: 'Aperturas con mancuernas', sets: 2, reps: '8-12' },
    { name: 'Remo con barra', sets: 2, reps: '10-12' }
  ], { 0: true });
  const html = fn.quick();
  return html.indexOf('🏁 Objetivo vs resultado de hoy') >= 0 && html.indexOf('🎉 Terminaste') < 0;
}());

t('R3 · Objetivo cumplido: veredicto junto al ejercicio + resumen + rutina terminada', function () {
  nuevoEstado();
  sandbox.state.workoutLog = S(AYER, 'Aperturas con mancuernas', 20, [10, 10], 1)
    .concat(S(HOY, 'Aperturas con mancuernas', 20, [11, 11], 77));
  packPlan(77, [
    { name: 'Aperturas con mancuernas', sets: 2, reps: '8-12' },
    { name: 'Remo con barra', sets: 2, reps: '10-12' }
  ], { 0: true, 1: true });
  const html = fn.quick();
  const n = html.split('✓ Objetivo cumplido').length - 1;
  return html.indexOf('✓ Objetivo cumplido') >= 0
    && html.indexOf('🎯 Objetivo · 20 lb · 11 / 11') >= 0
    && html.indexOf('🎉 Terminaste la rutina.') >= 0
    && html.indexOf('sin series registradas') >= 0
    && n >= 2; // veredicto por ejercicio + resumen
}());

t('R4 · Progreso parcial 11/10 → "↗ Progreso · faltó 1 repetición"', function () {
  nuevoEstado();
  sandbox.state.workoutLog = S(AYER, 'Aperturas con mancuernas', 20, [10, 10], 1)
    .concat(S(HOY, 'Aperturas con mancuernas', 20, [11, 10], 77));
  packPlan(77, [{ name: 'Aperturas con mancuernas', sets: 2, reps: '8-12' }], { 0: true });
  const html = fn.quick();
  return html.indexOf('↗ Progreso · faltó 1 repetición') >= 0 && html.indexOf('Casi. Mantén 20 lb') >= 0;
}());

t('R5 · Sin mejora 10/10 → "→ Mantén el peso"', function () {
  nuevoEstado();
  sandbox.state.workoutLog = S(AYER, 'Aperturas con mancuernas', 20, [10, 10], 1)
    .concat(S(HOY, 'Aperturas con mancuernas', 20, [10, 10], 77));
  packPlan(77, [{ name: 'Aperturas con mancuernas', sets: 2, reps: '8-12' }], { 0: true });
  const html = fn.quick();
  return html.indexOf('→ Mantén el peso') >= 0;
}());

t('R6 · Sesión por debajo 8/8 → "↓ Sesión por debajo de la anterior" sin bajar peso', function () {
  nuevoEstado();
  sandbox.state.workoutLog = S(AYER, 'Aperturas con mancuernas', 20, [10, 10], 1)
    .concat(S(HOY, 'Aperturas con mancuernas', 20, [8, 8], 77));
  packPlan(77, [{ name: 'Aperturas con mancuernas', sets: 2, reps: '8-12' }], { 0: true });
  const html = fn.quick();
  return html.indexOf('↓ Sesión por debajo de la anterior') >= 0 && html.indexOf('Mantén 20 lb') >= 0;
}());

t('R7 · Ejercicio alternativo usa SU historial (30 lb, no el del plano)', function () {
  nuevoEstado();
  sandbox.state.workoutLog = S(AYER, 'Press plano', 20, [10, 10], 1)
    .concat(S(AYER, 'Press inclinado', 30, [8, 8], 1))
    .concat(S(HOY, 'Press inclinado', 30, [9, 9], 77));
  packPlan(77, [{ name: 'Press inclinado', sets: 2, reps: '8-12' }], { 0: true });
  const html = fn.quick();
  return html.indexOf('✓ Objetivo cumplido') >= 0 && html.indexOf('🎯 Objetivo · 30 lb · 9 / 9') >= 0;
}());

t('R8 · F5: re-render con el mismo estado produce el mismo HTML', function () {
  nuevoEstado();
  sandbox.state.workoutLog = S(AYER, 'Aperturas con mancuernas', 20, [10, 10], 1)
    .concat(S(HOY, 'Aperturas con mancuernas', 20, [11, 11], 77));
  packPlan(77, [{ name: 'Aperturas con mancuernas', sets: 2, reps: '8-12' }], { 0: true });
  const h1 = fn.quick();
  const h2 = fn.quick();
  return h1 === h2 && h1.indexOf('✓ Objetivo cumplido') >= 0;
}());

t('R9 · Cerrar/abrir: el estado redondo (JSON) vuelve a renderizar igual', function () {
  nuevoEstado();
  sandbox.state.workoutLog = S(AYER, 'Aperturas con mancuernas', 20, [10, 10], 1)
    .concat(S(HOY, 'Aperturas con mancuernas', 20, [11, 11], 77));
  packPlan(77, [{ name: 'Aperturas con mancuernas', sets: 2, reps: '8-12' }], { 0: true });
  const h1 = fn.quick();
  sandbox.state = JSON.parse(JSON.stringify(sandbox.state)); // simula guardar y volver a cargar
  const h2 = fn.quick();
  return h1 === h2 && h2.indexOf('✓ Objetivo cumplido') >= 0;
}());

t('R10 · Cambio de día: 0 series hoy y el objetivo se reconstruye desde ayer', function () {
  nuevoEstado();
  sandbox.state.workoutLog = S(HOY, 'Aperturas con mancuernas', 20, [11, 11], 77); // "ayer" para el nuevo día
  packPlan(77, [{ name: 'Aperturas con mancuernas', sets: 2, reps: '8-12' }], {});
  sandbox._hoyLocal = '2026-08-14'; // mañana
  const html = fn.quick();
  return html.indexOf('Series de hoy: 0/2') >= 0
    && html.indexOf('🎯 Objetivo · 20 lb · 12 / 12') >= 0
    && html.indexOf('Objetivo cumplido') < 0;
}());

t('R11 · Rutina nueva sin ninguna serie → sin resumen ni veredictos', function () {
  nuevoEstado();
  packPlan(77, [{ name: 'Aperturas con mancuernas', sets: 2, reps: '8-12' }], {});
  const html = fn.quick();
  return html.indexOf('🏁 Objetivo vs resultado') < 0 && html.indexOf('Objetivo cumplido') < 0;
}());

t('R12 · actualizarResultadosHoy anota "primera" (🆕) en el storage', function () {
  nuevoEstado();
  sandbox.state.workoutLog = S(HOY, 'Aperturas con mancuernas', 20, [11, 11], 77);
  packPlan(77, [{ name: 'Aperturas con mancuernas', sets: 2, reps: '8-12' }], { 0: true });
  fn.actualizar();
  const ann = sandbox.state.fitnessDailyResults[0];
  return !!ann && ann.estado === 'primera' && ann.icon === '🆕';
}());

t('R14 · v1.188.4.2: rutina enlazada (por ID) muestra SU nombre en el campo', function () {
  nuevoEstado();
  sandbox.state.savedRoutines = [{ id: 'r1', name: 'Mi Rutina', plan: [{ name: 'Aperturas con mancuernas', sets: 2, reps: '8-12' }], date: '2026-08-10' }];
  packPlan(77, [{ name: 'Aperturas con mancuernas', sets: 2, reps: '8-12' }], {});
  sandbox.state.fitnessToday.loadedRoutineId = 'r1';
  const html = fn.quick();
  return html.indexOf('value="Mi Rutina"') >= 0 && html.indexOf('id="routineNameInput"') >= 0;
}());

t('R15 · progresión por ejercicio: peso Y reps se PRECARGAN de verdad (20 y 11)', function () {
  nuevoEstado();
  sandbox.state.workoutLog = S(AYER, 'Aperturas con mancuernas', 20, [10, 10], 1);
  packPlan(77, [{ name: 'Aperturas con mancuernas', sets: 2, reps: '8-12' }], {});
  const html = fn.quick();
  return /id="rlogW_0"[^>]*value="20"/.test(html)
    && /id="rlogR_0"[^>]*value="11"/.test(html);
}());

t('R16 · sin historial: reps vacías con el rango como placeholder', function () {
  nuevoEstado();
  packPlan(77, [{ name: 'Aperturas con mancuernas', sets: 2, reps: '8-12' }], {});
  const html = fn.quick();
  return /id="rlogR_0"[^>]*value=""/.test(html)
    && html.indexOf('placeholder="Reps 8-12"') >= 0;
}());

t('R17 · anti-salto: quickFitnessToday NO usa scrollIntoView y conserva la posición', function () {
  nuevoEstado();
  packPlan(77, [{ name: 'Aperturas con mancuernas', sets: 2, reps: '8-12' }], {});
  sandbox.window.scrollY = 150;
  sandbox.window.scrollTo = function (x, y) { sandbox._scrollCalls = (sandbox._scrollCalls || 0) + 1; sandbox._lastScrollTo = y; };
  sandbox._scrollCalls = 0;
  const source = String(sandbox.quickFitnessToday);
  fn.quick();
  return source.indexOf('out.scrollIntoView(') < 0
    && (sandbox._scrollCalls || 0) === 0
    && sandbox.window.scrollY === 150;
}());

t('R18 · Cambiar ejercicio: Motivo (Está ocupado / No me gusta) + hasta 10 alternativas + 🎲', function () {
  nuevoEstado();
  var pool = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10'];
  packPlan(77, [{ name: 'Aperturas con mancuernas', sets: 2, reps: '8-12', altsCompletas: pool }], {});
  const html = fn.quick();
  var botones = (html.match(/onclick="replaceFitnessExercise/g) || []).length;
  return html.indexOf('🔄 Cambiar ejercicio') >= 0
    && html.indexOf('Motivo:') >= 0
    && html.indexOf('🚫 Está ocupado') >= 0
    && html.indexOf('👎 No me gusta') >= 0
    && botones <= 10
    && html.indexOf('🎲 Otras opciones') >= 0;
}());

t('R19 · 🎲 Otras opciones muestra OTROS ejercicios (intersección vacía), no reordena', function () {
  nuevoEstado();
  var pool = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10'];
  packPlan(77, [{ name: 'Aperturas con mancuernas', sets: 2, reps: '8-12', altsCompletas: pool }], {});
  fn.quick();
  sandbox.state.fitnessToday = sandbox.state.fitnessToday || {};
  sandbox.state.fitnessToday.plan = [{ name: 'Aperturas con mancuernas', sets: 2, reps: '8-12', altsCompletas: pool }];
  function nombres(html) {
    var m = html.match(/onclick="replaceFitnessExercise\(\d+,'([^']*)'\)/g) || [];
    return m.map(function (s) { return s.match(/'([^']*)'\)/)[1]; });
  }
  var t1 = (function () { sandbox.f3RotarAlts(0); return nombres(fakeEls['altsRow_0'].innerHTML); })();
  var t2 = (function () { sandbox.f3RotarAlts(0); return nombres(fakeEls['altsRow_0'].innerHTML); })();
  var inter = t1.filter(function (n) { return t2.indexOf(n) >= 0; });
  return inter.length === 0 && t1.length === 5 && t2.length === 5;
}());

t('R20 · anti-salto REAL: al cambiar una alternativa, la TARJETA conserva su posición visual (no termina arriba)', function () {
  nuevoEstado();
  packPlan(77, [
    { name: 'Aperturas con mancuernas', sets: 2, reps: '8-12' },
    { name: 'Remo con barra', sets: 2, reps: '10-12' },
    { name: 'Press inclinado con barra', sets: 2, reps: '8-12' }
  ], {});
  sandbox.window.scrollY = 600;
  sandbox.window.scrollTo = function (x, y) { sandbox._lastScrollTo = y; };
  // Simular: el usuario está en la tarjeta 2 (su top quedó a 250px del viewport)
  // y tras el re-render la misma tarjeta quedaría a 400px si no se corrige.
  fakeEls['fitCard_2'] = { getBoundingClientRect: function () { return { top: 400 }; } };
  sandbox.window._fitAncla = 2;
  sandbox.window._fitAnclaTop = 250;
  fn.quick();
  return sandbox._lastScrollTo === 600 + (400 - 250) && sandbox.window._fitAncla === null;
}());

t('R21 · sin ancla activa se conserva el comportamiento anterior (scrollY absoluto, sin llamadas extra)', function () {
  nuevoEstado();
  packPlan(77, [{ name: 'Aperturas con mancuernas', sets: 2, reps: '8-12' }], {});
  sandbox.window.scrollY = 600;
  sandbox.window.scrollTo = function (x, y) { sandbox._lastScrollTo2 = y; };
  sandbox.window._fitAncla = null;
  sandbox.window._fitAnclaTop = null;
  fn.quick();
  return sandbox._lastScrollTo2 === undefined;
}());

t('R22 · cambiar de RUTINA completa (Usar hoy) conserva la posición del bloque de la rutina', function () {
  nuevoEstado();
  packPlan(77, [{ name: 'Aperturas con mancuernas', sets: 2, reps: '8-12' }], {});
  sandbox.window.scrollY = 600;
  sandbox.window.scrollTo = function (x, y) { sandbox._lastScrollTo = y; };
  fakeEls['simpleFitnessOut'] = { getBoundingClientRect: function () { return { top: 520 }; } };
  sandbox.window._fitAnclaEl = 'simpleFitnessOut';
  sandbox.window._fitAnclaTop = 120;
  fn.quick();
  return sandbox._lastScrollTo === 600 + (520 - 120) && sandbox.window._fitAnclaEl === null;
}());

t('R23 · loadSavedRoutine pide POSICIONAR el inicio de la nueva rutina (ancla semántica)', function () {
  nuevoEstado();
  var qfReal = sandbox.quickFitnessToday;
  sandbox.quickFitnessToday = function () { sandbox._irAVista = sandbox.window._fitIrA; return qfReal(); };
  sandbox.state.savedRoutines = [{ id: 'r1', name: 'Mi Rutina', plan: [{ name: 'Aperturas con mancuernas', sets: 2, reps: '8-12' }], date: '2026-08-10' }];
  sandbox.loadSavedRoutine('r1');
  return !!sandbox._irAVista && sandbox._irAVista.routineId === 'r1';
}());

t('R24 · INTEGRACIÓN: cargar otra rutina → render completo → SEGUNDO render → el viewport queda en el inicio de la nueva rutina', function () {
  nuevoEstado();
  packPlan(77, [{ name: 'Aperturas con mancuernas', sets: 2, reps: '8-12' }], {});
  sandbox.window.scrollY = 900;
  sandbox.window.scrollTo = function (x, y) { sandbox._lastScrollTo = y; };
  // La tarjeta 0 (inicio de la rutina) cambia de posición entre renders
  fakeEls['fitCard_0'] = { getBoundingClientRect: function () { return { top: sandbox._topCard0 }; } };
  sandbox.state.savedRoutines = [{ id: 'r1', name: 'Otra rutina', plan: [{ name: 'Aperturas con mancuernas', sets: 2, reps: '8-12' }], date: '2026-08-10' }];
  // Primer render: la tarjeta queda a 700px del viewport → debe acercarla a 90
  // (delta = top - objetivo = +610: scroll ABAJO, no hacia la cabecera).
  sandbox._topCard0 = 700;
  sandbox.loadSavedRoutine('r1');
  var t1 = sandbox._lastScrollTo; // esperado: 900 + (700 - 90) = 1510
  // Segundo render (p. ej. por sync/badge): la tarjeta queda a 250 → re-coloca a 90
  sandbox.window.scrollY = t1;
  sandbox._topCard0 = 250;
  sandbox.quickFitnessToday();
  var t2 = sandbox._lastScrollTo; // esperado: 1510 + (250 - 90) = 1670
  return t1 === 1510 && t2 === 1670;
}());

t('R13 · v1.188.4.1: el campo de nombre de rutina tiene fila propia, etiqueta y ancho útil (anti-regresión del input colapsado)', function () {
  nuevoEstado();
  packPlan(77, [{ name: 'Aperturas con mancuernas', sets: 2, reps: '8-12' }], {});
  const html = fn.quick();
  const i = html.indexOf('id="routineNameInput"');
  if (i < 0) return false;
  const etiqueta = html.indexOf('✏️ Nombre de rutina (opcional)');
  const guardar = html.indexOf('saveCurrentRoutine()');
  const bloque = html.slice(Math.max(0, i - 60), i + 420);
  // 1) etiqueta visible 2) fila propia ANTES de "Guardar" 3) ancho útil explícito
  return etiqueta >= 0 && etiqueta < guardar && i < guardar
    && /id="routineNameInput"[^>]*width:100%/.test(bloque)
    && /max-width:340px/.test(bloque)
    && bloque.indexOf('placeholder="Escribe un nombre…"') >= 0;
}());

console.log('\n== RENDER Ver progreso (renderSimpleFitnessProgress real) ==');

t('R13 · "Historial de sesiones" visible con fecha → ejercicio → peso → reps → resultado', function () {
  nuevoEstado();
  sandbox.state.workoutLog = S(AYER, 'Aperturas con mancuernas', 20, [10, 10], 1)
    .concat(S(HOY, 'Aperturas con mancuernas', 20, [11, 11], 77));
  packPlan(77, [{ name: 'Aperturas con mancuernas', sets: 2, reps: '8-12' }], { 0: true });
  fn.actualizar();
  const html = fn.progress();
  return html.indexOf('📜 Historial de sesiones') >= 0
    && html.indexOf('Aperturas con mancuernas') >= 0
    && html.indexOf('20 lb') >= 0
    && html.indexOf('11/11') >= 0
    && html.indexOf('✓ Objetivo cumplido') >= 0;
}());

t('R14 · El sistema viejo "Tu mejor peso por ejercicio" sigue presente', function () {
  nuevoEstado();
  sandbox.state.workoutLog = S(AYER, 'Aperturas con mancuernas', 20, [10, 10], 1)
    .concat(S(HOY, 'Aperturas con mancuernas', 20, [11, 11], 77));
  packPlan(77, [{ name: 'Aperturas con mancuernas', sets: 2, reps: '8-12' }], { 0: true });
  const html = fn.progress();
  return html.indexOf('Tu mejor peso por ejercicio') >= 0;
}());

t('R15 · Primera sesión sin anotación guardada → historial muestra "🆕 Primera vez" (no "—")', function () {
  nuevoEstado();
  sandbox.state.workoutLog = S(HOY, 'Aperturas con mancuernas', 20, [11, 11], 77);
  sandbox.state.fitnessDailyResults = [];
  const html = fn.progress();
  return html.indexOf('📜 Historial de sesiones') >= 0
    && html.indexOf('Aperturas con mancuernas') >= 0
    && html.indexOf('11/11') >= 0
    && html.indexOf('🆕 Primera vez') >= 0;
}());

t('R22 · Sin anotación pero CON sesión anterior → la más vieja es "🆕 Primera vez" y la nueva "—"', function () {
  nuevoEstado();
  sandbox.state.workoutLog = S(AYER, 'Aperturas con mancuernas', 20, [10, 10], 8)
    .concat(S(HOY, 'Aperturas con mancuernas', 20, [11, 11], 77));
  sandbox.state.fitnessDailyResults = [];
  const html = fn.progress();
  return html.indexOf('🆕 Primera vez') >= 0 && html.indexOf('<span class="muted">—</span>') >= 0;
}());

t('R23 · Anotación guardada de "primera" también muestra "🆕 Primera vez"', function () {
  nuevoEstado();
  sandbox.state.workoutLog = S(HOY, 'Aperturas con mancuernas', 20, [11, 11], 77);
  packPlan(77, [{ name: 'Aperturas con mancuernas', sets: 2, reps: '8-12' }], { 0: true });
  fn.actualizar();
  const html = fn.progress();
  return html.indexOf('🆕 Primera vez') >= 0;
}());

console.log('\n== CICLO DE LA SEGUNDA SESIÓN (render real) ==');

t('R24 · Historial de dos sesiones: 13 ago ✓ cumplido arriba y 11 ago 🆕 primera abajo', function () {
  nuevoEstado();
  sandbox.state.workoutLog = S(AYER, 'Aperturas con mancuernas', 20, [11, 11], 8)
    .concat(S(HOY, 'Aperturas con mancuernas', 20, [12, 12], 77));
  packPlan(77, [{ name: 'Aperturas con mancuernas', sets: 2, reps: '8-12' }], { 0: true });
  fn.actualizar(); // anota la sesión de HOY (cumplido); la de AYER queda derivada como 🆕
  const html = fn.progress();
  const p13 = html.indexOf('13 ago'), p11 = html.indexOf('11 ago');
  return p13 >= 0 && p11 >= 0 && p13 < p11
    && html.indexOf('✓ Objetivo cumplido') >= 0
    && html.indexOf('🆕 Primera vez') >= 0
    && html.indexOf('11/11') >= 0 && html.indexOf('12/12') >= 0;
}());

t('R25 · Segunda sesión: objetivo "20 lb · 12 / 12" y tras 12/12 → "✓ Objetivo cumplido"', function () {
  nuevoEstado();
  sandbox.state.workoutLog = S(AYER, 'Aperturas con mancuernas', 20, [11, 11], 8)
    .concat(S(HOY, 'Aperturas con mancuernas', 20, [12, 12], 77));
  packPlan(77, [{ name: 'Aperturas con mancuernas', sets: 2, reps: '8-12' }], { 0: true });
  const html = fn.quick();
  return html.indexOf('🎯 Objetivo · 20 lb · 12 / 12') >= 0
    && html.indexOf('✓ Objetivo cumplido') >= 0
    && html.indexOf('🏁 Objetivo vs resultado de hoy') >= 0;
}());

t('R26 · Segunda sesión parcial 12/11 → "↗ Progreso · faltó 1 repetición" y mantiene 20 lb', function () {
  nuevoEstado();
  sandbox.state.workoutLog = S(AYER, 'Aperturas con mancuernas', 20, [11, 11], 8)
    .concat(S(HOY, 'Aperturas con mancuernas', 20, [12, 11], 77));
  packPlan(77, [{ name: 'Aperturas con mancuernas', sets: 2, reps: '8-12' }], { 0: true });
  const html = fn.quick();
  return html.indexOf('↗ Progreso · faltó 1 repetición') >= 0
    && html.indexOf('Mantén 20 lb') >= 0
    && html.indexOf('✓ Objetivo cumplido') < 0;
}());

t('R27 · Siguiente sesión tras cumplir 12/12: objetivo sube a 25 lb · 8 / 8 (no suma)', function () {
  nuevoEstado();
  sandbox.state.workoutLog = S(AYER, 'Aperturas con mancuernas', 20, [11, 11], 8)
    .concat(S(HOY, 'Aperturas con mancuernas', 20, [12, 12], 77));
  packPlan(77, [{ name: 'Aperturas con mancuernas', sets: 2, reps: '8-12' }], {});
  sandbox._hoyLocal = '2026-08-14'; // día siguiente
  const html = fn.quick();
  return html.indexOf('🎯 Objetivo · 25 lb · 8 / 8') >= 0
    && html.indexOf('Series de hoy: 0/2') >= 0
    && html.indexOf('60 lb') < 0 && html.indexOf('40 lb') < 0;
}());

t('R28 · Semana con dos sesiones: 2 días entrenados y volumen 920 lb', function () {
  nuevoEstado();
  // fechas dinámicas: la ventana de 7 días usa la fecha real del sistema
  sandbox.state.workoutLog = S(sysLocal(-2), 'Aperturas con mancuernas', 20, [11, 11], 8)
    .concat(S(sysLocal(0), 'Aperturas con mancuernas', 20, [12, 12], 77));
  const html = fn.progress();
  return html.indexOf('<b>2</b><span>días entrenados</span>') >= 0
    && html.indexOf('920 lb movidas') >= 0;
}());

console.log('\n== PERIODOS Semana / 2 semanas / Mes (fitPeriodLogs) ==');

// Fecha local del sistema (los tests corren "hoy", sea la hora que sea).
function sysLocal(offsetDays) {
  const d = new Date(Date.now() + (offsetDays || 0) * 86400000);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
// Registros como los REALES del usuario: localDate = día local, date = día UTC (puede ser "mañana").
function regsRealesHoy() {
  const local = sysLocal(0);
  const utc = new Date(Date.now() + 24 * 3600000).toISOString().slice(0, 10);
  return [
    { id: 101, date: utc, localDate: local, sessionId: 9, exercise: 'Aperturas con mancuernas', weight: 20, sets: 1, reps: '11', note: 'Rutina · Pecho · Serie 1' },
    { id: 102, date: utc, localDate: local, sessionId: 9, exercise: 'Aperturas con mancuernas', weight: 20, sets: 1, reps: '11', note: 'Rutina · Pecho · Serie 2' }
  ];
}

t('R16 · Semana: cuenta los registros de HOY aunque x.date sea UTC de "mañana"', function () {
  nuevoEstado();
  sandbox.state.workoutLog = regsRealesHoy();
  const n = sandbox.fitPeriodLogs(7, 0).length;
  return n === 2;
}(), 'fitPeriodLogs(7,0)=' + sandbox.fitPeriodLogs(7, 0).length);

t('R17 · 2 semanas y Mes también cuentan los registros de hoy', function () {
  nuevoEstado();
  sandbox.state.workoutLog = regsRealesHoy();
  return sandbox.fitPeriodLogs(14, 0).length === 2 && sandbox.fitPeriodLogs(30, 0).length === 2;
}());

t('R18 · Progreso Semana con datos reales: 1 día, 1 ejercicio con peso, 440 lb de volumen', function () {
  nuevoEstado();
  sandbox.state.workoutLog = regsRealesHoy();
  const html = fn.progress();
  return html.indexOf('<b>1</b><span>días entrenados</span>') >= 0
    && html.indexOf('<b>1</b><span>ejercicios con peso</span>') >= 0
    && html.indexOf('440 lb movidas') >= 0;
}());

t('R19 · Registro viejo SIN localDate (solo date) sigue contando (sin regresión)', function () {
  nuevoEstado();
  const ayer = sysLocal(-1);
  sandbox.state.workoutLog = regsRealesHoy().concat([
    { id: 103, date: ayer, sessionId: 8, exercise: 'Remo con barra', weight: 25, sets: 1, reps: '10', note: 'legacy' }
  ]);
  return sandbox.fitPeriodLogs(7, 0).length === 3;
}());

t('R20 · Registro de hace 40 días queda FUERA del Mes', function () {
  nuevoEstado();
  sandbox.state.workoutLog = regsRealesHoy().concat([
    { id: 104, date: sysLocal(-40), localDate: sysLocal(-40), sessionId: 7, exercise: 'Curl bíceps', weight: 15, sets: 1, reps: '10', note: 'viejo' }
  ]);
  return sandbox.fitPeriodLogs(30, 0).length === 2 && sandbox.fitPeriodLogs(7, 0).length === 2;
}());

t('R21 · Semana, 2 semanas y Mes renderizan sin romperse', function () {
  nuevoEstado();
  sandbox.state.workoutLog = regsRealesHoy();
  const h7 = sandbox.renderSimpleFitnessProgress(7), html7 = fakeEls['simpleFitnessOut'].innerHTML;
  const h14 = sandbox.renderSimpleFitnessProgress(14), html14 = fakeEls['simpleFitnessOut'].innerHTML;
  const h30 = sandbox.renderSimpleFitnessProgress(30), html30 = fakeEls['simpleFitnessOut'].innerHTML;
  return html7.indexOf('📊 Progreso · Semana') >= 0
    && html14.indexOf('📊 Progreso · 2 semanas') >= 0
    && html30.indexOf('📊 Progreso · Mes') >= 0
    && html7.indexOf('440') >= 0 && html14.indexOf('440') >= 0 && html30.indexOf('440') >= 0;
}());

// ============================================================
// S · Render tardío (sync/badge ~10 s) NO navega: solo actualiza datos
// ============================================================
console.log('\n== S · Render tardío NO navega ==');
// Colaboradores de render() en el sandbox. El rebuild del DOM se simula: al
// asignar app.innerHTML el contenido se desvanece y el navegador clampa el scroll.
sandbox.tabs = ['Inicio', '💪 Ejercicio'];
sandbox._activeTab = 1;
sandbox.$ = function () {
  return {
    set innerHTML(v) { for (const k in fakeEls) delete fakeEls[k]; sandbox.window.scrollY = 0; },
    get innerHTML() { return ''; }
  };
};
sandbox.buildTabIfNeeded = function () { return true; };
sandbox.initNav = function () {};
sandbox.bindAll = function () {};
sandbox.section = function () { return ''; };
sandbox.updateSyncBadge = function () { return 'synced'; }; // render de badge: solo datos, nunca scroll
sandbox.keepScroll = function (fn) { fn(); };
sandbox.renderFitnessCoach = function () {};
sandbox.renderGuidedWorkout = function () {};
documentStub.elementFromPoint = function () { return null; };

t('S1 · cargar B → render inmediato + render de sync + render de badge + render tardío → el viewport NUNCA vuelve a la cabecera', function () {
  nuevoEstado();
  sandbox.window._fitIrA = null;
  packPlan(77, [{ name: 'Aperturas con mancuernas', sets: 2, reps: '8-12' }], {});
  sandbox.state.savedRoutines = [{ id: 'rB', name: 'Rutina B', plan: [{ name: 'Press banca con barra', sets: 3, reps: '6-15', rest: 135, alts: [] }], date: '2026-08-10' }];
  sandbox.window.scrollY = 900; // usuario parado en la lista de rutinas
  sandbox.window.scrollTo = function (x, y) { sandbox._lastScrollTo = y; sandbox.window.scrollY = y; };
  fakeEls['fitCard_0'] = { getBoundingClientRect: function () { return { top: 700 }; } };
  sandbox.loadSavedRoutine('rB'); // navegación inicial: deja la rutina visible
  sandbox._vistaRutina = true;
  var yInicial = sandbox.window.scrollY;
  sandbox.render(); // render de sync (~2-4 s)
  sandbox.updateSyncBadge('Sincronizado', '#d9f5e7'); // render de badge
  sandbox.render(); // render tardío (~10 s)
  var yFinal = sandbox.window.scrollY;
  var rutinaDibujada = fakeEls['simpleFitnessOut'].innerHTML.indexOf('Press banca con barra') >= 0;
  return yInicial > 0 && yFinal > 0 && rutinaDibujada;
}());

t('S2 · A → B → A con renders tardíos entre medias: cada rutina queda visible y estable', function () {
  nuevoEstado();
  sandbox.window._fitIrA = null;
  packPlan(77, [{ name: 'Aperturas con mancuernas', sets: 2, reps: '8-12' }], {});
  sandbox.state.savedRoutines = [
    { id: 'rA', name: 'Rutina A', plan: [{ name: 'Sentadilla con barra', sets: 3, reps: '6-15', rest: 135, alts: [] }], date: '2026-08-10' },
    { id: 'rB', name: 'Rutina B', plan: [{ name: 'Press banca con barra', sets: 3, reps: '6-15', rest: 135, alts: [] }], date: '2026-08-11' }
  ];
  sandbox.window.scrollY = 900;
  sandbox.window.scrollTo = function (x, y) { sandbox._lastScrollTo = y; sandbox.window.scrollY = y; };
  fakeEls['fitCard_0'] = { getBoundingClientRect: function () { return { top: 700 }; } };
  sandbox.loadSavedRoutine('rA');
  sandbox._vistaRutina = true;
  var yA = sandbox.window.scrollY;
  sandbox.render(); // render tardío durante A
  var yATardio = sandbox.window.scrollY;
  sandbox.loadSavedRoutine('rB');
  sandbox._vistaRutina = true;
  var yB = sandbox.window.scrollY;
  sandbox.render(); // render tardío durante B
  var yBTardio = sandbox.window.scrollY;
  sandbox.loadSavedRoutine('rA');
  var yA2 = sandbox.window.scrollY;
  return yA > 0 && yATardio > 0 && yB > 0 && yBTardio > 0 && yA2 > 0;
}());

// Regla: tras la navegación inicial, CUALQUIER control + render tardío de sync
// (~10 s) debe dejar el viewport EXACTAMENTE donde estaba (solo datos, sin navegar).
function prepararInteraccion() {
  nuevoEstado();
  sandbox.window._fitIrA = null; // el usuario ya interactuó: sin intención pendiente
  packPlan(77, [{ name: 'Aperturas con mancuernas', sets: 3, reps: '8-12', rest: 135, alts: [] }], {});
  sandbox.state.savedRoutines = [{ id: 'rB', name: 'Rutina B', plan: [{ name: 'Press banca con barra', sets: 3, reps: '6-15', rest: 135, alts: [] }], date: '2026-08-10' }];
  sandbox.window.scrollY = 900;
  // Geometría realista: la tarjeta 0 SIGUE al scroll (el rect no es estático).
  sandbox._top0 = 700;
  sandbox.window.scrollTo = function (x, y) {
    var dy = y - sandbox.window.scrollY;
    sandbox._lastScrollTo = y;
    sandbox.window.scrollY = Math.max(0, y);
    sandbox._top0 -= dy;
  };
  fakeEls['fitCard_0'] = { getBoundingClientRect: function () { return { top: sandbox._top0 }; } };
  sandbox.loadSavedRoutine('rB'); // navegación inicial: la rutina queda posicionada
  sandbox._vistaRutina = true; // la vista activa es la rutina
  return sandbox.window.scrollY; // (nunca en la cabecera: y > 0)
}
function renderTardio() { sandbox.render(); return sandbox.window.scrollY; }

t('S3 · renombrar rutina → render tardío (~10 s): el viewport NO se mueve y el nombre persiste', function () {
  var yAntes = prepararInteraccion();
  sandbox.f3RenombrarEnlazada('rB', 'Prueba Renombrada'); // acción del usuario
  var yFinal = renderTardio();
  var nombreOk = sandbox.state.savedRoutines[0].name === 'Prueba Renombrada';
  return yAntes > 0 && yFinal === yAntes && nombreOk;
}());

t('S4 · cambiar intensidad → render tardío: el viewport NO se mueve', function () {
  var yAntes = prepararInteraccion();
  sandbox.setFitEffort('suave'); // acción del usuario
  var yFinal = renderTardio();
  return yAntes > 0 && yFinal === yAntes && sandbox.state.fitEffort === 'suave';
}());

t('S5 · Terminé (registrar serie) → render tardío: el viewport NO se mueve', function () {
  var yAntes = prepararInteraccion();
  fakeEls['rlogW_0'] = { value: '20' };
  fakeEls['rlogR_0'] = { value: '11' };
  sandbox.logRoutineQuick(0); // acción del usuario
  var yFinal = renderTardio();
  var registrado = (sandbox.state.workoutLog || []).length > 0;
  return yAntes > 0 && yFinal === yAntes && registrado;
}());

t('S6 · abrir Historial → render tardío: el viewport NO se mueve y el sync NO arrebata la vista', function () {
  var yAntes = prepararInteraccion();
  sandbox.renderSimpleFitnessProgress(7); // acción del usuario (reemplaza la vista)
  sandbox._vistaRutina = false;
  var yFinal = renderTardio();
  // El sync no debe re-dibujar la rutina encima de la vista que el usuario eligió.
  var noArrebato = !fakeEls['simpleFitnessOut'] || (fakeEls['simpleFitnessOut'].innerHTML || '').indexOf('fitCard_') < 0;
  return yAntes > 0 && yFinal === yAntes && noArrebato;
}());

t('S7 · cambiar ejercicio (Está ocupado) → render tardío: el viewport NO se mueve', function () {
  var yAntes = prepararInteraccion();
  sandbox.state.fitnessToday.plan[0].altsCompletas = ['Press inclinado con barra'];
  sandbox.swapToFirstAlt(0); // acción del usuario
  var yFinal = renderTardio();
  var cambiado = sandbox.state.fitnessToday.plan[0].name === 'Press inclinado con barra';
  return yAntes > 0 && yFinal === yAntes && cambiado;
}());

t('S8 · scroll-a-arriba tardío (timer diferido de navegación) NO pisa la rutina ya posicionada', function () {
  var yAntes = prepararInteraccion();
  sandbox.window._fitIrA = null; // la navegación inicial ya convergió (intención limpia)
  sandbox._vistaRutina = true;
  sandbox.hmForceTopScroll('smooth'); // p. ej. el callback diferido de openTab
  var yFinal = sandbox.window.scrollY;
  return yAntes > 0 && yFinal === yAntes;
}());

t('S9 · renderGuidedWorkout sin sesión guiada NO limpia la vista principal (origen del borrado de rutina en cada render de sync)', function () {
  // Aserción a nivel de fuente (la función usa templates anidados que el
  // extractor no parsea): la rama "sin sesión" debe limpiar SOLO el contenedor
  // oculto del guiado, nunca simpleFitnessOut (donde vive la rutina del día).
  var desde = HTML.indexOf('function renderGuidedWorkout(');
  var src = HTML.slice(desde, HTML.indexOf('function moveGuidedWorkout('));
  var limpiaMain = /if\(!aw\|\|!aw\.plan\|\|!aw\.plan\.length\)\{out\.innerHTML='';return\}/.test(src);
  var limpiaOculto = src.indexOf("getElementById('guidedWorkoutOut')") >= 0;
  var usaMainSoloConSesion = src.indexOf('getFitnessMainOut') > src.indexOf('if(!aw||!aw.plan||!aw.plan.length)');
  return !limpiaMain && limpiaOculto && usaMainSoloConSesion;
}());

// ============================================================
// C · Configurar rutina (⚙️ plantilla guardada, multi-día)
// ============================================================
console.log('\n== C · Configurar rutina ==');
sandbox.FIT_GOALS = ['Ganar músculo sin quedar molido', 'Tren superior', 'Tren inferior', 'Pecho', 'Espalda y hombros', 'Brazos', 'Pierna y glúteos', 'Calistenia', 'Yoga', 'Corrido (cardio)', 'Core y movilidad', 'Recuperar'];
sandbox.DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
sandbox.confirmResult = true;
sandbox.confirm = function () { return sandbox.confirmResult !== false; };
sandbox.todayWeekdayIndex = function () { return (typeof sandbox._hoyW === 'number') ? sandbox._hoyW : 0; };
sandbox.buildFitnessTodayPlan = function () {
  return [{ name: 'Propuesta A', muscle: 'biceps', sets: 3, reps: '8-12', rest: 60 }, { name: 'Propuesta B', muscle: 'triceps', sets: 3, reps: '8-12', rest: 60 }];
};
sandbox.renderSavedRoutines = function () { if (sandbox.window._routineCfg) sandbox.renderRoutineConfig(); };
function abrirCfg(id) { sandbox.openRoutineConfig(id); return fakeEls['savedRoutinesOut'].innerHTML || ''; }
function diasActivas() { return (sandbox.state.savedRoutines[0] || {}).dias || []; }

t('C0 · la tarjeta muestra días/ejercicios y el botón ⚙️ Configurar (fuente)', function () {
  var desde = HTML.indexOf('function renderSavedRoutines(');
  var src = HTML.slice(desde, HTML.indexOf('function f3DiasRutina('));
  return src.indexOf('⚙️ Configurar') >= 0 && src.indexOf('openRoutineConfig(') >= 0 && src.indexOf('día') >= 0;
}());

t('C1 · abrir Configurar crea un borrador con el MISMO id y muestra el panel', function () {
  cargarRubenA();
  var html = abrirCfg('rA');
  return !!sandbox.window._routineCfg && sandbox.window._routineCfg.id === 'rA'
    && html.indexOf('⚙️ Configurar rutina') >= 0 && html.indexOf('RUBEN A') >= 0
    && html.indexOf('💾 Guardar cambios') >= 0 && html.indexOf('Cancelar') >= 0
    && html.indexOf('Días de entrenamiento') >= 0;
}());

t('C2 · editar nombre + guardar conserva routineId y NO crea duplicado', function () {
  cargarRubenA();
  abrirCfg('rA');
  fakeEls['cfgName'] = { value: 'RUBEN A FUERTE' };
  sandbox.cfgSetNombre({ target: fakeEls['cfgName'] });
  sandbox.confirmResult = false; // no aplicar al entreno de hoy
  sandbox.cfgGuardar();
  var activas = sandbox.state.savedRoutines.filter(function (r) { return !r.deleted; });
  return activas.length === 1 && activas[0].id === 'rA' && activas[0].name === 'RUBEN A FUERTE';
}());

t('C3 · añadir Sábado genera una propuesta coherente visible ANTES de guardar', function () {
  cargarRubenA();
  abrirCfg('rA');
  sandbox.cfgToggleDia(5);
  var cfg = sandbox.window._routineCfg;
  var d5 = cfg.dias.find(function (d) { return d.di === 5; });
  var html = fakeEls['savedRoutinesOut'].innerHTML;
  return !!d5 && d5.propuesto === true && d5.exs.length === 2
    && d5.exs[0].name === 'Propuesta A'
    && html.indexOf('propuesta') >= 0 && html.indexOf('2 ejercicios') >= 0;
}());

t('C4 · añadir Domingo también propone plan', function () {
  cargarRubenA();
  abrirCfg('rA');
  sandbox.cfgToggleDia(5);
  sandbox.cfgToggleDia(6);
  var cfg = sandbox.window._routineCfg;
  var d6 = cfg.dias.find(function (d) { return d.di === 6; });
  return !!d6 && d6.exs.length === 2;
}());

t('C5 · quitar un día con ejercicios pide confirmación y NO borra si se cancela', function () {
  cargarRubenA();
  abrirCfg('rA');
  sandbox.cfgToggleDia(5);
  sandbox.confirmResult = false;
  sandbox.cfgToggleDia(5); // intenta quitar → confirmación cancelada
  var sigue = !!sandbox.window._routineCfg.dias.find(function (d) { return d.di === 5; });
  sandbox.confirmResult = true;
  sandbox.cfgToggleDia(5); // ahora sí
  var quitado = !sandbox.window._routineCfg.dias.find(function (d) { return d.di === 5; });
  return sigue && quitado;
}());

t('C6 · guardar Sáb + Dom, conservar el plan original como respaldo y reabrir conserva los días y el id', function () {
  cargarRubenA();
  abrirCfg('rA');
  sandbox.confirmResult = false;
  sandbox.cfgToggleDia(5); sandbox.cfgToggleDia(6);
  sandbox.cfgGuardar();
  var r = sandbox.state.savedRoutines[0];
  var guardado = r.dias && r.dias.length === 2 && r.id === 'rA' && r.plan.length === 1 && r.plan[0].name === 'Press banca con barra';
  abrirCfg('rA');
  var reabierto = sandbox.window._routineCfg.dias.length === 2;
  return guardado && reabierto;
}());

t('C7 · días libres: guardar 5, 6 y 7 días funciona (sin hardcode)', function () {
  cargarRubenA();
  abrirCfg('rA');
  sandbox.confirmResult = false;
  [0, 1, 2, 3, 4].forEach(function (di) { sandbox.cfgToggleDia(di); }); // Lun..Vie
  sandbox.cfgGuardar();
  var n5 = diasActivas().length;
  abrirCfg('rA');
  sandbox.cfgToggleDia(5); sandbox.cfgGuardar();
  var n6 = diasActivas().length;
  abrirCfg('rA');
  sandbox.cfgToggleDia(6); sandbox.cfgGuardar();
  var n7 = diasActivas().length;
  return n5 === 5 && n6 === 6 && n7 === 7;
}());

t('C8 · editar la plantilla NO modifica el entrenamiento de hoy (default NO)', function () {
  cargarRubenA();
  var planAntes = planFirma();
  abrirCfg('rA');
  sandbox.cfgToggleDia(5); // cambia la plantilla
  sandbox.confirmResult = false; // responde NO a "¿aplicar hoy?"
  sandbox.cfgGuardar();
  return planFirma() === planAntes && sandbox.state.savedRoutines[0].dias.length === 1;
}());

t('C9 · si el usuario dice SÍ, la plantilla se aplica al día de HOY', function () {
  cargarRubenA();
  abrirCfg('rA');
  sandbox._hoyW = 5; // hoy = Sábado
  sandbox.cfgToggleDia(5);
  sandbox.confirmResult = true;
  sandbox.cfgGuardar();
  return sandbox.state.fitnessToday.plan[0].name === 'Propuesta A'
    && planFirma().indexOf('Propuesta B') >= 0;
}());

t('C10 · Usar hoy carga el día que corresponde al día de la semana', function () {
  cargarRubenA();
  abrirCfg('rA');
  sandbox.cfgToggleDia(5);
  sandbox.confirmResult = false;
  sandbox.cfgGuardar();
  sandbox._hoyW = 5; // hoy = Sábado
  sandbox.loadSavedRoutine('rA');
  return sandbox.state.fitnessToday.plan[0].name === 'Propuesta A'
    && sandbox.state.fitnessToday.loadedRoutineId === 'rA';
}());

t('C11 · el editor sobrevive a un render de sync tardío sin mover el scroll (no vuelve el bug)', function () {
  var yAntes = cargarRubenA();
  abrirCfg('rA');
  sandbox._vistaRutina = true;
  sandbox.render(); // render tardío de sync
  sandbox.renderSavedRoutines(); // como hace bindAll
  var yFinal = sandbox.window.scrollY;
  var html = fakeEls['savedRoutinesOut'].innerHTML || '';
  return html.indexOf('⚙️ Configurar rutina') >= 0 && yFinal === yAntes;
}());

t('C12 · editar cada día: agregar/quitar/reordenar ejercicios del banco', function () {
  cargarRubenA();
  abrirCfg('rA');
  sandbox.cfgToggleDia(5); // día con propuesta A,B
  sandbox.cfgDiaEditar(sandbox.window._routineCfg.dias.findIndex(function (d) { return d.di === 5; }));
  var idx = sandbox.window._routineCfg.dias.findIndex(function (d) { return d.di === 5; });
  sandbox.cfgExMover(5, 0, 1); // mover A abajo
  var orden = sandbox.window._routineCfg.dias[idx].exs.map(function (x) { return x.name; }).join(',');
  sandbox.cfgExQuitar(5, 1); // quitar A
  var restan = sandbox.window._routineCfg.dias[idx].exs.map(function (x) { return x.name; }).join(',');
  return orden === 'Propuesta B,Propuesta A' && restan === 'Propuesta B';
}());

t('C13 · días independientes: editar Lunes NO cambia Martes; editar Sábado NO cambia ningún otro día', function () {
  cargarRubenA();
  abrirCfg('rA');
  sandbox.cfgToggleDia(0); // Lunes (propuesta)
  sandbox.cfgToggleDia(1); // Martes (propuesta)
  var cfg = sandbox.window._routineCfg;
  var nombres = function (di) { var d = cfg.dias.find(function (x) { return x.di === di; }); return JSON.stringify((d ? d.exs : []).map(function (x) { return x.name; })); };
  var antesMar = nombres(1), antesBase = nombres(-1);
  sandbox.cfgExQuitar(0, 0); // quitar el 1º de Lunes
  var lunQuedan = cfg.dias.find(function (d) { return d.di === 0; }).exs.length;
  var despuesMar = nombres(1), despuesBase = nombres(-1);
  var okLunNoTocaMar = antesMar === despuesMar && antesBase === despuesBase && lunQuedan === 1;
  sandbox.cfgToggleDia(5); // Sábado
  var antesLun = nombres(0);
  sandbox.cfgExQuitar(5, 0); // quitar el 1º de Sábado
  var despuesLun = nombres(0);
  return okLunNoTocaMar && antesLun === despuesLun;
}());

t('C14 · el plan de respaldo queda en "Avanzado" con días, y visible como respaldo sin días', function () {
  cargarRubenA();
  var htmlSinDias = abrirCfg('rA');
  var sinDiasOk = htmlSinDias.indexOf('Plan de respaldo') >= 0 && htmlSinDias.indexOf('Avanzado · Plan de respaldo') < 0
    && htmlSinDias.indexOf('No es un día de entrenamiento') >= 0;
  sandbox.cfgToggleDia(5);
  var htmlConDias = fakeEls['savedRoutinesOut'].innerHTML;
  var conDiasOk = htmlConDias.indexOf('Avanzado · Plan de respaldo') >= 0;
  return sinDiasOk && conDiasOk;
}());

t('C15 · Usar hoy: carga el día correcto; el fallback entra SOLO cuando falta plan, con aviso', function () {
  cargarRubenA();
  abrirCfg('rA');
  sandbox.cfgToggleDia(5);
  sandbox.confirmResult = false;
  sandbox.cfgGuardar();
  sandbox._hoyW = 5; // hoy = Sábado → carga Sábado, sin aviso
  sandbox.loadSavedRoutine('rA');
  var htmlSab = fn.quick();
  var okDia = htmlSab.indexOf('Propuesta A') >= 0 && htmlSab.indexOf('plan de respaldo') < 0;
  sandbox._hoyW = 1; // hoy = Martes (sin día) → respaldo CON aviso
  sandbox.loadSavedRoutine('rA');
  var htmlMar = fn.quick();
  var okFb = htmlMar.indexOf('plan de respaldo') >= 0 && htmlMar.indexOf('Press banca con barra') >= 0;
  return okDia && okFb;
}());

t('C16 · rutina antigua (solo plan clásico): migración segura, mismo id/nombre, sin inventar días', function () {
  cargarRubenA();
  var antes = plantillaGuardada();
  abrirCfg('rA');
  sandbox.confirmResult = false;
  sandbox.cfgGuardar(); // guardar sin cambios (solo convierte a respaldo)
  var r = sandbox.state.savedRoutines[0];
  var planOriginal = JSON.parse(antes).plan;
  return r.id === 'rA' && r.name === 'RUBEN A'
    && JSON.stringify(r.plan) === JSON.stringify(planOriginal)
    && Array.isArray(r.dias) && r.dias.length === 1 && r.dias[0].di === -1
    && r.dias[0].exs.length === planOriginal.length;
}());

t('C17 · UI: cada bloque muestra DÍA COMPLETO + enfoque + nº ejercicios, con HOY resaltado', function () {
  cargarRubenA();
  abrirCfg('rA');
  sandbox._hoyW = 5; // hoy = Sábado
  sandbox.cfgToggleDia(5); // añade Sábado con propuesta (biceps+triceps)
  var html = fakeEls['savedRoutinesOut'].innerHTML;
  var okSabado = html.indexOf('SÁBADO') >= 0 && html.indexOf('Biceps + Triceps') >= 0 && html.indexOf('2 ejercicios') >= 0 && html.indexOf('>HOY<') >= 0;
  sandbox.cfgToggleDia(0); // añade Lunes
  var html2 = fakeEls['savedRoutinesOut'].innerHTML;
  var okLunes = html2.indexOf('LUNES') >= 0 && html2.indexOf('SÁBADO') >= 0; // los 7 días conviven y se revisan individualmente
  return okSabado && okLunes;
}());

// ============================================================
// N · Identidad de la rutina cargada (nombre vs ajustes de HOY)
// ============================================================
console.log('\n== N · Identidad de la rutina cargada ==');
function cargarRubenA(nombre) {
  nuevoEstado();
  sandbox.window._fitIrA = null;
  packPlan(77, [{ name: 'Aperturas con mancuernas', sets: 3, reps: '8-12', rest: 135, alts: [] }], {});
  sandbox.state.savedRoutines = [{ id: 'rA', name: nombre || 'RUBEN A', plan: [{ name: 'Press banca con barra', sets: 3, reps: '6-15', rest: 135, alts: [] }], date: '2026-08-10' }];
  sandbox.window.scrollY = 900;
  sandbox._top0 = 700;
  sandbox.window.scrollTo = function (x, y) { var dy = y - sandbox.window.scrollY; sandbox.window.scrollY = Math.max(0, y); sandbox._top0 -= dy; };
  fakeEls['fitCard_0'] = { getBoundingClientRect: function () { return { top: sandbox._top0 }; } };
  sandbox.loadSavedRoutine('rA');
  sandbox._vistaRutina = true;
  return sandbox.window.scrollY;
}
function nombreEnCampo() {
  var html = fakeEls['simpleFitnessOut'].innerHTML || '';
  var m = html.match(/id="routineNameInput"[^>]*value="([^"]*)"/);
  return m ? m[1] : null;
}
function plantillaGuardada() { return JSON.stringify(sandbox.state.savedRoutines[0]); }
function planFirma() { return JSON.stringify((sandbox.state.fitnessToday.plan || []).map(function (x) { return x.name; })); }

t('N0 · createFitnessToday conserva la identidad de la rutina enlazada (fuente del estado)', function () {
  var desde = HTML.indexOf('function createFitnessToday(');
  var src = HTML.slice(desde, HTML.indexOf('function renderFitnessCoach('));
  return src.indexOf('enlaceHoy') >= 0 && src.indexOf('loadedRoutineId=null') > src.indexOf('enlaceHoy');
}());

t('N0b · modifyFitnessOnlyToday (Estoy cansado/Poco tiempo) conserva el enlace de la rutina cargada', function () {
  var desde = HTML.indexOf('function modifyFitnessOnlyToday(');
  var src = HTML.slice(desde, HTML.indexOf('function ', desde + 10));
  return src.indexOf('loadedRoutineId:(prevFT&&prevFT.loadedRoutineId)') >= 0;
}());

t('N1 · cambiar intensidad (Normal→Fuerte · crecer) NO pierde el nombre, el enlace ni los ejercicios', function () {
  cargarRubenA();
  var planAntes = planFirma();
  sandbox.setFitEffort('fuerte');
  return nombreEnCampo() === 'RUBEN A'
    && sandbox.state.fitnessToday.loadedRoutineId === 'rA'
    && planFirma() === planAntes;
}());

t('N2 · cambiar "¿Cómo llegas hoy?" (Muy fatigado) NO pierde el nombre', function () {
  cargarRubenA();
  var planAntes = planFirma();
  sandbox.setFitEstado('muy_fatigado');
  return nombreEnCampo() === 'RUBEN A'
    && sandbox.state.fitnessToday.loadedRoutineId === 'rA'
    && planFirma() === planAntes;
}());

t('N3 · cambiar un ejercicio (Está ocupado) NO pierde el nombre', function () {
  cargarRubenA();
  sandbox.state.fitnessToday.plan[0].altsCompletas = ['Press inclinado con barra'];
  sandbox.swapToFirstAlt(0);
  return nombreEnCampo() === 'RUBEN A' && sandbox.state.fitnessToday.loadedRoutineId === 'rA';
}());

t('N4 · registrar peso/reps NO pierde el nombre', function () {
  cargarRubenA();
  fakeEls['rlogW_0'] = { value: '20' };
  fakeEls['rlogR_0'] = { value: '11' };
  sandbox.logRoutineQuick(0);
  return nombreEnCampo() === 'RUBEN A' && sandbox.state.fitnessToday.loadedRoutineId === 'rA';
}());

t('N5 · pulsar Terminé (marcar hecho) NO pierde el nombre', function () {
  cargarRubenA();
  sandbox.toggleSimpleFitDone(0);
  return nombreEnCampo() === 'RUBEN A' && sandbox.state.fitnessToday.loadedRoutineId === 'rA';
}());

t('N6 · sync/render tardío (>15 s) NO pierde el nombre y NO mueve el viewport', function () {
  var yAntes = cargarRubenA();
  sandbox.setFitEffort('fuerte'); // ajuste de HOY
  var yFinal = renderTardio(); // render de sync tardío
  return nombreEnCampo() === 'RUBEN A'
    && sandbox.state.fitnessToday.loadedRoutineId === 'rA'
    && yFinal === yAntes;
}());

t('N7 · RUBEN A → RUBEN B: el campo cambia al nombre de la rutina cargada', function () {
  cargarRubenA();
  sandbox.state.savedRoutines.push({ id: 'rB', name: 'RUBEN B', plan: [{ name: 'Jalón al pecho', sets: 3, reps: '6-15', rest: 135, alts: [] }], date: '2026-08-11' });
  sandbox.loadSavedRoutine('rB');
  return nombreEnCampo() === 'RUBEN B' && sandbox.state.fitnessToday.loadedRoutineId === 'rB';
}());

t('N8 · edición MANUAL del campo sí cambia el nombre (RUBEN A → RUBEN A FUERTE)', function () {
  cargarRubenA();
  sandbox.f3RenombrarEnlazada('rA', 'RUBEN A FUERTE');
  fn.quick(); // re-render del campo
  return nombreEnCampo() === 'RUBEN A FUERTE' && sandbox.state.savedRoutines[0].name === 'RUBEN A FUERTE';
}());

t('N9 · cambiar "¿Qué tan fuerte hoy?" NO modifica la plantilla guardada', function () {
  cargarRubenA();
  var antes = plantillaGuardada();
  sandbox.setFitEffort('fuerte');
  return plantillaGuardada() === antes;
}());

t('N10 · cambiar "¿Cómo llegas hoy?" NO modifica la plantilla guardada', function () {
  cargarRubenA();
  var antes = plantillaGuardada();
  sandbox.setFitEstado('muy_fatigado');
  return plantillaGuardada() === antes;
}());

t('N11 · HOY = Muy fatigado + Suave → tras re-render/sync el ajuste permanece HOY', function () {
  cargarRubenA();
  sandbox.setFitEstado('muy_fatigado');
  sandbox.setFitEffort('suave');
  renderTardio(); // re-render/sync tardío
  var hoy = sandbox.todayISO();
  return sandbox.state.fitEstado === 'muy_fatigado' && sandbox.state.fitEstadoDate === hoy
    && sandbox.state.fitEffort === 'suave' && sandbox.state.fitEffortDate === hoy
    && nombreEnCampo() === 'RUBEN A';
}());

t('N12 · día siguiente: el ajuste de HOY NO se vuelve permanente (esfuerzo vuelve a auto)', function () {
  cargarRubenA();
  sandbox.setFitEffort('suave');
  sandbox.setFitEstado('muy_fatigado');
  var real = sandbox.todayISO;
  sandbox.todayISO = function () { return '2026-08-15'; }; // simular el día siguiente
  var ef = sandbox.fitEffortHoy();
  var esVigente = sandbox.state.fitEstadoDate === '2026-08-15' && sandbox.state.fitEstado !== 'normal';
  sandbox.todayISO = real;
  return ef === 'auto' && !esVigente && sandbox.state.savedRoutines[0].name === 'RUBEN A';
}());

t('N13 · chip compacto: solo aparece con ajuste activo y NO cambia rutina guardada', function () {
  cargarRubenA();
  var antes = plantillaGuardada();
  var htmlSinAjuste = fn.quick();
  sandbox.setFitEffort('fuerte');
  var htmlConAjuste = fn.quick();
  return htmlSinAjuste.indexOf('🔧 <b>Hoy:</b>') < 0
    && htmlConAjuste.indexOf('🔧 <b>Hoy:</b>') >= 0
    && htmlConAjuste.indexOf('Fuerte · crecer') >= 0
    && htmlConAjuste.indexOf('Cambiar') >= 0
    && plantillaGuardada() === antes;
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
