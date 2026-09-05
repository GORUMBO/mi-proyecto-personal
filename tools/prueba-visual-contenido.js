// Prueba visual de la fase CONTENIDO/UX (CDP, Electron).
// Uso: node tools/prueba-visual-contenido.js [puerto]  (default 9333)
// Casos obligatorios: Bolitas de energía, Overnight oats, Huevo con método,
// Quesadilla, Aderezo como auxiliar, receta con TM5, receta sin TM5.
// En cada caso: nombre comprensible, ingredientes, cantidades, cómo se hace,
// tiempo activo, porción, acompañamiento separado, kcal reales.
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

  await evalJs("(function(){if(!window.__origGetHours){window.__origGetHours=Date.prototype.getHours;}Date.prototype.getHours=function(){return 8;};state.profile=state.profile||{};state.profile.calorias=3000;state.profile.proteina=180;state.profile.objetivo='ganar peso';state.profile.llenado='rapido';var today=(typeof todayISO==='function')?todayISO():new Date().toISOString().slice(0,10);state.diary=state.diary||{};state.diary[today]={breakfast:[{name:'Comida de prueba',kcal:1200,prot:60,carb:0,fat:0}],lunch:[],dinner:[],snacks:[]};window._completarMostradas=[];window._completarFamiliasVistas=[];completarAbrir();return true;})()");

  // tarjeta desde una receta real (los 7 casos pasan por el mismo render)
  const tarjetaDe = async (nombreReceta) => {
    const info = await evalJs("(function(){var idx=-1;baseRecipes.forEach(function(r,i){if(r.name===" + JSON.stringify(nombreReceta) + ")idx=i;});if(idx<0)return {existe:false};var r=baseRecipes[idx];return {existe:true,idx:idx,k:r.k,p:r.p,time:r.time,reposo:r.reposo||null,metodo:r.method||'',ingredientes:r.ingredients||'',pasos:(r.steps||[]).length,resumen:recetaResumenCorto(r.name),tm5:/(tm5|thermomix)/i.test((r.method||'')+' '+(r.tags||''))};})()");
    if (!info.existe) return info;
    const html = await evalJs("(function(){var r=baseRecipes[" + info.idx + "];var prop={tipoProp:'comida',titulo:r.name,kcal:r.k,p:r.p,c:0,g:0,volumen:'Poco',tiempo:r.time,razones:[],clave:r.name,componentes:[{tipo:'receta',nombre:r.name,ref:" + info.idx + ",kcal:r.k,p:r.p,c:0,g:0,tiempo:r.time,porcion:{texto:'1 porción'}}]};window._completarModoFacil=true;completarRenderPanel([prop]);var el=document.getElementById('completarPanel');return el?el.innerHTML:'';})()");
    info.html = html;
    return info;
  };

  console.log('-- 1 · Bolitas de energía --');
  const bolExiste = await evalJs("(function(){var r=null;baseRecipes.forEach(function(x){if(/Bolitas de energía/.test(x.name))r=x;});return r?{nombre:r.name,k:r.k,p:r.p,time:r.time,ing:!!r.ingredients,pasos:(r.steps||[]).length}:null;})()");
  t('existe y tiene nombre comprensible', !!bolExiste && bolExiste.nombre.length > 10, bolExiste && bolExiste.nombre);
  t('ingredientes reales + pasos', bolExiste && bolExiste.ing && bolExiste.pasos >= 2, bolExiste && (bolExiste.pasos + ' pasos'));
  const bolResumen = await evalJs("(function(){var r=null;baseRecipes.forEach(function(x){if(/Bolitas de energía/.test(x.name))r=x;});return r?recetaResumenCorto(r.name):null;})()");
  t('resumen con verbo y tiempo', !!bolResumen && /\d+ min/.test(bolResumen), bolResumen);
  t('kcal reales (>0) y tiempo activo', bolExiste && bolExiste.k > 0 && bolExiste.time > 0, bolExiste && (bolExiste.k + ' kcal · ' + bolExiste.time + ' min'));

  console.log('-- 2 · Overnight oats (nueva, reposo separado) --');
  const ov = await evalJs("(function(){var r=null;baseRecipes.forEach(function(x){if(/Overnight oats/.test(x.name))r=x;});if(!r)return null;return {nombre:r.name,k:r.k,p:r.p,time:r.time,reposo:r.reposo||null,pasos:(r.steps||[]).length,resumen:recetaResumenCorto(r.name)};})()");
  t('existe overnight oats', !!ov, ov && ov.nombre);
  t('tiempo activo ≤10 min y reposo separado', ov && ov.time <= 10 && !!ov.reposo, ov && (ov.time + ' min activos + ' + ov.reposo));
  t('resumen distingue activo de reposo', ov && /reposo/.test(ov.resumen), ov && ov.resumen);
  t('pasos reales con cantidades', ov && ov.pasos >= 3);
  const ovK = await evalJs("(function(){var t=(typeof todayISO==='function')?todayISO():new Date().toISOString().slice(0,10);var suma=foods.filter(function(f){return ['Avena 1/2 taza','Leche entera taza','Plátano','Miel 1 cucharada'].indexOf(f[0])>=0;}).reduce(function(a,f){return a+f[1];},0);return suma;})()");
  t('kcal = suma real de foods (474)', ov && ov.k === ovK, ov && (ov.k + ' vs ' + ovK));

  console.log('-- 3 · Huevo con método visible --');
  const huevoCard = await evalJs("(function(){var sug=recetaSugeridaPara('Huevo');var prop={tipoProp:'micro',titulo:'Huevo',kcal:72,p:6,c:0,g:0,volumen:'Poco',tiempo:0,razones:[],clave:'Huevo',componentes:[{tipo:'alimento',nombre:'Huevo',kcal:72,p:6,c:0,g:0,porcion:{texto:'1 huevo'}}]};window._completarModoFacil=true;completarRenderPanel([prop]);var el=document.getElementById('completarPanel');return {sug:sug,html:el?el.innerHTML:''};})()");
  t('sugerencia real de preparación', !!huevoCard.sug && /Huevo/.test(huevoCard.sug.nombre), huevoCard.sug && (huevoCard.sug.nombre + ' (' + huevoCard.sug.tiempo + ' min)'));
  t('método visible en la tarjeta (Prepáralo)', /🍳 Prepáralo:/.test(huevoCard.html));
  t('porción real en la tarjeta', /1 huevo/.test(huevoCard.html));
  t('kcal reales en la tarjeta', /72 kcal/.test(huevoCard.html));

  console.log('-- 4 · Quesadilla (nueva) --');
  const quesa = await evalJs("(function(){var r=null;baseRecipes.forEach(function(x){if(/Quesadilla de frijol y queso/.test(x.name))r=x;});if(!r)return null;var prop={tipoProp:'comida',titulo:r.name,kcal:r.k,p:r.p,c:0,g:0,volumen:'Poco',tiempo:r.time,razones:[],clave:r.name,componentes:[{tipo:'receta',nombre:r.name,kcal:r.k,p:r.p,c:0,g:0,tiempo:r.time,porcion:{texto:'1 porción'}}]};window._completarModoFacil=true;completarRenderPanel([prop]);var el=document.getElementById('completarPanel');return {k:r.k,p:r.p,time:r.time,resumen:recetaResumenCorto(r.name),tm5:/(tm5|thermomix)/i.test((r.method||'')+' '+(r.tags||'')),html:el?el.innerHTML:''};})()");
  t('existe quesadilla con kcal reales (405)', quesa && quesa.k === 405, quesa && (quesa.k + ' kcal'));
  t('resumen con verbo y tiempo (8 min)', quesa && /8 min/.test(quesa.resumen), quesa && quesa.resumen);
  t('SIN chip TM5 (sartén/comal es más simple)', quesa && !quesa.tm5 && !/TM5 disponible/.test(quesa.html));

  console.log('-- 5 · Aderezo correctamente como auxiliar --');
  const aderezo = await evalJs("(function(){var r=null;baseRecipes.forEach(function(x){if(/Aderezo de cilantro y limón casero/.test(x.name))r=x;});var ctx=completarCtxReal();var props=[];for(var i=0;i<6;i++){var p=completarProponer(ctx);props=props.concat(p);ctx.mostradas=(ctx.mostradas||[]).concat(p.map(function(x){return x.clave;}));if(p.length<3)break;}return {enCatalogo:!!r,enPropuestas:props.some(function(p){return JSON.stringify(p.componentes).indexOf('Aderezo')>=0;}),titulos:props.slice(0,9).map(function(p){return p.titulo;})};})()");
  t('el aderezo sigue en el catálogo (ficha propia)', aderezo.enCatalogo);
  t('el aderezo NUNCA aparece como propuesta', !aderezo.enPropuestas, aderezo.titulos.join(' | '));

  console.log('-- 6 · Receta con TM5 --');
  const tm5 = await evalJs("(function(){var r=null;baseRecipes.forEach(function(x){if(/yogurt y fresa/.test(x.name)&&/TM5/.test(x.name))r=x;});if(!r)return null;var prop={tipoProp:'bebida',titulo:r.name,kcal:r.k,p:r.p,c:0,g:0,volumen:'Poco',tiempo:r.time,razones:[],clave:r.name,componentes:[{tipo:'receta',nombre:r.name,kcal:r.k,p:r.p,c:0,g:0,tiempo:r.time,porcion:{texto:'1 porción'}}]};window._completarModoFacil=true;completarRenderPanel([prop]);var el=document.getElementById('completarPanel');return {k:r.k,html:el?el.innerHTML:'',resumen:recetaResumenCorto(r.name)};})()");
  t('receta TM5 existe con kcal reales (328)', tm5 && tm5.k === 328, tm5 && (tm5.k + ' kcal'));
  t('tarjeta muestra "⚙️ TM5 disponible"', tm5 && /TM5 disponible/.test(tm5.html));
  t('resumen real con método', tm5 && /\d+ min/.test(tm5.resumen), tm5 && tm5.resumen);

  console.log('-- 7 · Receta donde TM5 NO aplique --');
  t('quesadilla sin chip TM5 (ya verificado arriba)', quesa && !quesa.tm5);
  const tostada = await evalJs("(function(){var r=null;baseRecipes.forEach(function(x){if(/Tostada de crema de cacahuate y plátano/.test(x.name))r=x;});return r?{tm5:/(tm5|thermomix)/i.test((r.method||'')+' '+(r.tags||'')),k:r.k}:null;})()");
  t('tostada sin chip TM5', tostada && !tostada.tm5 && tostada.k === 359, tostada && (tostada.k + ' kcal'));

  console.log('-- 8 · Acompañamiento separado + iPhone --');
  const sep = await evalJs("(function(){var prop={tipoProp:'comida',titulo:'Huevos a la mexicana',kcal:550,p:46,c:0,g:0,volumen:'Poco',tiempo:10,razones:[],clave:'sep',componentes:[{tipo:'receta',nombre:'Huevos a la mexicana',kcal:420,p:26,c:0,g:0,tiempo:10,porcion:{texto:'1 porción'}},{tipo:'alimento',nombre:'Yogurt griego taza',kcal:130,p:20,c:9,g:0,porcion:{texto:'1 taza de yogurt griego'}}]};window._completarModoFacil=true;completarRenderPanel([prop]);var el=document.getElementById('completarPanel');return el?el.innerHTML:'';})()");
  t('Receta y Acompañamiento separados en la tarjeta', /Receta:<\/b> Huevos a la mexicana/.test(sep) && /Acompañamiento:<\/b> Yogurt griego taza/.test(sep));
  await evalJs("(function(){completarCerrar();completarAbrir();return true;})()");
  await new Promise(r => setTimeout(r, 600));
  await ws.sendJson('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await new Promise(r => setTimeout(r, 500));
  const ovf = await evalJs("(function(){return {sw:document.body.scrollWidth,iw:window.innerWidth,panel:document.getElementById('completarPanel')?document.getElementById('completarPanel').scrollWidth:-1};})()");
  t('iPhone sin overflow', ovf.sw <= ovf.iw + 1 && ovf.panel <= ovf.iw + 1, JSON.stringify(ovf));
  await shot(ws, 'visual-contenido-iphone.png');
  await ws.sendJson('Emulation.clearDeviceMetricsOverride', {});
  await evalJs("(function(){completarCerrar();if(window.__origGetHours)Date.prototype.getHours=window.__origGetHours;return true;})()");
  const ex = ws.events.filter(e => e.method === 'Runtime.exceptionThrown');
  t('sin excepciones JS', ex.length === 0, ex.length + ' excepción(es)');
  console.log('===== RESULTADO: ' + pasadas + ' PASS / ' + falladas + ' FAIL =====');
  console.log('La app queda ABIERTA para prueba visual manual.');
  process.exit(falladas ? 1 : 0);
})().catch(e => { console.log('ERROR GLOBAL:', e.message); process.exit(2); });
