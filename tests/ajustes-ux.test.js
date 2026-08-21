// ============================================================
// PRUEBAS — UX de Mi configuracion (acordeon exclusivo, barra de
// cambios pendientes, resumenes reales, navegacion de regreso,
// responsive). Sin datos duplicados: todo lee state.profile,
// state.kitchenTools y state.uiSettings.
// Uso: node tests/ajustes-ux.test.js
// ============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extractFunc(name) {
  var src = HTML;
  let i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('No se encontró function ' + name);
  let parens = 0, j = i, q = null, lc = false, bc = false, bs = -1;
  for (; j < src.length; j++) {
    const c = src[j], n = src[j + 1];
    if (lc) { if (c === '\n') lc = false; continue; }
    if (bc) { if (c === '*' && n === '/') { bc = false; j++; } continue; }
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '/' && n === '/') { lc = true; j++; continue; }
    if (c === '/' && n === '*') { bc = true; j++; continue; }
    if (c === '(') parens++;
    else if (c === ')') { parens--; if (parens === 0) { bs = j + 1; break; } }
  }
  if (bs < 0) throw new Error('params de ' + name);
  let d = 0; q = null; lc = false; bc = false; j = bs;
  for (; j < src.length; j++) {
    const c = src[j], n = src[j + 1];
    if (lc) { if (c === '\n') lc = false; continue; }
    if (bc) { if (c === '*' && n === '/') { bc = false; j++; } continue; }
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '/' && n === '/') { lc = true; j++; continue; }
    if (c === '/' && n === '*') { bc = true; j++; continue; }
    if (c === '{') d++;
    else if (c === '}') { d--; if (d === 0) return src.slice(i, j + 1); }
  }
  throw new Error('incompleta: ' + name);
}
function extractVarArrA(name) {
  var BSC = String.fromCharCode(92);
  var m = HTML.match(new RegExp('(?:const|var) ' + name + '=(' + BSC + '[' + '.*?' + BSC + ']' + ');', 's'));
  if (!m) throw new Error('No se encontró ' + name);
  return m[1];
}
function extractObjB(name) {
  var m = HTML.match(new RegExp('(?:const|var) ' + name + '=(\{.*?\});', 's'));
  if (!m) throw new Error('No se encontró ' + name);
  return m[1];
}

let passed = 0, failed = 0;
const failures = [];
function t(name, cond, extra) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; failures.push(name + (extra ? ' → ' + extra : '')); console.log('  ✗ ' + name + (extra ? ' → ' + extra : '')); }
}

