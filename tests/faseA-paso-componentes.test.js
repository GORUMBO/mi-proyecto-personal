// ============================================================
// PRUEBAS Fase A+ — componentes/subrecetas en Paso a paso.
// Reglas: prioridad interno→biblioteca→no inventar; pila anti-ciclos;
// conservar paso/porciones/modo al volver de subreceta.
// Uso: node tests/faseA-paso-componentes.test.js
// ============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extractFunc(name) {
  const i = HTML.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('No se encontró function ' + name);
  let depth = 0, j = i, q = null;
  for (; j < HTML.length; j++) {
    const c = HTML[j];
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return HTML.slice(i, j + 1); }
  }
  throw new Error('incompleta: ' + name);
}
function extractVar(name) {
  const m = HTML.match(new RegExp('var ' + name + '=\\[[\\s\\S]*?\\];\\s*\\n'));
  if (!m) throw new Error('No se encontró ' + name);
  return vm.runInNewContext('(' + m[0].replace(new RegExp('^var ' + name + '='), '').replace(/;\s*\n$/, '') + ')');
}
const RECETA_COMPONENTES = extractVar('RECETA_COMPONENTES');
const RECETA_PREPVERB = vm.runInNewContext('(' + (HTML.match(/var RECETA_PREPVERB=[^;]+;/)[0]).replace(/^var RECETA_PREPVERB=/, '').replace(/;$/, '') + ')');

let pasadas = 0, falladas = 0;
function t(label, ok, extra) {
  if (ok) { pasadas++; console.log('✓ ' + label + (extra ? ' · ' + extra : '')); }
  else { falladas++; console.log('✗ FALLA ' + label + (extra ? ' · ' + extra : '')); }
}

const NOMBRES = ['recetaComponentesEnPaso', 'recetaComponenteCalif', 'recetaPreparacionPrevia', 'recetaPreviaInterna',
  'recetaPreparaComponenteInterno', 'recetaSubrecetas', 'recetaPilaContiene', 'recetaComponenteListo',
  'recetaAbrirCompleta', 'recetaSubPasoTimer', 'recetaComponenteHTML', 'recetaPreviaHTML', 'recetaSubHTML',
  'recetaTiempoPaso', 'recetaPorciones', 'abrirReceta', 'recetaVolverPadre', 'cerrarReceta', 'recetaComponenteRelevante'];

function makeSandbox(base) {
  const mSimples = HTML.match(/var RECETA_INGREDIENTES_SIMPLES=\[[\s\S]*?\];\s*\n/);
  const mServicio = HTML.match(/var RECETA_VERBO_SERVICIO=[^;\n]+;/);
  const sb = {
    baseRecipes: base || [],
    safeText: function (x) { return String(x == null ? '' : x); },
    RECETA_COMPONENTES, RECETA_PREPVERB,
    RECETA_INGREDIENTES_SIMPLES: vm.runInNewContext('(' + mSimples[0].replace(/^var RECETA_INGREDIENTES_SIMPLES=/, '').replace(/;\s*\n$/, '') + ')'),
    RECETA_VERBO_SERVICIO: vm.runInNewContext('(' + mServicio[0].replace(/^var RECETA_VERBO_SERVICIO=/, '').replace(/;$/, '') + ')'),
    alerts: [], alert: function (m) { sb.alerts.push(m); },
    window: {},
    document: {
      getElementById() { return null; },
      createElement() { return { style: {} }; },
      body: { appendChild() {} }
    },
    openAppTimer: function (label, seg) { sb.timerCalls = sb.timerCalls || []; sb.timerCalls.push({ label, seg }); }
  };
  NOMBRES.forEach(n => { sb[n] = vm.runInNewContext('(' + extractFunc(n) + ')', sb); });
  sb.recetaDetalleHTML = function () { return '<detalle>'; };
  sb.globalThis = sb;
  return sb;
}

const SALSA_VERDE = { name: 'Salsa verde básica', type: 'salsa', time: 10, k: 40, p: 1, cost: 0.8, ingredients: '6 tomatillos, 2 chiles, cebolla', steps: ['Licúa todo.', 'Hierve 7 min.'] };
const SALSA_ROJA = { name: 'Salsa roja casera', type: 'salsa', time: 12, k: 60, p: 1, cost: 0.9, ingredients: '4 jitomates, 2 chiles', steps: ['Asa los jitomates.', 'Licúa con chile.'] };
const CHILAQUILES = {
  name: 'Chilaquiles con huevo', type: 'comida', time: 25, k: 520, p: 22, cost: 2.5, porciones: '2',
  ingredients: '8 tortillas, 2 huevos, ½ cebolla',
  steps: ['Fríe las tortillas en triángulos.', 'Bate los huevos y cuécelos aparte.',
    'Baja a fuego MEDIO (160°C), agrega salsa verde o roja.', 'Agrega los huevos y sirve.']
};

