// ============================================================
// PRUEBAS v1.191.0-Carrito — subpantalla "Agregar a <comida>" en Comer.
// Cubre: flujo de subpantalla (títulos, volver, scroll), carrito multi-
// selección (upsert, cantidades, kcal/macros, chips, CTA en lote),
// listas perezosas y sync diferido mientras la subpantalla está abierta.
// Uso: node tests/carrito.test.js
// ============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extractFunc(name) {
  const i = HTML.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('No se encontró function ' + name);
  let depth = 0, j = i, q = null, tplStack = [];
  for (; j < HTML.length; j++) {
    const c = HTML[j];
    if (q === '`') {
      if (c === '\\') { j++; continue; }
      if (c === '`') { q = null; continue; }
      if (c === '$' && HTML[j + 1] === '{') { j += 2; tplStack.push(depth); depth++; q = null; continue; }
      continue;
    }
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '/' && (HTML[j + 1] === "'" || HTML[j + 1] === '"' || HTML[j + 1] === '\\') && /[\(,=:\[!&|?;{+\-*%~^<>]\s*$/.test(HTML.slice(Math.max(0, j - 4), j))) {
      j++;
      while (j < HTML.length && !(HTML[j] === '/' && HTML[j - 1] !== '\\')) j++;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (tplStack.length && depth === tplStack[tplStack.length - 1]) { tplStack.pop(); q = '`'; }
      if (depth === 0) return HTML.slice(i, j + 1);
    }
  }
  throw new Error('incompleta: ' + name);
}

function makeTextNode() { return { textContent: '' }; }
function makeChipSlot() {
  const slot = { style: { display: 'none' }, name: makeTextNode(), cant: makeTextNode(), x: { onclick: null } };
  slot.querySelector = function (s) {
    if (s === '[data-chip-name]') return this.name;
    if (s === '[data-chip-cant]') return this.cant;
    if (s === '[data-chip-x]') return this.x;
    return null;
  };
  return slot;
}
function makeChipsEl() {
  const slots = [makeChipSlot(), makeChipSlot(), makeChipSlot()];
  return { style: {}, slots: slots, querySelector: function (s) { const m = /data-chip-slot="(\d)"/.exec(s); return m ? slots[+m[1]] : null; } };
}
function makeResumenEl() {
  const r = { n: makeTextNode(), kcal: makeTextNode(), p: makeTextNode(), c: makeTextNode(), g: makeTextNode() };
  return { r: r, querySelector: function (s) { const m = /data-r-(\w+)/.exec(s); return m ? this.r[m[1]] : null; } };
}

// Sandbox principal del carrito (subpantalla)
function makeSandbox(initialState) {
  const els = {
    comerMain: { style: { display: 'block' } },
    foodAddView: { style: { display: 'none' } },
    foodAddTitle: { textContent: '' },
    carritoOut: { innerHTML: '' },
    carritoChips: makeChipsEl(),
    carritoChipsMas: { style: { display: 'none' }, textContent: '' },
    carritoResumen: makeResumenEl(),
    carritoCTA: { disabled: true, textContent: '' },
    foodSearch: { value: '' },
    foodSearchResults: { innerHTML: '' },
    catBotonesContainer: { innerHTML: '' },
    quickMealsOut: { innerHTML: '' },
    extrasPanelContainer: { innerHTML: '' },
    diaryDate: { value: '2026-08-23' },
    addFoodAviso: { style: {}, innerHTML: '' },
    saveToast: { textContent: '', style: {}, _tid: null }
  };
  const sb = {
    console,
    todayISO: function () { return '2026-08-23'; },
    state: JSON.parse(JSON.stringify(initialState)),
    _currentMealKey: 'lunch',
    tabs: ['🍱 Contador'], _activeTab: 0,
    closes: 0,
    saves: 0,
    renders: 0,
    render: function () { sb.renders++; },
    section: function () { sb.sectionCalls = (sb.sectionCalls || 0) + 1; return 'TAB'; },
    bindAll: function () { sb.bindAllCalls = (sb.bindAllCalls || 0) + 1; },
    searchFood: function (q) { els.foodSearchResults.innerHTML = 'resultados(' + q + ')'; },
    secExtrasPanel: function () { return 'extras'; },
    categoriaBotonesHTML: function () { return 'categorias'; },
    performance: { now: function () { return Date.now(); } },
    save: function () { sb.saves++; },
    confirm: function () { sb.confirms = (sb.confirms || 0) + 1; return sb.confirmRespuesta !== false; },
    registrarCambio: function () {},
    totalExtras: function () { return { kcal: 0, prot: 0 }; },
    mealKeyLabel: function (key) { return ({ breakfast: 'desayuno', lunch: 'comida', dinner: 'cena', snacks: 'snack' })[key] || 'comida'; },
    safeText: function (s) { return String(s == null ? '' : s); },
    document: {
      getElementById: function (id) { return els[id] || null; },
      querySelector: function (sel) { return sel === '.tab.active' ? { innerHTML: '' } : null; },
      querySelectorAll: function () { return []; },
      body: { style: {} }
    },
    clearTimeout: function () {},
    setTimeout: function (fn) { sb.timeout = fn; },
    requestAnimationFrame: function (fn) { sb.rafQueue.push(fn); }
  };
  sb.window = { _carrito: [], _extrasActuales: [], _guardandoCarrito: false, _foodModalAbierto: false, _renderPendiente: false, _syncPendiente: false, _carritoListaRaf: 0, scrollY: 200, scrollTo: function (x, y) { sb.lastScrollTo = y; } };
  sb.rafQueue = [];
  sb.globalThis = sb;
  sb.flush = function () {
    let guard = 0;
    while (sb.rafQueue.length && guard < 20) {
      const q = sb.rafQueue; sb.rafQueue = [];
      q.forEach(function (fn) { try { fn(); } catch (e) {} });
      guard++;
    }
  };
  for (const fn of ['openAddFood', 'closeAddFood', 'volverDeAgregar', 'guardarCarrito', 'quickMealsHTML', 'chipCarrito', 'enCarrito', 'enCarritoId', 'renderCarrito', 'renderCarritoLista', 'updateCartChips', 'updateCartTotals', 'updateCartCTA', 'totalCarrito', 'toggleCarrito', 'updateFoodRow', 'carritoQuitar', 'carritoCheckHTML', 'carritoFilaStyle', 'carritoCant', 'carritoCantInput']) {
    sb[fn] = vm.runInNewContext('(' + extractFunc(fn) + ')', sb, { filename: fn });
  }
  return sb;
}
function nCarrito(sb) { return sb.window._carrito.length; }

let passed = 0, failed = 0;
function t(name, cond, extra) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.log('  ✗ ' + name + (extra ? ' → ' + extra : '')); }
}

