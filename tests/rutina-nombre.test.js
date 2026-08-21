// ============================================================
// PRUEBAS — Nombre editable de rutina
// Guardar con nombre, auto-nombre descriptivo, renombrar sin tocar
// datos, repetir conserva nombre, rutinas antiguas sin nombre
// (presentación sin mutar) y paso por la sincronización actual.
// Uso: node tests/rutina-nombre.test.js
// ============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extractFunc(name) {
  var src = HTML;
  let i = src.indexOf('function ' + name + '(');
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

let passed = 0, failed = 0;
const failures = [];
function t(name, cond, extra) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; failures.push(name + (extra ? ' → ' + extra : '')); console.log('  ✗ ' + name + (extra ? ' → ' + extra : '')); }
}

// ============================================================
// Sandbox
// ============================================================
const sandbox = {
  console,
  state: { savedRoutines: [], workoutLog: [], fitnessToday: null },
  todayISO: function () { return '2026-08-16'; },
  save: function () {},
  alert: function () {},
  promptResult: null,
  prompt: function () { return sandbox.promptResult; },
  confirmResult: true,
  confirm: function () { return sandbox.confirmResult !== false; },
  ppUUID: function () { sandbox._uuid = (sandbox._uuid || 0) + 1; return 'uuid-' + sandbox._uuid; },
  renderSavedRoutines: function () {},
  quickFitnessToday: function () {},
  document: {
    getElementById: function () { return { value: '', innerHTML: '', textContent: '', style: { opacity: '' }, getBoundingClientRect: function () { return { top: 0 }; } }; },
    addEventListener: function () {}
  },
  setTimeout: setTimeout,
  clearTimeout: clearTimeout
};
sandbox.window = sandbox;
vm.runInNewContext(
  extractFunc('f3NombreRutinaAuto') + '\n' +
  extractFunc('f3NombreMostrar') + '\n' +
  extractFunc('f3NombreAGuardar') + '\n' +
  extractFunc('f3FirmaRutina') + '\n' +
  extractFunc('f3AnclarEl') + '\n' +
  extractFunc('f3DiasRutina') + '\n' +
  extractFunc('f3IrARutina') + '\n' +
  extractFunc('f3InitIrAListeners') + '\n' +
  extractFunc('f3RenombrarEnlazada') + '\n' +
  extractFunc('f3NombreInput') + '\n' +
  extractFunc('f3NombreBlur') + '\n' +
  extractFunc('deleteSavedRoutine') + '\n' +
  extractFunc('f3RutinasActivas') + '\n' +
  extractFunc('f3CampoNombreHTML') + '\n' +
  extractFunc('openCreateRoutine') + '\n' +
  extractFunc('crearRutina') + '\n' +
  extractFunc('createFitnessToday') + '\n' +
  extractFunc('renombrarRutina') + '\n' +
  extractFunc('saveCurrentRoutine') + '\n' +
  extractFunc('repetirRutina') + '\n' +
  extractFunc('loadSavedRoutine') + '\n' +
  extractFunc('_mergeArrays'),
  sandbox
);
// La función REAL de createFitnessToday se captura aquí: la sección V2 la
// sombrea temporalmente con un stub y V5/V6 la restauran para probarla de verdad.
var createFitnessTodayReal = sandbox.createFitnessToday;

const planEjemplo = [
  { name: 'Press banca con barra', muscle: 'pecho', sets: 3, reps: '6-15', rest: 135, alts: [], note: '' },
  { name: 'Extensión de tríceps en cuerda', muscle: 'triceps', sets: 3, reps: '6-15', rest: 90, alts: [], note: '' }
];

// ============================================================
// A · Auto-nombre descriptivo
// ============================================================
console.log('\n== A · Nombre automático ==');
t('A1 · genera "Pecho + Tríceps · 16 ago" desde los músculos',
  sandbox.f3NombreRutinaAuto(planEjemplo, '2026-08-16') === 'Pecho + Tríceps · 16 ago',
  sandbox.f3NombreRutinaAuto(planEjemplo, '2026-08-16'));