console.log('== 1 · Detección de componentes en un paso ==');
(function () {
  const sb = makeSandbox([]);
  const comps = sb.recetaComponentesEnPaso('Baja a fuego MEDIO (160°C), agrega salsa verde o roja.');
  t('detecta "salsa"', comps.length === 1 && comps[0].label === 'salsa');
  t('calificador "verde"', comps[0].calif === 'verde');
  t('"mezcla bien" (verbo) NO es componente', sb.recetaComponentesEnPaso('Mezcla bien todo.').length === 0);
  t('"agrega la mezcla" sí', sb.recetaComponentesEnPaso('Agrega la mezcla al molde.').length === 1);
  t('paso sin componentes → []', sb.recetaComponentesEnPaso('Corta las papas.').length === 0);
})();

console.log('== 2 · Componente definido dentro de la receta → se reutiliza ==');
(function () {
  const sb = makeSandbox([SALSA_VERDE]);
  const r = { name: 'Enchiladas', type: 'comida', ingredients: 'Para la salsa: 6 tomatillos, chile. Tortillas, pollo.', steps: ['Agrega la salsa.', 'Sirve.'] };
  t('interno detectado por sección "Para la salsa"', sb.recetaPreparaComponenteInterno(r, { label: 'salsa', rx: /\bsalsas?\b/i }) === true);
  const r2 = { name: 'Tacos', type: 'comida', ingredients: 'Tortillas, pollo.', steps: ['Prepara la salsa: licúa todo.', 'Agrega la salsa.', 'Sirve.'] };
  t('interno detectado por paso de preparación', sb.recetaPreparaComponenteInterno(r2, { label: 'salsa', rx: /\bsalsas?\b/i }) === true);
  // Regresión: el objeto mapeado por el detector DEBE conservar rx (bug real:
  // sin rx la rama "interno" nunca se activaba y se ofrecían subrecetas).
  const comps = sb.recetaComponentesEnPaso('Calienta salsa en sartén.');
  t('el componente mapeado conserva rx', comps.length === 1 && !!comps[0].rx);
  t('interno vía componente mapeado', sb.recetaPreparaComponenteInterno({ name: 'X', ingredients: 'Tortillas.', steps: ['Calienta salsa en sartén.'] }, comps[0]) === true);
  // Regresión: "la mezcla" NO debe auto-matchear con el verbo "mezcla".
  const compMezcla = sb.recetaComponentesEnPaso('Cuela la mezcla, regresa el líquido.');
  t('"la mezcla" se detecta como componente', compMezcla.length === 1);
  t('sin preparación previa NO es interno', sb.recetaPreparaComponenteInterno({ name: 'Y', ingredients: 'Elotes.', steps: ['Cuela la mezcla, regresa el líquido.'] }, compMezcla[0]) === false);
  t('con verbo de preparación real SÍ es interno', sb.recetaPreparaComponenteInterno({ name: 'W', ingredients: 'Harina.', steps: ['Prepara la mezcla batiendo todo.', 'Usa la mezcla.'] }, compMezcla[0]) === true);
})();

console.log('== 3 · Componente externo → subrecetas de la biblioteca ==');
(function () {
  const sb = makeSandbox([SALSA_VERDE, SALSA_ROJA, CHILAQUILES]);
  const comp = { label: 'salsa', calif: 'verde', tipos: ['salsa', 'aderezo'] };
  const subs = sb.recetaSubrecetas(comp, []);
  t('encuentra subrecetas', subs.length >= 2);
  t('la mejor es "Salsa verde básica" (calificador)', subs[0].r.name === 'Salsa verde básica');
  t('muestra opciones (máx 3)', subs.length <= 3);
})();