const DIARY = { '2026-08-23': { breakfast: [], lunch: [], dinner: [], snacks: [] } };

console.log('== 1 · Subpantalla: apertura por comida ==');
(function () {
  const titulos = { breakfast: 'Agregar a Desayuno', lunch: 'Agregar a Comida', dinner: 'Agregar a Cena', snacks: 'Agregar a Snack' };
  Object.keys(titulos).forEach(function (k) {
    const sb = makeSandbox({ diary: JSON.parse(JSON.stringify(DIARY)) });
    sb.openAddFood(k);
    t('abrir ' + k + ' → título correcto', sb.document.getElementById('foodAddTitle').textContent === titulos[k]);
    t('abrir ' + k + ' → subpantalla visible y Comer oculto', sb.document.getElementById('foodAddView').style.display === 'block' && sb.document.getElementById('comerMain').style.display === 'none');
    sb.closeAddFood();
    sb.flush();
    t('cerrar ' + k + ' → vuelve a Comer', sb.document.getElementById('foodAddView').style.display === 'none' && sb.document.getElementById('comerMain').style.display === 'block');
  });
})();

console.log('== 2 · Volver cancela sin guardar ==');
(function () {
  const sb = makeSandbox({ diary: JSON.parse(JSON.stringify(DIARY)) });
  sb.openAddFood('breakfast');
  sb.toggleCarrito(encodeURIComponent('Pollo'), 100, 20, 0, 2, encodeURIComponent('100g'));
  sb.confirmRespuesta = true;
  sb.volverDeAgregar();
  t('con selección: pide confirmación', sb.confirms === 1);
  t('volver: carrito descartado', nCarrito(sb) === 0);
  t('volver: NO guarda', sb.saves === 0);
  sb.flush();
  t('volver: regresa a Comer', sb.document.getElementById('foodAddView').style.display === 'none');
  const sb2 = makeSandbox({ diary: JSON.parse(JSON.stringify(DIARY)) });
  sb2.openAddFood('breakfast');
  sb2.volverDeAgregar();
  t('sin selección: no pide confirmación', (sb2.confirms || 0) === 0);
  const sb3 = makeSandbox({ diary: JSON.parse(JSON.stringify(DIARY)) });
  sb3.openAddFood('lunch');
  sb3.toggleCarrito(encodeURIComponent('Pollo'), 100, 20, 0, 2, encodeURIComponent('100g'));
  sb3.confirmRespuesta = false;
  sb3.volverDeAgregar();
  t('confirmación rechazada: la subpantalla sigue abierta y el carrito intacto', sb3.document.getElementById('foodAddView').style.display === 'block' && nCarrito(sb3) === 1);
})();

