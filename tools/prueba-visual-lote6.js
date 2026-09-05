// Prueba visual CDP de los 2 casos del cerdo (lote 6).
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
  const sig = () => evalJs("(function(){var b=[].slice.call(document.querySelectorAll('#recetaDetalle button')).find(function(x){return /Siguiente/.test(x.textContent);}); if(b)b.click(); return true;})()");

  console.log('== CASO A: Cerdo cocido en salsa roja con papas ==');
  await abrir(await idxDe('Cerdo cocido en salsa roja con papas'));
  let tx = await detalle();
  t('paso 1 = solo preparar el cerdo (Cerdo cocido básico)', /Prepara el cerdo cocido/.test(tx) && /40-60 min orientativos/.test(tx) && /bien cocidos y tiernos/.test(tx));
  t('sin aviso de Preparación incompleta', !/Preparación incompleta/.test(tx));
  t('sin enlace verde (ciclo eliminado)', !/Ver cómo prepararlos/.test(tx));
  t('no menciona Arroz frito (sin ciclo)', !/Arroz frito con cerdo cocido y huevo/.test(tx));
  await sig(); tx = await detalle();
  t('paso 2 = su preparación de papa (propia, no copiada)', /Hierve la papa en cubos — 10 min/.test(tx));
  await sig(); tx = await detalle();
  t('paso 3 = su salsa roja propia', /hierve 3 jitomates y 2 chiles guajillo/.test(tx));

  console.log('== CASO B: Arroz frito con cerdo cocido y huevo ==');
  await abrir(await idxDe('Arroz frito con cerdo cocido y huevo'));
  tx = await detalle();
  t('paso 1 = solo preparar el cerdo (Cerdo cocido básico)', /Prepara el cerdo cocido/.test(tx) && /40-60 min orientativos/.test(tx));
  t('sin aviso de Preparación incompleta', !/Preparación incompleta/.test(tx));
  t('sin enlace verde (ciclo eliminado)', !/Ver cómo prepararlos/.test(tx));
  t('no menciona Cerdo cocido en salsa roja (sin ciclo)', !/Cerdo cocido en salsa roja con papas/.test(tx));
  await sig(); tx = await detalle();
  t('paso 2 = su preparación de arroz (propia)', /Cuece el arroz como en Caldo de pollo con arroz/.test(tx));

  console.log('== Errores JS ==');
  const reales = ws.events.filter(e => e.method === 'Runtime.exceptionThrown');
  t('sin excepciones JS', reales.length === 0, reales.length + ' excepción(es)');
  console.log('===== RESULTADO: ' + pasadas + ' PASS / ' + falladas + ' FAIL =====');
  process.exit(falladas ? 1 : 0);
})().catch(e => { console.log('ERROR GLOBAL:', e.message); process.exit(2); });