const docEls = {};
const sandbox = {
  console,
  state: {
    profile: { nombre: 'Rubén', peso: 128, altura: 170, edad: 31, sexo: 'hombre', objetivo: 'ganar músculo', pasosDia: 22000, preferencias: '', restricciones: '', equipo: 'gym', inventario: {}, diasGym: [0, 1, 2, 3, 4], nivelFit: 'intermedio', modoGuiado: false, objetivoFit: 'Ganar músculo sin quedar molido' },
    kitchenTools: { estufa: true, horno: true, microondas: true, licuadora: true, thermomix: true, instantpot: true, airfryer: true, vaporera: true },
    uiSettings: { theme: 'maui', dark: false, notif: false },
    workoutLog: []
  },
  PP_THEMES: { maui: { nombre: 'Maui' }, oceano: { nombre: 'Océano' } },
  PP_SYNC: { kind: 'synced' },
  safeStorage: { get: function () { return sandbox._storage; } },
  save: function (inmediato) {
    sandbox._inmediatas = (sandbox._inmediatas || 0) + (inmediato ? 1 : 0);
    sandbox.state.lastModified = new Date().toISOString();
    if (docEls['cfgBarraEstado']) sandbox._barraDurante = docEls['cfgBarraEstado'].innerHTML;
    sandbox._storage = JSON.stringify(sandbox.state);
  },
  safeText: function (x) { return String(x == null ? '' : x); },
  alert: function () {},
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  openTab: function (tab) { sandbox._ultimoTab = tab; },
  document: {
    getElementById: function (id) {
      if (!docEls[id]) docEls[id] = { value: '', innerHTML: '', textContent: '', _tid: null, open: false, style: {}, disabled: false, setAttribute: function () {}, scrollIntoView: function () {}, closest: function () { return { querySelectorAll: function () { return []; } }; } };
      return docEls[id];
    },
    querySelectorAll: function () { return []; }
  }
};
sandbox.window = sandbox;
vm.runInNewContext(
  extractFunc('f3ResumenesConfig') + '\n' +
  extractFunc('f3SnapshotConfig') + '\n' +
  extractFunc('f3CambiosPendientes') + '\n' +
  extractFunc('f3BarraCambiosHTML') + '\n' +
  extractFunc('f3BarraEstado') + '\n' +
  extractFunc('f3RefrescarBarra') + '\n' +
  extractFunc('f3RefrescarResumenes') + '\n' +
  extractFunc('f3RefrescarConfigUI') + '\n' +
  extractFunc('f3IrConfiguracion') + '\n' +
  extractFunc('f3VolverDeConfig') + '\n' +
  extractFunc('accordion') + '\n' +
  extractFunc('quickSaved') + '\n' +
  extractFunc('toggleKitchenTool') + '\n' +
  extractFunc('guardarConfiguracion') + '\n' +
  'var KITCHEN_TOOLS_ORDER=' + extractVarArrA('KITCHEN_TOOLS_ORDER') + ';\n' +
  'var KITCHEN_METHODS=' + extractObjB('KITCHEN_METHODS') + ';',
  sandbox
);

function snapshotBase() { sandbox.window._cfgSnapshot = sandbox.f3SnapshotConfig(); }
function reabrir() { sandbox.state = JSON.parse(sandbox._storage); return sandbox.state; }

// ============================================================
// 1-2 · Acordeon exclusivo y sin cambios falsos
// ============================================================
function g(id) { return sandbox.document.getElementById(id); }
function el(id) { return sandbox.document.getElementById(id); }

// ============================================================
// 1-2 · Acordeon exclusivo y sin cambios falsos
// ============================================================
console.log('== 1-2 · Acordeon exclusivo ==');
var elCocina = el('ajCocina');
var elEnt = el('ajEnt');
elCocina.open = true; elEnt.open = true;
elCocina.closest = function () { return { querySelectorAll: function () { return [elEnt, elCocina]; } }; };
sandbox.accordion(elCocina);
t('1 · abrir Mi cocina cierra Entrenamiento (acordeon exclusivo)', elCocina.open === true && elEnt.open === false);
snapshotBase();
sandbox.f3RefrescarBarra();
t('2 · abrir/cerrar acordeones NO activa Cambios sin guardar',
  sandbox.f3CambiosPendientes() === false && el('cfgBarraCambios').style.display === 'none');

// ============================================================
// 3-4 · Barra aparece SOLO con cambios reales y desaparece al revertir
// ============================================================
console.log('== 3-4 · Barra de cambios reales ==');
snapshotBase();
sandbox.toggleKitchenTool('horno');
t('3 · cambiar un aparato -> aparece la barra con Cambios sin guardar',
  sandbox.f3CambiosPendientes() === true && el('cfgBarraCambios').style.display === 'block'
  && el('cfgBarraEstado').innerHTML.indexOf('🟠 Cambios sin guardar') >= 0);
sandbox.toggleKitchenTool('horno');
t('4 · revertir manualmente al valor original -> la barra desaparece',
  sandbox.f3CambiosPendientes() === false && el('cfgBarraCambios').style.display === 'none');

