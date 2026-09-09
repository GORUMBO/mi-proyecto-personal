// ============================================================
// PRUEBAS — Rutina activa persistente (bug: "Rutina de la semana"
// no quedaba cargada al volver a entrar a Fitness).
// Uso: node tests/rutina-activa.test.js
// Escenarios A-I: refresh · cierre/apertura · renombrar · cambiar ·
// eliminar sin auto-selección · sync PC↔iPhone · historial intacto ·
// sin duplicados.
// ============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extractFunc(name) {
  const src = HTML;
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

let passed = 0, failed = 0;
function t(label, ok, extra) {
  if (ok) { passed++; console.log('✓ ' + label + (extra ? ' · ' + extra : '')); }
  else { failed++; console.log('✗ FALLA ' + label + (extra ? ' · ' + extra : '')); }
}

const rutinaBase = function (id, name) {
  return { id, name, plan: [{ name: 'Dominadas', muscle: 'Espalda', sets: 3, reps: '8', rest: 90 }], cfg: { equip: 'Gimnasio' }, updated_at: null };
};

function makeSb(state) {
  const panels = { savedRoutinesOut: { innerHTML: '' } };
  const sb = {
    state: JSON.parse(JSON.stringify(state)),
    safeText: function (x) { return String(x == null ? '' : x); },
    saves: 0,
    save() { sb.saves++; },
    quickFitnessToday() { sb._qft = (sb._qft || 0) + 1; },
    f3IrARutina() {},
    renderFitnessCoach() {},
    renderSavedRoutines() {},
    todayRoutinePlan() { return null; },
    confirm() { return true; },
    todayISO: (function () { return new Date().toISOString().slice(0, 10); })(),
    document: { getElementById(id) { return panels[id] || null; } }
  };
  sb.window = sb;
  vm.createContext(sb);
  ['f3RutinaActiva', 'f3PlanDeRutina', 'loadSavedRoutine', 'deleteSavedRoutine', 'createFitnessToday',
    'f3UsarSoloHoy', 'f3VolverASemanal', 'f3VariarHoy',
    'f3NombreMostrar', 'f3RutinasActivas', 'f3DiasRutina', 'renderSavedRoutines', 'f3MismaFechaLocal',
    'todayISO', 'todayLocal', 'readFitnessContext', 'todayWeekdayIndex', 'buildFitnessTodayPlan'].forEach(function (n) {
    vm.runInContext(extractFunc(n), sb);
  });
  // Alternativa determinista para "Usar solo hoy" (el generador real es pesado).
  sb.buildFitnessTodayPlan = function () { return [{ name: 'Sentadilla libre', muscle: 'Pierna', sets: 3, reps: '10', rest: 90 }]; };
  sb.panels = panels;
  return sb;
}

console.log('== A · Seleccionar Rutina A → refresh → sigue activa ==');
(function () {
  const sb = makeSb({ savedRoutines: [rutinaBase('A', 'Rutina A')], workoutLog: [{ id: 1, exercise: 'Histórico' }] });
  sb.loadSavedRoutine('A');
  t('A queda marcada como rutina activa', sb.state.activeRoutineId === 'A' && sb.f3RutinaActiva() && sb.f3RutinaActiva().id === 'A');
  t('el plan de hoy viene de A', sb.state.fitnessToday.loadedRoutineId === 'A' && sb.state.fitnessToday.plan.length === 1);
  // refresh = nueva sesión con el estado persistido (snapshot)
  const sb2 = makeSb(sb.state);
  t('refresh: A sigue activa', sb2.f3RutinaActiva() && sb2.f3RutinaActiva().id === 'A');
  sb2.createFitnessToday(); // entrar a Fitness OTRO día (o fecha regenerada)
  t('al entrar a Fitness: el plan se carga SOLO desde A', sb2.state.fitnessToday.loadedRoutineId === 'A' && /Dominadas/.test(sb2.state.fitnessToday.plan[0].name));
})();

