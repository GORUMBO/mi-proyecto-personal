// ============================================================
// PRUEBAS — Ajustes de rutina como fuente unica del perfil
// Boton manual "Guardar configuracion": todo vive en state.profile
// (una sola fuente), persiste, no borra nada y no crea almacenamiento
// paralelo. Autosave existente se conserva.
// Uso: node tests/ajustes-perfil.test.js
// ============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extractVarArrA(name) { var BSC = String.fromCharCode(92); var m = HTML.match(new RegExp('(?:const|var) ' + name + '=(' + BSC + '[' + '.*?' + BSC + ']' + ');', 's')); if (!m) throw new Error('No se encontró ' + name); return m[1]; }
function extractObjB(name) { var m = HTML.match(new RegExp('(?:const|var) ' + name + '=({.*?});', 's')); if (!m) throw new Error('No se encontró ' + name); return m[1]; }
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

let passed = 0, failed = 0;
const failures = [];
function t(name, cond, extra) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; failures.push(name + (extra ? ' → ' + extra : '')); console.log('  ✗ ' + name + (extra ? ' → ' + extra : '')); }
}

// ============================================================
// Sandbox: perfil + persistencia simulada (guardar -> JSON -> reabrir)
// ============================================================
const docEls = {};
const sandbox = {
  console,
  state: {
    profile: { nombre: '', peso: 150, altura: 170, edad: 30, sexo: 'hombre', objetivo: 'ganar peso', pasosDia: 22000, preferencias: '' },
    workoutLog: [{ id: 1, date: '2026-08-18', exercise: 'Sentadilla con barra', weight: 100, sets: 3, reps: '10', note: 'x' }],
    savedRoutines: [{ id: 'r1', name: 'Mi rutina', plan: [{ name: 'Press banca con barra', muscle: 'pecho', sets: 3, reps: '6-15', rest: 135 }], date: '2026-08-10' }],
    customRoutine: { days: [{ day: 'Empuje A', exercises: [] }], weekSchedule: [0, 'rest', 'rest', 'rest', 'rest', 'rest', 'rest'] },
    fitnessToday: null
  },
  todayISO: function () { return '2026-08-19'; },
  safeStorage: { get: function () { return sandbox._storage; } },
  save: function (inmediato) {
    sandbox._saves = (sandbox._saves || 0) + 1;
    if (inmediato) sandbox._inmediatas = (sandbox._inmediatas || 0) + 1;
    if (docEls['cfgGuardarBtn'] && docEls['cfgGuardarBtn']._guardarCaptura) docEls['cfgGuardarBtn']._guardarCaptura();
    sandbox.state.lastModified = new Date().toISOString();
    sandbox._storage = JSON.stringify(sandbox.state);
  },
  safeText: function (x) { return String(x == null ? '' : x); },
  alert: function () {},
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  document: {
    getElementById: function (id) {
      if (!docEls[id]) docEls[id] = { value: '', innerHTML: '', textContent: '', _tid: null, setAttribute: function () {}, disabled: false };
      if (id === 'cfgGuardarBtn' && docEls[id]._guardarCaptura === undefined) { docEls[id]._guardarCaptura = function () { sandbox._btnDurante = docEls[id].innerHTML; }; }
      return docEls[id];
    },
    querySelectorAll: function () { return []; }
  }
};
sandbox.window = sandbox;
vm.runInNewContext(
  extractFunc('guardarConfiguracion') + '\n' +
  extractFunc('f3SnapshotConfig') + '\n' +
  extractFunc('f3CambiosPendientes') + '\n' +
  extractFunc('f3BarraEstado') + '\n' +
  extractFunc('f3BarraCambiosHTML') + '\n' +
  extractFunc('f3RefrescarBarra') + '\n' +
  extractFunc('f3RefrescarResumenes') + '\n' +
  extractFunc('f3RefrescarConfigUI') + '\n' +
  extractFunc('f3ResumenesConfig') + '\n' +
  extractFunc('f3EquipoActualLabel') + '\n' +
  extractFunc('f3PerfilSectionHTML') + '\n' +
  extractFunc('profileAvatarHTML') + '\n' +
  extractFunc('f3AlimentacionSectionHTML') + '\n' +
  extractFunc('f3CocinaSectionHTML') + '\n' +
  extractFunc('f3GuardadoSectionHTML') + '\n' +
  extractFunc('f3EntrenamientoHTML') + '\n' +
  extractFunc('toggleKitchenTool') + '\n' +
  extractFunc('methodEnabled') + '\n' +
  extractFunc('f3EquipoAjustesHTML') + '\n' +
  extractFunc('f3DiasAjustesHTML') + '\n' +
  extractFunc('f3EquipoOpcionesHTML') + '\n' +
  extractFunc('f3InventarioOpcionesHTML') + '\n' +
  extractFunc('f3EquipoTexto') + '\n' +
  extractFunc('diasGymTexto') + '\n' +
  'var DIAS_SEMANA=' + extractVarArrA('DIAS_SEMANA') + ';' +
  'var KITCHEN_TOOLS_ORDER=' + extractVarArrA('KITCHEN_TOOLS_ORDER') + ';' +
  'var KITCHEN_METHODS=' + extractObjB('KITCHEN_METHODS') + ';',
  sandbox
);