console.log('== 4 · Sin subreceta → NO inventa ==');
(function () {
  const sb = makeSandbox([CHILAQUILES]);
  const comp = { label: 'mezcla', calif: null, tipos: [], rx: /\b(la|el|una|su|tu|esta|esa|nuestra)\s+mezclas?\b/i };
  t('sin pool → []', sb.recetaSubrecetas(comp, []).length === 0);
  const vista = { idx: 0, componentesListos: {}, pila: [], subAbierta: null };
  const h = sb.recetaComponenteHTML(comp, 'agrega la mezcla', vista, CHILAQUILES);
  t('muestra "⚠ Preparación incompleta"', h.includes('Preparación incompleta'));
  t('ofrece "Usar preparada"', h.includes('Usar') && h.includes('recetaComponenteListo'));
  t('ofrece "Buscar en Recetas"', h.includes('Buscar en Recetas'));
})();

console.log('== 5 · "Usar preparada" / marcar listo continúa el flujo ==');
(function () {
  const sb = makeSandbox([SALSA_VERDE]);
  sb.window._recetaVista = { idx: 0, modo: 'pasoapaso', paso: 0, componentesListos: {}, subAbierta: null };
  sb.recetaComponenteListo('salsa');
  t('marcado en componentesListos', sb.window._recetaVista.componentesListos.salsa === true);
  const h = sb.recetaComponenteHTML({ label: 'salsa', calif: null, tipos: ['salsa', 'aderezo'], rx: /\bsalsas?\b/i }, 'agrega la salsa', sb.window._recetaVista, CHILAQUILES);
  t('tras listo: fila "salsa listo" sin repetir pasos', h.includes('salsa listo') && !h.includes('PASOS'));
})();

console.log('== 6 · Temporizador de subreceta ==');
(function () {
  const sb = makeSandbox([SALSA_VERDE]);
  sb.window._recetaVista = { idx: 0, modo: 'pasoapaso', paso: 0, componentesListos: {}, subAbierta: null };
  const h = sb.recetaSubHTML(0, 'salsa', []);
  t('subreceta colapsada sin pasos', !h.includes('PASOS'));
  sb.window._recetaVista.subAbierta = 0;
  const h2 = sb.recetaSubHTML(0, 'salsa', []);
  t('expandida muestra ingredientes y pasos', h2.includes('NECESITAS') && h2.includes('PASOS'));
  t('paso con tiempo muestra ⏱ (Hervir 7 min)', h2.includes('⏱ 7 min'));
  sb.recetaSubPasoTimer(0, 1);
  t('usa openAppTimer con 420 seg', sb.timerCalls && sb.timerCalls[0] && sb.timerCalls[0].seg === 420);
})();

console.log('== 7 · Volver de subreceta conserva paso/porciones/modo ==');
(function () {
  const sb = makeSandbox([CHILAQUILES, SALSA_VERDE]);
  sb.window._recetaVista = { idx: 0, modo: 'pasoapaso', paso: 3, personas: 4, componentesListos: { aderezo: true }, subAbierta: null };
  sb.window._recetaPila = [];
  sb.abrirReceta(1, 'pasoapaso'); // abrir la salsa completa desde Chilaquiles
  t('abre la subreceta', sb.window._recetaVista.idx === 1 && sb.window._recetaVista.modo === 'pasoapaso');
  t('el padre quedó en la pila', sb.window._recetaPila.length === 1 && sb.window._recetaPila[0].idx === 0);
  sb.recetaVolverPadre();
  const v = sb.window._recetaVista;
  t('volver → Chilaquiles de nuevo', v.idx === 0);
  t('conserva el paso (3)', v.paso === 3);
  t('conserva las porciones (4)', v.personas === 4);
  t('conserva el modo Paso a paso', v.modo === 'pasoapaso');
  t('conserva componentes listos', v.componentesListos.aderezo === true);
})();

console.log('== 8 · Sin ciclos A→B→A ==');
(function () {
  const sb = makeSandbox([CHILAQUILES, SALSA_VERDE]);
  sb.window._recetaVista = { idx: 0, modo: 'pasoapaso', paso: 0, componentesListos: {}, subAbierta: null };
  sb.window._recetaPila = [];
  sb.abrirReceta(1, 'pasoapaso');
  const antes = sb.window._recetaVista.idx;
  sb.recetaAbrirCompleta(0); // intentar volver al padre como subreceta
  t('no navega (ciclo detectado)', sb.window._recetaVista.idx === antes);
  t('avisa con alert', sb.alerts.length === 1 && /ciclo/i.test(sb.alerts[0]));
})();

