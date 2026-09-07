// Prueba visual CDP de 🥣 Arma tu caldo (FASE 1).
// Uso: node tools/prueba-visual-caldo.js [puerto]  (default 9333)
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
    } catch (e) { }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('sin target CDP');
}
function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let id = 0;
    const pend = new Map();
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
    };
  });
}
const shot = async (ws, file) => {
  try {
    const r = await Promise.race([
      ws.sendJson('Page.captureScreenshot', { format: 'png' }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 60000))
    ]);
    fs.writeFileSync(path.join(__dirname, file), Buffer.from(r.data, 'base64'));
    console.log('  📸 ' + file);
  } catch (e) { console.log('  ⚠ captura omitida: ' + e.message); }
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
  await new Promise(r => setTimeout(r, 6000));

  await evalJs("(function(){try{openTab('🍽️ Recetas',false);}catch(e){}return true;})()");
  await new Promise(r => setTimeout(r, 1500));
  // abrir la sección Arma tu caldo (details)
  await evalJs("(function(){var ds=document.querySelectorAll('details');for(var i=0;i<ds.length;i++){if(ds[i].textContent.indexOf('Arma tu caldo')>=0){ds[i].open=true;break;}}return true;})()");
  await new Promise(r => setTimeout(r, 600));
  // elegir un preset (Caldo de pollo con chipotle, índice 4)
  await evalJs("(function(){caldoAplicar(caldoRapidoSel(4));return true;})()");
  await new Promise(r => setTimeout(r, 600));
  const ui = await evalJs("(function(){var b=document.getElementById('caldoBuilderBody');var html=b?b.innerHTML:'';var res=/\\d+ kcal/.exec(html);var tiempo=/~\\d+ min/.exec(html);return {kcal:res?res[0]:'(sin)',tiempo:tiempo?tiempo[0]:'(sin)',tienePresets:html.indexOf('Caldo rápido')>=0,tieneChipotle:html.indexOf('Chipotle')>=0,tieneValidacion:html.indexOf('Caldo coherente')>=0};})()");
  console.log('UI caldo (preset chipotle):', JSON.stringify(ui));
  await shot(ws, 'arma-caldo-preset.png');
  // probar + en una verdura y ver recálculo en vivo
  const antes = await evalJs("(function(){return caldoTotales().k;})()");
  await evalJs("(function(){caldoMas('verdura',3);return true;})()");
  await new Promise(r => setTimeout(r, 400));
  const despues = await evalJs("(function(){return caldoTotales().k;})()");
  console.log('recálculo en vivo (+1 jitomate):', antes, '→', despues, despues === antes + 22 ? '✓' : '✗');
  // iPhone 390 sin overflow
  await ws.sendJson('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await new Promise(r => setTimeout(r, 500));
  const ov = await evalJs("(function(){return {sw:document.body.scrollWidth,iw:window.innerWidth};})()");
  console.log('iPhone sin overflow:', ov.sw <= ov.iw + 1 ? '✓' : '✗', JSON.stringify(ov));
  await shot(ws, 'arma-caldo-iphone.png');
  await ws.sendJson('Emulation.clearDeviceMetricsOverride', {});
  // restaurar selección limpia
  await evalJs("(function(){state.caldoBuilder={};save(true);var b=document.getElementById('caldoBuilderBody');if(b)b.innerHTML=caldoBodyHTML();return true;})()");
  console.log('La app queda abierta en Comer → Recetas con la sección Arma tu caldo lista.');
  process.exit(0);
})().catch(e => { console.log('ERROR GLOBAL:', e.message); process.exit(2); });