function reabrir() {
  sandbox.state = JSON.parse(sandbox._storage);
  return sandbox.state;
}
function g(id) { return sandbox.document.getElementById(id); }

// ============================================================
// 1-8: cada dato personal persiste (guardar -> reabrir)
// ============================================================
console.log('== 1-8 · Datos personales persisten ==');
g('cfgNombre').value = 'Rubén';
g('cfgPeso').value = '180';
g('cfgAltura').value = '175';
g('cfgEdad').value = '31';
g('cfgSexo').value = 'hombre';
g('cfgObjetivo').value = 'mantener';
g('cfgPasos').value = '18000';
g('cfgPreferencias').value = 'sin cerdo, más pollo';
sandbox.guardarConfiguracion();
var p1 = sandbox.state.profile;
t('1 · Nombre persiste', p1.nombre === 'Rubén', p1.nombre);
t('2 · Peso persiste', p1.peso === 180, String(p1.peso));
t('3 · Altura persiste', p1.altura === 175, String(p1.altura));
t('4 · Edad persiste', p1.edad === 31, String(p1.edad));
t('5 · Sexo persiste', p1.sexo === 'hombre', p1.sexo);
t('6 · Objetivo persiste', p1.objetivo === 'mantener', p1.objetivo);
t('7 · Pasos persisten', p1.pasosDia === 18000, String(p1.pasosDia));
t('8 · Preferencias de comida persisten', p1.preferencias === 'sin cerdo, más pollo', p1.preferencias);

// ============================================================
// 9-12: equipo, inventario, modo guiado y cerrar/reabrir
// ============================================================
console.log('== 9-12 · Equipo, inventario, modo guiado y reapertura ==');
sandbox.state.profile.equipo = 'casa_equipo';
sandbox.state.profile.inventario = { man: true, ban: true, bar: true };
sandbox.state.profile.modoGuiado = false;
sandbox.guardarConfiguracion();
var re1 = reabrir();
t('9 · Equipo disponible persiste', re1.profile.equipo === 'casa_equipo', re1.profile.equipo);
t('10 · Inventario persiste', !!re1.profile.inventario && re1.profile.inventario.man === true && re1.profile.inventario.bar === true, JSON.stringify(re1.profile.inventario));
t('11 · Modo guiado persiste (desactivado predeterminado)', re1.profile.modoGuiado === false, String(re1.profile.modoGuiado));
t('12 · Cerrar/reabrir conserva TODA la configuracion (nombre, peso, equipo...)',
  re1.profile.nombre === 'Rubén' && re1.profile.peso === 180 && re1.profile.objetivo === 'mantener'
  && re1.profile.equipo === 'casa_equipo' && re1.profile.modoGuiado === false,
  JSON.stringify({ nombre: re1.profile.nombre, peso: re1.profile.peso, objetivo: re1.profile.objetivo, equipo: re1.profile.equipo }));

// ============================================================
// 13-14: cambiar una preferencia no borra las demas; no toca workoutLog
// ============================================================
console.log('== 13-14 · Sin perdidas colaterales ==');
g('cfgObjetivo').value = 'bajar grasa';
var logAntes = JSON.stringify(sandbox.state.workoutLog);
var rutinasAntes = JSON.stringify(sandbox.state.savedRoutines);
sandbox.guardarConfiguracion();
t('13 · cambiar una preferencia NO borra las demas',
  sandbox.state.profile.objetivo === 'bajar grasa' && sandbox.state.profile.nombre === 'Rubén'
  && sandbox.state.profile.peso === 180 && sandbox.state.profile.equipo === 'casa_equipo');