console.log('== 3 · Selección y cantidades ==');
(function () {
  const sb = makeSandbox({ diary: JSON.parse(JSON.stringify(DIARY)) });
  sb.openAddFood('lunch');
  for (let i = 1; i <= 5; i++) sb.toggleCarrito(encodeURIComponent('A' + i), 100 + i, 10, 5, 1, encodeURIComponent('1 porción'), encodeURIComponent('id' + i));
  t('seleccionar 5 → carrito=5', nCarrito(sb) === 5);
  t('el 3º NO reemplaza al 1º', sb.window._carrito[0].name === 'A1' && sb.window._carrito[2].name === 'A3');
  sb.carritoCant(0, 1);
  let tot = sb.totalCarrito();
  t('cantidad +: kcal correcta (A1×2)', tot.kcal === 101 * 2 + 102 + 103 + 104 + 105);
  sb.carritoCantInput(0, '3');
  tot = sb.totalCarrito();
  t('cantidad escrita ×3', tot.kcal === 101 * 3 + 102 + 103 + 104 + 105);
  sb.carritoQuitar(1);
  t('quitar uno → 4', nCarrito(sb) === 4);
  t('chips muestran el primero (in-place)', sb.document.getElementById('carritoChips').slots[0].name.textContent === 'A1');
  t('resumen muestra "4 alimentos seleccionados"', sb.document.getElementById('carritoResumen').r.n.textContent === '4 alimentos seleccionados');
  t('CTA: "Agregar 4 alimentos a comida"', sb.document.getElementById('carritoCTA').textContent.indexOf('Agregar 4 alimentos a comida') >= 0);
  t('click NO llama save() ni render global', sb.saves === 0 && sb.renders === 0);
  t('click NO llama sync', sb.window._syncPendiente === false);
})();

console.log('== 4 · Cambiar categoría/búsqueda conserva el carrito ==');
(function () {
  const sb = makeSandbox({ diary: JSON.parse(JSON.stringify(DIARY)) });
  sb.openAddFood('lunch');
  sb.toggleCarrito(encodeURIComponent('Pollo'), 100, 20, 0, 2, encodeURIComponent('100g'));
  sb.toggleCarrito(encodeURIComponent('Arroz'), 200, 4, 45, 0, encodeURIComponent('1 taza'));
  sb.searchFood('pollo'); // re-render de resultados (categoría/buscador)
  t('la selección sobrevive al re-render', nCarrito(sb) === 2);
  sb.searchFood('');
  t('y al volver a la lista completa', nCarrito(sb) === 2);
})();