console.log('== B · Cerrar app → abrir → Rutina A sigue activa ==');
(function () {
  const sb = makeSb({ savedRoutines: [rutinaBase('A', 'Rutina A')] });
  sb.loadSavedRoutine('A');
  const persisted = JSON.parse(JSON.stringify(sb.state)); // "cierre"
  const sb2 = makeSb(persisted); // "apertura"
  t('al abrir: A sigue activa sin tocar nada', sb2.state.activeRoutineId === 'A');
  sb2.createFitnessToday();
  t('al abrir Fitness: se muestra A directamente', sb2.state.fitnessToday.loadedRoutineId === 'A' && sb2.state.fitnessToday.loadedName === 'Rutina A');
})();

console.log('== C · Cambiar el nombre de Rutina A → sigue siendo la activa ==');
(function () {
  const sb = makeSb({ savedRoutines: [rutinaBase('A', 'Rutina A')] });
  sb.loadSavedRoutine('A');
  sb.state.savedRoutines[0].name = 'Rutina A (renombrada)';
  const sb2 = makeSb(sb.state); // refresh
  t('renombrar NO desenlaza la rutina activa (mismo id)', sb2.f3RutinaActiva() && sb2.f3RutinaActiva().id === 'A');
  sb2.createFitnessToday();
  t('el nombre nuevo viaja al plan de hoy', sb2.state.fitnessToday.loadedName === 'Rutina A (renombrada)');
})();

console.log('== D · Cambiar a Rutina B → refresh → B queda activa ==');
(function () {
  const sb = makeSb({ savedRoutines: [rutinaBase('A', 'Rutina A'), rutinaBase('B', 'Rutina B')] });
  sb.loadSavedRoutine('A');
  sb.loadSavedRoutine('B');
  const sb2 = makeSb(sb.state);
  t('la nueva selección reemplaza a la anterior', sb2.state.activeRoutineId === 'B');
  sb2.createFitnessToday();
  t('al entrar: B es la que se carga', sb2.state.fitnessToday.loadedRoutineId === 'B');
})();

console.log('== E · Eliminar Rutina B → sin rutina activa automática ==');
(function () {
  const sb = makeSb({ savedRoutines: [rutinaBase('A', 'Rutina A'), rutinaBase('B', 'Rutina B')] });
  sb.loadSavedRoutine('B');
  sb.deleteSavedRoutine('B');
  t('al eliminar la activa: la referencia se limpia', sb.state.activeRoutineId === null && sb.f3RutinaActiva() === null);
  t('NO se selecciona otra automáticamente (A NO es activa)', sb.state.activeRoutineId === null);
  sb.renderSavedRoutines();
  t('la lista muestra "No tienes una rutina activa"', /No tienes una rutina activa/.test(sb.panels.savedRoutinesOut.innerHTML));
})();

console.log('== F/G · PC y iPhone convergen en la MISMA rutina activa ==');
(function () {
  const sbPC = makeSb({ savedRoutines: [rutinaBase('A', 'Rutina A'), rutinaBase('B', 'Rutina B')] });
  sbPC.loadSavedRoutine('A'); // PC elige A
  const sbIP = makeSb({ savedRoutines: [rutinaBase('A', 'Rutina A'), rutinaBase('B', 'Rutina B')] });
  sbIP.loadSavedRoutine('B'); // iPhone elige B (más tarde)
  sbIP.state.lastModified = '2026-09-08T02:00:00.000Z';
  sbPC.state.lastModified = '2026-09-08T01:00:00.000Z';
  // el merge es el de la app: gana el lado con lastModified más reciente (escalar)
  const merged = Object.assign({}, sbPC.state, sbIP.state, { lastModified: sbIP.state.lastModified });
  const enPC = makeSb(merged);
  t('PC recibe B como rutina activa (sincronización)', enPC.state.activeRoutineId === 'B');
  enPC.createFitnessToday();
  t('PC carga B al entrar', enPC.state.fitnessToday.loadedRoutineId === 'B');
})();

