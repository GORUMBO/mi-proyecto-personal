// Prueba visual del SELECTOR de alimentos (carrito de Comer) — CDP.
// Uso: node tools/prueba-visual-carrito.js [puerto]  (default 9333)
// Casos: estado seleccionado MUY visible (fondo+anillo+✓), deseleccionar,
// resumen en vivo, CTA con cantidad y momento, chips, iPhone 390 sin
// overflow. La app queda abierta EN ESTA PANTALLA para revisión.
const port = Number(process.argv[2] || 9333);
const fs = require('fs');
const path = require('path');

async function getTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch('http://127.0.0.1:' + port + '/json/list');
      const list = await res.json();
      const t = list.find(x => x.type === 'page' && x.webSocketDebuggerUrl);
      if (t) return t;
    } catch (e) { /* aún no listo */ }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('sin target CDP en ' + port);
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
      if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
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
    const r = await Promise.race([
      ws.sendJson('Page.captureScreenshot', { format: 'png' }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout shot')), 60000))
    ]);
    fs.writeFileSync(path.join(__dirname, file), Buffer.from(r.data, 'base64'));
    console.log('  📸 ' + file);
  } catch (e) { console.log('  ⚠ captura omitida (' + file + '): ' + e.message); }
};

(async () => {
  const target = await getTarget();
  const ws = await connect(target.webSocketDebuggerUrl);
  const evalJs = async (expr) => {
    const r = await ws.sendJson('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('EVAL ERROR: ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
    return r.result.value;
  };
  await ws.sendJson('Runtime.enable', {});
  await ws.sendJson('Page.enable', {});
  await ws.sendJson('Page.reload', { ignoreCache: true });
  await new Promise(r => setTimeout(r, 5000));

  await evalJs("(function(){try{openTab('🍱 Contador',false);}catch(e){}return true;})()");
  await new Promise(r => setTimeout(r, 800));
  await evalJs("(function(){openAddFood('breakfast');return true;})()");
  await new Promise(r => setTimeout(r, 500));
  await evalJs("(function(){var inp=document.getElementById('foodSearch');if(inp)inp.value='huevo';searchFood('huevo');return true;})()");
  await new Promise(r => setTimeout(r, 500));

  const filaEstado = () => evalJs("(function(){var r=document.querySelector('#foodSearchResults [data-foodid]');if(!r)return null;var b=r.querySelector('[data-check]');return {bg:r.style.background,anillo:r.style.boxShadow,check:b?b.textContent:'(sin)',checkBg:b?b.style.background:''};})()");
  const resumen = () => evalJs("(function(){var el=document.getElementById('carritoResumen');return el?el.textContent.trim():'';})()");
  const cta = () => evalJs("(function(){var el=document.getElementById('carritoCTA');return el?{txt:el.textContent,disabled:el.disabled}:null;})()");

  const antes = await filaEstado();
  t('sin seleccionar: círculo vacío (check transparente, sin fondo)', antes && antes.check === '✓' && antes.checkBg === '' && antes.bg === '', JSON.stringify(antes));

  console.log('-- Tocar fila → selecciona con estado MUY visible --');
  await evalJs("(function(){var r=document.querySelector('#foodSearchResults [data-foodid]');if(r)r.click();return true;})()");
  await new Promise(r => setTimeout(r, 500));
  const sel1 = await filaEstado();
  t('seleccionada: fondo verde + anillo 2px + ✓ relleno', sel1 && sel1.bg === 'rgb(232, 248, 238)' && /rgb\(21, 112, 79\) 0px 0px 0px 2px inset/.test(sel1.anillo) && sel1.check === '✓' && sel1.checkBg === 'rgb(21, 112, 79)', JSON.stringify(sel1));
  const res1 = await resumen();
  t('resumen en vivo: "1 alimento seleccionado · kcal · g P · g C · g G"', /1 alimento seleccionado · \d+ kcal · [\d.]+ g P · [\d.]+ g C · [\d.]+ g G/.test(res1), res1);
  const cta1 = await cta();
  t('CTA: "Agregar 1 alimento a desayuno" (activo)', cta1 && cta1.txt === 'Agregar 1 alimento a desayuno' && cta1.disabled === false, cta1 && cta1.txt);

  console.log('-- Varios + deseleccionar --');
  await evalJs("(function(){searchFood('arroz');return true;})()");
  await new Promise(r => setTimeout(r, 400));
  await evalJs("(function(){var r=document.querySelector('#foodSearchResults [data-foodid]');if(r)r.click();return true;})()");
  await new Promise(r => setTimeout(r, 400));
  const res2 = await resumen();
  const cta2 = await cta();
  t('2 seleccionados: resumen y CTA con plural', /2 alimentos seleccionados/.test(res2) && cta2 && cta2.txt === 'Agregar 2 alimentos a desayuno', res2 + ' | ' + (cta2 && cta2.txt));
  // deseleccionar el primero (huevo)
  await evalJs("(function(){searchFood('huevo');return true;})()");
  await new Promise(r => setTimeout(r, 400));
  await evalJs("(function(){var r=document.querySelector('#foodSearchResults [data-foodid]');if(r)r.click();return true;})()");
  await new Promise(r => setTimeout(r, 400));
  const filaDesel = await filaEstado();
  const res3 = await resumen();
  t('tocar otra vez → deselecciona (visual vuelve a normal)', filaDesel && filaDesel.bg === '' && filaDesel.checkBg === '', JSON.stringify(filaDesel));
  t('resumen vuelve a "1 alimento seleccionado"', /1 alimento seleccionado/.test(res3), res3);
  // chips visibles con el alimento
  const chips = await evalJs("(function(){var c=document.getElementById('carritoChips');var s=c?c.querySelector('[data-chip-slot=\"0\"]'):null;return {visible:s?s.style.display:'(sin)',nombre:s&&s.querySelector('[data-chip-name]')?s.querySelector('[data-chip-name]').textContent:''};})()");
  t('chips: primer chip visible con nombre', chips && chips.visible !== 'none' && chips.nombre.length > 0, JSON.stringify(chips));
  await shot(ws, 'carrito-seleccion-desktop.png');

  console.log('-- iPhone 390x844: sin overflow --');
  await ws.sendJson('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await new Promise(r => setTimeout(r, 600));
  const ov = await evalJs("(function(){return {sw:document.body.scrollWidth,iw:window.innerWidth};})()");
  t('iPhone sin overflow', ov.sw <= ov.iw + 1, JSON.stringify(ov));
  await shot(ws, 'carrito-seleccion-iphone.png');
  await ws.sendJson('Emulation.clearDeviceMetricsOverride', {});

  // dejar 2 alimentos seleccionados para la revisión visual
  await evalJs("(function(){searchFood('huevo');var r=document.querySelector('#foodSearchResults [data-foodid]');if(r)r.click();return true;})()");
  await new Promise(r => setTimeout(r, 400));

  const ex = ws.events.filter(e => e.method === 'Runtime.exceptionThrown');
  t('sin excepciones JS', ex.length === 0, ex.length + ' excepción(es)');
  console.log('===== RESULTADO: ' + pasadas + ' PASS / ' + falladas + ' FAIL =====');
  console.log('La app queda ABIERTA en el selector de alimentos para revisión manual.');
  process.exit(falladas ? 1 : 0);
})().catch(e => { console.log('ERROR GLOBAL:', e.message); process.exit(2); });