console.log('== 5 · CTA guarda en lote: 1 save, 1 sync, sin duplicados ==');
(function () {
  const sb = makeSandbox({ diary: JSON.parse(JSON.stringify(DIARY)) });
  sb.openAddFood('breakfast');
  sb.toggleCarrito(encodeURIComponent('Pollo'), 100, 20, 0, 2, encodeURIComponent('100g'));
  sb.toggleCarrito(encodeURIComponent('Arroz'), 200, 4, 45, 0, encodeURIComponent('1 taza'));
  sb.carritoCant(0, 1); // Pollo ×2
  sb.guardarCarrito();
  const lunch = sb.state.diary['2026-08-23'].lunch; // _currentMealKey no cambió en este sandbox: lunch
  const meal = sb.state.diary['2026-08-23'][sb._currentMealKey] || lunch;
  t('guarda TODOS (2 filas)', meal.length === 2);
  t('kcal del primero = ×2 (200)', meal[0].kcal === 200 && meal[0].prot === 40);
  t('exactamente 1 save', sb.saves === 1);
  sb.guardarCarrito();
  t('doble click no duplica', sb.state.diary['2026-08-23'][sb._currentMealKey].length === 2 && sb.saves === 1);
  t('regresa a Comer tras guardar', sb.document.getElementById('foodAddView').style.display === 'none');
  t('confirmación en toast', sb.document.getElementById('saveToast').textContent.indexOf('2 alimentos agregados a') >= 0);
})();

console.log('== 6 · Sync diferido mientras la subpantalla está abierta ==');
(function () {
  const sbSync = {
    console,
    window: { _foodModalAbierto: true, _syncPendiente: false }
  };
  sbSync.globalThis = sbSync;
  const cs = vm.runInNewContext('(async ' + extractFunc('cloudStartupSync') + ')', sbSync, { filename: 'cloudStartupSync' });
  cs({ _origin: 'test' });
  t('subpantalla abierta: sync pospuesto ANTES de cualquier trabajo', sbSync.window._syncPendiente === true);
  const sb = makeSandbox({ diary: JSON.parse(JSON.stringify(DIARY)) });
  sb.window._syncPendiente = true;
  let syncs = 0;
  sb.cloudStartupSync = function () { syncs++; };
  sb.openAddFood('lunch'); sb.flush();
  sb.closeAddFood();
  sb.flush();
  t('al volver: el sync pendiente se ejecuta UNA vez', syncs === 1);
})();

console.log('== 7 · Persistencia y scroll ==');
(function () {
  const sb = makeSandbox({ diary: JSON.parse(JSON.stringify(DIARY)) });
  sb.openAddFood('breakfast');
  t('guarda el scroll de Comer al abrir', sb.window._comerScrollY === 200);
  sb.toggleCarrito(encodeURIComponent('Leche'), 149, 8, 12, 8, encodeURIComponent('1 taza'));
  sb.guardarCarrito();
  sb.flush();
  t('al volver restaura el scroll de Comer', sb.lastScrollTo === 200);
  const copia = JSON.parse(JSON.stringify(sb.state));
  t('el registro guardado persiste tras recarga simulada', copia.diary['2026-08-23'][sb._currentMealKey].length === 1 && copia.diary['2026-08-23'][sb._currentMealKey][0].name === 'Leche');
  t('el carrito temporal NO se persiste', JSON.stringify(copia).indexOf('_carrito') < 0);
})();