t('A2 · sin músculos usa "Rutina · fecha"',
  sandbox.f3NombreRutinaAuto([], '2026-08-16') === 'Rutina · 16 ago');
t('A3 · no repite músculos en el nombre',
  sandbox.f3NombreRutinaAuto([{ muscle: 'pecho' }, { muscle: 'pecho' }], '2026-08-16') === 'Pecho · 16 ago');

// ============================================================
// B · Guardar con nombre escrito
// ============================================================
console.log('\n== B · Guardar con nombre ==');
sandbox.state.fitnessToday = { date: '2026-08-16', ctx: { focus: 'Pecho' }, plan: JSON.parse(JSON.stringify(planEjemplo)) };
sandbox.window._routineName = 'Pecho + Bíceps A';
sandbox.saveCurrentRoutine();
t('B1 · guarda el nombre exacto que escribiste', sandbox.state.savedRoutines[0].name === 'Pecho + Bíceps A');
t('B2 · guarda los ejercicios actuales intactos',
  JSON.stringify(sandbox.state.savedRoutines[0].plan.map(function (x) { return x.name; })) === JSON.stringify(planEjemplo.map(function (x) { return x.name; })));
t('B3 · limpia el campo tras guardar', sandbox.window._routineName === '');

// ============================================================
// C · Auto-nombre al guardar sin escribir nada
// ============================================================
console.log('\n== C · Auto-nombre al guardar ==');
sandbox.window._routineName = undefined;
sandbox.state.savedRoutines = [];
sandbox.saveCurrentRoutine();
t('C1 · sin nombre escrito genera el descriptivo', sandbox.state.savedRoutines[0].name.indexOf('Pecho') >= 0 && sandbox.state.savedRoutines[0].name.indexOf('· 16 ago') >= 0,
  sandbox.state.savedRoutines[0].name);

// ============================================================
// D · Repetir conserva el nombre
// ============================================================
console.log('\n== D · Repetir conserva nombre ==');
sandbox.state.savedRoutines = [];
sandbox.window._routineName = 'Mi Favorita';
sandbox.repetirRutina();
t('D1 · repetir guarda con el nombre que escribiste', sandbox.state.savedRoutines[0].name === 'Mi Favorita');
t('D2 · conserva ejercicios y orden exactos',
  JSON.stringify(sandbox.state.savedRoutines[0].plan.map(function (x) { return x.name; })) === JSON.stringify(planEjemplo.map(function (x) { return x.name; })));
sandbox.repetirRutina();
t('D3 · repetir dos veces el mismo día no duplica', sandbox.state.savedRoutines.length === 1);

// ============================================================
// E · Renombrar sin tocar datos
// ============================================================
console.log('\n== E · Renombrar ==');
var antesPlan = JSON.stringify(sandbox.state.savedRoutines[0].plan);
var antesFecha = sandbox.state.savedRoutines[0].date;
var antesId = sandbox.state.savedRoutines[0].id;
sandbox.promptResult = 'Nuevo Nombre A';
sandbox.renombrarRutina(sandbox.state.savedRoutines[0].id);
t('E1 · cambia el nombre', sandbox.state.savedRoutines[0].name === 'Nuevo Nombre A');
t('E2 · plan, fecha e id intactos',
  JSON.stringify(sandbox.state.savedRoutines[0].plan) === antesPlan
  && sandbox.state.savedRoutines[0].date === antesFecha
  && sandbox.state.savedRoutines[0].id === antesId);
sandbox.promptResult = '   ';
sandbox.renombrarRutina(sandbox.state.savedRoutines[0].id);
t('E3 · renombrar en blanco no cambia nada', sandbox.state.savedRoutines[0].name === 'Nuevo Nombre A');

// ============================================================
// F · Rutinas antiguas sin nombre (presentación sin mutar)
// ============================================================
console.log('\n== F · Rutinas antiguas sin nombre ==');
var vieja = { id: 'old-1', plan: [{ name: 'Sentadilla con barra', muscle: 'pierna', sets: 3, reps: '6-15', rest: 180 }], date: '2026-05-01' };
var copiaVieja = JSON.parse(JSON.stringify(vieja));
t('F1 · muestra un nombre de presentación generado',
  sandbox.f3NombreMostrar(vieja) === 'Pierna · 1 may', sandbox.f3NombreMostrar(vieja));