console.log('== H · El historial de ejercicios NO desaparece ==');
(function () {
  const historial = [{ id: 100, exercise: 'Peso muerto', weight: 200, sets: 3, reps: '5' }];
  const sb = makeSb({ savedRoutines: [rutinaBase('A', 'Rutina A')], workoutLog: JSON.parse(JSON.stringify(historial)) });
  sb.loadSavedRoutine('A');
  sb.createFitnessToday();
  sb.deleteSavedRoutine('A');
  t('workoutLog intacto tras cargar y eliminar la activa', sb.state.workoutLog.length === 1 && sb.state.workoutLog[0].id === 100 && sb.state.workoutLog[0].exercise === 'Peso muerto');
})();

console.log('== I · Cargar la activa NO duplica rutinas ==');
(function () {
  const sb = makeSb({ savedRoutines: [rutinaBase('A', 'Rutina A')] });
  const antes = sb.state.savedRoutines.length;
  sb.loadSavedRoutine('A');
  sb.loadSavedRoutine('A');
  sb.createFitnessToday();
  sb.createFitnessToday();
  t('savedRoutines sin duplicados (1 sigue siendo 1)', sb.state.savedRoutines.length === antes && antes === 1);
})();

console.log('== K · 🔄 Usar solo hoy: excepción SIN tocar la rutina semanal ==');
(function () {
  const sb = makeSb({ savedRoutines: [rutinaBase('A', 'Rutina A')] });
  sb.loadSavedRoutine('A');
  const antes = sb.state.activeRoutineId;
  sb.f3UsarSoloHoy();
  t('activeRoutineId NO cambia', sb.state.activeRoutineId === antes && sb.state.activeRoutineId === 'A');
  t('la identidad sigue enlazada a la rutina (loadedRoutineId intacto)', sb.state.fitnessToday.loadedRoutineId === 'A');
  t('el plan de hoy es el alternativo (excepción marcada)', sb.state.fitnessToday.oneOff === true && sb.state.fitnessToday.plan[0].name === 'Sentadilla libre');
  t('savedRoutines NO se modifica', sb.state.savedRoutines.length === 1 && sb.state.savedRoutines[0].name === 'Rutina A');
})();

console.log('== L · Mañana (nuevo día): vuelve la rutina semanal automáticamente ==');
(function () {
  const sb = makeSb({ savedRoutines: [rutinaBase('A', 'Rutina A')] });
  sb.loadSavedRoutine('A');
  sb.f3UsarSoloHoy();
  // simular el día siguiente: la fecha global cambia
  sb.todayISO = function () { return '2099-01-02'; };
  sb.todayLocal = function () { return '2099-01-02'; };
  sb.createFitnessToday();
  t('la excepción muere con el día (oneOff no persiste)', !sb.state.fitnessToday.oneOff);
  t('mañana se carga la rutina semanal de nuevo', sb.state.fitnessToday.loadedRoutineId === 'A' && /Dominadas/.test(sb.state.fitnessToday.plan[0].name));
})();

console.log('== M · ↩ Volver a mi rutina de la semana (hoy mismo) ==');
(function () {
  const sb = makeSb({ savedRoutines: [rutinaBase('A', 'Rutina A')] });
  sb.loadSavedRoutine('A');
  sb.f3UsarSoloHoy();
  sb.f3VolverASemanal();
  t('el plan semanal se restaura hoy mismo', !sb.state.fitnessToday.oneOff && sb.state.fitnessToday.loadedRoutineId === 'A' && /Dominadas/.test(sb.state.fitnessToday.plan[0].name));
  t('activeRoutineId sigue siendo A', sb.state.activeRoutineId === 'A');
})();