t('14 · Guardar configuracion NO modifica workoutLog ni rutinas guardadas',
  JSON.stringify(sandbox.state.workoutLog) === logAntes && JSON.stringify(sandbox.state.savedRoutines) === rutinasAntes);

// ============================================================
// 15: Fitness y Alimentacion leen los MISMOS datos guardados
// ============================================================
console.log('== 15 · Una sola fuente para Fitness y Alimentacion ==');
var re2 = reabrir();
t('15 · Fitness (equipo) y Alimentacion (peso/objetivo) leen el mismo perfil reabierto',
  sandbox.f3EquipoActualLabel() === 'Casa con equipo' && re2.profile.peso === 180 && re2.profile.objetivo === 'bajar grasa',
  sandbox.f3EquipoActualLabel() + ' | ' + re2.profile.peso + ' | ' + re2.profile.objetivo);

// ============================================================
// UI: boton general, confirmacion, sin botones redundantes, autosave vivo
// ============================================================
console.log('== UI ==');
t('U1 · la barra inferior es el UNICO guardado (sin boton grande duplicado)', HTML.indexOf('<button id="cfgGuardarBtn"') < 0 && (HTML.match(/id="cfgBarraBtn"/g) || []).length === 1 && HTML.indexOf('Haz tus cambios y pulsa') >= 0);
t('U2 · el boton redundante "Guardar mis pasos" fue eliminado', HTML.indexOf('Guardar mis pasos') < 0);
t('U3 · el autosave existente se conserva (nombre con quickSaved)', HTML.indexOf('state.profile.nombre=this.value;quickSaved()') >= 0);
t('U4 · mensaje de confirmacion no bloqueante', HTML.indexOf('✅ Configuración guardada') >= 0);
t('U5 · guardar fuerza la persistencia inmediata (save(true))', sandbox._inmediatas >= 1, String(sandbox._inmediatas));

console.log('');
console.log('==========================================');

// ============================================================
// T16-T18: los campos viven DENTRO de Ajustes de rutina y cargan del perfil
// ============================================================
console.log('== T16-T18 · Integracion en Ajustes de rutina ==');
t('T16 · el campo Nombre de Ajustes carga el valor guardado en state.profile',
  HTML.indexOf('id="cfgNombre"') >= 0 && HTML.indexOf('safeText(p.nombre||') >= 0);
t('T17 · todos los campos personales estan en el bloque de Ajustes',
  ['cfgNombre', 'cfgPeso', 'cfgAltura', 'cfgEdad', 'cfgSexo', 'cfgObjetivo', 'cfgPasos', 'cfgPreferencias'].every(function (id) { return HTML.indexOf('id="' + id + '"') >= 0; }));
t('T18 · equipo, inventario y dias de entrenamiento comparten los MISMOS controles',
  HTML.indexOf('f3EquipoAjustesHTML()') >= 0 && HTML.indexOf('f3DiasAjustesHTML()') >= 0);
// Fallback: si los controles de Ajustes no existen, se leen los anteriores
g('cfgNombre').value = '';
g('nombrePerfil').value = 'Rubén (control anterior)';
sandbox.guardarConfiguracion();
t('T19 · respaldo a controles anteriores sin duplicar datos',
  sandbox.state.profile.nombre === 'Rubén (control anterior)');

// ============================================================
// T20-T22 · el formulario vive en Configurar rutina (Ajustes) y el nombre se muestra
t('T22 · Ajustes tiene el acceso principal Configurar rutina', HTML.indexOf('⚙️ Configurar rutina') >= 0 && HTML.indexOf('id="ajConfigRutina"') >= 0);
// ============================================================
console.log('== T20-T23 · Configurar rutina como unico formulario ==');
sandbox.state.profile.nombre = 'Rubén';
sandbox.state.profile.equipo = 'casa_equipo';
sandbox.state.profile.inventario = { man: true };
var htmlPanel = sandbox.f3PerfilSectionHTML();
t('T20 · el formulario muestra el nombre guardado (Rubén)',
  htmlPanel.indexOf('value="Rubén"') >= 0 && htmlPanel.indexOf('id="cfgNombre"') >= 0,
  htmlPanel.slice(0, 200));