// ============================================================
// 5-8 · Guardado real: Guardando -> resultado real (sin timeouts falsos)
// ============================================================
console.log('== 5-8 · Guardado real ==');
snapshotBase();
sandbox.state.kitchenTools.horno = false;
sandbox.PP_SYNC.kind = 'pending';
el('cfgNombre').value = 'Rubén';
sandbox.guardarConfiguracion();
t('5 · al guardar la barra pasa por ⏳ Guardando... y termina en estado real',
  sandbox._barraDurante === '⏳ Guardando...' && el('cfgBarraEstado').innerHTML.indexOf('🟡 Guardado local · sincronizando…') >= 0,
  el('cfgBarraEstado').innerHTML);
t('5b · tras el guardado real no quedan cambios pendientes',
  sandbox.f3CambiosPendientes() === false);
sandbox.safeStorage = { get: function () { return '{{roto'; } };
sandbox.guardarConfiguracion();
t('6 · error de persistencia -> 🔴 Error al guardar · Reintentar',
  el('cfgBarraEstado').innerHTML.indexOf('🔴 Error al guardar') >= 0
  && el('cfgBarraBtn').innerHTML.indexOf('↻ Reintentar') >= 0);
sandbox.safeStorage = { get: function () { return sandbox._storage; } };
sandbox.PP_SYNC.kind = 'synced';
sandbox.guardarConfiguracion();
t('8 · sincronizacion confirmada -> 🟢 Sincronizado',
  el('cfgBarraEstado').innerHTML.indexOf('🟢 Sincronizado') >= 0
  && el('cfgSyncBadge').innerHTML.indexOf('🟢 Sincronizado') >= 0);

// ============================================================
// 9-10 · Un solo guardado conserva todo y persiste tras Ctrl+F5/reabrir
// ============================================================
console.log('== 9-10 · Un solo guardado conserva todo ==');
el('cfgNombre').value = 'Rubén Ajustes';
sandbox.state.profile = { nombre: '', peso: 128, altura: 170, edad: 31, sexo: 'hombre', objetivo: 'ganar músculo', pasosDia: 22000, modoGuiado: true };
sandbox.state.kitchenTools = { horno: false, estufa: true };
snapshotBase();
sandbox.guardarConfiguracion();
var reTodo = reabrir();
t('9 · UN solo guardado conserva perfil + cocina + entrenamiento',
  reTodo.profile.nombre === 'Rubén Ajustes' && reTodo.profile.modoGuiado === true && reTodo.kitchenTools.horno === false);
t('10 · Ctrl+F5/reabrir conserva los cambios', reTodo.profile.nombre === 'Rubén Ajustes' && reTodo.kitchenTools.horno === false);

// ============================================================
// 11 · Resumenes reales y refrescables
// ============================================================
console.log('== 11 · Resumenes reales ==');
var R1 = sandbox.f3ResumenesConfig();
t('11 · los resumenes salen de los datos reales',
  R1.perfil === 'Rubén Ajustes · 128 lb · 170 cm' && R1.alim.indexOf('ganar músculo') >= 0 && R1.notif === 'Desactivadas');
sandbox.state.kitchenTools.horno = true;
sandbox.f3RefrescarResumenes();
t('11b · al cambiar un dato, el resumen se actualiza',
  el('cfgResumenCocina').textContent.indexOf('Horno') >= 0);

// ============================================================
// 12-13 · Navegacion de regreso con origen
// ============================================================
console.log('== 12-13 · Navegacion de regreso ==');
sandbox.f3IrConfiguracion('ajCocina', '🍽️ Comer');
t('12 · Comer -> Mi cocina abre la seccion y muestra Volver a Comer',
  sandbox.window._cfgVolver === '🍽️ Comer' && el('cfgVolverBtn').textContent.indexOf('Volver a 🍽️ Comer') >= 0 && el('ajCocina').open === true);
sandbox.f3VolverDeConfig();
t('12b · Volver regresa a Comer', sandbox._ultimoTab === '🍽️ Comer');
sandbox.f3IrConfiguracion('ajConfigRutina', '💪 Ejercicio');
t('13 · Fitness -> Entrenamiento -> Volver a Fitness',
  sandbox.window._cfgVolver === '💪 Ejercicio' && el('ajConfigRutina').open === true && el('cfgVolverBtn').textContent.indexOf('Volver a 💪 Ejercicio') >= 0);
