// ============================================================
// PRUEBAS — Reorganización de la pantalla Fitness (solo UI)
// Visibles: Rutinas guardadas + Registrar ejercicio + Más herramientas
// (que contiene Ajustes, Configurar/herramientas, favoritos, pareja,
// avanzadas, grasa y progreso). Acordeón sin auto-scroll. Las funciones
// existentes NO se eliminaron.
// Uso: node tests/fitness-ui.test.js
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
// A · Estructura: lo visible y lo que quedó dentro de Más herramientas
// ============================================================
console.log('\n== A · Estructura de la pantalla Fitness ==');
const sec = String(extractFunc('secEjercicio'));
const iMas = sec.indexOf('id="masHerramientasDetails"');
const iRut = sec.indexOf('id="savedRoutinesDetails"');
const iReg = sec.indexOf('id="fitnessRegisterDetails"');
t('A1 · existe el bloque único Más herramientas', iMas >= 0);
t('A2 · orden: Rutinas guardadas → Registrar ejercicio → Más herramientas',
  iRut >= 0 && iReg >= 0 && iRut < iReg && iReg < iMas);
['⚙️ Ajustes de rutina', '⚙️ Configurar y herramientas', '📊 Progreso y estadísticas', '${secExFavoritos()}', '${secParejasMusculo()}', '${advanced}'].forEach(function (s) {
  t('A3 · "' + s + '" quedó DENTRO de Más herramientas', sec.indexOf(s) > iMas, 'pos ' + sec.indexOf(s) + ' vs ' + iMas);
});
var posParejas = sec.indexOf('${secParejasMusculo()}');
var posCoach = sec.indexOf('fitnessCoachOut');
t('A4 · Más herramientas se cierra antes de los contenedores ocultos',
  posCoach > posParejas && posParejas > iMas && sec.slice(posParejas, posCoach).indexOf('</details>') >= 0);
t('A5 · las funciones siguen existiendo (nada se borró)',
  ['saveSimpleWorkout', 'generateCustomRoutine', 'calcNavyBodyFat', 'renderExerciseProgress', 'secExFavoritos', 'secParejasMusculo', 'setNivelFit'].every(function (f) { return HTML.indexOf(f) >= 0; }));

// ============================================================
// B · Acordeón: al abrir una principal se cierran las otras
// ============================================================
console.log('\n== B · Acordeón ==');
const els = {};
const docStub = {
  getElementById: function (id) {
    if (!els[id]) els[id] = { id: id, open: false };
    return els[id];
  }
};
const sandbox = { console, document: docStub };
vm.runInNewContext(extractFunc('fitAcordeonPrincipal'), sandbox);
docStub.getElementById('masHerramientasDetails').open = true;
docStub.getElementById('savedRoutinesDetails').open = true;
sandbox.fitAcordeonPrincipal({ id: 'savedRoutinesDetails', open: true });
t('B1 · abrir Rutinas guardadas cierra Más herramientas',
  els.masHerramientasDetails.open === false && els.fitnessRegisterDetails.open === false && els.savedRoutinesDetails.open === true);
docStub.getElementById('fitnessRegisterDetails').open = true;
sandbox.fitAcordeonPrincipal({ id: 'fitnessRegisterDetails', open: true });
t('B2 · abrir Registrar ejercicio cierra Rutinas guardadas',
  els.savedRoutinesDetails.open === false && els.fitnessRegisterDetails.open === true);
sandbox.fitAcordeonPrincipal({ id: 'savedRoutinesDetails', open: false });
t('B3 · cerrar una sección NO abre las demás', els.masHerramientasDetails.open === false);

// ============================================================
// C · Sin auto-scroll
// ============================================================
console.log('\n== C · Sin auto-scroll ==');
const srcShow = String(extractFunc('showSavedRoutines'));
t('C1 · showSavedRoutines ya no usa scrollIntoView', srcShow.indexOf('scrollIntoView') < 0);
t('C2 · quickFitnessToday (render interno) tampoco',
  String(extractFunc('quickFitnessToday')).indexOf('out.scrollIntoView(') < 0);

console.log('\n==========================================');
console.log('Resultado: ' + passed + ' pasaron · ' + failed + ' fallaron');
console.log('==========================================');
if (failed) {
  console.log('\nFallos:\n' + failures.map(function (f) { return '  ✗ ' + f; }).join('\n'));
  process.exit(1);
}
process.exit(0);