console.log('== 10 · Sobre-detección: ingredientes simples NO disparan subreceta ==');
(function () {
  const sb = makeSandbox([]);
  const compCrema = sb.recetaComponentesEnPaso('Sirve con crema, queso y cebolla.')[0];
  t('"Sirve con crema" detecta crema', compCrema && compCrema.label === 'crema');
  t('"Sirve con crema" → NO relevante (bloque eliminado)', compCrema && sb.recetaComponenteRelevante(compCrema, 'Sirve con crema, queso y cebolla.') === false);
  t('"Sirve con queso y cebolla" → sin componentes de queso/cebolla', sb.recetaComponentesEnPaso('Sirve con queso y cebolla.').length === 0);
  const compCil = sb.recetaComponentesEnPaso('Decora con cilantro.');
  t('"Decora con cilantro" → sin bloque', compCil.length === 0 || compCil.every(c => sb.recetaComponenteRelevante(c, 'Decora con cilantro.') === false));
  const compSalsa = sb.recetaComponentesEnPaso('Agrega salsa verde.');
  t('"Agrega salsa verde" → sí relevante', compSalsa.length === 1 && sb.recetaComponenteRelevante(compSalsa[0], 'Agrega salsa verde.') === true);
  const compCremaChip = sb.recetaComponentesEnPaso('Usa crema de chipotle preparada.');
  t('"crema de chipotle preparada" → sí relevante (especificidad)', compCremaChip.length === 1 && sb.recetaComponenteRelevante(compCremaChip[0], 'Usa crema de chipotle preparada.') === true);
  // el bloque de un ingrediente simple con calificador NO busca subrecetas
  const FRESAS = { name: 'Fresas con crema', type: 'postre', ingredients: 'fresas, crema, azúcar', steps: ['Lava las fresas.', 'Sirve con crema.'] };
  const sb2 = makeSandbox([FRESAS]);
  const vista = { idx: 0, componentesListos: {}, pila: [], subAbierta: null };
  const h = sb2.recetaComponenteHTML(compCremaChip[0], 'Usa crema de chipotle preparada.', vista, { name: 'Tacos', ingredients: 'tortillas', steps: ['Sirve.'] });
  t('simple+calificador: sin candidatas ("Fresas con crema" NO aparece)', h.includes('Usar crema preparada') && !h.includes('Fresas con crema'));
  // caso real obligatorio: Chilaquiles paso 5
  const CHILAQUILES = { name: 'Chilaquiles con huevo', ingredients: '8 tortillas, 2 huevos, crema, queso, cebolla', steps: ['Calienta aceite.', 'Fríe tortillas.', 'Agrega salsa.', 'Incorpora huevos.', 'Sirve con crema, queso y cebolla.'] };
  const compsPaso5 = sb.recetaComponentesEnPaso(CHILAQUILES.steps[4]);
  const bloques = compsPaso5.filter(c => sb.recetaComponenteRelevante(c, CHILAQUILES.steps[4]));
  t('Chilaquiles paso 5: sin bloques de preparación', bloques.length === 0, compsPaso5.map(c => c.label).join(','));
})();

console.log('== 9 · Preparaciones previas ==');
(function () {
  const sb = makeSandbox([CHILAQUILES]);
  const p = sb.recetaPreparacionPrevia('Usa pollo cocido y desmenúzalo.');
  t('detecta "pollo cocido"', p && p.label === 'pollo cocido');
  t('no detecta en pasos normales', sb.recetaPreparacionPrevia('Corta las papas.') === null);
  const r = { name: 'Caldo tlalpeño', steps: ['Cocina el pollo 20 min.', 'Usa pollo cocido desmenuzado.'] };
  const vista = { idx: 0, componentesListos: {}, pila: [], subAbierta: null };
  t('interno: paso anterior cocina el pollo', sb.recetaPreviaInterna(r, p, 1) === true);
  const r2 = { name: 'Sopa', steps: ['Agrega agua.', 'Usa pollo cocido desmenuzado.'] };
  t('no interno → no inventa', sb.recetaPreviaInterna(r2, p, 1) === false);
  const h = sb.recetaPreviaHTML(p, r2, 1, vista);
  t('aviso "no incluye cómo prepararlo"', h.includes('no incluye cómo prepararlo'));
})();

console.log('===== RESULTADO: ' + pasadas + ' PASS / ' + falladas + ' FAIL =====');
if (falladas) process.exit(1);
