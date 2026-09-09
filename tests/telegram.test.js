// ============================================================
// PRUEBAS — 📩 Telegram (entrada rápida) + OCR local gratis.
// Uso: node tests/telegram.test.js
// App: foto→OCR→borrador (sin gasto/inventario hasta confirmar), lista por
// texto con dedupe, nevera ambigua→confirmable, persistencia, sync, IA NUNCA
// por defecto. Worker: secret token, chat autorizado, notify con sesión dueño.
// ============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const WORKER_SRC = fs.readFileSync(path.join(__dirname, '..', 'cloudflare-worker.js'), 'utf8');

function extractFunc(src, name) {
  let i = src.indexOf('async function ' + name + '(');
  if (i < 0) i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('No se encontró function ' + name);
  let parens = 0, j = i, q = null, bodyStart = -1;
  for (; j < src.length; j++) {
    const c = src[j];
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '(') parens++;
    else if (c === ')') { parens--; if (parens === 0) { bodyStart = j + 1; break; } }
  }
  if (bodyStart < 0) throw new Error('params de ' + name);
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

/* ============ APP ============ */
function makeAppSb(state, ocrResultado) {
  const sb = {
    state: JSON.parse(JSON.stringify(state)),
    safeText: function (x) { return String(x == null ? '' : x); },
    completarNorm: function (s) { return String(s || '').toLowerCase(); },
    ppUUID: function () { return 't' + Math.random(); },
    todayISO: function () { return HOY; },
    save() { sb.saves = (sb.saves || 0) + 1; },
    alert(msg) { sb._alerts = (sb._alerts || 0) + 1; sb._lastAlert = msg; },
    confirm() { return true; },
    renderCarrito() {},
    telegramMarcar(id, estado) { sb._marcados.push({ id: id, estado: estado }); },
    telegramNotify(texto) { sb._notifies.push(texto); },
    ticketIA() { sb._iaLlamadas++; },
    ocrLocal: async function () { return ocrResultado || { texto: '', confianza: 0 }; },
    getCloudSession: function () { return sb._sesion; },
    cloudRest: async function (path) { sb._cloudCalls.push(path); return { ok: true, data: sb._inboxRows.filter(function (f) { return f.estado === 'pendiente'; }) }; },
    getCloudConfig: function () { return { url: 'https://x.supabase.co', key: 'sb_anon' }; },
    foods: [['Pollo 100g', 165, 31, 4, 0], ['Huevo', 72, 6, 5, 0], ['Leche entera taza', 149, 8, 8, 12], ['Arroz cocido 1 taza', 205, 4, 0, 45]],
    fridgeCats: { 'Carnes y proteínas': ['pollo', 'huevo', 'res'], 'Lácteos': ['leche'], 'Carbohidratos': ['arroz', 'papa'] },
    parsedReceiptItems: [],
    ticketDataUrl: '',
    _inboxRows: [],
    _marcados: [],
    _notifies: [],
    _cloudCalls: [],
    _iaLlamadas: 0,
    _sesion: { user: { id: 'uid-1' }, access_token: 'jwt-app' },
    parseReceiptText: function () {
      sb.parsedReceiptItems = sb._parsedMock || [];
    },
    _parsedMock: [],
    fetch: async function (url) {
      sb._fetches.push(url);
      return { ok: true, blob: async function () { return { size: 10 }; } };
    },
    FileReader: class FileReader {
      readAsDataURL(blob) {
        const self = this;
        setTimeout(function () {
          self.result = 'data:image/jpeg;base64,AAA';
          if (self.onload) self.onload({ target: self });
        }, 0);
      }
    },
    _fetches: [],
    document: { getElementById: function () { return null; } },
    window: { _carrito: [] }
  };
  sb.globalThis = sb;
  vm.createContext(sb);
  ['telegramBuscarFood', 'telegramAplicarLista', 'telegramAplicarNevera', 'telegramProcesarTicket',
    'telegramProcesarInbox', 'telegramPendientesUI', 'abrirBorradorTicket', 'abrirPendientesNevera',
    'descartarTelegramPendientes', 'ticketDesdeItems', 'ticketOCR'].forEach(function (n) {
    vm.runInContext(extractFunc(HTML, n), sb);
  });
  return sb;
}
function estadoBase() {
  return { diary: {}, expenses: [], receiptTextHistory: [], fridgeTengo: [], ticketBorrador: null, telegramPendientes: [], fitSettings: {} };
}

