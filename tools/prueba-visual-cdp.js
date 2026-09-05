// Prueba visual real de las correcciones de recetas vía CDP (Electron).
// Uso: node tools/prueba-visual-cdp.js [puerto]  (default 9333)
const port = Number(process.argv[2] || 9333);

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
  throw new Error('No se encontró target CDP en el puerto ' + port);
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
    if (r.exceptionDetails) throw new Error('EVAL ERROR: ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
    return r.result.value;
  };
  await ws.sendJson('Runtime.enable', {});
  await ws.sendJson('Page.enable', {});
  await ws.sendJson('Page.reload', { ignoreCache: true });
  await new Promise(r => setTimeout(r, 3500)); // arranque de la app

  const idxDe = (nombre) => evalJs("(function(){var i=baseRecipes.findIndex(function(r){return r.name===" + JSON.stringify(nombre) + "}); return i;})()");
  const detalle = () => evalJs("(function(){return (document.getElementById('recetaDetalle')||{innerText:''}).innerText;})()");
  const abrir = (idx) => evalJs("(function(){abrirReceta(" + idx + ",'pasoapaso'); return (window._recetaVista||{idx:-1}).idx;})()");
  const clicSiguiente = () => evalJs("(function(){var b=[].slice.call(document.querySelectorAll('#recetaDetalle button')).find(function(x){return /Siguiente/.test(x.textContent);}); if(b){b.click();return true} return false;})()");
  const clicAnterior = () => evalJs("(function(){var b=[].slice.call(document.querySelectorAll('#recetaDetalle button')).find(function(x){return /Anterior/.test(x.textContent);}); if(b){b.click();return true} return false;})()");
  const clicVolver = () => evalJs("(function(){var b=[].slice.call(document.querySelectorAll('#recetaDetalle button')).find(function(x){return /^←/.test(x.textContent.trim());}); if(b){b.click();return true} return false;})()");
  const pasoActual = () => evalJs("(function(){return (window._recetaVista||{paso:null}).paso;})()");
  const vistaIdx = () => evalJs("(function(){return (window._recetaVista||{idx:null}).idx;})()");
  const nombreActual = () => evalJs("(function(){return baseRecipes[(window._recetaVista||{idx:-1}).idx].name;})()");

  const NOMBRES = {
    hamburguesaFrijol: 'Hamburguesa de frijol (barata, sin carne)',
    tingaRes: 'Tinga de res',
    verdurasSalteadas: 'Verduras salteadas con ajo',
    tortitas: 'Tortitas de pollo y queso',
    cerdoSalsa: 'Cerdo cocido en salsa roja con papas',
    arrozFrito: 'Arroz frito con cerdo cocido y huevo',
    machaca: 'Huevos con machaca',
    arrozVerduras: 'Arroz con verduras cocidas y pollo'
  };
  const IDs = {};
  for (const k of Object.keys(NOMBRES)) {
    const i = await idxDe(NOMBRES[k]);
    if (i < 0) { console.log('FATAL: no se encontró la receta ' + NOMBRES[k]); process.exit(2); }
    IDs[k] = i;
  }

  console.log('== CASO 1: Hamburguesa de frijol — frijoles antes de machacar ==');
  await abrir(IDs.hamburguesaFrijol);
  let tx = await detalle();
  t('paso 1 explica cocer el frijol (Frijoles de olla)', /Cuece el frijol como en Frijoles de olla/.test(tx), (tx.match(/Cuece el frijol[^\n]*/) || ['?'])[0]);
  await clicSiguiente();
  tx = await detalle();
  t('paso 2 es el machacado', /Machaca los frijoles/.test(tx) && /Paso 2 de/.test(tx));

  console.log('== CASO 2: Tinga de res — cocción de la res ==');
  await abrir(IDs.tingaRes);
  tx = await detalle();
  t('paso 1 cocina la res 40 min', /Cuece 150g de res en agua con sal 40 min/.test(tx));

  console.log('== CASO 3: Verduras salteadas con ajo — vapor previo ==');
  await abrir(IDs.verdurasSalteadas);
  tx = await detalle();
  t('paso 1 vapor 8+5 min', /al vapor/.test(tx) && /duras 8 min/.test(tx));

  console.log('== CASO 4: Tortitas de pollo y queso — dos preparaciones, sin falso enlace ==');
  await abrir(IDs.tortitas);
  tx = await detalle();
  t('paso 1 = salsa verde cocida (8 min hasta cambiar color)', /salsa verde cocida/.test(tx) && /8 min hasta cambiar color/.test(tx));
  await clicSiguiente();
  tx = await detalle();
  t('paso 2 = pollo hervido 20 min', /Hierve el pollo en agua con sal a 100°C — 20 min/.test(tx));
  t('sin aviso de Preparación incompleta', !/Preparación incompleta/.test(tx));
  t('sin enlace verde (Ver cómo prepararlos)', !/Ver cómo prepararlos/.test(tx));

  console.log('== CASO 5: Cerdo cocido en salsa roja — honesto, sin enlace circular ==');
  await abrir(IDs.cerdoSalsa);
  tx = await detalle();
  t('muestra ⚠ Preparación incompleta', /Preparación incompleta/.test(tx));
  t('NO enlaza verde (Ver cómo prepararlos ausente)', !/Ver cómo prepararlos/.test(tx));
  t('NO menciona Arroz frito como enlace', !/Arroz frito con cerdo cocido y huevo/.test(tx));

  console.log('== CASO 6: Arroz frito con cerdo — honesto, sin enlace circular ==');
  await abrir(IDs.arrozFrito);
  tx = await detalle();
  t('muestra ⚠ Preparación incompleta', /Preparación incompleta/.test(tx));
  t('NO enlaza verde', !/Ver cómo prepararlos/.test(tx));
  t('NO menciona Cerdo cocido en salsa roja como enlace', !/Cerdo cocido en salsa roja con papas/.test(tx));

  console.log('== CASO 7: Huevos con machaca — copia ACTIVA corregida ==');
  await abrir(IDs.machaca);
  await clicSiguiente();
  tx = await detalle();
  t('paso 2 renderiza la corrección (a fuego medio)', /Sofríe cebolla, jitomate y chile a fuego medio\./.test(tx));

  console.log('== CASO 8: Arroz con verduras cocidas y pollo — preparación visible ==');
  await abrir(IDs.arrozVerduras);
  tx = await detalle();
  t('paso 1 con la preparación al vapor', /Cuece las verduras al vapor como en Verduras cocidas al vapor/.test(tx));
  await clicSiguiente();
  tx = await detalle();
  t('la preparación externa de pechuga sigue intacta (paso 2)', tx.includes('Hierve la pechuga en agua con sal a 100°C — 20 min'));

  console.log('== Funcionalidad: Paso a paso ==');
  await abrir(IDs.hamburguesaFrijol);
  await clicSiguiente(); await clicSiguiente();
  tx = await detalle();
  t('Siguiente avanza (Paso 3 de 6)', /Paso 3 de 6/.test(tx));
  await clicAnterior();
  tx = await detalle();
  t('Anterior regresa (Paso 2 de 6)', /Paso 2 de 6/.test(tx));

  console.log('== Funcionalidad: Volver conserva receta/paso (estado limpio) ==');
  const totalApp = await evalJs("(function(){return baseRecipes.length;})()");
  console.log('   (la app tiene ' + totalApp + ' recetas en runtime: estáticas + del usuario)');
  await evalJs("(function(){cerrarReceta();})()"); // estado limpio como usuario real
  await abrir(IDs.tingaRes);
  await clicSiguiente(); await clicSiguiente(); await clicSiguiente();
  const pasoAntes = await pasoActual();
  await abrir(IDs.tortitas); // apila a Tinga de res
  const idxSub = await vistaIdx();
  const volvio = await clicVolver();
  const idxTras = await vistaIdx();
  const pasoTras = await pasoActual();
  tx = await detalle();
  t('volver restaura la receta padre (Tinga de res)', volvio && idxTras === IDs.tingaRes, 'idx=' + idxTras + ' sub=' + idxSub);
  t('volver conserva el paso (3, 0-indexado → "Paso 4 de 4")', pasoTras === pasoAntes && pasoTras === 3 && /Paso 4 de 4/.test(tx), 'paso=' + pasoTras);

  console.log('== Errores JS durante la prueba ==');
  const reales = ws.events.filter(e => e.method === 'Runtime.exceptionThrown');
  const consola = ws.events
    .filter(e => e.method === 'Runtime.consoleAPICalled' && e.params && e.params.type === 'error')
    .map(e => (e.params.args || []).map(x => x.value || x.description || '').join(' '))
    .filter(a => !/net::|fetch|supabase|cloudflare|Failed to load resource|WebSocket|ERR_/i.test(a));
  t('sin excepciones JS', reales.length === 0, reales.length + ' excepción(es)');
  t('sin errores de consola de la app (excluye red)', consola.length === 0, JSON.stringify(consola.slice(0, 3)));

  console.log('===== RESULTADO: ' + pasadas + ' PASS / ' + falladas + ' FAIL =====');
  process.exit(falladas ? 1 : 0);
})().catch(e => { console.log('ERROR GLOBAL:', e.message); process.exit(2); });