t('F2 · NO muta la entrada guardada', JSON.stringify(vieja) === JSON.stringify(copiaVieja) && vieja.name === undefined);
sandbox.state.savedRoutines = [vieja];
sandbox.state.fitnessToday = null;
sandbox.loadSavedRoutine('old-1');
t('F3 · cargar una rutina antigua usa el nombre generado sin mutarla',
  sandbox.state.fitnessToday.loadedName === 'Pierna · 1 may'
  && JSON.stringify(sandbox.state.savedRoutines[0]) === JSON.stringify(copiaVieja));

// ============================================================
// S · Guardar la misma rutina NO duplica: actualiza el nombre existente
// ============================================================
console.log('\n== S · Guardar sin duplicados ==');
sandbox.state.savedRoutines = [];
sandbox.state.fitnessToday = { date: '2026-08-16', ctx: { focus: 'Pecho' }, plan: JSON.parse(JSON.stringify(planEjemplo)) };
sandbox._renders = 0;
sandbox.renderSavedRoutines = function () { sandbox._renders++; };
sandbox.window._routineName = 'Primer nombre';
sandbox.saveCurrentRoutine();
var antesId = sandbox.state.savedRoutines[0].id;
var antesFecha = sandbox.state.savedRoutines[0].date;
var antesPlan = JSON.stringify(sandbox.state.savedRoutines[0].plan);
sandbox.window._routineName = 'Nombre actualizado';
sandbox.saveCurrentRoutine();
t('S1 · guardar la misma rutina NO crea duplicado', sandbox.state.savedRoutines.length === 1);
t('S2 · actualiza el nombre de la rutina existente', sandbox.state.savedRoutines[0].name === 'Nombre actualizado');
t('S3 · plan, fecha e id quedan intactos al actualizar el nombre',
  JSON.stringify(sandbox.state.savedRoutines[0].plan) === antesPlan
  && sandbox.state.savedRoutines[0].date === antesFecha
  && sandbox.state.savedRoutines[0].id === antesId);
t('S4 · la lista se re-renderiza al guardar (el nombre nuevo se ve al instante)', sandbox._renders >= 2);
// Recarga/persistencia: el estado redondo (JSON) conserva el nombre actualizado
var estadoRecargado = JSON.parse(JSON.stringify(sandbox.state));
t('S5 · tras recargar/sincronizar el nombre actualizado persiste',
  estadoRecargado.savedRoutines.length === 1 && estadoRecargado.savedRoutines[0].name === 'Nombre actualizado');
// Una rutina DIFERENTE sí crea una entrada nueva
sandbox.state.fitnessToday = { date: '2026-08-16', ctx: { focus: 'Pierna' }, plan: JSON.parse(JSON.stringify([{ name: 'Sentadilla con barra', muscle: 'pierna', sets: 3, reps: '6-15', rest: 180 }])) };
sandbox.window._routineName = 'Día de pierna';
sandbox.saveCurrentRoutine();
t('S6 · una rutina distinta sí se guarda como entrada nueva', sandbox.state.savedRoutines.length === 2);
t('S7 · workoutLog sigue intacto', (sandbox.state.workoutLog || []).length === 0);

// ============================================================
// T · Campo vinculado a la rutina por ID
// ============================================================
console.log('\n== T · Campo vinculado por ID ==');
sandbox.state.savedRoutines = [
  { id: 'r1', name: 'Mi Rutina', plan: JSON.parse(JSON.stringify(planEjemplo)), date: '2026-08-10' },
  { id: 'r2', name: '', plan: [{ name: 'Sentadilla con barra', muscle: 'pierna', sets: 3, reps: '6-15', rest: 180 }], date: '2026-08-01' }
];
sandbox.state.fitnessToday = null;
sandbox.loadSavedRoutine('r1');
t('T1 · cargar una rutina guardada la ENLAZA por id (loadedRoutineId)',
  sandbox.state.fitnessToday.loadedRoutineId === 'r1');
