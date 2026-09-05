// Prueba visual de Bebidas/Licuados + Micro-extras (CDP, Electron).
// Uso: node tools/prueba-visual-bebidas-micro.js [puerto]  (default 9333)
// Escenarios: mañana (licuado compuesto + menú), trabajo (portable),
// noche (denso), Potenciar llenado rápido (micro + encadenado),
// overflow escritorio + iPhone. Capturas en tools/visual-bebidas-*.png
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
    console.log('  📸 ' + file + ' (' + Math.round(Buffer.from(r.data, 'base64').length / 1024) + ' KB)');
  } catch (e) {
    console.log('  ⚠ captura omitida (' + file + '): ' + e.message);
  }
};

(async () => {
  const target = await getTarget();
  const ws = await connect(target.webSocketDebuggerUrl);
  const withTimeout = (p, ms, tag) => Promise.race([
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout ' + tag)), ms))
  ]);
  const evalJs = async (expr) => {
    const r = await withTimeout(ws.sendJson('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }), 20000, 'eval');
    if (r.exceptionDetails) throw new Error('EVAL ERROR: ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
    return r.result.value;
  };
  await ws.sendJson('Runtime.enable', {});
  await ws.sendJson('Page.enable', {});
  await ws.sendJson('Page.reload', { ignoreCache: true });
  await new Promise(r => setTimeout(r, 4500));

  const seed = async (hora, llenado, kcal) => evalJs("(function(){if(!window.__origGetHours){window.__origGetHours=Date.prototype.getHours;}Date.prototype.getHours=function(){return " + hora + ";};state.profile=state.profile||{};state.profile.calorias=3000;state.profile.proteina=180;state.profile.objetivo='ganar peso';state.profile.llenado='" + llenado + "';var today=(typeof todayISO==='function')?todayISO():new Date().toISOString().slice(0,10);state.diary=state.diary||{};state.diary[today]={breakfast:[{name:'Comida de prueba',kcal:" + kcal + ",prot:60,carb:0,fat:0}],lunch:[],dinner:[],snacks:[]};window._completarMostradas=[];window._bebidaSaboresUsados=[];return true;})()");

  console.log('-- MAÑANA (Me lleno rápido): ranking fácil primero --');
  await seed(8, 'rapido', 1200);
  await evalJs("(function(){completarAbrir();return true;})()");
  await new Promise(r => setTimeout(r, 800));
  const manana = await evalJs("(function(){return (window._completarPropuestas||[]).map(function(p){return {t:!!p.bebida,ti:p.titulo,k:p.kcal};});})()");
  const idxBeb = manana.findIndex(p => p.t);
  t('≥1 bebida/licuado entre las 3 (mañana rápido)', idxBeb >= 0, manana.map(p => p.ti + ' ' + p.k + 'kcal' + (p.t ? ' [🍹]' : '')).join(' | '));
  const rapidaPresente = await evalJs("(function(){return (window._completarPropuestas||[]).some(function(p){var cs=(p.componentes||[]).map(function(c){return {tiempo:c.tiempo,metodo:c.metodo,portable:!!p.bebida};});return completarEsRapido({partes:cs});});})()");
  t('≥1 opción rápida/portable', rapidaPresente);
  t('máximo 1 comida grande (≥600 kcal)', manana.filter(p => p.k >= 600).length <= 1, manana.map(p => p.k).join('/'));
  t('sin meal prep pesado (todas ≤600 en mañana rápido)', manana.every(p => p.k <= 600), manana.map(p => p.k).join('/'));
  // regresión del caso real: las capturas del usuario
  const titulos = manana.map(p => p.ti).join(' | ');
  t('REGRESIÓN: sin "Meal prep: pechugas para la semana"', !/Meal prep/i.test(titulos), titulos);
  t('REGRESIÓN: sin "Ensalada de pollo con aguacate (llena)"', !/llena/i.test(titulos));
  t('REGRESIÓN: sin "Papa + Huevo + Leche" como combo automático', !/Papa \+ Huevo/i.test(titulos));
  const facilesTodas = await evalJs("(function(){return (window._completarPropuestas||[]).every(function(p){return p.kcal<=650&&p.tiempo<=15;});})()");
  t('todo el top-3 es del pool fácil (≤650 kcal, ≤15 min)', facilesTodas);
  const capsOk = await evalJs("(function(){var ps=window._completarPropuestas||[];function fams(p){return completarFamiliasDe({partes:(p.componentes||[]).map(function(c){return {nombre:c.nombre,tipo:c.tipo,type:c.tipo==='alimento'?'alimento':'',tags:''};}),tipoBebida:!!p.bebida});}var cont={};ps.forEach(function(p){fams(p).forEach(function(f){cont[f]=(cont[f]||0)+1;});});return {h:cont.huevo||0,l:cont.lacteos||0,b:cont.bebida||0,c:cont.cereales||0};})()");
  t('REGLA TOP-3: máx 1 huevo, 1 lácteo, 1 bebida, 1 cereal', capsOk.h <= 1 && capsOk.l <= 1 && capsOk.b <= 1 && capsOk.c <= 1, JSON.stringify(capsOk));
  const menuHtml = await evalJs("(function(){var el=document.getElementById('completarPanel');return el?el.innerHTML.includes('Ajustar licuado')&&el.innerHTML.includes('Otro sabor'):false;})()");
  t('menú discreto cerrado presente', menuHtml);
  const etiquetas = await evalJs("(function(){var el=document.getElementById('completarPanel');if(!el)return false;var h=el.innerHTML;return {tipo:/⚡ Suma fácil|🥜 Snack rápido|🧀 Extra pequeño|🍽️ Comida fácil|🥤 Bebida/.test(h),micro:/🥡 Sin cocinar · Poco volumen/.test(h)};})()");
  t('tarjeta micro visible con etiqueta de tipo', etiquetas.tipo, JSON.stringify(etiquetas));
  t('tarjeta micro muestra "Sin cocinar · Poco volumen"', etiquetas.micro);
  if (idxBeb >= 0) {
    const antes = await evalJs("(function(){var p=window._completarPropuestas[" + idxBeb + "];return {ti:p.titulo,k:p.kcal};})()");
    await evalJs("(function(){bebidaAccion(" + idxBeb + ",'sabor');return true;})()");
    await new Promise(r => setTimeout(r, 400));
    const despues = await evalJs("(function(){var p=window._completarPropuestas[" + idxBeb + "];return {ti:p.titulo,k:p.kcal};})()");
    // ±25% estricto está cubierto en unit tests; en vivo basta cambio + cercanía razonable
    t('🔄 Otro sabor cambia el licuado', despues.ti !== antes.ti && Math.abs(despues.k - antes.k) <= antes.k * 0.4, antes.ti + ' → ' + despues.ti + ' (' + despues.k + ' kcal)');
    const mas = await evalJs("(function(){bebidaAccion(" + idxBeb + ",'mas');return (window._completarPropuestas[" + idxBeb + "]||{}).kcal;})()");
    t('＋ Más calorías sube las kcal', mas > despues.k, despues.k + ' → ' + mas);
    const ligero = await evalJs("(function(){var p=window._completarPropuestas[" + idxBeb + "];var b=p&&p.bebida;if(!b)return -1;var m=bebidaMasLigero(b,completarCtxReal());return m?m.kcal:-1;})()");
    t('− Más ligero disponible (o -1 si no escala)', ligero === -1 || ligero < mas, 'ligero: ' + ligero + ' kcal');
    await shot(ws, 'visual-bebidas-manana.png');
  }

  console.log('-- Rondas: Otras 3 rota SOLO dentro del pool fácil --');
  const rotar = async () => {
    await evalJs("(function(){completarOtras3();return true;})()");
    await new Promise(r => setTimeout(r, 400));
    return evalJs("(function(){return (window._completarPropuestas||[]).map(function(p){return p.titulo;});})()");
  };
  let sinPesadas = true;
  for (let ronda = 0; ronda < 3; ronda++) {
    const lot = await rotar();
    t('Otras 3 #' + (ronda + 1) + ': sin pesadas', lot.length > 0 && !lot.some(t => /Meal prep|llena|Tortitas/i.test(t)), lot.join(' | '));
    if (lot.some(t => /Meal prep|llena|Tortitas/i.test(t))) sinPesadas = false;
  }
  t('ninguna ronda natural metió pesadas automáticamente', sinPesadas);
  const naturalesOk = await evalJs("(function(){var ps=window._completarPropuestas||[];var ctx=completarCtxReal();var cat=completarCatalogo(ctx);return ps.every(function(p){var tier=p.bebida?'E':(p.componentes.length===1?(p.componentes[0].tipo==='alimento'?'D':'A'):(p.componentes.every(function(c){return c.tipo==='alimento';})?'C':'B'));var partes=p.componentes.map(function(c){if(c.tipo==='receta'){var r=cat.find(function(x){return x.nombre===c.nombre;});return {nombre:c.nombre,tipo:'receta',type:r?r.type:'',tags:r?r.tags:''};}return {nombre:c.nombre,tipo:'alimento',type:'alimento',tags:''};});return completarEsEstructuraNatural({tier:tier,partes:partes,tipoBebida:!!p.bebida});});})()");
  t('cada propuesta es una estructura natural (sin combos raros)', naturalesOk);
  const facilesMarca = await evalJs("(function(){var ctx=completarCtxReal();var cands=completarCandidatos(ctx);var faciles=cands.filter(function(c){return completarEsCandidatoFacil(ctx,c);});window._completarMostradas=(window._completarMostradas||[]).concat(faciles.map(function(c){return c.partes.map(function(p){return p.nombre;}).join(' + ');}));completarRenderPanel();return faciles.length;})()");
  t('pool agotado (forzado, ' + facilesMarca + ' fáciles marcados)', facilesMarca > 0);
  const agotadoTxt = await evalJs("(function(){var el=document.getElementById('completarPanel');return el?el.innerText:'';})()");
  t('pool agotado: mensaje claro', agotadoTxt.includes('No hay más opciones fáciles diferentes ahora'));
  t('botón "Ver opciones normales" presente', await evalJs("(function(){var el=document.getElementById('completarPanel');return !!el&&el.innerHTML.includes('Ver opciones normales');})()"));
  await shot(ws, 'visual-bebidas-agotado.png');
  await evalJs("(function(){completarVerNormales();return true;})()");
  await new Promise(r => setTimeout(r, 500));
  const normalesLot = await evalJs("(function(){return (window._completarPropuestas||[]).map(function(p){return p.titulo;});})()");
  t('Ver opciones normales: ranking normal con 3 opciones', normalesLot.length === 3, normalesLot.join(' | '));
  await shot(ws, 'visual-bebidas-normales.png');

  console.log('-- MADRUGADA (estado real del diagnóstico): tarjeta micro visible en el DOM --');
  await seed(0, 'rapido', 0); // 00:00, diario vacío — el estado que producía 3 comidas sin micro
  await evalJs("(function(){completarAbrir();return true;})()");
  await new Promise(r => setTimeout(r, 800));
  const microDOM = await evalJs("(function(){var el=document.getElementById('completarPanel');if(!el)return null;var cards=[].slice.call(el.querySelectorAll('div')).filter(function(d){return d.style.background==='rgb(255, 255, 255)';});var micro=cards.find(function(d){return /Suma fácil|Snack rápido|Extra pequeño/.test(d.innerText||'');});if(!micro)return {hay:false,titulos:cards.map(function(d){return (d.innerText||'').split(String.fromCharCode(10))[0];})};var rect=micro.getBoundingClientRect();return {hay:true,texto:micro.innerText,visible:rect.height>0&&rect.width>0&&!!micro.offsetParent,boton:!!micro.querySelector('button'),aceite:/aceite/i.test(micro.innerText||''),kcal:/\\+\\d+ kcal/.test(micro.innerText||''),porcion:/taza|cucharada| g |½|¼| pieza| porción/.test(micro.innerText||'')};})()");
  t('existe tarjeta micro (⚡/🥜/🧀) en el DOM', microDOM && microDOM.hay, microDOM && microDOM.titulos ? microDOM.titulos.join(' | ') : 'panel sin tarjetas');
  t('tarjeta micro visible (no oculta)', microDOM && microDOM.visible, JSON.stringify(microDOM && microDOM.visible));
  t('tarjeta micro con +kcal reales', microDOM && microDOM.kcal, microDOM && (microDOM.texto || '').split(String.fromCharCode(10)).slice(0, 3).join(' | '));
  t('tarjeta micro con porción real', microDOM && microDOM.porcion);
  t('tarjeta micro con botón Agregar', microDOM && microDOM.boton);
  t('tarjeta micro NO es aceite independiente', microDOM && !microDOM.aceite);
  const madTitulos = await evalJs("(function(){return (window._completarPropuestas||[]).map(function(p){return p.tipoProp+':'+p.titulo;});})()");
  t('madrugada: bebida + micro + comida (no 3 recetas)', madTitulos.some(t => /^bebida:/.test(t)) && madTitulos.some(t => /^micro:/.test(t)), madTitulos.join(' | '));
  await shot(ws, 'visual-bebidas-madrugada.png');

  console.log('-- TRABAJO: portátil y rápido --');
  await seed(13, 'normal', 1500);
  await evalJs("(function(){completarAbrir();return true;})()");
  await new Promise(r => setTimeout(r, 500));
  const trabajoRazones = await evalJs("(function(){return (window._completarPropuestas||[]).some(function(p){return (p.razones||[]).some(function(r){return /portable|rápida/.test(r);});});})()");
  t('trabajo: alguna propuesta portable/rápida', trabajoRazones);

  console.log('-- NOCHE: denso posible --');
  await seed(20, 'normal', 1000);
  const densoNoche = await evalJs("(function(){var ctx=completarCtxReal();var cat=bebidaCat(ctx);var s3={compsBase:[cat['Yogurt griego taza'],cat['Granola 1/2 taza'],cat['Miel 1 cucharada']],base:0,variante:2,factor:1};var d=bebidaMasCalorias(s3,ctx);return d?(d.factor+'x · '+d.kcal+' kcal'):'null';})()");
  t('noche: licuado denso ×2 disponible', /^2x/.test(densoNoche || ''), densoNoche);

  console.log('-- POTENCIAR (Me lleno rápido): micro-extra + encadenado --');
  await seed(20, 'rapido', 1800);
  await evalJs("(function(){completarAbrir();return true;})()");
  await new Promise(r => setTimeout(r, 500));
  const idxCombo = await evalJs("(function(){return (window._completarPropuestas||[]).findIndex(function(p){return p.componentes.every(function(c){return c.tipo==='alimento';})&&p.componentes.length>=2;});})()");
  await evalJs("(function(){completarPotenciarAbrir(" + idxCombo + ");return true;})()");
  await new Promise(r => setTimeout(r, 600));
  const potTxt = await evalJs("(function(){return (document.getElementById('completarPotPanel')||{innerText:''}).innerText;})()");
  t('Potenciar: ⚡ Extra fácil presente', /⚡ Extra fácil|💪 Proteína \+ calorías/.test(potTxt), (potTxt.match(/(⚡ Extra fácil|💪 Proteína \+ calorías)[^\n]*/) || ['?'])[0]);
  t('Potenciar: facilidad 🥡', potTxt.includes('🥡 Listo para comer'));
  await shot(ws, 'visual-bebidas-pot-escritorio.png');
  await ws.sendJson('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await new Promise(r => setTimeout(r, 600));
  const ov1 = await evalJs("(function(){var el=document.getElementById('completarPotPanel');return {sw:document.body.scrollWidth,iw:window.innerWidth,p:el?el.scrollWidth:-1};})()");
  t('Potenciar sin overflow en iPhone', ov1.sw <= ov1.iw + 1 && ov1.p <= ov1.iw + 1, JSON.stringify(ov1));
  await shot(ws, 'visual-bebidas-pot-iphone.png');
  // agregar 2 micro-extras seguidos
  const antesK = await evalJs("(function(){return potenciarFaltante(completarCtxReal()).k;})()");
  const m1 = await evalJs("(function(){var xs=window._completarPotExtras||[];var i=xs.findIndex(function(x){return x.isMicro;});if(i<0)return null;completarPotAgregar(i);return xs[i].nombre+' '+xs[i].kcal;})()");
  await new Promise(r => setTimeout(r, 700));
  t('micro 1 agregado', !!m1, m1);
  const m2 = await evalJs("(function(){var xs=window._completarPotExtras||[];var i=xs.findIndex(function(x){return x.isMicro;});if(i<0)return null;completarPotAgregar(i);return xs[i].nombre+' '+xs[i].kcal;})()");
  await new Promise(r => setTimeout(r, 700));
  t('micro 2 agregado (encadenado, sin repetir)', !!m2 && m2.split(' ')[0] !== m1.split(' ')[0], m1 + ' → ' + m2);
  const resumen = await evalJs("(function(){return (document.getElementById('completarPotPanel')||{innerText:''}).innerText;})()");
  t('resumen acumula los 2 micros ✅', (resumen.match(/✅ /g) || []).length >= 2 && resumen.includes('Total añadido aquí'));
  const despuesK = await evalJs("(function(){return potenciarFaltante(completarCtxReal()).k;})()");
  t('faltante bajó dos veces', despuesK < antesK, antesK + ' → ' + despuesK);
  await shot(ws, 'visual-bebidas-pot-iphone2.png');

  await ws.sendJson('Emulation.clearDeviceMetricsOverride', {});
  await evalJs("(function(){if(window.__origGetHours)Date.prototype.getHours=window.__origGetHours;completarPotCerrar();completarCerrar();return true;})()");
  const ex = ws.events.filter(e => e.method === 'Runtime.exceptionThrown');
  t('sin excepciones JS', ex.length === 0, ex.length + ' excepción(es)');
  console.log('===== RESULTADO: ' + pasadas + ' PASS / ' + falladas + ' FAIL =====');
  console.log('La app queda ABIERTA para prueba visual manual.');
  process.exit(falladas ? 1 : 0);
})().catch(e => { console.log('ERROR GLOBAL:', e.message); process.exit(2); });