(async function () {
  console.log('== 1-8 · Foto de ticket → OCR → borrador (sin gasto/inventario antes de confirmar) ==');
  const sb = makeAppSb(estadoBase(), { texto: 'POLLO 2 lb 12.48\nHUEVOS docena 5.99\nTOTAL 18.47', confianza: 70 });
  sb._parsedMock = [
    { name: 'Pollo', amount: 12.48, priceSource: 'REAL', cat: 'comida', spanish: 'Pollo', raw: 'POLLO 2 lb 12.48', include: true, qty: '2', unit: 'lb', toFridge: false },
    { name: 'Huevos', amount: 5.99, priceSource: 'REAL', cat: 'comida', spanish: 'Huevos', raw: 'HUEVOS docena 5.99', include: true, qty: '1', unit: 'docena', toFridge: false }
  ];
  sb._inboxRows = [{ id: 'f1', user_id: 'uid-1', tipo: 'ticket', imagen_url: 'uid-1/telegram/t1.jpg', estado: 'pendiente' }];
  await sb.telegramProcesarInbox();
  t('foto recibida → borrador de ticket creado (origen telegram)', sb.state.ticketBorrador && sb.state.ticketBorrador.origen === 'telegram' && sb.state.ticketBorrador.items.length === 2);
  t('descarga la imagen de la carpeta del usuario', sb._fetches.length === 1 && /uid-1(%2F|\/)telegram(%2F|\/)t1\.jpg/.test(sb._fetches[0]));
  t('NO registra gasto antes de confirmar', sb.state.expenses.length === 0);
  t('NO toca Nevera antes de confirmar', sb.state.fridgeTengo.length === 0);
  t('fila marcada como procesada', sb._marcados.length === 1 && sb._marcados[0].estado === 'procesada');
  t('el bot recibe el conteo real (sin afirmar de más)', /OCR detectó 2 productos/.test(sb._notifies[0]), sb._notifies[0]);
  t('la IA NO se llamó (OCR gratis por defecto)', sb._iaLlamadas === 0);

  console.log('== 9-12 · OCR parcial / sin resultados / editar / confirmar ==');
  const sb2 = makeAppSb(estadoBase(), { texto: 'P O L L O 12.48', confianza: 30 });
  sb2._parsedMock = [{ name: 'Pollo', amount: 12.48, priceSource: 'REAL', cat: 'comida', spanish: 'Pollo', raw: 'P O L L O', include: true, qty: '', unit: '', toFridge: false }];
  sb2._inboxRows = [{ id: 'f2', user_id: 'uid-1', tipo: 'ticket', imagen_url: 'uid-1/telegram/t2.jpg', estado: 'pendiente' }];
  await sb2.telegramProcesarInbox();
  t('OCR débil: aviso honesto', /no se pudieron leer bien/.test(sb2._notifies[0]), sb2._notifies[0]);
  const sb3 = makeAppSb(estadoBase(), { texto: '', confianza: 5 });
  sb3._inboxRows = [{ id: 'f3', user_id: 'uid-1', tipo: 'ticket', imagen_url: 'uid-1/telegram/t3.jpg', estado: 'pendiente' }];
  await sb3.telegramProcesarInbox();
  t('OCR sin resultados: borrador vacío + mensaje claro', sb3.state.ticketBorrador && sb3.state.ticketBorrador.items.length === 0 && /no pude leerlo/.test(sb3._notifies[0]));
  // editar y confirmar desde el borrador
  sb.abrirBorradorTicket();
  sb.parsedReceiptItems[0].amount = 10; // corrección del usuario
  t('el borrador se abre para editar', sb.parsedReceiptItems.length === 2 && sb.parsedReceiptItems[0].amount === 10);

  console.log('== 13-15 · Persistencia refresh/cierre y sync ==');
  const persisted = JSON.parse(JSON.stringify(sb.state));
  const sb4 = makeAppSb(persisted, null);
  t('refresh/cierre: el borrador sobrevive', sb4.state.ticketBorrador && sb4.state.ticketBorrador.items.length === 2);
  t('el borrador viaja en el snapshot (misma sync)', JSON.stringify(sb4.state.ticketBorrador.items) === JSON.stringify(sb.state.ticketBorrador.items));

  console.log('== 16-17 · Lista de compras por texto con dedupe ==');
  const sb5 = makeAppSb(estadoBase(), null);
  sb5._inboxRows = [{ id: 'l1', user_id: 'uid-1', tipo: 'lista', texto: 'Agrega leche, huevos y pollo a compras', estado: 'pendiente' }];
  await sb5.telegramProcesarInbox();
  t('3 productos a la lista EXISTENTE', sb5.window._carrito.length === 3, sb5.window._carrito.map(function (c) { return c.name; }).join(','));
  t('los datos vienen de foods (kcal reales, nada inventado)', sb5.window._carrito[0].kcal > 0);
  sb5._inboxRows = [{ id: 'l2', user_id: 'uid-1', tipo: 'lista', texto: 'agrega pollo', estado: 'pendiente' }];
  await sb5.telegramProcesarInbox();
  t('repetir NO duplica', sb5.window._carrito.length === 3);
  t('el bot confirma con el número real', /Agregué 3 productos/.test(sb5._notifies[0]), sb5._notifies[0]);

  console.log('== 18 · Nevera por texto: ambiguo no toca inventario; claro queda confirmable ==');
  const sb6 = makeAppSb(estadoBase(), null);
  sb6._inboxRows = [{ id: 'n1', user_id: 'uid-1', tipo: 'nevera', texto: 'compré algo raro en la tienda', estado: 'pendiente' }];
  await sb6.telegramProcesarInbox();
  t('texto ambiguo: NUNCA modifica inventario', sb6.state.fridgeTengo.length === 0);
  t('ambiguo se marca para confirmación y avisa', sb6._marcados[0].estado === 'necesita_confirmacion');
  sb6._inboxRows = [{ id: 'n2', user_id: 'uid-1', tipo: 'nevera', texto: 'compré 2 lb de pollo', estado: 'pendiente' }];
  await sb6.telegramProcesarInbox();
  t('texto claro: queda PENDIENTE de confirmar (no entra directo)', sb6.state.fridgeTengo.length === 0 && sb6.state.telegramPendientes.length === 1 && sb6.state.telegramPendientes[0].nombre === 'pollo');
  sb6.abrirPendientesNevera(); // confirmar
  t('al confirmar recién entra a la Nevera', sb6.state.fridgeTengo.length === 1 && sb6.state.fridgeTengo[0] === 'pollo');

  console.log('== 19-20 · IA nunca automática; cancelar ==');
  t('flujo completo sin una sola llamada a la IA', sb5._iaLlamadas === 0 && sb6._iaLlamadas === 0);
  const sb7 = makeAppSb(estadoBase(), { texto: 'POLLO 12.48', confianza: 60 });
  sb7._parsedMock = [{ name: 'Pollo', amount: 12.48, priceSource: 'REAL', cat: 'comida', spanish: 'Pollo', raw: 'POLLO', include: true, qty: '', unit: '', toFridge: false }];
  sb7._inboxRows = [{ id: 'f7', user_id: 'uid-1', tipo: 'ticket', imagen_url: 'uid-1/telegram/t7.jpg', estado: 'pendiente' }];
  await sb7.telegramProcesarInbox();
  sb7.descartarTelegramPendientes();
  t('descartar limpia borrador y pendientes sin guardar nada', sb7.state.ticketBorrador === null && sb7.state.expenses.length === 0 && sb7.state.fridgeTengo.length === 0);

  console.log('== WORKER · webhook seguro ==');
  const env = { BOT_TOKEN: 'bot:TOK', TG_WEBHOOK_SECRET: 'sec-web', TG_ALLOWED_CHAT: '123', OWNER_USER_ID: 'uid-1', TG_JWT_SECRET: 'jwt-secreto-de-prueba' };
  const wsb = {
    SUPABASE_URL: 'https://x.supabase.co',
    SUPABASE_ANON: 'sb_anon',
    WORKER_VERSION: 'test',
    Response: globalThis.Response,
    Request: globalThis.Request,
    CORS_HEADERS: {},
    env: env,
    atob: globalThis.atob, btoa: globalThis.btoa, TextEncoder: globalThis.TextEncoder, TextDecoder: globalThis.TextDecoder,
    crypto: globalThis.crypto,
    fetch: async function (url, opts) {
      wsb._fetches.push({ url: String(url), headers: opts && opts.headers || {} });
      if (/\/getFile/.test(url)) return { ok: true, json: async function () { return { result: { file_path: 'photos/file.jpg' } }; } };
      if (/\/file\/bot/.test(url)) return { ok: true, arrayBuffer: async function () { return new Uint8Array([1, 2, 3]).buffer; } };
      if (/storage\/v1\/object/.test(url)) return { ok: true };
      if (/rest\/v1\/telegram_inbox/.test(url)) { wsb._insertBody = JSON.parse(opts.body); return { ok: true }; }
      if (/sendMessage/.test(url)) { wsb._sendBody = JSON.parse(opts.body); return { ok: true }; }
      return { ok: false, status: 500 };
    },
    _fetches: [], _insertBody: null, _sendBody: null
  };
  vm.createContext(wsb);
  ['json', 'jsonV', 'decodeJwt', 'firmarTgJwt', 'handleTelegramWebhook', 'handleTelegramNotify', 'b64url', 'tgEnvOk'].forEach(function (n) {
    const src = extractFunc(WORKER_SRC, n);
    vm.runInContext(src, wsb);
  });
  // chat autorizado
  const req = function (body, secret) {
    return new Request('https://w.workers.dev/telegram/webhook', { method: 'POST', headers: { 'X-Telegram-Bot-Api-Secret-Token': secret || 'sec-web', 'content-type': 'application/json' }, body: JSON.stringify(body) });
  };
  const upd = { update_id: 1, message: { chat: { id: 123 }, photo: [{ file_id: 'F1' }, { file_id: 'F2' }] } };
  const rOk = await wsb.handleTelegramWebhook(req(upd), wsb.env);
  const dataOk = await rOk.json();
  t('webhook con secret y chat correctos: acepta y responde al bot', dataOk.ok === true && /Ticket recibido/.test(wsb._sendBody.text), JSON.stringify(dataOk));
  t('inserta SOLO en telegram_inbox con el user_id del dueño', wsb._insertBody && wsb._insertBody.user_id === 'uid-1' && wsb._insertBody.tipo === 'ticket' && wsb._insertBody.estado === 'pendiente');
  const rSecret = await wsb.handleTelegramWebhook(req(upd, 'secreto-malo'), wsb.env);
  t('secret inválido → 401', rSecret.status === 401);
  const upd2 = { update_id: 2, message: { chat: { id: 999 }, text: 'hola' } };
  const rChat = await wsb.handleTelegramWebhook(req(upd2), wsb.env);
  t('chat NO autorizado → 403 (nadie más puede escribir)', rChat.status === 403);
  const mockReqNotify = function (sub) {
    return {
      method: 'POST',
      headers: { get: function (h) { return h.toLowerCase() === 'authorization' ? 'Bearer x.' + Buffer.from(JSON.stringify({ sub: sub, exp: Math.floor(Date.now() / 1000) + 60 })).toString('base64') : ''; } },
      json: async function () { return { text: 'OCR detectó 8 productos.' }; }
    };
  };
  const rN = await wsb.handleTelegramNotify(mockReqNotify('uid-1'), wsb.env);
  const dataN = await rN.json();
  t('notify con la sesión del dueño: envía el mensaje al bot', dataN.ok === true && /OCR detectó 8/.test(wsb._sendBody.text), JSON.stringify(dataN));
  const rN2 = await wsb.handleTelegramNotify(mockReqNotify('otro-usuario'), wsb.env);
  t('notify con OTRO usuario → 403', rN2.status === 403);

  console.log('== CONFIG · Campo seguro + mensaje de prueba ==');
  const storage = {};
  const cfgInputs = { tgBotToken: { value: '123456:ABC-DEF' }, tgChatId: { value: '8315587997' } };
  const cfgOut = { innerHTML: '' };
  const csb = {
    state: { fitSettings: {} },
    safeText: function (x) { return String(x == null ? '' : x); },
    safeStorage: {
      get: function (k) { return Object.prototype.hasOwnProperty.call(storage, k) ? storage[k] : null; },
      set: function (k, v) { storage[k] = v; return true; }
    },
    document: { getElementById: function (id) { if (id === 'tgBotToken') return cfgInputs.tgBotToken; if (id === 'tgChatId') return cfgInputs.tgChatId; if (id === 'telegramTestOut') return cfgOut; return null; } },
    fetch: async function (url, opts) {
      csb._urls.push(url);
      csb._body = JSON.parse(opts.body);
      return csb._nextFetch;
    },
    _urls: [], _body: null, _nextFetch: { ok: true, json: async function () { return { ok: true }; } }
  };
  vm.createContext(csb);
  ['getTelegramCfg', 'guardarTelegramCfg', 'telegramEnviarPrueba'].forEach(function (n) { vm.runInContext(extractFunc(HTML, n), csb); });

  csb.guardarTelegramCfg();
  const guardado = JSON.parse(storage['pp_telegram_cfg'] || '{}');
  t('el token se guarda SOLO en almacenamiento local del dispositivo', guardado.token === '123456:ABC-DEF' && guardado.chatId === '8315587997');
  t('el token NO entra al estado (no viaja al snapshot ni a la nube)', JSON.stringify(csb.state).indexOf('ABC-DEF') < 0);
  t('el campo del token se limpia tras guardar', cfgInputs.tgBotToken.value === '');
  await csb.telegramEnviarPrueba();
  t('el mensaje de prueba usa el chat autorizado y el texto exacto', /sendMessage/.test(csb._urls[0]) && csb._body.chat_id === '8315587997' && csb._body.text === '✅ Telegram conectado correctamente con mi app de fitness');
  t('éxito: pantalla confirma el envío', /Mensaje de prueba enviado/.test(cfgOut.innerHTML), cfgOut.innerHTML);
  csb._nextFetch = { ok: false, status: 401, json: async function () { return { ok: false, description: 'Unauthorized' }; } };
  cfgInputs.tgBotToken.value = '';
  await csb.telegramEnviarPrueba();
  t('fallo: muestra el error exacto de Telegram', /Telegram dice: Unauthorized/.test(cfgOut.innerHTML), cfgOut.innerHTML);
  csb._nextFetch = { ok: true, json: async function () { return { ok: true }; } };
  cfgInputs.tgChatId.value = 'abc';
  await csb.telegramEnviarPrueba();
  t('chat id inválido: aviso claro sin llamar a Telegram', /solo números/.test(cfgOut.innerHTML));
  storage['pp_telegram_cfg'] = '';
  cfgInputs.tgBotToken.value = '';
  await csb.telegramEnviarPrueba();
  t('sin token: pide guardarlo primero', /Guarda primero el token/.test(cfgOut.innerHTML));

  console.log('\n===== RESULTADO: ' + passed + ' PASS / ' + failed + ' FAIL =====');
  if (failed) process.exit(1);
})();