console.log('== N · Textos y botones por modo (semanal / excepción / sin semanal) ==');
(function () {
  function makeUISb(state) {
    const panels = { simpleFitnessOut: { innerHTML: '' }, savedRoutinesOut: { innerHTML: '' } };
    const sb = {
      state: JSON.parse(JSON.stringify(state)),
      safeText: function (x) { return String(x == null ? '' : x); },
      save() {}, syncSimpleFitnessInputs() {}, createFitnessToday() {}, renderGuidedWorkout() {},
      activarDiaEntrenamiento() {}, f3DiaActivo() { return 0; }, todayRoutinePlan() { return null; },
      f3NombresPlan() { return ''; }, renderDescansoHTML() { return ''; }, fitResumenResultadoHoy() { return ''; },
      f3CampoNombreHTML() { return ''; }, f3Incompatibles() { return []; }, f3EquipoActualLabel() { return 'Gimnasio'; },
      f3TendenciaDificilSemanas() { return false; }, fitEffortHoy() { return 'auto'; }, f3AltsHTML() { return ''; },
      f3NombreMostrar(r) { return r && r.name; }, f3RutinaActiva() {
        const id = sb.state.activeRoutineId;
        return id ? (sb.state.savedRoutines || []).find(x => x.id === id && !x.deleted) || null : null;
      },
      scrollY: 0,
      setTimeout: function (fn) { return 0; },
      clearTimeout: function () {},
      exLink: function () { return '#'; },
      f3SesionVisibleHoy: function () { return { sid: null, visibles: [] }; },
      bestByExercise: function () { return null; },
      repsTotal: function () { return 0; },
      U: { pesoUnidad: function () { return 'lb'; } },
      document: { getElementById(id) { return panels[id] || null; } }
    };
    sb.window = sb;
    vm.createContext(sb);
    ['quickFitnessToday', 'todayISO', 'todayWeekdayIndex', 'f3RutinaActiva'].forEach(function (n) { vm.runInContext(extractFunc(n), sb); });
    sb.panels = panels;
    return sb;
  }
  const hoy = new Date().toISOString().slice(0, 10);
  // 1) sin semanal: rutina de hoy generada
  const s1 = makeUISb({ savedRoutines: [], fitnessToday: { date: hoy, plan: [{ name: 'Flexiones', sets: 3, reps: '10' }], checked: {}, checkedDate: hoy } });
  s1.quickFitnessToday();
  t('sin semanal: texto de variación diaria presente y 🎲 visible', /Los ejercicios cambian cada día/.test(s1.panels.simpleFitnessOut.innerHTML) && /🎲 Variar ejercicios/.test(s1.panels.simpleFitnessOut.innerHTML) && /Rutina lista\./.test(s1.panels.simpleFitnessOut.innerHTML));
  // 2) con semanal: prioridad al plan, sin variación aleatoria
  const s2 = makeUISb({ savedRoutines: [rutinaBase('A', 'Rutina A')], activeRoutineId: 'A', fitnessToday: { date: hoy, plan: [{ name: 'Dominadas', sets: 3, reps: '8' }], checked: {}, checkedDate: hoy, loadedRoutineId: 'A', loadedName: 'Rutina A' } });
  s2.quickFitnessToday();
  t('con semanal: título de la semana y botón Usar solo hoy', /🏋️ Mi rutina de la semana/.test(s2.panels.simpleFitnessOut.innerHTML) && /🔄 Usar solo hoy/.test(s2.panels.simpleFitnessOut.innerHTML));
  t('con semanal: SIN texto de "cambian cada día" ni 🎲', !/Los ejercicios cambian cada día/.test(s2.panels.simpleFitnessOut.innerHTML) && !/🎲 Variar ejercicios/.test(s2.panels.simpleFitnessOut.innerHTML));
  // 3) excepción de un día
  const s3 = makeUISb({ savedRoutines: [rutinaBase('A', 'Rutina A')], activeRoutineId: 'A', fitnessToday: { date: hoy, plan: [{ name: 'Sentadilla libre', sets: 3, reps: '10' }], checked: {}, checkedDate: hoy, loadedRoutineId: 'A', oneOff: true } });
  s3.quickFitnessToday();
  t('excepción: banner Solo por hoy + volver a la semanal', /🔄 Solo por hoy/.test(s3.panels.simpleFitnessOut.innerHTML) && /↩ Volver a mi rutina de la semana/.test(s3.panels.simpleFitnessOut.innerHTML) && /mañana vuelve/i.test(s3.panels.simpleFitnessOut.innerHTML));
})();

console.log('\n===== RESULTADO: ' + passed + ' PASS / ' + failed + ' FAIL =====');
if (failed) process.exit(1);