console.log('== 8 · Listas perezosas (sin procesar 945 recetas) ==');
(function () {
  function extractConstArr(name) {
    const m = new RegExp('const ' + name + '\\s*=\\s*\\[').exec(HTML);
    if (!m) throw new Error('no const ' + name);
    let i = HTML.indexOf('[', m.index), d = 0, j = i;
    for (; j < HTML.length; j++) {
      const c = HTML[j];
      if (c === '[') d++;
      else if (c === ']') { d--; if (d === 0) return HTML.slice(i, j + 1); }
    }
    throw new Error('incompleta ' + name);
  }
  const els14 = { foodSearchResults: { innerHTML: '' } };
  const sb14 = {
    console,
    window: { _foodVerMas: false, _foodSearchT: null, _catCounts: undefined },
    FOOD_DB: vm.runInNewContext('(' + extractConstArr('FOOD_DB') + ')', {}),
    baseRecipes: [],
    enCarritoId: function () { return false; },
    document: { getElementById: function (id) { return els14[id] || null; }, querySelectorAll: function () { return []; } },
    safeText: function (s) { return String(s == null ? '' : s); },
    setTimeout: function (fn) { sb14._t = fn; },
    clearTimeout: function () {}
  };
  sb14.globalThis = sb14;
  sb14.carritoCheckHTML = vm.runInNewContext('(' + extractFunc('carritoCheckHTML') + ')', sb14, { filename: 'ch14' });
  sb14.carritoFilaStyle = vm.runInNewContext('(' + extractFunc('carritoFilaStyle') + ')', sb14, { filename: 'cf14' });
  sb14.searchFood = vm.runInNewContext('(' + extractFunc('searchFood') + ')', sb14, { filename: 'sf14' });
  sb14.foodSearchDebounced = vm.runInNewContext('(' + extractFunc('foodSearchDebounced') + ')', sb14, { filename: 'db14' });
  sb14.searchFood('');
  const filas = (els14.foodSearchResults.innerHTML.match(/data-foodid/g) || []).length;
  t('apertura: máximo 10 filas (' + filas + ')', filas <= 10);
  t('botón "Mostrar más" presente', els14.foodSearchResults.innerHTML.indexOf('Mostrar más') >= 0);
  let busquedas = 0;
  sb14.searchFood = function () { busquedas++; };
  sb14.foodSearchDebounced('pollo');
  t('debounce: NO busca de inmediato', busquedas === 0);
  sb14._t();
  t('debounce: busca UNA vez tras el timer', busquedas === 1);
})();

console.log('== 9 · Acciones rápidas (solo datos locales) ==');
(function () {
  const sinHistorial = makeSandbox({ diary: JSON.parse(JSON.stringify(DIARY)) });
  t('sin historial: acciones rápidas ocultas', sinHistorial.quickMealsHTML('lunch') === '');
  const conHistorial = makeSandbox({ diary: { '2026-08-22': { breakfast: [], lunch: [{ name: 'Pollo', kcal: 100, prot: 20, carb: 0, fat: 2, amount: '100g' }], dinner: [], snacks: [] }, '2026-08-23': JSON.parse(JSON.stringify(DIARY['2026-08-23'])) } });
  const h = conHistorial.quickMealsHTML('lunch');
  t('con historial: Repetir última comida', h.indexOf('Repetir última comida') >= 0 && h.indexOf('Pollo') >= 0);
  const dosDias = makeSandbox({ diary: { '2026-08-21': { breakfast: [], lunch: [{ name: 'Pollo', kcal: 100, prot: 20, carb: 0, fat: 2, amount: '100g' }], dinner: [], snacks: [] }, '2026-08-22': { breakfast: [], lunch: [{ name: 'Pollo', kcal: 100, prot: 20, carb: 0, fat: 2, amount: '100g' }], dinner: [], snacks: [] }, '2026-08-23': JSON.parse(JSON.stringify(DIARY['2026-08-23'])) } });
  t('frecuentes solo con >=2 apariciones', dosDias.quickMealsHTML('lunch').indexOf('⭐ Frecuentes') >= 0);
})();

console.log('== 10 · No existe dependencia del overlay viejo ==');
(function () {
  t('el id addFoodModal ya no existe en la app', HTML.indexOf('id="addFoodModal"') < 0);
  t('la subpantalla foodAddView existe', HTML.indexOf('id="foodAddView"') >= 0);
  t('sin residuos de instrumentación temporal', ['__CART_TEST_MODE', '__CART_DISABLE_PARTS', '__FOOD_MODAL', 'RAF_PROBE', 'PAINT_READY', 'LONG_TASK'].every(function (k) { return HTML.indexOf(k) < 0; }));
})();

console.log('==========================================');
console.log('Resultado: ' + passed + ' pasaron · ' + failed + ' fallaron');
console.log('==========================================');
process.exit(failed ? 1 : 0);