var antesPlanT = JSON.stringify(sandbox.state.savedRoutines[0].plan);
var antesFechaT = sandbox.state.savedRoutines[0].date;
// Escribir + perder foco (blur) renombra ESA rutina por id
sandbox.f3NombreBlur({ target: { value: 'Nombre escrito hoy' } });
t('T2 · escribir y salir del campo renombra la rutina enlazada', sandbox.state.savedRoutines[0].name === 'Nombre escrito hoy');
t('T3 · NO crea otra rutina ni toca plan/fecha/id',
  sandbox.state.savedRoutines.length === 2
  && JSON.stringify(sandbox.state.savedRoutines[0].plan) === antesPlanT
  && sandbox.state.savedRoutines[0].date === antesFechaT
  && sandbox.state.savedRoutines[0].id === 'r1');
// Rutina sin nombre: vacío en el campo, presentación generada al mostrarla
sandbox.f3RenombrarEnlazada('r2', '');
t('T4 · vaciar el nombre no rompe nada: vuelve al nombre de presentación',
  sandbox.state.savedRoutines[1].name === '' && sandbox.f3NombreMostrar(sandbox.state.savedRoutines[1]) === 'Pierna · 1 ago');
// Persistencia: el enlace y el nombre sobreviven el round-trip (reload/sync)
var estadoT = JSON.parse(JSON.stringify(sandbox.state));
t('T5 · el enlace (loadedRoutineId) y el nombre persisten tras recargar/sincronizar',
  estadoT.savedRoutines[0].name === 'Nombre escrito hoy' && estadoT.fitnessToday.loadedRoutineId === 'r1');
// Rutina NO enlazada: el campo solo prepara el nombre para Guardar
sandbox.state.fitnessToday = { date: '2026-08-16', ctx: { focus: 'Pecho' }, plan: JSON.parse(JSON.stringify(planEjemplo)) };
sandbox.f3NombreInput({ target: { value: 'Nombre pendiente' } });
t('T6 · sin enlace, escribir solo prepara el nombre (no crea rutinas)',
  sandbox.window._routineName === 'Nombre pendiente' && sandbox.state.savedRoutines.length === 2);
t('T7 · workoutLog sigue intacto', (sandbox.state.workoutLog || []).length === 0);

// ============================================================
// U · Eliminar rutina de forma PERSISTENTE (tombstone reutilizando el merge)
// ============================================================
console.log('\n== U · Eliminación persistente ==');
sandbox.confirmResult = true;
sandbox.state = {
  workoutLog: [{ id: 1, date: '2026-08-15', localDate: '2026-08-15', exercise: 'Sentadilla', weight: 100, sets: 1, reps: '10' }],
  savedRoutines: [{ id: 'r1', name: 'Mi Rutina', plan: JSON.parse(JSON.stringify(planEjemplo)), date: '2026-08-10' }],
  fitnessToday: { date: '2026-08-16', plan: JSON.parse(JSON.stringify(planEjemplo)), loadedRoutineId: 'r1' }
};
sandbox.deleteSavedRoutine('r1');
t('U1 · al eliminar desaparece de inmediato', sandbox.f3RutinasActivas().length === 0);
t('U2 · queda un tombstone con updated_at (mecanismo del merge existente)',
  sandbox.state.savedRoutines.length === 1 && sandbox.state.savedRoutines[0].deleted === true && !!sandbox.state.savedRoutines[0].updated_at);
