// Prueba visual CDP de 8 de los 12 casos del lote 10.
const port = Number(process.argv[2] || 9333);
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
(async () => {
  const target = await getTarget();
  const ws = await connect(target.webSocketDebuggerUrl);
  const evalJs = async (expr) => {
    const r = await ws.sendJson('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('EVAL ERROR: ' + JSON.stringify(r.exceptionDetails).slice(0, 200));
    return r.result.value;
  };
  await ws.sendJson('Runtime.enable', {});
  await ws.sendJson('Page.enable', {});
  await ws.sendJson('Page.reload', { ignoreCache: true });
  await new Promise(r => setTimeout(r, 3500));
  const idxDe = n => evalJs("(function(){return baseRecipes.findIndex(function(r){return r.name===" + JSON.stringify(n) + "});})()");
  const detalle = () => evalJs("(function(){return (document.getElementById('recetaDetalle')||{innerText:''}).innerText;})()");
  const abrir = i => evalJs("(function(){abrirReceta(" + i + ",'pasoapaso');return true;})()");

  const CASOS = [
    ['Avena de coco, piña y leche condensada', /durante 5 minutos \(preparación: Avena de manzana, nuez y miel\)/],
    ['Avena con yogurt, granola y jalea de fresa', /5 minutos o déjala overnight/],
    ['Huevos endiablados', /10-11 min, enfríalos en agua con hielo/],
    ['Papas con chorizo', /10 min a 100°C \(preparación: Papas doradas con huevo\)/],
    ['Espagueti rojo mexicano', /8 min al dente \(preparación: Pasta mexicana con carne\)/],
    ['Macarrones con carne molida y queso', /8 min al dente \(preparación: Pasta mexicana con carne\)/],
    ['Pasta con atún y crema', /8 min al dente \(preparación: Pasta mexicana con carne\)/],
    ['Meal-prep arroz con pollo (batch)', /cocina 15 min \(preparación: Caldo de pollo con arroz\)/]
  ];
  for (const [nombre, rx] of CASOS) {
    await abrir(await idxDe(nombre));
    const tx = await detalle();
    t(nombre + ' — paso con datos y atribución', rx.test(tx), (tx.match(rx) || ['?'])[0]);
    t(nombre + ' — sin avisos', !/Preparación incompleta|Ver cómo prepararlos/.test(tx));
  }
  const reales = ws.events.filter(e => e.method === 'Runtime.exceptionThrown');
  t('sin excepciones JS', reales.length === 0, reales.length + ' excepción(es)');
  console.log('===== RESULTADO: ' + pasadas + ' PASS / ' + falladas + ' FAIL =====');
  process.exit(falladas ? 1 : 0);
})().catch(e => { console.log('ERROR GLOBAL:', e.message); process.exit(2); });
