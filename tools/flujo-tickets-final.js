// Verificación FINAL del flujo de tickets en la app real (Electron) — con
// manejo correcto de respuestas CDP y clics REALES (user activation).
// Uso: node tools/flujo-tickets-final.js [puerto]
const port = Number(process.argv[2] || 9334);
const fs = require('fs');
const path = require('path');

async function getTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch('http://127.0.0.1:' + port + '/json/list');
      const list = await res.json();
      const t = list.find(x => x.type === 'page' && x.webSocketDebuggerUrl);
      if (t) return t;
    } catch (e) {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('sin target');
}
function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let id = 0;
    const pend = new Map();
    const events = [];
    ws.onopen = () => {
      ws.sendJson = (method, params) => new Promise((res, rej) => {
        const mid = ++id;
        pend.set(mid, { res, rej });
        ws.send(JSON.stringify({ id: mid, method, params: params || {} }));
      });
      resolve(ws);
    };
    ws.onerror = e => reject(new Error('ws error'));
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m); }
      else if (m.method) events.push(m);
    };
    ws.events = events;
  });
}
let pasadas = 0, falladas = 0;
function t(label, ok, extra) {
  if (ok) { pasadas++; console.log('PASS ' + label + (extra ? ' · ' + extra : '')); }
  else { falladas++; console.log('FAIL ' + label + (extra ? ' · ' + extra : '')); }
}
const shot = async (ws, file) => {
  try {
    const r = await ws.sendJson('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(__dirname, file), Buffer.from(r.result.data, 'base64'));
    console.log('  📸 ' + file);
  } catch (e) { console.log('  ⚠ captura omitida: ' + e.message); }
};
const wait = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const target = await getTarget();
  console.log('conectado: ' + target.url);
  const ws = await connect(target.webSocketDebuggerUrl);
  await ws.sendJson('Runtime.enable', {});
  await ws.sendJson('Page.enable', {});
  await ws.sendJson('Log.enable', {});
  await ws.sendJson('Page.bringToFront', {});

  const ev = async (expr) => {
    const m = await ws.sendJson('Runtime.evaluate', { expression: expr, returnByValue: true });
    if (m.result && m.result.exceptionDetails) {
      const d = m.result.exceptionDetails.exception ? m.result.exceptionDetails.exception.description : m.result.exceptionDetails.text;
      console.log('  ⚠ EXCEP en eval: ' + d);
      return undefined;
    }
    return m.result && m.result.result ? m.result.result.value : undefined;
  };
  const clickReal = async (txt) => {
    const box = await ev(`(()=>{var b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes(${JSON.stringify(txt)}));if(!b)return null;b.scrollIntoView({block:'center'});var r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    if (!box) return false;
    await ws.sendJson('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y });
    await ws.sendJson('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 });
    await ws.sendJson('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 });
    return true;
  };

  await wait(2500);
  // entorno limpio de modales + overrides (los avisos fijos taparían los clics)
  console.log('prep:', await ev(`(()=>{window.alert=function(m){window.__alerts=window.__alerts||[];window.__alerts.push(String(m));};window.confirm=function(){return true;};try{state.onboarded=true;state._avisoSinCuentaVisto=true;state.uiSettings=state.uiSettings||{};state.uiSettings.tutorialDone=true;}catch(e){}['loginScreen','onboardingModal','avisoSinCuentaBox','appTutorial','ppWorkerToggleBar'].forEach(function(id){var el=document.getElementById(id);if(el)el.remove();});return 1;})()`));

  console.log('== 1 · Comer → Lista de compra → Mis tickets ==');
  await ev(`openTab('🍱 Contador')`);
  await wait(700);
  let r = await ev(`(()=>{var card=document.getElementById('listaCompraCard');var outs=document.querySelectorAll('#misTicketsOut');return {card:!!card,count:outs.length,inside:!!(card&&outs.length&&card.contains(outs[0]))};})()`);
  t('tarjeta Lista de compra en Comer con Mis tickets UNA vez', r && r.card === true && r.count === 1 && r.inside === true, JSON.stringify(r));
  await shot(ws, 'tickets-1-comer-lista.png');

  console.log('== 2 · Nevera: único acceso ==');
  await ev(`openTab('🥗 Nevera')`);
  await wait(700);
  r = await ev(`(()=>{var bs=[...document.querySelectorAll('button')].filter(b=>b.textContent.includes('Escanear compra y agregar alimentos'));return {n:bs.length,viejo:[...document.querySelectorAll('button')].filter(b=>b.textContent.includes('¿Tienes un ticket?')).length};})()`);
  t('acceso "📷 Escanear compra y agregar alimentos" UNA vez y sin botón viejo', r && r.n === 1 && r.viejo === 0, JSON.stringify(r));
  await shot(ws, 'tickets-2-nevera.png');

  console.log('== 3 · El acceso de Nevera abre el MISMO flujo con picker real ==');
  await ws.sendJson('Page.setInterceptFileChooserDialog', { enabled: true });
  const chooserProm = new Promise(res => {
    const orig = ws.onmessage;
    ws.onmessage = ev2 => {
      try {
        const m = JSON.parse(ev2.data);
        if (m.method === 'Page.fileChooserOpened') res({ backendNodeId: m.params.backendNodeId });
      } catch (e) {}
      orig(ev2);
    };
  });
  const okClick = await clickReal('Escanear compra y agregar alimentos');
  const chooser = await Promise.race([chooserProm, wait(5000).then(() => null)]);
  t('el acceso abre el selector de archivo (foto o galería) en el mismo gesto', okClick === true && !!chooser);
  await wait(500);
  r = await ev(`(()=>{var p=document.getElementById('gastoPaste');return {paste:!!p&&p.style.display!=='none',dups:document.querySelectorAll('#misTicketsOut').length};})()`);
  t('navega a Dinero y muestra la MISMA vista de edición', r && r.paste === true, JSON.stringify(r));
  t('sigue habiendo UNA sola sección Mis tickets', r && r.dups === 1, JSON.stringify(r));
  if (chooser) {
    const png = path.join(__dirname, '..', 'icon-192.png');
    await ws.sendJson('DOM.setFileInputFiles', { files: [png], backendNodeId: chooser.backendNodeId });
    console.log('  (imagen entregada; esperando OCR local…)');
    await wait(25000);
    const ocr = await ev(`(()=>{var re=document.getElementById('receiptText');return {texto:re?re.value.length:0,alertas:(window.__alerts||[]).length,borrador:!!(state.ticketBorrador&&state.ticketBorrador.origen)};})()`);
    t('el OCR local corrió (texto o aviso) y quedó en la vista editable', ocr && (ocr.texto > 0 || ocr.alertas > 0 || ocr.borrador === true), JSON.stringify(ocr));
    await shot(ws, 'tickets-3-ocr.png');
  }
  await ws.sendJson('Page.setInterceptFileChooserDialog', { enabled: false });
  await ev(`(()=>{try{ticketCancelar();}catch(e){}return 1;})()`);

  console.log('== 4 · Pegar → editar → confirmar (lista + nevera + Dinero 1 vez) ==');
  await ev(`openTab('💳 Gastos')`);
  await wait(300);
  await ev(`setGastoView('paste')`);
  await wait(200);
  r = await ev(`(()=>{var re=document.getElementById('receiptText');re.value='WALMART\\nPOLLO 12.48\\nHUEVOS 5.99\\nARROZ 8.49\\nTAX 0.50';analyzeReceiptText();return document.querySelectorAll('#receiptParsedOut tbody tr').length;})()`);
  t('vista previa editable con productos detectados', r === 4, 'filas=' + r);
  await ev(`(()=>{var c=document.querySelector('#receiptParsedOut tbody tr:nth-child(1) td:nth-child(6) input');if(c){c.checked=true;c.dispatchEvent(new Event('change'));}var f=document.querySelector('#receiptParsedOut tbody tr:nth-child(1) td:nth-child(7) input');if(f){f.checked=true;f.dispatchEvent(new Event('change'));}var c3=document.querySelector('#receiptParsedOut tbody tr:nth-child(3) td:nth-child(6) input');if(c3){c3.checked=true;c3.dispatchEvent(new Event('change'));}receiptNotaChip('compré más');return 1;})()`);
  await wait(200);
  r = await ev(`(()=>{var o=document.getElementById('receiptTotalsOut');return o?o.textContent:'';})()`);
  t('total editable refleja la selección', r && /27\.46/.test(r), r);
  await shot(ws, 'tickets-4-edicion.png');
  const clickOk = await clickReal('✅ Confirmar compra');
  await wait(900);
  r = await ev(`(()=>({exp:state.expenses.length,total:state.expenses[0]?state.expenses[0].total:null,tipo:state.expenses[0]?state.expenses[0].type:null,lista:state.listaCompra.map(x=>x.name+'='+(x.comprado?1:0)).join('|'),fridge:state.fridgeTengo.join('|'),badge:(document.getElementById('expenseOut')||{textContent:''}).textContent.includes('🧾 ticket')}))()`);
  t('clic en Confirmar registró UN solo gasto', clickOk === true && r && r.exp === 1, 'click=' + clickOk + ' ' + JSON.stringify(r));
  t('el gasto lleva total correcto y tipo alimentación', r && Math.abs(r.total - 27.46) < 0.01 && r.tipo === 'food_gain', 'total=' + (r && r.total));
  t('🛒 Compra → lista persistente comprado; 🍽 → Nevera sin duplicados', r && r.lista === 'POLLO=1|ARROZ=1' && r.fridge === 'POLLO', JSON.stringify(r && { lista: r.lista, fridge: r.fridge }));
  t('Dinero muestra la relación 🧾 ticket', r && r.badge === true);
  await shot(ws, 'tickets-5-dinero.png');

  console.log('== 5 · Historial de Mis tickets (resumen, filtros, Telegram) ==');
  await ev(`openTab('🍱 Contador')`);
  r = '';
  for (let i = 0; i < 10 && !r; i++) {
    await wait(500);
    r = await ev(`(()=>{var d=document.getElementById('misTicketsDet');if(d)d.open=true;var o=document.getElementById('misTicketsOut');return o?o.innerHTML:'';})()`);
  }
  t('historial: 1 ticket, búsqueda, filtros y resumen semanal/mensual', r && /1 ticket guardado/.test(r) && /Buscar en tickets/.test(r) && /Todas las tiendas/.test(r) && /Gasto esta semana/.test(r) && /Este mes/.test(r));
  t('botones de envío a Telegram presentes', r && /Enviar a Telegram/.test(r) && /Enviar resumen de compras/.test(r));
  await shot(ws, 'tickets-6-historial.png');

  console.log('== 6 · Dedupe: el mismo ticket otra vez NO guarda ==');
  await ev(`openTab('💳 Gastos')`);
  await wait(300);
  await ev(`setGastoView('paste')`);
  await wait(200);
  await ev(`(()=>{var re=document.getElementById('receiptText');re.value='WALMART\\nPOLLO 12.48\\nHUEVOS 5.99\\nARROZ 8.49\\nTAX 0.50';analyzeReceiptText();return 1;})()`);
  await wait(200);
  await ev(`window.confirm=function(){return false;};`);
  await clickReal('✅ Confirmar compra');
  await wait(700);
  r = await ev(`(()=>({exp:state.expenses.length,lista:state.listaCompra.length,fridge:state.fridgeTengo.length}))()`);
  t('el duplicado fue detectado y cancelado sin cambios', r && r.exp === 1 && r.lista === 2 && r.fridge === 1, JSON.stringify(r));

  console.log('== 7 · Cancelar sin modificar ==');
  await ev(`window.confirm=function(){return true;};`);
  const antes = await ev(`JSON.stringify({exp:state.expenses.length,lista:state.listaCompra.length,fridge:state.fridgeTengo.length})`);
  await clickReal('❌ Cancelar');
  await wait(500);
  const despues = await ev(`JSON.stringify({exp:state.expenses.length,lista:state.listaCompra.length,fridge:state.fridgeTengo.length})`);
  t('cancelar no cambió gastos, lista ni nevera', antes === despues, despues);
  t('cancelar limpió el borrador', await ev(`(()=>!state.ticketBorrador&&parsedReceiptItems.length===0)()`));

  console.log('== 8 · iPhone 390×844 sin overflow ==');
  await ws.sendJson('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  await wait(300);
  await ev(`openTab('🍱 Contador')`);
  await wait(800);
  r = await ev(`(()=>{var d=document.documentElement;return {w:d.scrollWidth,i:window.innerWidth};})()`);
  t('Comer (con la tarjeta nueva) cabe en iPhone', r && r.w <= r.i + 1, JSON.stringify(r));
  await shot(ws, 'tickets-7-iphone-comer.png');
  await ev(`openTab('🥗 Nevera')`);
  await wait(800);
  r = await ev(`(()=>{var d=document.documentElement;return {w:d.scrollWidth,i:window.innerWidth};})()`);
  t('Nevera (con el acceso nuevo) cabe en iPhone', r && r.w <= r.i + 1, JSON.stringify(r));
  await shot(ws, 'tickets-8-iphone-nevera.png');
  await ws.sendJson('Emulation.clearDeviceMetricsOverride', {});

  const errores = ws.events.filter(m => m.method === 'Runtime.exceptionThrown').length;
  t('sin excepciones JS durante el flujo', errores === 0, errores + ' excepciones');

  console.log('\n===== FLUJO VISUAL: ' + pasadas + ' PASS / ' + falladas + ' FAIL =====');
  process.exit(falladas ? 1 : 0);
}
main().catch(e => { console.error('ERROR: ' + e.message); process.exit(2); });
