// Prueba visual de "Completar mi día" + "Potenciar inteligente" (CDP, Electron).
// Uso: node tools/prueba-visual-porciones.js [puerto]  (default 9333)
// Guarda capturas: tools/visual-porciones-escritorio.png (1280px, Completar mi día)
//                  tools/visual-porciones-iphone.png (390px, Completar mi día)
//                  tools/visual-porciones-iphone-pot.png (390px, Potenciar)
//                  tools/visual-porciones-iphone-pot2.png (390px, tras agregar→recalcular)
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
  const r = await ws.sendJson('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(__dirname, file), Buffer.from(r.data, 'base64'));
  console.log('  📸 ' + file + ' (' + Math.round(Buffer.from(r.data, 'base64').length / 1024) + ' KB)');
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

  // Contexto determinista (igual que prueba-visual-fase3): noche, faltan kcal.
  await evalJs("(function(){if(!window.__origGetHours){window.__origGetHours=Date.prototype.getHours;}Date.prototype.getHours=function(){return 20;};state.profile=state.profile||{};state.profile.calorias=3000;state.profile.proteina=180;state.profile.objetivo='ganar peso';state.profile.llenado='normal';var today=(typeof todayISO==='function')?todayISO():new Date().toISOString().slice(0,10);state.diary=state.diary||{};state.diary[today]={breakfast:[{name:'Comida de prueba',kcal:1800,prot:60,carb:0,fat:0}],lunch:[],dinner:[],snacks:[]};window._completarMostradas=[];completarAbrir();return true;})()");

  console.log('-- Completar mi día: textos con porción real --');
  const txt = await evalJs("(function(){return (document.getElementById('completarPanel')||{innerText:''}).innerText;})()");
  t('usa "g proteína" completo', /g proteína/.test(txt));
  t('sin "P 4g" ambiguo', !/\bP \d/.test(txt));
  t('sin "Vol Poco" / "Vol Normal"', !/Vol Poco|Vol Normal/.test(txt));
  t('badges 🥤/🍽 presentes', /🥤 Poco volumen|🍽 Volumen normal/.test(txt));
  t('sin "aprox." inventado', !/aprox\./.test(txt));
  const propsTxt = await evalJs("(function(){return (window._completarPropuestas||[]).map(function(p){return p.componentes.map(function(c){return (c.porcion||{}).texto||'';}).join(' | ');}).join(String.fromCharCode(10));})()");
  t('cada componente trae su porción real', propsTxt.split('\n').every(l => l.trim().length > 0), propsTxt.replace(/\n/g, ' · ').slice(0, 160));
  await shot(ws, 'visual-porciones-escritorio.png');

  console.log('-- Ancho tipo iPhone (390px) --');
  await ws.sendJson('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await new Promise(r => setTimeout(r, 800));
  const overflow = await evalJs("(function(){return {sw:document.body.scrollWidth,iw:window.innerWidth,panel:document.getElementById('completarPanel')?document.getElementById('completarPanel').scrollWidth:-1};})()");
  t('sin desbordamiento horizontal en iPhone (body)', overflow.sw <= overflow.iw + 1, JSON.stringify(overflow));
  t('sin desbordamiento horizontal en iPhone (panel)', overflow.panel <= overflow.iw + 1, JSON.stringify(overflow));
  await shot(ws, 'visual-porciones-iphone.png');

  console.log('-- Potenciar inteligente en iPhone --');
  const idxCombo = await evalJs("(function(){return (window._completarPropuestas||[]).findIndex(function(p){return p.componentes.every(function(c){return c.tipo==='alimento';})&&p.componentes.length>=2;});})()");
  t('existe un combo de alimentos para potenciar', idxCombo >= 0, 'idx ' + idxCombo);
  await evalJs("(function(){completarPotenciarAbrir(" + idxCombo + ");return true;})()");
  await new Promise(r => setTimeout(r, 600));
  const potTxt = await evalJs("(function(){return (document.getElementById('completarPotPanel')||{innerText:''}).innerText;})()");
  t('encabezado: ⚡ Potenciar esta comida', potTxt.includes('⚡ Potenciar esta comida'));
  t('debajo: faltante real del día', /Te faltan \d+ kcal|Kcal del día cubiertas/.test(potTxt), (potTxt.match(/Te faltan \d+ kcal[^\n]*/) || [potTxt.split('\n')[1]])[0]);
  t('Potenciar: sin "P 4g" ni "Vol"', !/\bP \d/.test(potTxt) && !/Vol Poco|Vol Normal/.test(potTxt));
  t('Potenciar: cada extra muestra "+N kcal" con su porción', /\+\d+ kcal/.test(potTxt), (potTxt.match(/\+\d+ kcal/g) || []).join(' '));
  t('Potenciar: razón principal del conjunto aprobado', /⭐ Mejor ajuste para lo que te falta|💪 Te falta proteína|🍚 Te faltan carbohidratos|🥤 Sube calorías con poco volumen|⚡ Rápido de agregar/.test(potTxt), (potTxt.match(/(⭐|💪|🍚|🥤|⚡)[^\n]*/g) || []).slice(0, 3).join(' | '));
  t('Potenciar: facilidad real 🥡', /🥡 Listo para comer/.test(potTxt));
  const extrasTxt = await evalJs("(function(){return (window._completarPotExtras||[]).map(function(x){return x.titulo+': '+x.porcion.texto+' (x'+x.factor+')';}).join(' | ');})()");
  t('extras con porción del catálogo (no inventada)', /1 taza de|2 tazas de|½ aguacate|1 pieza|g ·|cucharada de|cucharadas de/.test(extrasTxt), extrasTxt.slice(0, 160));
  const potOverflow = await evalJs("(function(){var el=document.getElementById('completarPotPanel');return {sw:document.body.scrollWidth,iw:window.innerWidth,panel:el?el.scrollWidth:-1};})()");
  t('Potenciar sin desbordamiento en iPhone', potOverflow.sw <= potOverflow.iw + 1 && potOverflow.panel <= potOverflow.iw + 1, JSON.stringify(potOverflow));
  await shot(ws, 'visual-porciones-iphone-pot.png');

  console.log('-- Agregar extra → Balance recalcula → 3 nuevas → Otros extras --');
  const antes = await evalJs("(function(){return potenciarFaltante(completarCtxReal()).k;})()");
  const extra0 = await evalJs("(function(){var x=(window._completarPotExtras||[])[0];return x?(x.nombre+' = '+Math.round(x.kcal)+' kcal'):'';})()");
  t('hay un primer extra para agregar', !!extra0, extra0);
  await evalJs("(function(){completarPotAgregar(0);return true;})()");
  await new Promise(r => setTimeout(r, 700));
  const despues = await evalJs("(function(){return potenciarFaltante(completarCtxReal()).k;})()");
  t('agregar → Balance recalculado (faltante bajó)', despues < antes || antes === 0, antes + ' → ' + despues);
  const toastVivo = await evalJs("(function(){var b=document.body.textContent||'';return {seAgrego:b.includes('Se agregó'),faltan:b.includes('Ahora te faltan '+Math.round(potenciarFaltante(completarCtxReal()).k)+' kcal')};})()");
  t('toast de confirmación visible con datos reales', toastVivo.seAgrego && toastVivo.faltan, JSON.stringify(toastVivo));
  const potTxt2 = await evalJs("(function(){return (document.getElementById('completarPotPanel')||{innerText:''}).innerText;})()");
  t('resumen "Agregado a esta comida" visible', potTxt2.includes('Agregado a esta comida'));
  t('"Total añadido aquí" con suma real', potTxt2.includes('Total añadido aquí'));
  t('encabezado recalculado tras agregar', potTxt2.includes('Te faltan ' + despues + ' kcal'), (potTxt2.match(/Te faltan \d+ kcal[^\n]*/) || ['?'])[0]);
  const panelVivo = await evalJs("(function(){var el=document.getElementById('completarPotPanel');return !!(el&&el.innerHTML.includes('＋ Agregar extra'));})()");
  t('el panel sigue abierto con nuevo lote', panelVivo);
  const lote2 = await evalJs("(function(){return (window._completarPotExtras||[]).map(function(x){return x.nombre;});})()");
  const sinRepetir = await evalJs("(function(){var agg=" + JSON.stringify(extra0.split(' = ')[0]) + ";return (window._completarPotExtras||[]).every(function(x){return completarNombreCorto(x.nombre)!==completarNombreCorto(agg);});})()");
  t('3 nuevas sin repetir el extra agregado', lote2.length >= 1 && sinRepetir, lote2.join(' · '));
  const reg = await evalJs("(function(){var t=(typeof todayISO==='function')?todayISO():new Date().toISOString().slice(0,10);var d=state.diary[t]||{};var out=[];['breakfast','lunch','dinner','snacks'].forEach(function(m){(d[m]||[]).forEach(function(x){out.push(x.name+' = '+x.kcal+' kcal');});});return out;} )()");
  t('diario tiene el extra con porción y kcal EXACTAS', reg.some(r => r === extra0), reg.slice(-2).join(' | ') + ' vs ' + extra0);
  await shot(ws, 'visual-porciones-iphone-pot2.png');
  const lot1 = await evalJs("(function(){return (window._completarPotExtras||[]).map(function(x){return x.nombre;}).join('|');})()");
  await evalJs("(function(){completarPotOtros();return true;})()");
  await new Promise(r => setTimeout(r, 600));
  const lot2 = await evalJs("(function(){return (window._completarPotExtras||[]).map(function(x){return x.nombre;}).join('|');})()");
  t('🔄 Otros extras rota a un lote distinto', lot2.length > 0 && lot2 !== lot1, lot2.split('|').join(' · '));
  const otrosSinRepetir = await evalJs("(function(){var agg=" + JSON.stringify(extra0.split(' = ')[0]) + ";return (window._completarPotExtras||[]).every(function(x){return completarNombreCorto(x.nombre)!==completarNombreCorto(agg);});})()");
  t('Otros extras no re-ofrece el agregado', otrosSinRepetir);

  await ws.sendJson('Emulation.clearDeviceMetricsOverride', {});
  await evalJs("(function(){if(window.__origGetHours)Date.prototype.getHours=window.__origGetHours;completarPotCerrar();completarCerrar();return true;})()");
  const ex = ws.events.filter(e => e.method === 'Runtime.exceptionThrown');
  t('sin excepciones JS', ex.length === 0, ex.length + ' excepción(es)');
  console.log('===== RESULTADO: ' + pasadas + ' PASS / ' + falladas + ' FAIL =====');
  console.log('La app queda ABIERTA para prueba visual manual.');
  process.exit(falladas ? 1 : 0);
})().catch(e => { console.log('ERROR GLOBAL:', e.message); process.exit(2); });