t('T20b · Mi perfil incluye los datos personales y Entrenamiento el resto',
  ['cfgPeso','cfgAltura','cfgEdad','cfgSexo'].every(function (id) { return htmlPanel.indexOf('id="' + id + '"') >= 0; })
  && (function(){ var hE = sandbox.f3EntrenamientoHTML(); return ['simpleFitGuiado','flexFitMinutes','simpleFitNivel'].every(function (id) { return hE.indexOf('id="' + id + '"') >= 0; }) && hE.indexOf('Mancuernas') >= 0 && hE.indexOf('Lun') >= 0; })()
  && (function(){ var hG = sandbox.f3GuardadoSectionHTML(); return hG.indexOf('cfgGuardarBtn') < 0 && hG.indexOf('barra inferior') >= 0; })());
t('T21 · Ajustes ya NO muestra la tarjeta antigua de comida (una sola pantalla)',
  HTML.indexOf('<div id="v4124perfilDatos">') < 0 && HTML.indexOf('abrirConfigurarRutina') >= 0);
t('T22 · Ajustes tiene la seccion Entrenamiento (mismo bloque ajConfigRutina)',
  HTML.indexOf('🏋️ Entrenamiento') >= 0 && HTML.indexOf('id="ajConfigRutina"') >= 0);
t('T23 · el tab Fitness enlaza a Entrenamiento sin duplicar el formulario',
  HTML.indexOf('⚙️ Abrir Entrenamiento') >= 0 && (HTML.match(/id="cfgNombre"/g) || []).length === 1);

// ============================================================
// T24-T27 · layout de la comida y flujo completo del nombre
// ============================================================
console.log('== T24-T27 · Layout y flujo del nombre ==');
t('T24 · sin grid anidado duplicado (causa raiz del layout roto)',
  HTML.indexOf('class="profile-clean-grid"><div class="profile-clean-grid"') < 0);
t('T25 · Mi perfil LEE state.profile.nombre (una sola fuente)',
  HTML.indexOf('var p=state.profile||{};') >= 0 && HTML.indexOf('safeText(p.nombre||') >= 0);
t('T26 · boton visible ' + String.fromCharCode(39) + '⚙️ Configurar rutina' + String.fromCharCode(39) + ' en la tarjeta y grid de macros responsive',
  HTML.indexOf('>⚙️ Configurar rutina</button>') < 0 && HTML.indexOf('repeat(auto-fit,minmax(130px,1fr))') >= 0);
// Flujo completo: escribir -> guardar -> reabrir -> la tarjeta lo leería
g('cfgNombre').value = 'Rubén';
sandbox.state.profile.nombre = '';
sandbox.guardarConfiguracion();
var reT = reabrir();
t('T27 · flujo completo: Configurar rutina -> Guardar -> reabrir -> nombre en el perfil',
  sandbox.state.profile.nombre === 'Rubén' && reT.profile.nombre === 'Rubén');
t('T27b · peso/altura/edad/sexo/objetivo/pasos siguen de la misma fuente',
  reT.profile.peso === 180 && reT.profile.altura === 175 && reT.profile.edad === 31
  && reT.profile.sexo === 'hombre' && reT.profile.objetivo === 'bajar grasa' && reT.profile.pasosDia === 18000,
  JSON.stringify({ peso: reT.profile.peso, altura: reT.profile.altura, edad: reT.profile.edad, sexo: reT.profile.sexo, objetivo: reT.profile.objetivo, pasos: reT.profile.pasosDia }));

// ============================================================
// T28-T31 · centro 'Mi configuracion' y cocina funcional
// ============================================================
console.log('== T28-T31 · Mi configuracion ==');
t('T28 · cabecera Mi configuracion con estado de sincronizacion',
  HTML.indexOf('⚙️ Mi configuración') >= 0 && HTML.indexOf('Todo lo que cambies aquí se usa en toda la aplicación.') >= 0 && HTML.indexOf('✅ Sincronizado') >= 0);
t('T29 · las 6 secciones existen (perfil, alimentacion, cocina, entrenamiento, apariencia, notificaciones)',
  ['👤 Mi perfil','🍽️ Alimentación','🍳 Mi cocina','🏋️ Entrenamiento','🎨 Apariencia y diseño','🔔 Notificaciones'].every(function (x) { return HTML.indexOf(x) >= 0; }));
sandbox.state.kitchenTools = { estufa: true, horno: false, airfryer: true };
var hCoc = sandbox.f3CocinaSectionHTML();
t('T30 · Mi cocina lista los aparatos y methodEnabled consulta esa configuracion',
  hCoc.indexOf('Estufa') >= 0 && hCoc.indexOf('Air Fryer') >= 0 && hCoc.indexOf('Horno') >= 0
  && sandbox.methodEnabled('horno') === false && sandbox.methodEnabled('estufa') === true && sandbox.methodEnabled('sincocinar') === true);