// F5 / cerrar y abrir: el estado redondo (JSON) sigue sin la rutina
var estadoU = JSON.parse(JSON.stringify(sandbox.state));
sandbox.state = estadoU;
t('U3 · tras F5/recargar sigue eliminada', sandbox.f3RutinasActivas().length === 0);
// Windows elimina → iPhone sincroniza (merge real _mergeArrays, ambos órdenes)
var tomb = { id: 'r1', name: 'Mi Rutina', plan: [{ name: 'A' }], date: '2026-08-10', deleted: true, updated_at: '2026-08-16T10:00:00.000Z' };
var copiaVieja = { id: 'r1', name: 'Mi Rutina', plan: [{ name: 'A' }], date: '2026-08-10' };
var m1 = sandbox._mergeArrays([tomb], [copiaVieja]);
var m2 = sandbox._mergeArrays([copiaVieja], [tomb]);
t('U4 · la copia vieja del iPhone NO resucita la rutina (Windows eliminó)',
  m1.length === 1 && m1[0].deleted === true && m2.length === 1 && m2[0].deleted === true);
// iPhone elimina → Windows sincroniza (mismo merge, papeles invertidos)
var m3 = sandbox._mergeArrays([copiaVieja], [tomb]);
t('U5 · la copia vieja de Windows NO resucita la rutina (iPhone eliminó)',
  m3.length === 1 && m3[0].deleted === true);
t('U6 · workoutLog queda INTACTO al eliminar una rutina', sandbox.state.workoutLog.length === 1);
// Cancelar no elimina nada
sandbox.state.savedRoutines.push({ id: 'r2', name: 'R2', plan: [{ name: 'B' }], date: '2026-08-10' });
sandbox.confirmResult = false;
sandbox.deleteSavedRoutine('r2');
t('U7 · cancelar el borrado no elimina nada',
  sandbox.f3RutinasActivas().some(function (r) { return r.id === 'r2'; })
  && !sandbox.state.savedRoutines.find(function (r) { return r.id === 'r2'; }).deleted);
// Guardar la MISMA rutina después de eliminar → entrada NUEVA (no reutiliza la borrada)
sandbox.confirmResult = true;
sandbox.deleteSavedRoutine('r1');
sandbox.state.fitnessToday = { date: '2026-08-16', ctx: { focus: 'Pecho' }, plan: JSON.parse(JSON.stringify(planEjemplo)) };
sandbox.window._routineName = 'De nuevo';
sandbox.saveCurrentRoutine();
t('U8 · re-guardar la misma rutina crea una entrada NUEVA (id distinto, sin reutilizar la borrada)',
  sandbox.f3RutinasActivas().some(function (r) { return r.id !== 'r1' && r.name === 'De nuevo'; })
  && !sandbox.f3RutinasActivas().some(function (r) { return r.id === 'r1'; }));

// ============================================================
// V · Nombre en "Crear rutina" (reutiliza el componente único)
// ============================================================
console.log('\n== V · Nombre en Crear rutina ==');
t('V1 · el constructor incluye el MISMO componente de nombre',
  String(sandbox.openCreateRoutine).indexOf('f3CampoNombreHTML()') >= 0);
// crearRutina con nombre escrito → la rutina queda guardada YA con ese nombre
sandbox.state = { profile: {}, savedRoutines: [], workoutLog: [], fitnessToday: null };
sandbox.createFitnessToday = function () {
  sandbox.state.fitnessToday = { date: '2026-08-16', ctx: { focus: 'Pierna' }, plan: [{ name: 'Sentadilla con barra', muscle: 'pierna', sets: 3, reps: '6-15', rest: 180 }] };
};
sandbox.quickFitnessToday = function () {};
sandbox.window._routineName = 'Pierna martes';
sandbox.crearRutina();
t('V2 · al crear con nombre, la rutina queda guardada con ese nombre desde el principio',
  sandbox.state.savedRoutines.length === 1 && sandbox.state.savedRoutines[0].name === 'Pierna martes');
t('V3 · queda enlazada por ID (el campo la renombrará a ella, no creará otra)',
  sandbox.state.fitnessToday.loadedRoutineId === sandbox.state.savedRoutines[0].id);
// Sin nombre → NO auto-guarda (el usuario puede Guardar después con auto-nombre)
sandbox.state.savedRoutines = [];
sandbox.window._routineName = '';
sandbox.crearRutina();
t('V4 · sin nombre no auto-guarda (el campo vacío genera el automático al Guardar)',
  sandbox.state.savedRoutines.length === 0);
