// ============================================================
// PRUEBAS — 🧾 Mis tickets (historial, resumen, dedupe, toggles,
// notas y envíos a Telegram con el token local).
// Uso: node tests/mis-tickets.test.js
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

let passed = 0, failed = 0;
function t(label, ok, extra) {
  if (ok) { passed++; console.log('✓ ' + label + (extra ? ' · ' + extra : '')); }
  else { failed++; console.log('✗ FALLA ' + label + (extra ? ' · ' + extra : '')); }
}

const HOY = new Date().toISOString().slice(0, 10);
const MES = HOY.slice(0, 7);

function makeSb(state) {
  const storage = { pp_telegram_cfg: JSON.stringify({ token: '111:TOK', chatId: '9988776655' }) };
  const inputs = { receiptStore: { value: 'Times' }, receiptNota: { value: '' }, tgBotToken: { value: '' }, tgChatId: { value: '9988776655' } };
  const base = { diary: {}, weight: [], tasks: [], receiptTextHistory: [], fridgeTengo: [], listaCompra: [], fitSettings: {} };
  const sb = {
    state: Object.assign(JSON.parse(JSON.stringify(base)), JSON.parse(JSON.stringify(state))),
    safeText: function (x) { return String(x == null ? '' : x); },
    completarNorm: function (s) { return String(s || '').toLowerCase().replace(/[^a-záéíóúñ0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); },
    money: function (n) { return '$' + (+n).toFixed(2); },
    ppUUID: function () { return 'x' + Math.random(); },
    todayISO: function () { return HOY; },
    confirm() { sb._confirms++; return sb._confirmResult; },
    alert(msg) { sb._lastAlert = msg; },
    toastReg(msg) { sb._toasts.push(msg); },
    save: function () { sb.saves = (sb.saves || 0) + 1; },
    renderExpenses() {}, renderGastoChart() {}, renderSavingsAnalyzer() {}, renderExpenseAlerts() {}, renderMissingExpenseIdeas() {},
    defaultExpenseNeed: function () { return 'reduce'; },
    renderCarrito() {},
    getCloudSession: function () { return null; },
    f3RutinaActiva: function () { return null; },
    getTodayDiaryTotals: function () { return { k: 0, p: 0 }; },
    safeStorage: {
      get: function (k) { return Object.prototype.hasOwnProperty.call(storage, k) ? storage[k] : null; },
      set: function (k, v) { storage[k] = v; return true; }
    },
    document: {
      getElementById: function (id) { return inputs[id] || null; }
    },
    window: { _carrito: [], _mtQ: '', _mtTienda: 'todas', _mtMes: 'todos', _mtCat: 'todas' },
    fetch: async function (url, opts) {
      sb._urls.push(String(url));
      sb._body = JSON.parse(opts.body);
      return { ok: true, json: async function () { return { ok: true }; } };
    },
    _urls: [], _body: null, _confirms: 0, _confirmResult: true, _toasts: [], _lastAlert: null,
    parsedReceiptItems: [], ticketDataUrl: ''
  };
  vm.createContext(sb);
  ['misTicketsLista', 'misTicketsResumen', 'telegramTextoResumenCompras', 'telegramTicketTexto',
    'telegramEnviarLocal', 'telegramEnviarTicket', 'telegramEnviarResumenCompras', 'telegramResumenDiaTexto',
    'telegramEnviarResumenDia', 'misTicketsHTML', 'misTicketsRender', 'ticketPareceDuplicado',
    'ticketAplicarConfirmados', 'receiptNotaChip', 'receiptNotaActual', 'getTelegramCfg',
    'saveParsedReceiptSingle', 'baseReceiptExpense', 'setGastoView'].forEach(function (n) {
    vm.runInContext(extractFunc(n), sb);
  });
  sb.inputs = inputs;
  return sb;
}
function gastoTicket(id, store, total, detalle, d, cat, nota) {
  return { id: id, store: store, total: total, cat: cat || 'comida', d: d || HOY,
    ticket: 'data:image/jpeg;base64,AAA', note: 'Ticket guardado como un solo gasto. Solo precios reales. Detalle: ' + detalle + (nota ? '. Nota: ' + nota : '') };
}

console.log('== 1 · Historial y resumen (solo datos reales) ==');
(function () {
  const sb = makeSb({ expenses: [
    gastoTicket(1, 'Times', 31.75, 'Pollo $12.48 (comida, REAL); Huevos $5.99 (comida, REAL); Arroz $8.49 (comida, REAL)'),
    gastoTicket(2, 'Costco', 80.00, 'Leche $4.79 (comida, REAL)', HOY.slice(0, 8) + '01'),
    { id: 3, store: 'Gas', total: 30, d: HOY, cat: 'gasolina' }, // sin ticket: no cuenta
    { id: 4, store: 'Safeway', total: 20.50, d: HOY, cat: 'comida', esTicket: true, note: 'Ticket guardado como un solo gasto. Solo precios reales. Detalle: Pan $2.50 (comida, REAL)' } // ticket sin foto: SÍ cuenta
  ], diary: {}, weight: [], tasks: [] });
  t('los gastos con foto o nacidos de un ticket (esTicket) cuentan como tickets', sb.misTicketsLista().length === 3);
  t('un gasto normal sigue sin contar', !sb.misTicketsLista().some(function (e) { return e.id === 3; }));
  const r = sb.misTicketsResumen();
  t('gasto semanal y mensual calculados desde los tickets reales', r.semana === 52.25 && r.mes === 132.25, JSON.stringify(r));
  t('productos más comprados salen del detalle real', r.top.length >= 1 && r.top[0][0] === 'pollo');
  const html = sb.misTicketsHTML();
  t('historial muestra búsqueda y filtros', /Buscar en tickets/.test(html) && /Todas las tiendas/.test(html) && /Todos los meses/.test(html) && /Todas las categorías/.test(html));
  sb.window._mtQ = 'costco';
  const html2 = sb.misTicketsHTML();
  t('la búsqueda filtra por tienda (la tarjeta de Times sale de la lista)', /Costco/.test(html2) && html2.indexOf('font-weight:900">$31.75') < 0);
})();

console.log('== 2 · Dedupe entre tickets (con confirmación) ==');
(function () {
  const sb = makeSb({ expenses: [gastoTicket(1, 'Times', 26.96, 'Pollo $12.48 (comida, REAL); Huevos $5.99 (comida, REAL); Arroz $8.49 (comida, REAL)')], diary: {}, weight: [], tasks: [] });
  const items = [
    { name: 'Pollo', amount: 12.48, priceSource: 'REAL', cat: 'comida', spanish: 'Pollo', raw: 'POLLO', include: true, qty: '', unit: '', toFridge: false, compra: false },
    { name: 'Huevos', amount: 5.99, priceSource: 'REAL', cat: 'comida', spanish: 'Huevos', raw: 'HUEVOS', include: true, qty: '', unit: '', toFridge: false, compra: false },
    { name: 'Arroz', amount: 8.49, priceSource: 'REAL', cat: 'comida', spanish: 'Arroz', raw: 'ARROZ', include: true, qty: '', unit: '', toFridge: false, compra: false }
  ];
  t('detecta un ticket repetido (tienda+total+productos)', sb.ticketPareceDuplicado('Times', 26.96, items) === true);
  const sbImpuesto = makeSb({ expenses: [gastoTicket(7, 'Times', 27.46, 'Pollo $12.48 (comida, REAL); Huevos $5.99 (comida, REAL); Arroz $8.49 (comida, REAL); Sales tax / impuesto $0.50 (impuesto fees, REAL)')], diary: {}, weight: [], tasks: [] });
  t('el dedupe coincide nombres con símbolos ("Sales tax / impuesto") tras normalizar', sbImpuesto.ticketPareceDuplicado('Times', 27.46, [
    { name: 'Pollo', amount: 12.48, priceSource: 'REAL', cat: 'comida', spanish: 'Pollo', raw: 'POLLO', include: true },
    { name: 'Huevos', amount: 5.99, priceSource: 'REAL', cat: 'comida', spanish: 'Huevos', raw: 'HUEVOS', include: true },
    { name: 'Arroz', amount: 8.49, priceSource: 'REAL', cat: 'comida', spanish: 'Arroz', raw: 'ARROZ', include: true },
    { name: 'Sales tax / impuesto', amount: 0.50, priceSource: 'REAL', cat: 'impuesto fees', spanish: 'Impuesto', raw: 'TAX', include: true }
  ]) === true);
  const sbSinFoto = makeSb({ expenses: [{ id: 9, store: 'Times', total: 26.96, d: HOY, cat: 'comida', esTicket: true, note: 'Ticket guardado como un solo gasto. Solo precios reales. Detalle: Pollo $12.48 (comida, REAL); Huevos $5.99 (comida, REAL); Arroz $8.49 (comida, REAL)' }], diary: {}, weight: [], tasks: [] });
  t('el dedupe también detecta tickets guardados sin foto (esTicket)', sbSinFoto.ticketPareceDuplicado('Times', 26.96, items) === true);
  t('no confunde con otro total', sb.ticketPareceDuplicado('Times', 40, items) === false);
  t('no confunde con otros productos', sb.ticketPareceDuplicado('Times', 31.75, [{ name: 'Jabón', amount: 31.75, priceSource: 'REAL', cat: 'otro', spanish: 'Jabón', raw: 'JABON', include: true, qty: '', unit: '', toFridge: false, compra: false }]) === false);
  // flujo real: confirmar duplicado con confirm=false → NO guarda
  sb.parsedReceiptItems = items.map(function (x) { return Object.assign({}, x); });
  sb.inputs.receiptStore.value = 'Times';
  sb._confirmResult = false;
  sb.saveParsedReceiptSingle();
  t('si el usuario cancela el duplicado, NO se guarda ni se aplica nada', sb.state.expenses.length === 1 && sb.state.listaCompra.length === 0 && sb.state.fridgeTengo.length === 0 && sb._confirms === 1, 'exp=' + sb.state.expenses.length + ' lista=' + sb.state.listaCompra.length + ' fridge=' + sb.state.fridgeTengo.length + ' confirms=' + sb._confirms);
})();

console.log('== 3 · Toggles por línea: compra y alimentación ==');
(function () {
  const sb = makeSb({ expenses: [], diary: {}, weight: [], tasks: [] });
  const items = [
    { name: 'Pollo', amount: 12.48, priceSource: 'REAL', cat: 'comida', spanish: 'Pollo', raw: 'POLLO', include: true, qty: '', unit: '', toFridge: true, compra: true },
    { name: 'Jabón', amount: 3.00, priceSource: 'REAL', cat: 'otro', spanish: 'Jabón', raw: 'JABON', include: true, qty: '', unit: '', toFridge: false, compra: false }
  ];
  sb.ticketAplicarConfirmados(items);
  t('🛒 Compra: entra a la lista de compras persistente ya marcado como comprado', sb.state.listaCompra.length === 1 && sb.state.listaCompra[0].name === 'Pollo' && sb.state.listaCompra[0].comprado === true);
  t('🍽 Alimentación: entra a la Nevera', sb.state.fridgeTengo && sb.state.fridgeTengo.length === 1 && sb.state.fridgeTengo[0] === 'Pollo');
  t('un producto sin marcar NO entra a la lista ni a la nevera', sb.state.listaCompra.length === 1 && sb.state.fridgeTengo.length === 1);
})();

console.log('== 4 · Notas del ticket ==');
(function () {
  const sb = makeSb({ expenses: [], diary: {}, weight: [], tasks: [] });
  sb.receiptNotaChip('compré más');
  sb.receiptNotaChip('estaba en oferta');
  t('los chips acumulan la nota', sb.inputs.receiptNota.value === 'compré más, estaba en oferta');
  sb.parsedReceiptItems = [{ name: 'Pollo', amount: 12.48, priceSource: 'REAL', cat: 'comida', spanish: 'Pollo', raw: 'POLLO', include: true, qty: '', unit: '', toFridge: false, compra: false }];
  sb.inputs.receiptStore.value = 'Times';
  sb.saveParsedReceiptSingle();
  t('la nota queda guardada en el gasto', /Nota: compré más, estaba en oferta/.test(sb.state.expenses[0].note));
})();

console.log('== 5 · Envíos a Telegram con token local (sin foto) ==');
(async function () {
  const sb = makeSb({ expenses: [gastoTicket(1, 'Times', 31.75, 'Pollo $12.48 (comida, REAL)', HOY, 'comida', 'compré más')], diary: {}, weight: [], tasks: [] });
  const txt = sb.telegramTicketTexto(sb.state.expenses[0]);
  t('el texto del ticket lleva tienda, fecha, total, productos y nota', /Times/.test(txt) && /31\.75/.test(txt) && /Pollo/.test(txt) && /compré más/.test(txt));
  t('el texto NO incluye la fotografía (dataURL)', txt.indexOf('data:image') < 0);
  await sb.telegramEnviarTicket(1);
  t('envía por Telegram con el token LOCAL guardado', /api\.telegram\.org\/bot111(%3A|:)TOK\/sendMessage/.test(sb._urls[0]) && sb._body.chat_id === '9988776655', sb._urls[0]);
  const resumen = sb.telegramTextoResumenCompras();
  t('el resumen de compras lleva semana, mes y top productos', /\$31\.75/.test(resumen) && /Más comprados: pollo ×1/.test(resumen));
  await sb.telegramEnviarResumenCompras();
  t('envío de resumen: toast de éxito', sb._toasts.some(function (x) { return /Resumen de compras enviado/.test(x); }));
  finalizar();
})();

console.log('== 6 · Resumen del día (Completa tu día) ==');
(function () {
  const sb = makeSb({ expenses: [], diary: {}, weight: [], tasks: [], fitSettings: {} });
  const txt = sb.telegramResumenDiaTexto();
  t('los campos faltantes dicen "Sin registro"', /Rutina: Sin registro/.test(txt) && /Ejercicios: Sin registro/.test(txt) && /Calorías: Sin registro/.test(txt) && /Agua: Sin registro/.test(txt) && /Peso: Sin registro/.test(txt));
  const sb2 = makeSb({ expenses: [], diary: {}, weight: [{ w: 150 }], tasks: [{ title: 'Comprar huevo', done: false }], fitSettings: {} });
  const txt2 = sb2.telegramResumenDiaTexto();
  t('con datos reales los muestra', /Peso: 150 lb/.test(txt2) && /Metas pendientes: Comprar huevo/.test(txt2));
})();

console.log('== 7 · IA nunca automática y el token nunca viaja en el estado ==');
(function () {
  const sb = makeSb({ expenses: [], diary: {}, weight: [], tasks: [] });
  t('el token vive solo en el almacenamiento local (no en state)', JSON.stringify(sb.state).indexOf('111:TOK') < 0);
  t('getTelegramCfg lo recupera del almacenamiento local', sb.getTelegramCfg().token === '111:TOK');
  t('el código NO trae ningún Chat ID personal predeterminado', HTML.indexOf('8315587997') < 0);
  const ocurrencias = (HTML.match(/id="misTicketsOut"/g) || []).length;
  t('la sección Mis tickets existe UNA sola vez en el código', ocurrencias === 1, ocurrencias + ' ocurrencias');
})();

console.log('== 8 · Sin Chat ID guardado: error claro y ningún envío ==');
(async function () {
  const sb = makeSb({ expenses: [], diary: {}, weight: [], tasks: [] });
  sb.safeStorage.set('pp_telegram_cfg', JSON.stringify({ token: '111:TOK', chatId: '' }));
  let msg = null;
  try { await sb.telegramEnviarLocal('prueba'); } catch (e) { msg = e.message; }
  t('sin Chat ID se detiene con mensaje claro y NO envía', /Chat ID/.test(msg || '') && sb._urls.length === 0, String(msg));
  finalizar();
})();

function finalizar() {
  console.log('\n===== RESULTADO: ' + passed + ' PASS / ' + failed + ' FAIL =====');
  if (failed) process.exit(1);
}