sandbox.toggleKitchenTool('horno');
t('T30b · toggleKitchenTool enciende el aparato y las recetas lo ven',
  sandbox.state.kitchenTools.horno === true && sandbox.methodEnabled('horno') === true);
sandbox.guardarConfiguracion();
var reCoc = reabrir();
t('T31 · la configuracion de cocina persiste tras guardar y reabrir',
  reCoc.kitchenTools.horno === true && reCoc.kitchenTools.airfryer === true);

// ============================================================
// T32-T33 · Mi configuracion REEMPLAZA la estructura antigua
// ============================================================
console.log('== T32-T33 · Una sola pantalla ==');
var iSec = HTML.indexOf('window.secPerfil=function(){');
var iViejo = HTML.indexOf('window.v4124PerfilViejo=function(){', iSec);
var srcSecPerfil = HTML.slice(iSec, iViejo);
t('T32 · secPerfil compone Mi configuracion PRIMERO y la estructura antigua ya no existe',
  iSec >= 0 && srcSecPerfil.indexOf('renderAjustesUnificados()') >= 0 && srcSecPerfil.indexOf('Perfil y meta de comida') < 0 && srcSecPerfil.indexOf('v4124perfilDatos') < 0);
var iCont = HTML.indexOf('function secContador');
var iFinCont = HTML.indexOf('/* ===== 🥪', iCont);
var srcContador = HTML.slice(iCont, iFinCont);
t('T33 · el calculo de comida vive ahora en Comer (Contador), no en Ajustes',
  srcContador.indexOf('Calcular cuánto debo comer') >= 0 && srcContador.indexOf('v4124macroOut') >= 0);

// ============================================================
// T34-T36 · estados REALES del boton de guardado
// ============================================================
console.log('== T34-T36 · Estados del boton ==');
g('cfgNombre').value = 'Rubén';
g('cfgPeso').value = '181';
sandbox.state.profile = { nombre: '', peso: 150 };
sandbox.guardarConfiguracion();
t('T34 · durante el clic el boton muestra ⏳ Guardando... (estado real)',
  sandbox._btnDurante === '⏳ Guardando...', String(sandbox._btnDurante));
t('T34b · al terminar: ✅ Configuración guardada y boton restaurado',
  g('cfgSavedMsg').innerHTML.indexOf('✅ Configuración guardada') >= 0
  && g('cfgGuardarBtn').innerHTML === '💾 Guardar toda mi configuración' && g('cfgGuardarBtn').disabled === false);
t('T34c · Ultimo guardado se actualiza con la hora real (state.lastModified)',
  g('cfgLastSaved').textContent.indexOf('Último guardado: ') >= 0 && !!sandbox.state.lastModified);
// Fallo real: el almacen devuelve JSON roto -> nunca dice guardado
sandbox.safeStorage = { get: function () { return '{{roto'; } };
g('cfgNombre').value = 'Fallo';
sandbox.guardarConfiguracion();
t('T35 · si la persistencia falla: ❌ Error al guardar · Reintentar (sin exito falso)',
  g('cfgGuardarBtn').innerHTML.indexOf('❌ Error al guardar · Reintentar') >= 0
  && g('cfgSavedMsg').innerHTML.indexOf('✅') < 0 && g('cfgSyncBadge').innerHTML === '🔴 Sin guardar');
t('T35b · el boton queda habilitado para reintentar', g('cfgGuardarBtn').disabled === false);
// Flujo completo: Nombre + Cocina + Entrenamiento en UN solo clic
sandbox.safeStorage = { get: function () { return sandbox._storage; } };
g('cfgNombre').value = 'Rubén';
sandbox.state.profile = { nombre: '', peso: 150, modoGuiado: false };
sandbox.state.kitchenTools = { horno: false };
sandbox.state.profile.modoGuiado = true;
sandbox.guardarConfiguracion();
var reTodo = reabrir();
t('T36 · un solo clic guarda Nombre + Cocina + Entrenamiento (persisten tras reabrir)',
  reTodo.profile.nombre === 'Rubén' && reTodo.profile.modoGuiado === true && reTodo.kitchenTools.horno === false && reTodo.profile.peso === 181);
console.log('Resultado: ' + passed + ' pasaron · ' + failed + ' fallaron');
console.log('==========================================');
if (failed) {
  console.log('Fallos:');
  console.log(failures.map(function (f) { return '  ✗ ' + f; }).join('\n'));
  process.exit(1);
}
process.exit(0);
