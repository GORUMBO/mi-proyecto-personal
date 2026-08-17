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
  ppUUID: function () { sandbox._uuid = (sandbox._uuid || 0) + 1; return 'uuid-' + sandbox._uuid; },
  renderSavedRoutines: function () {},
  quickFitnessToday: function () {},
  document: {
    getElementById: function () { return { value: '', innerHTML: '', textContent: '', style: { opacity: '' } }; }
  },
  setTimeout: setTimeout,
  clearTimeout: clearTimeout
};
sandbox.window = sandbox;
vm.runInNewContext(
  extractFunc('f3NombreRutinaAuto') + '\n' +
  extractFunc('f3NombreMostrar') + '\n' +
  extractFunc('f3NombreAGuardar') + '\n' +
  extractFunc('renombrarRutina') + '\n' +
  extractFunc('saveCurrentRoutine') + '\n' +
  extractFunc('repetirRutina') + '\n' +
  extractFunc('loadSavedRoutine') + '\n' +
  extractFunc('_mergeArrays'),
  sandbox
);

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
// G · El nombre viaja con la sincronización actual (merge por id)
// ============================================================
console.log('\n== G · Sincronización ==');
var fusion = sandbox._mergeArrays(
  [{ id: 'a', name: 'Rutina A', plan: [1] }, { id: 'b', plan: [2] }],
  [{ id: 'c', name: 'Rutina C', plan: [3] }]
);
t('G1 · la unión conserva las rutinas con nombre de ambos dispositivos (0 pérdidas)',
  fusion.length === 3 && fusion.find(function (r) { return r.id === 'a'; }).name === 'Rutina A'
  && fusion.find(function (r) { return r.id === 'c'; }).name === 'Rutina C');
t('G2 · workoutLog no se tocó en ningún paso', (sandbox.state.workoutLog || []).length === 0);

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
