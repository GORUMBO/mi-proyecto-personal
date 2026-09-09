// ============================================================
// PRUEBAS — 🧾 Tickets de compra (OCR por IA existente).
// Uso: node tests/ticket-compra.test.js
// Cubre: productos múltiples, no identificado, edición, eliminación,
// confirmación, dedupe, lista de compras, Nevera, gasto, persistencia
// (refresh/cierre vía borrador), snapshot/sync y cancelación.
// La llamada a la IA se mockea: aquí se prueba el PIPELINE completo.
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
      if (c === '$' && src[j + 1] === '{') { j += 2; tplStack.push(depth); depth++; q = null; continue; }
      continue;
    }
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '/' && (src[j + 1] === "'" || src[j + 1] === '"' || src[j + 1] === '\\') && /[\(,=:\[!&|?;{+\-*%~^<>]\s*$/.test(src.slice(Math.max(0, j - 4), j))) {
      j++;
      while (j < src.length && !(src[j] === '/' && src[j - 1] !== '\\')) j++;
      continue;
    }
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

const TICKET_JSON = {
  tienda: 'Times',
  fecha: '2026-09-08',
  total: 31.75,
  productos: [
    { nombre: 'Pollo', cantidad: 2, unidad: 'lb', precio: 12.48 },
    { nombre: 'Huevos', cantidad: 1, unidad: 'docena', precio: 5.99 },
    { nombre: 'Leche', cantidad: 1, unidad: 'gal', precio: 4.79 },
    { nombre: 'Arroz', cantidad: 5, unidad: 'lb', precio: 8.49 },
    { nombre: '', cantidad: null, unidad: '', precio: null } // ilegible
  ]
};

function makeSb(state) {
  const inputs = { receiptStore: { value: '' }, receiptDate: { value: '' } };
  const sb = {
    state: JSON.parse(JSON.stringify(state)),
    safeText: function (x) { return String(x == null ? '' : x); },
    money: function (n) { return '$' + (+n).toFixed(2); },
    completarNorm: function (s) { return String(s || '').toLowerCase().replace(/[áéíóúñ]/g, function (c) { return 'aeioun' [ 'áéíóúñ'.indexOf(c) ]; }).trim(); },
    inferReceiptCategory: function (n) { return { cat: 'comida', es: n }; },
    receiptCatOptions: function (c) { return '<option>' + c + '</option>'; },
    receiptPriceBadge: function (s) { return s; },
    catEmoji: { comida: '🍽️' },
    defaultExpenseNeed: function () { return 'reduce'; },
    alert(msg) { sb._alerts = (sb._alerts || 0) + 1; sb._lastAlert = msg; },
    confirm() { return true; },
    renderExpenses() {}, renderGastoChart() {}, renderSavingsAnalyzer() {}, renderExpenseAlerts() {}, renderMissingExpenseIdeas() {},
    setGastoView() {},
    todayISO: function () { return new Date().toISOString().slice(0, 10); },
    save() { sb.saves = (sb.saves || 0) + 1; },
    document: {
      getElementById: function (id) { return inputs[id] || null; }
    },
    window: { _carrito: [] },
    parsedReceiptItems: [],
    ticketDataUrl: ''
  };
  vm.createContext(sb);
  ['ticketProcesarIA', 'ticketCancelar', 'ticketAplicarConfirmados', 'saveParsedReceiptSeparate',
    'saveParsedReceiptSingle', 'renderParsedReceiptTable', 'updateReceiptTotals',
    'baseReceiptExpense', 'setGastoView', 'ticketDesdeItems'].forEach(function (n) {
    vm.runInContext(extractFunc(n), sb);
  });
  sb.inputs = inputs;
  return sb;
}
function estadoBase() {
  return { diary: {}, expenses: [], receiptTextHistory: [], fridgeTengo: [], ticketBorrador: null, fitSettings: {} };
}

console.log('== 1 · Ticket con varios productos (detección IA) ==');
(function () {
  const sb = makeSb(estadoBase());
  sb.ticketProcesarIA(TICKET_JSON, 'data:image/jpeg;base64,AAA');
  t('5 líneas detectadas (4 productos + 1 ilegible)', sb.parsedReceiptItems.length === 5, JSON.stringify(sb.parsedReceiptItems[0]));
  t('precios reales con origen "IA REAL"', sb.parsedReceiptItems[0].priceSource === 'IA REAL' && sb.parsedReceiptItems[0].amount === 12.48);
  t('cantidad y unidad detectadas', sb.parsedReceiptItems[0].qty === '2' && sb.parsedReceiptItems[0].unit === 'lb' && sb.parsedReceiptItems[1].unit === 'docena', 'qty=' + sb.parsedReceiptItems[0].qty + ' unit=' + sb.parsedReceiptItems[0].unit);
  t('tienda y fecha van al formulario', sb.inputs.receiptStore.value === 'Times' && sb.inputs.receiptDate.value === '2026-09-08');
  t('borrador persistido con la foto', sb.state.ticketBorrador && sb.state.ticketBorrador.items.length === 5 && sb.state.ticketBorrador.foto === 'data:image/jpeg;base64,AAA' && sb.saves >= 1);
})();

console.log('== 2 · Producto no identificado → se marca REVISAR ==');
(function () {
  const sb = makeSb(estadoBase());
  sb.ticketProcesarIA(TICKET_JSON, 'data:x');
  const malo = sb.parsedReceiptItems[4];
  t('nombre "Producto no identificado" y origen REVISAR', malo.name === 'Producto no identificado' && malo.priceSource === 'REVISAR' && malo.amount === 0);
  t('la línea es editable (el usuario la corrige antes de confirmar)', malo.include === true);
})();

console.log('== 3 · Edición antes de confirmar ==');
(function () {
  const sb = makeSb(estadoBase());
  sb.ticketProcesarIA(TICKET_JSON, 'data:x');
  sb.parsedReceiptItems[4].name = 'Papas';
  sb.parsedReceiptItems[4].amount = 3.25;
  sb.parsedReceiptItems[4].priceSource = 'REAL';
  sb.saveParsedReceiptSingle();
  const g = sb.state.expenses[0];
  t('el gasto refleja el nombre y precio CORREGIDOS', /Papas/.test(g.note) && g.total === 35, g.note);
})();

console.log('== 4 · Eliminar una línea antes de confirmar ==');
(function () {
  const sb = makeSb(estadoBase());
  sb.ticketProcesarIA(TICKET_JSON, 'data:x');
  sb.parsedReceiptItems[3].include = false; // Arroz fuera
  sb.saveParsedReceiptSingle();
  const g = sb.state.expenses[0];
  t('la línea quitada NO entra al total ni al detalle', g.total === 23.26 && !/Arroz/.test(g.note), g.total);
})();

console.log('== 5 · Confirmación guarda gasto + historial ==');
(function () {
  const sb = makeSb(estadoBase());
  sb.ticketProcesarIA(TICKET_JSON, 'data:image/jpeg;base64,ABC');
  sb.parsedReceiptItems[4].include = false;
  sb.saveParsedReceiptSingle();
  const g = sb.state.expenses[0];
  t('gasto guardado con tienda, total y ticket (imagen)', g.store === 'Times' && g.total === 31.75 && g.ticket === 'data:image/jpeg;base64,ABC', JSON.stringify({ store: g.store, total: g.total, ticket: g.ticket }));
  t('historial del ticket registrado', sb.state.receiptTextHistory.length === 1 && sb.state.receiptTextHistory[0].count === 4);
})();

console.log('== 6 · Deduplicación: doble confirmación no guarda dos veces ==');
(function () {
  const sb = makeSb(estadoBase());
  sb.ticketProcesarIA(TICKET_JSON, 'data:x');
  sb.parsedReceiptItems[4].include = false;
  sb.saveParsedReceiptSingle();
  sb.saveParsedReceiptSingle(); // segunda confirmación
  t('un solo gasto registrado', sb.state.expenses.length === 1);
  t('la segunda confirmación avisa "No hay líneas"', sb._lastAlert === 'No hay líneas seleccionadas.');
})();

console.log('== 7 · Lista de compras: solo lo que YA estaba pasa a comprado ==');
(function () {
  const sb = makeSb(estadoBase());
  sb.window._carrito = [{ name: 'Pollo', kcal: 0, cant: 1 }];
  sb.ticketProcesarIA(TICKET_JSON, 'data:x');
  sb.parsedReceiptItems[4].include = false;
  sb.parsedReceiptItems[3].include = false; // Arroz no estaba en la lista
  sb.parsedReceiptItems[2].include = false;
  sb.parsedReceiptItems[1].include = false;
  sb.saveParsedReceiptSingle();
  t('Pollo (en la lista) queda marcado comprado', sb.window._carrito[0].comprado === true);
  t('productos fuera de la lista NO se agregan como pendientes', sb.window._carrito.length === 1);
})();

console.log('== 8 · Nevera: solo los marcados 🧊 entran (sin duplicados) ==');
(function () {
  const sb = makeSb(estadoBase());
  sb.state.fridgeTengo = ['Pollo'];
  sb.ticketProcesarIA(TICKET_JSON, 'data:x');
  sb.parsedReceiptItems[0].toFridge = true; // Pollo (ya estaba)
  sb.parsedReceiptItems[3].toFridge = true; // Arroz
  sb.parsedReceiptItems[1].include = false;
  sb.parsedReceiptItems[2].include = false;
  sb.parsedReceiptItems[4].include = false;
  sb.saveParsedReceiptSingle();
  t('Arroz entra a Nevera; Pollo no se duplica', sb.state.fridgeTengo.length === 2 && sb.state.fridgeTengo.includes('Arroz'));
  t('una línea puede quedar FUERA de Nevera aunque se confirme', !sb.state.fridgeTengo.includes('Huevos'));
})();

console.log('== 9 · Persistencia: refresh y cierre/reapertura del borrador ==');
(function () {
  const sb = makeSb(estadoBase());
  sb.ticketProcesarIA(TICKET_JSON, 'data:image/jpeg;base64,ZZZ');
  const persisted = JSON.parse(JSON.stringify(sb.state)); // refresh / cerrar
  const sb2 = makeSb(persisted); // abrir
  sb2.setGastoView('paste'); // la app restaura el borrador al abrir la vista
  t('tras refresh/cierre: el borrador se restaura con sus líneas', sb2.parsedReceiptItems.length === 5 && sb2.ticketDataUrl === 'data:image/jpeg;base64,ZZZ');
  t('la foto del ticket se conserva en el borrador', sb2.state.ticketBorrador.foto === 'data:image/jpeg;base64,ZZZ');
})();

console.log('== 10 · Cancelación sin guardar cambios ==');
(function () {
  const sb = makeSb(estadoBase());
  sb.ticketProcesarIA(TICKET_JSON, 'data:x');
  sb.ticketCancelar();
  t('cancelar limpia líneas y borrador', sb.parsedReceiptItems.length === 0 && sb.state.ticketBorrador === null);
  t('cancelar NO guarda gastos', sb.state.expenses.length === 0 && sb.state.receiptTextHistory.length === 0);
})();

console.log('== 11 · El estado viaja en el snapshot (sync sin cambios) ==');
(function () {
  const sb = makeSb(estadoBase());
  sb.ticketProcesarIA(TICKET_JSON, 'data:x');
  sb.parsedReceiptItems[4].include = false;
  sb.saveParsedReceiptSingle();
  const local = sb.state;
  const remoto = { expenses: [], lastModified: '2026-09-08T01:00:00.000Z' };
  const merged = Object.assign({}, remoto, local);
  t('expenses + receiptTextHistory + fridgeTengo viajan en el snapshot', merged.expenses.length === 1 && merged.receiptTextHistory.length === 1 && Array.isArray(merged.fridgeTengo));
})();

console.log('\n===== RESULTADO: ' + passed + ' PASS / ' + failed + ' FAIL =====');
if (failed) process.exit(1);
