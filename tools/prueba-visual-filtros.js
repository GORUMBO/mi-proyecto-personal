// Prueba visual de los filtros de practicidad (⚙️ Ajustar ahora) — CDP, Electron.
// Uso: node tools/prueba-visual-filtros.js [puerto]  (default 9333)
// Casos: tengo huevo+tortilla+queso (5 min), noCocinar+yogurt/granola/plátano,
// soloTengo estricto, estado vacío con relajación explícita y modo 1-faltante.
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
  await new Promise(r => setTimeout(r, 4500));

  await evalJs("(function(){if(!window.__origGetHours){window.__origGetHours=Date.prototype.getHours;}Date.prototype.getHours=function(){return 8;};state.profile=state.profile||{};state.profile.calorias=3000;state.profile.proteina=180;state.profile.objetivo='ganar peso';state.profile.llenado='rapido';var today=(typeof todayISO==='function')?todayISO():new Date().toISOString().slice(0,10);state.diary=state.diary||{};state.diary[today]={breakfast:[{name:'Comida de prueba',kcal:1200,prot:60,carb:0,fat:0}],lunch:[],dinner:[],snacks:[]};window._completarMostradas=[];window._completarFamiliasVistas=[];completarFiltrosReset();completarAbrir();return true;})()");

  const aplicar = async (filtros) => {
    await evalJs("(function(){window._completarFiltros=" + JSON.stringify(Object.assign({ tengo: [], soloTengo: false, noCocinar: false, recalentar: false, licuar: true, tiempo: null, modoFaltante: false }, filtros)) + ";completarRenderPanel();return true;})()");
    await new Promise(r => setTimeout(r, 500));
    return evalJs("(function(){return (window._completarPropuestas||[]).map(function(p){return p.titulo+' · '+p.kcal+' kcal · '+p.tiempo+' min';});})()");
  };
  const panelHTML = () => evalJs("(function(){var el=document.getElementById('completarPanel');return el?el.innerHTML:'';})()");

  console.log('-- Toggles: filas completas y visibles --');
  const htmlToggles = await panelHTML();
  t('Recalentar sí SIEMPRE visible (fila completa)', /<label[^>]*>[\s\S]*?Recalentar sí[\s\S]*?type="checkbox"/.test(htmlToggles));
  t('Licuar sí SIEMPRE visible (fila completa)', /<label[^>]*>[\s\S]*?Licuar sí[\s\S]*?type="checkbox"/.test(htmlToggles));
  t('fila "Solo con lo que tengo" clicable (label+checkbox)', /<label[^>]*>[\s\S]*?Solo con lo que tengo[\s\S]*?type="checkbox"/.test(htmlToggles));

  console.log('-- Caso A: tengo huevo+tortilla+queso · 5 min --');
  const lotA = await aplicar({ tengo: ['Huevo', 'Tortilla maíz', 'Queso 28g'], tiempo: 5 });
  t('top-3 con ≤5 min activos', lotA.length > 0 && (await evalJs("(function(){return (window._completarPropuestas||[]).every(function(p){return p.tiempo<=5;});})()")), lotA.join(' | '));
  t('UI muestra ⚙️ Ajustar ahora con filtros activos', /⚙️ Ajustar ahora · filtros activos/.test(await panelHTML()));
  t('línea "✓ 5 min" explica por qué encaja', /✓ 5 min/.test(await panelHTML()));
  await shot(ws, 'visual-filtros-casoA.png');

  console.log('-- Caso B: no cocinar · yogurt+granola+plátano · 2 min --');
  const lotB = await aplicar({ tengo: ['Yogurt griego taza', 'Granola 1/2 taza', 'Plátano'], noCocinar: true, tiempo: 2 });
  const pasaB = await evalJs("(function(){var f=window._completarFiltros;return (window._completarPropuestas||[]).every(function(p){var r=completarFiltroRecetaDe({partes:p.componentes.map(function(c){return {nombre:c.nombre,tipo:c.tipo,tags:'',ingredients:'',method:c.tipo==='receta'?(baseRecipes[c.ref]?baseRecipes[c.ref].method:'')||'':'',tiempo:c.tiempo||0};})});return recetaPasaFiltros(r,{noCocinar:f.noCocinar,recalentar:f.recalentar,licuar:f.licuar,tiempo:f.tiempo,soloTengo:false,tengo:[]});});})()");
  t('todo lo mostrado cumple noCocinar + 2 min', lotB.length > 0 && pasaB, lotB.join(' | '));
  await shot(ws, 'visual-filtros-casoB.png');

  console.log('-- Caso C: Solo con lo que tengo (estricto) --');
  const lotC = await aplicar({ tengo: ['Huevo', 'Tortilla maíz'], soloTengo: true });
  t('soloTengo: todas las propuestas sin faltantes', (await evalJs("(function(){var f=window._completarFiltros;return (window._completarPropuestas||[]).every(function(p){var r=completarFiltroRecetaDe({partes:p.componentes.map(function(c){return {nombre:c.nombre,tipo:c.tipo,tags:'',ingredients:'',method:'',tiempo:c.tiempo||0};})});return recetaFaltantes(r,f.tengo).length===0;});})()")), lotC.join(' | '));

  console.log('-- Estado vacío → relajación explícita → 1 ingrediente faltante --');
  const lotD = await aplicar({ tengo: ['Pollo 100g'], soloTengo: true, noCocinar: true, tiempo: 2 });
  t('0 opciones con filtros estrictos', lotD.length === 0, '(vacío)');
  const htmlVacio = await panelHTML();
  t('mensaje "No encontré algo que cumpla todo."', /No encontré algo que cumpla todo\./.test(htmlVacio));
  t('botones Relajar tiempo / Permitir cocinar / 1 faltante', /Relajar tiempo/.test(htmlVacio) && /Permitir cocinar/.test(htmlVacio) && /Ver opciones con 1 ingrediente faltante/.test(htmlVacio));
  await shot(ws, 'visual-filtros-vacio.png');
  await evalJs("(function(){completarFiltroModoFaltante();return true;})()");
  await new Promise(r => setTimeout(r, 500));
  const lotF = await evalJs("(function(){return (window._completarPropuestas||[]).map(function(p){return p.titulo;});})()");
  t('modo 1-faltante muestra opciones etiquetadas', lotF.length > 0 && /Te faltaría:/.test(await panelHTML()), lotF.join(' | '));
  await shot(ws, 'visual-filtros-faltante.png');

  console.log('-- iPhone --');
  await evalJs("(function(){window._completarFiltros={tengo:['Huevo','Tortilla maíz','Queso 28g'],soloTengo:false,noCocinar:false,recalentar:false,licuar:true,tiempo:5,modoFaltante:false};completarRenderPanel();return true;})()");
  await new Promise(r => setTimeout(r, 400));
  await ws.sendJson('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await new Promise(r => setTimeout(r, 500));
  const ov = await evalJs("(function(){return {sw:document.body.scrollWidth,iw:window.innerWidth,panel:document.getElementById('completarPanel')?document.getElementById('completarPanel').scrollWidth:-1};})()");
  t('iPhone sin overflow', ov.sw <= ov.iw + 1 && ov.panel <= ov.iw + 1, JSON.stringify(ov));
  await shot(ws, 'visual-filtros-iphone.png');
  await ws.sendJson('Emulation.clearDeviceMetricsOverride', {});
  await evalJs("(function(){completarCerrar();if(window.__origGetHours)Date.prototype.getHours=window.__origGetHours;return true;})()");
  console.log('-- Fibra: dato real en el catálogo (auditoría viva) --');
  await evalJs("(function(){completarAbrir();return true;})()");
  await new Promise(r => setTimeout(r, 400));
  const fibraLive = await evalJs("(function(){var conDato=0,sinDato=0,estandar=0,otraFuente=0;foods.forEach(function(f){if(f.length>6&&f[6]!=null){conDato++;if(f[7]==='estandar')estandar++;else otraFuente++;}else sinDato++;});var completaAlguna=false;(window._completarPropuestas||[]).forEach(function(p){var fb=completarFibraCandidato({partes:(p.componentes||[]).map(function(c){return {nombre:c.nombre,tipo:c.tipo};})});if(fb.estado==='completa'&&fb.g>0)completaAlguna=true;});var html=document.getElementById('completarPanel')?document.getElementById('completarPanel').innerHTML:'';return {conDato:conDato,sinDato:sinDato,estandar:estandar,otraFuente:otraFuente,completaAlguna:completaAlguna,fibraEnPantalla:/g fibra|Buena fuente de fibra/.test(html)};})()");
  // nota: 96 entradas enriquecidas con 95 claves porque el catálogo repite
  // 'Leche 2% 1 taza' (dos entradas, mismo nombre) — no es un bug de datos.
  t('catálogo enriquecido: ' + fibraLive.conDato + ' fiables (todas fuente estandar, ' + fibraLive.sinDato + ' null)', fibraLive.estandar === fibraLive.conDato && fibraLive.otraFuente === 0 && fibraLive.conDato + fibraLive.sinDato === 121 && fibraLive.conDato >= 1);
  t('fibra en pantalla ⇔ existe propuesta con dato completo (sin cifras falsas)', fibraLive.fibraEnPantalla === fibraLive.completaAlguna, JSON.stringify(fibraLive));
  const ex = ws.events.filter(e => e.method === 'Runtime.exceptionThrown');
  t('sin excepciones JS', ex.length === 0, ex.length + ' excepción(es)');
  console.log('===== RESULTADO: ' + pasadas + ' PASS / ' + falladas + ' FAIL =====');
  console.log('La app queda ABIERTA para prueba visual manual.');
  process.exit(falladas ? 1 : 0);
})().catch(e => { console.log('ERROR GLOBAL:', e.message); process.exit(2); });