sandbox.f3VolverDeConfig();
t('13b · Volver regresa a Fitness', sandbox._ultimoTab === '💪 Ejercicio');

// ============================================================
// 14-15 · Responsive iPhone y escritorio (sin overflow)
// ============================================================
console.log('== 14-15 · Responsive ==');
t('14 · iPhone 390px: barra fija con safe-area y sin overflow horizontal',
  HTML.indexOf('.cfg-barra{position:fixed') >= 0 && HTML.indexOf('env(safe-area-inset-bottom)') >= 0
  && HTML.indexOf('max-width:100vw') >= 0 && HTML.indexOf('.grid input,.grid select{min-width:0') >= 0
  && HTML.indexOf('flex-wrap:wrap') >= 0);
t('15 · escritorio: barra centrada con ancho maximo y botones de al menos 44px',
  HTML.indexOf('max-width:860px') >= 0 && HTML.indexOf('min-height:44px') >= 0);

console.log('');
console.log('==========================================');

// ============================================================
// A/B/H · Recargar sin barra, acordeones sin barra, chevrons
// ============================================================
console.log('== A/B/H · Barra solo con cambios reales y chevrons ==');
// A) Recargar Ajustes: la barra NO debe verse sin cambios
sandbox.window._cfgSnapshot = null;
sandbox.window._cfgSnapshot = sandbox.f3SnapshotConfig();
sandbox.f3RefrescarBarra();
t('A · recargar Ajustes sin tocar datos -> la barra NO es visible',
  el('cfgBarraCambios').style.display === 'none');
// B) Abrir/cerrar acordeones NO cuenta como cambio
sandbox.window._cfgSnapshot = sandbox.f3SnapshotConfig();
var cB = el('ajCocina'), tB = el('ajEnt');
cB.closest = function () { return { querySelectorAll: function () { return [tB, cB]; } }; };
cB.open = true; sandbox.accordion(cB); cB.open = false;
tB.open = true; sandbox.accordion(tB); tB.open = false;
sandbox.f3RefrescarBarra();
t('B · abrir/cerrar Mi cocina y Entrenamiento -> la barra NO aparece',
  sandbox.f3CambiosPendientes() === false && el('cfgBarraCambios').style.display === 'none');
// E) cambio -> guardar -> estados reales -> barra desaparece (relectura real)
sandbox.window._cfgSnapshot = sandbox.f3SnapshotConfig();
sandbox.toggleKitchenTool('licuadora');
t('E1 · cambiar aparato -> barra visible con Guardar', el('cfgBarraCambios').style.display === 'block');
sandbox.PP_SYNC.kind = 'pending';
sandbox.guardarConfiguracion();
t('E2 · tras guardar: barra en estado real (local/sincronizando o sincronizado), sin pendientes',
  sandbox.f3CambiosPendientes() === false && el('cfgBarraEstado').innerHTML.indexOf('🟡') >= 0);
sandbox.PP_SYNC.kind = 'synced';
sandbox.guardarConfiguracion();
t('E3 · con sincronizacion confirmada la barra muestra 🟢 Sincronizado',
  el('cfgBarraEstado').innerHTML.indexOf('🟢 Sincronizado') >= 0);
// H) chevrons en todos los acordeones
t('H · los acordeones muestran indicador cerrado y abierto',
  HTML.indexOf('summary::after{content:') >= 0 && HTML.indexOf('›') >= 0 && HTML.indexOf('[open] summary::after{content:') >= 0 && HTML.indexOf('⌄') >= 0);
console.log('Resultado: ' + passed + ' pasaron · ' + failed + ' fallaron');
console.log('==========================================');
if (failed) {
  console.log('Fallos:');
  console.log(failures.map(function (f) { return '  ✗ ' + f; }).join('\n'));
  process.exit(1);
}
process.exit(0);