// createFitnessToday: plan nuevo desenlaza; plan de semana conserva
sandbox.state = { profile: {}, savedRoutines: [], workoutLog: [], fitnessToday: { date: '2026-08-16', loadedRoutineId: 'r1' } };
sandbox.readFitnessContext = function () { return { date: '2026-08-16', steps: 5000, energy: 3, pain: 0, sleep: 7, focus: 'Pecho', equip: 'Gimnasio', hard: false, recovery: false }; };
sandbox.todayRoutinePlan = function () { return null; };
sandbox.buildFitnessTodayPlan = function () { return [{ name: 'Press banca con barra', muscle: 'pecho', sets: 3, reps: '6-15', rest: 135, alts: [], note: '' }]; };
sandbox.renderFitnessCoach = function () {};
sandbox.createFitnessToday = createFitnessTodayReal; // restaurar la real (V2 la sombreó)
sandbox.createFitnessToday();
t('V5 · al regenerar un plan NUEVO el campo se desenlaza (prepara nombre nuevo)',
  sandbox.state.fitnessToday.loadedRoutineId === null);
sandbox.state.fitnessToday = { date: '2026-08-16', loadedRoutineId: 'r1' };
sandbox.todayRoutinePlan = function () { return { rest: false, plan: [{ name: 'X' }], dayName: 'Pierna' }; };
sandbox.createFitnessToday();
t('V6 · el plan de la semana conserva su enlace', sandbox.state.fitnessToday.loadedRoutineId === 'r1');
// Uso posterior desde Rutinas guardadas (recargar + cargar)
var estadoV = JSON.parse(JSON.stringify(sandbox.state));
estadoV.savedRoutines = [{ id: 'r9', name: 'Pierna martes', plan: [{ name: 'Sentadilla con barra', muscle: 'pierna', sets: 3, reps: '6-15', rest: 180 }], date: '2026-08-16' }];
sandbox.state = estadoV;
sandbox.state.fitnessToday = null;
sandbox.loadSavedRoutine('r9');
t('V7 · al usarla desde Rutinas guardadas, el nombre aparece y sigue editable',
  sandbox.state.fitnessToday.loadedRoutineId === 'r9' && sandbox.state.fitnessToday.loadedName === 'Pierna martes');
t('V8 · workoutLog sigue intacto', (sandbox.state.workoutLog || []).length === 0);

// ============================================================
// G · El nombre viaja con la sincronización actual (merge por id)
// ============================================================
console.log('\n== G · Sincronización ==');
var wlAntesG = JSON.stringify(sandbox.state.workoutLog || []);
var fusion = sandbox._mergeArrays(
  [{ id: 'a', name: 'Rutina A', plan: [1] }, { id: 'b', plan: [2] }],
  [{ id: 'c', name: 'Rutina C', plan: [3] }]
);
t('G1 · la unión conserva las rutinas con nombre de ambos dispositivos (0 pérdidas)',
  fusion.length === 3 && fusion.find(function (r) { return r.id === 'a'; }).name === 'Rutina A'
  && fusion.find(function (r) { return r.id === 'c'; }).name === 'Rutina C');
t('G2 · el merge NO toca workoutLog', JSON.stringify(sandbox.state.workoutLog || []) === wlAntesG);

// ============================================================
// H · UI presente
// ============================================================
console.log('\n== H · UI ==');
t('H1 · el campo de nombre está en Mi rutina de hoy', HTML.indexOf('routineNameInput') >= 0);
t('H2 · la lista de rutinas guardadas muestra el nombre y el botón de renombrar',
  HTML.indexOf('f3NombreMostrar(r)') >= 0 && HTML.indexOf('renombrarRutina') >= 0);

console.log('\n==========================================');
console.log('Resultado: ' + passed + ' pasaron · ' + failed + ' fallaron');
console.log('==========================================');
if (failed) {
  console.log('\nFallos:\n' + failures.map(function (f) { return '  ✗ ' + f; }).join('\n'));
  process.exit(1);
}
process.exit(0);

