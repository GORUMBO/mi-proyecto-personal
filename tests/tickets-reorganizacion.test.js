// ============================================================
// PRUEBAS — Reorganización de tickets (v1.195.0)
// Uso: node tests/tickets-reorganizacion.test.js
// Cubre:
//  1. Ubicación: Mis tickets vive UNA sola vez en Comer → Lista de compra.
//  2. Nevera: solo el acceso pequeño "Escanear compra y agregar alimentos".
//  3. El acceso de Nevera abre la MISMA sección (sin copias).
//  4. Flujo: foto/archivo (sin 'capture' → cámara o galería) → OCR local
//     (parseReceiptText) → vista previa editable → confirmar.
//  5. Dinero: UN solo gasto por ticket; la foto viaja UNA sola vez.
//  6. Cancelar sin modificar; dedupe de tickets y de lista de compra.
//  7. Privacidad Telegram: sin Chat ID predeterminado en el código.
// ============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extractFunc(name) {
  const src = HTML;
  const i = src.indexOf('async function ' + name + '(');
  if (i >= 0) return extractFuncAt(src, i);
  const j = src.indexOf('function ' + name + '(');
  if (j >= 0) return extractFuncAt(src, j);
  throw new Error('No se encontró function ' + name);
}
function extractFuncAt(src, i) {
  let parens = 0, j = i, q = null, bodyStart = -1;
  for (; j < src.length; j++) {
    const c = src[j];
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '(') parens++;
    else if (c === ')') { parens--; if (parens === 0) { bodyStart = j + 1; break; } }
  }
  let depth = 0; q = null; j = bodyStart;
  for (; j < src.length; j++) {
    const c = src[j];
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return src.slice(i, j + 1); }
  }
  throw new Error('incompleta: ' + name);
}
function extractSection(name) {
  const src = HTML;
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('No se encontró ' + name);
  let depth = 0, j = i, q = null, tplStack = [];
  for (; j < src.length; j++) {
    const c = src[j];
    if (q === '`') {
      if (c === '\\') { j++; continue; }
      if (c === '`') { q = null; continue; }
      if (c === '$' && src[j + 1] === '{') { j += 2; tplStack.push(depth); depth++; q = null; continue; }
      continue;
    }
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (tplStack.length && depth === tplStack[tplStack.length - 1]) { tplStack.pop(); q = '`'; }
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

const HOY = new Date().toISOString().slice(0, 10);

console.log('== 1 · Ubicación de Mis tickets: UNA sola sección en Comer → Lista de compra ==');
(function () {
  const ocurrencias = (HTML.match(/id="misTicketsOut"/g) || []).length;
  t('el div de Mis tickets existe UNA sola vez', ocurrencias === 1, ocurrencias + ' ocurrencias');
  const contador = extractSection('secContador');
  t('la sección vive dentro de Comer (secContador)', /id="misTicketsOut"/.test(contador));
  t('Comer tiene la tarjeta Lista de compra', /id="listaCompraCard"/.test(contador));
  t('Mis tickets está dentro de la tarjeta de Lista de compra',
    contador.indexOf('id="listaCompraCard"') < contador.indexOf('id="misTicketsOut"') &&
    contador.indexOf('id="misTicketsOut"') < contador.indexOf('id="listaCompraCard"') + 4000);
  const nevera = extractSection('secNevera');
  t('Nevera tiene el acceso pequeño con el nombre pedido', /📷 Escanear compra y agregar alimentos/.test(nevera) && /escanearDesdeNevera\(\)/.test(nevera));
  t('el botón viejo de Nevera ya no existe', !/¿Tienes un ticket\? Escanéalo/.test(HTML));
  t('el escaneo por línea en Dinero ya no existe (un solo registro por ticket)', !/saveParsedReceiptSeparate/.test(HTML));
  t('el escaneo de ticket NO usa capture: en iPhone ofrece cámara, fototeca o archivos', !/setAttribute\(['"]capture/.test(extractFunc('escanearTicket')));
  t('no hay ningún Chat ID personal predeterminado en el código', HTML.indexOf('8315587997') < 0);
})();

console.log('== 2 · parseReceiptText: el OCR local llega a líneas editables ==');
(function () {
  const inputs = {
    receiptText: { value: 'WALMART\nPOLLO 12.48\nHUEVOS 5.99\nARROZ 8.49\nTAX 0.50\nTOTAL 26.96' },
    receiptStore: { value: '' }, receiptDate: { value: '' },
    receiptParseSummary: { innerHTML: '' }, receiptParsedOut: { innerHTML: '' }
  };
  const sb = {
    parsedReceiptItems: [],
    document: { getElementById: function (id) { return inputs[id] || null; } },
    money: function (n) { return '$' + (+n).toFixed(2); },
    inferReceiptCategory: function () { return { cat: 'comida', es: 'Comida' }; },
    renderParsedReceiptTable: function () { sb._rendered = (sb._rendered || 0) + 1; },
    _rendered: 0
  };
  vm.createContext(sb);
  ['parseReceiptText', 'normalizeReceiptLine', 'parseReceiptMoney', 'parseReceiptDate', 'detectReceiptStore'].forEach(function (n) {
    vm.runInContext(extractFunc(n), sb);
  });
  sb.parseReceiptText();
  t('detecta los productos con precio del texto OCR', sb.parsedReceiptItems.length === 4, JSON.stringify(sb.parsedReceiptItems.map(function (x) { return x.name; })));
  t('detecta la tienda y la fecha', inputs.receiptStore.value === 'Walmart' && inputs.receiptDate.value.length === 10);
  t('líneas marcadas REAL (precio leído del ticket)', sb.parsedReceiptItems.every(function (x) { return x.priceSource === 'REAL'; }));
  t('la vista previa editable se refresca', sb._rendered === 1);
})();

console.log('== 3 · Escanear desde Mis tickets abre la MISMA vista de edición (Dinero → Pegar ticket) ==');
(function () {
  const sb = {
    parsedReceiptItems: [],
    openTab: function (tab) { sb._tabs.push(tab); },
    setGastoView: function (v) { sb._views.push(v); },
    setTimeout: function (fn) { sb._timers.push(fn); return 1; },
    document: {
      createElement: function () {
        return sb._input = { type: '', accept: '', setAttribute: function (k, v) { sb._attrs.push(k + '=' + v); }, style: {}, click: function () { sb._clicked = true; }, files: [] };
      },
      body: { appendChild: function () {} }
    },
    _tabs: [], _views: [], _attrs: [], _clicked: false, _input: null, _timers: []
  };
  vm.createContext(sb);
  vm.runInContext(extractFunc('escanearTicket'), sb);
  sb.escanearTicket();
  sb._timers.forEach(function (fn) { try { fn(); } catch (e) {} });
  t('navega a Dinero y abre la vista Pegar ticket', sb._tabs.join(',') === '💳 Gastos' && sb._views.join(',') === 'paste');
  t('abre el selector de imagen (foto o galería) en el mismo gesto', sb._clicked === true && sb._input.type === 'file' && sb._input.accept === 'image/*' && sb._attrs.length === 0, 'attrs=' + sb._attrs.join('|'));
  const sb2 = {
    openTab: function (tab) { sb2._tabs.push(tab); },
    setTimeout: function () { return 1; },
    _tabs: []
  };
  vm.createContext(sb2);
  vm.runInContext(extractFunc('abrirPegarTicket'), sb2);
  sb2.abrirPegarTicket();
  t('Pegar ticket abre la misma vista de edición', sb2._tabs.join(',') === '💳 Gastos');
})();

console.log('== 4 · Acceso de Nevera: abre Comer → Lista de compra y arranca el escaneo ==');
(function () {
  const timeouts = [];
  const detEl = { open: false };
  const cardEl = { scrollIntoView: function (opts) { sb._scroll = opts; } };
  const sb = {
    openTab: function (tab) { sb._tabs.push(tab); },
    setTimeout: function (fn) { timeouts.push(fn); return 1; },
    document: { getElementById: function (id) { if (id === 'misTicketsDet') return detEl; if (id === 'listaCompraCard') return cardEl; return null; } },
    escanearTicket: function () { sb._escaneo = true; },
    _tabs: [], _escaneo: false, _scroll: null
  };
  vm.createContext(sb);
  vm.runInContext(extractFunc('escanearDesdeNevera'), sb);
  sb.escanearDesdeNevera();
  timeouts.forEach(function (fn) { try { fn(); } catch (e) {} });
  t('navega a Comer y abre la MISMA sección de Mis tickets', sb._tabs.join(',') === '🍱 Contador' && detEl.open === true && sb._scroll && sb._scroll.block === 'start');
  t('arranca el escaneo dentro del mismo toque', sb._escaneo === true);
})();

console.log('== 5 · Lista de compra persistente: agregar, dedupe, marcar y quitar ==');
(function () {
  const inputs = { listaCompraNombre: { value: '' }, listaCompraOut: { innerHTML: '' } };
  const sb = {
    state: { listaCompra: [], fridgeTengo: [] },
    document: { getElementById: function (id) { return inputs[id] || null; } },
    save: function () { sb.saves = (sb.saves || 0) + 1; },
    completarNorm: function (s) { return String(s || '').toLowerCase(); },
    ppUUID: function () { return 'lc' + (sb._n = (sb._n || 0) + 1); },
    safeText: function (x) { return String(x == null ? '' : x); },
    toastReg: function (m) { sb._toast = m; },
    saves: 0
  };
  vm.createContext(sb);
  ['listaCompraAgregarNombre', 'listaCompraAgregar', 'listaCompraToggle', 'listaCompraQuitar', 'listaCompraHTML', 'listaCompraRender'].forEach(function (n) {
    vm.runInContext(extractFunc(n), sb);
  });
  t('agregar alimento nuevo', sb.listaCompraAgregarNombre('Pollo') === true && sb.state.listaCompra.length === 1 && sb.state.listaCompra[0].comprado === false);
  t('duplicado NO se agrega', sb.listaCompraAgregarNombre('pollo') === false && sb.state.listaCompra.length === 1);
  sb.listaCompraToggle(0);
  t('marcar comprado', sb.state.listaCompra[0].comprado === true);
  sb.listaCompraToggle(0);
  sb.listaCompraAgregarNombre('Huevos');
  sb.listaCompraQuitar(0);
  t('quitar sin tocar los demás', sb.state.listaCompra.length === 1 && sb.state.listaCompra[0].name === 'Huevos');
  const html = sb.listaCompraHTML();
  t('el HTML muestra el estado comprado/pendiente', /Marcar comprado/.test(html) && /Huevos/.test(html));
})();

console.log('== 6 · Confirmar compra: UN gasto en Dinero, foto UNA vez, lista + nevera ==');
(function () {
  const inputs = { receiptStore: { value: 'Times' }, receiptDate: { value: HOY }, receiptPayMethod: { value: 'debit' }, receiptNota: { value: '' } };
  const sb = {
    state: { expenses: [], receiptTextHistory: [], fridgeTengo: [], listaCompra: [{ id: 1, name: 'Arroz', comprado: false }], ticketBorrador: null },
    document: { getElementById: function (id) { return inputs[id] || null; } },
    parsedReceiptItems: [
      { name: 'Pollo', amount: 12.48, priceSource: 'REAL', cat: 'comida', spanish: 'Pollo', raw: 'POLLO', include: true, qty: '', unit: '', toFridge: true, compra: true },
      { name: 'Arroz', amount: 8.49, priceSource: 'REAL', cat: 'comida', spanish: 'Arroz', raw: 'ARROZ', include: true, qty: '', unit: '', toFridge: false, compra: false },
      { name: 'Jabón', amount: 3.00, priceSource: 'REAL', cat: 'otro', spanish: 'Jabón', raw: 'JABON', include: true, qty: '', unit: '', toFridge: false, compra: false }
    ],
    ticketDataUrl: 'data:image/jpeg;base64,FOTO',
    confirm: function () { return true; },
    alert: function (m) { sb._alert = m; },
    save: function () { sb.saves = (sb.saves || 0) + 1; },
    setGastoView: function (v) { sb._view = v; },
    money: function (n) { return '$' + (+n).toFixed(2); },
    completarNorm: function (s) { return String(s || '').toLowerCase(); },
    ppUUID: function () { return 'lc' + (sb._n = (sb._n || 0) + 1); },
    defaultExpenseNeed: function () { return 'reduce'; },
    receiptNotaActual: function () { return inputs.receiptNota.value.trim(); },
    saves: 0
  };
  vm.createContext(sb);
  ['ticketAplicarConfirmados', 'ticketPareceDuplicado', 'saveParsedReceiptSingle', 'baseReceiptExpense', 'misTicketsLista'].forEach(function (n) {
    vm.runInContext(extractFunc(n), sb);
  });
  sb.saveParsedReceiptSingle();
  t('UN solo gasto registrado en Dinero', sb.state.expenses.length === 1, 'expenses=' + sb.state.expenses.length);
  const g = sb.state.expenses[0];
  t('el gasto lleva el total confirmado (23.97) y la tienda', Math.abs(g.total - 23.97) < 0.001 && g.store === 'Times', 'total=' + g.total);
  t('el gasto queda marcado como ticket (esTicket)', g.esTicket === true);
  t('la foto del ticket viaja UNA sola vez', g.ticket === 'data:image/jpeg;base64,FOTO' && sb.state.expenses.filter(function (x) { return x.ticket; }).length === 1);
  (function () {
    const sinFoto = JSON.parse(JSON.stringify(sb.state.expenses[0])); sinFoto.id = 99; sinFoto.ticket = '';
    sb.state.expenses.push(sinFoto);
    const enLista = sb.misTicketsLista().some(function (e) { return e.id === 99; });
    const dupe = sb.ticketPareceDuplicado('Times', 23.97, [{ name: 'Pollo' }, { name: 'Arroz' }, { name: 'Jabón' }]);
    sb.state.expenses.pop();
    t('un ticket guardado SIN foto también aparece en Mis tickets y entra al dedupe', enLista && dupe);
  })();
  t('el gasto de comida se marca como alimentación (food_gain)', g.type === 'food_gain');
  t('producto 🛒 entra a la lista de compra como comprado', sb.state.listaCompra.some(function (x) { return x.name === 'Pollo' && x.comprado === true; }));
  t('producto ya en la lista (Arroz) queda comprado con el ticket', sb.state.listaCompra.find(function (x) { return x.name === 'Arroz'; }).comprado === true);
  t('producto sin marcar NO entra a la lista', !sb.state.listaCompra.some(function (x) { return x.name === 'Jabón'; }));
  t('producto 🍽 entra a la Nevera sin duplicados', sb.state.fridgeTengo.length === 1 && sb.state.fridgeTengo[0] === 'Pollo');
  t('el borrador se limpia y una segunda confirmación no duplica', sb.state.ticketBorrador === null && sb.parsedReceiptItems.length === 0);
  t('historial del ticket registrado una vez', sb.state.receiptTextHistory.length === 1);
})();

console.log('== 7 · Cancelar no modifica lista, nevera ni Dinero ==');
(function () {
  const sb = {
    state: { expenses: [], receiptTextHistory: [], fridgeTengo: [], listaCompra: [], ticketBorrador: { origen: 'ocr', items: [{ name: 'Pollo' }] } },
    parsedReceiptItems: [{ name: 'Pollo', amount: 12.48, priceSource: 'REAL', include: true }],
    save: function () { sb.saves = (sb.saves || 0) + 1; },
    document: { getElementById: function () { return null; } },
    money: function (n) { return '$' + n; },
    safeText: function (x) { return String(x); },
    renderParsedReceiptTable: function () {},
    saves: 0
  };
  vm.createContext(sb);
  ['ticketCancelar'].forEach(function (n) { vm.runInContext(extractFunc(n), sb); });
  sb.ticketCancelar();
  t('cancelar limpia líneas y borrador', sb.parsedReceiptItems.length === 0 && sb.state.ticketBorrador === null);
  t('cancelar NO toca gastos, lista ni nevera', sb.state.expenses.length === 0 && sb.state.listaCompra.length === 0 && sb.state.fridgeTengo.length === 0);
})();

console.log('\n===== RESULTADO: ' + passed + ' PASS / ' + failed + ' FAIL =====');
if (failed) process.exit(1);
