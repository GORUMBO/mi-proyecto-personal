// Prueba visual de las ETIQUETAS SEMÁNTICAS de Potenciar (por rol) — CDP.
// Uso: node tools/prueba-visual-potenciar.js [puerto]  (default 9333)
// Casos: ensalada (totopos/aceite/pavo) y desayuno dulce (leche/fruta
// congelada/miel). Escritorio + iPhone. La app queda abierta.
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

  await evalJs("(function(){if(!window.__origGetHours){window.__origGetHours=Date.prototype.getHours;}Date.prototype.getHours=function(){return 14;};state.profile=state.profile||{};state.profile.calorias=3000;state.profile.proteina=180;state.profile.objetivo='ganar peso';state.profile.llenado='normal';var today=(typeof todayISO==='function')?todayISO():new Date().toISOString().slice(0,10);state.diary=state.diary||{};state.diary[today]={breakfast:[{name:'Comida de prueba',kcal:1200,prot:60,carb:0,fat:0}],lunch:[],dinner:[],snacks:[]};window._completarMostradas=[];window._completarFamiliasVistas=[];completarFiltrosReset();return true;})()");

  // Etiquetas en VIVO desde las funciones reales de la app (variantes reales)
  const etiquetaViva = (base, nombre, kcal, p, isMicro, cat) => {
    const expr = "(function(){var o={nombre:'" + nombre + "',nombreBase:'" + base + "',kcal:" + kcal + ",p:" + p + ",volumen:'Poco',tipo:'alimento',tiempo:0,metodo:'',isMicro:" + (isMicro ? 'true' : 'false') + ",factor:2};return {etiqueta:potenciarRazon('" + cat + "',false,o,{}),facilidad:potenciarFacilidad(o)};})()";
    return evalJs(expr);
  };
  const abrirPot = async (titulo, componente) => {
    await evalJs("(function(){window._completarPropuestas=[{titulo:'" + titulo + "',tipoProp:'comida',kcal:430,p:34,c:10,g:20,volumen:'Medio',tiempo:6,razones:[],clave:'cdp',componentes:[{tipo:'receta',nombre:'" + componente + "',ref:null,kcal:430,p:34,c:10,g:20,tiempo:6,porcion:{texto:'1 porción'}}]}];window._completarExtrasVistas=[];completarPotenciarAbrir(0);return true;})()");
    await new Promise(r => setTimeout(r, 600));
    return evalJs("(function(){return (window._completarPotExtras||[]).map(function(x){return {base:x.nombreBase,nombre:x.nombre,etiqueta:x.etiqueta.texto,facilidad:x.facilidad?x.facilidad.texto:''};});})()");
  };

  console.log('-- Etiquetas en vivo (funciones reales, variantes reales) --');
  const tot = await etiquetaViva('Totopos 1 oz', 'Totopos 2 oz', 280, 4, false, 'v');
  t('totopos 2 oz: "Snack denso en calorías · 2 oz ≈ 57 g"', tot.etiqueta.icono === '🥜' && tot.etiqueta.texto === 'Snack denso en calorías · 2 oz ≈ 57 g', tot.etiqueta.icono + tot.etiqueta.texto + ' | ' + tot.facilidad.texto);
  const ace = await etiquetaViva('Aceite oliva 1 cucharada', 'Aceite oliva 2 cucharadas', 238, 0, true, 'v');
  t('aceite 2 cdas: "Extra para agregar a comidas" + "Muy poco volumen"', ace.etiqueta.texto === 'Extra para agregar a comidas' && ace.facilidad.texto === 'Muy poco volumen', ace.etiqueta.icono + ace.etiqueta.texto + ' | ' + ace.facilidad.texto);
  t('aceite jamás "Listo para comer"', ace.facilidad.texto !== 'Listo para comer');
  const pav = await etiquetaViva('Pavo cocido 100g', 'Pavo cocido 200g', 270, 34, false, 'v');
  t('pavo 200g: "Alto en proteína" SIN "poco volumen"', /Alto en proteína/.test(pav.etiqueta.texto) && !/poco volumen/.test(pav.etiqueta.texto), pav.etiqueta.icono + pav.etiqueta.texto + ' | ' + pav.facilidad.texto);
  const leche = await etiquetaViva('Leche entera taza', 'Leche entera taza', 149, 8, true, 'kcal');
  t('leche: "Bebida con energía y proteína" + "Lista para beber"', leche.etiqueta.texto === 'Bebida con energía y proteína' && leche.facilidad.texto === 'Lista para beber', leche.etiqueta.icono + leche.etiqueta.texto + ' | ' + leche.facilidad.texto);
  const frutaC = await etiquetaViva('Fruta congelada 1 taza', 'Fruta congelada 1 taza', 80, 1, true, 'kcal');
  t('fruta congelada: "Requiere preparación o licuado"', frutaC.facilidad.texto === 'Requiere preparación o licuado', frutaC.etiqueta.icono + frutaC.etiqueta.texto + ' | ' + frutaC.facilidad.texto);
  const miel = await etiquetaViva('Miel 1 cucharada', 'Miel 1 cucharada', 64, 0, true, 'kcal');
  t('miel: "Extra para agregar a comidas" + "Muy poco volumen"', miel.etiqueta.texto === 'Extra para agregar a comidas' && miel.facilidad.texto === 'Muy poco volumen', miel.etiqueta.icono + miel.etiqueta.texto + ' | ' + miel.facilidad.texto);

  console.log('-- Tarjetas RENDERIZADAS (ensalada): sin violaciones de rol --');
  const extA = await abrirPot('Ensalada de pollo con aguacate', 'Ensalada de pollo con aguacate');
  const violacionesA = extA.filter(x => /Listo para comer/.test(x.facilidad) && /aceite|mantequilla|mayonesa|miel|jalea|crema/i.test(x.base)).map(x => x.base);
  t('panel ensalada: ninguna grasa/topping muestra "Listo para comer"', violacionesA.length === 0, violacionesA.join(','));
  t('panel ensalada: ninguna tarjeta de proteína sólida dice "poco volumen"', extA.filter(x => /roteína/.test(x.etiqueta) && /poco volumen/.test(x.etiqueta)).length === 0, extA.map(x => x.base + '→' + x.etiqueta).join(' | '));
  await shot(ws, 'potenciar-ensalada-desktop.png');

  console.log('-- Tarjetas RENDERIZADAS (desayuno dulce) --');
  const extB = await abrirPot('Yogurt con granola y fruta', 'Yogurt con granola y fruta');
  const violacionesB = extB.filter(x => /Listo para comer/.test(x.facilidad) && /aceite|mantequilla|mayonesa|miel|jalea|crema|congelad|avena/i.test(x.base)).map(x => x.base);
  t('panel desayuno: sin "Listo para comer" en grasas/congelados/avena', violacionesB.length === 0, violacionesB.join(','));
  await shot(ws, 'potenciar-desayuno-desktop.png');

  console.log('-- iPhone (390x844): sin overflow en el panel Potenciar --');
  await evalJs("(function(){window._completarExtrasVistas=[];completarPotenciarAbrir(0);return true;})()");
  await ws.sendJson('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await new Promise(r => setTimeout(r, 600));
  const ov = await evalJs("(function(){var p=document.getElementById('completarPotPanel');return {sw:document.body.scrollWidth,iw:window.innerWidth,pw:p?p.scrollWidth:-1};})()");
  t('iPhone Potenciar sin overflow', ov.sw <= ov.iw + 1 && ov.pw <= ov.iw + 1, JSON.stringify(ov));
  await shot(ws, 'potenciar-iphone.png');
  await ws.sendJson('Emulation.clearDeviceMetricsOverride', {});
  await evalJs("(function(){completarPotCerrar();if(window.__origGetHours)Date.prototype.getHours=window.__origGetHours;return true;})()");

  console.log('-- Potenciar sobre SNACK: fritos + guacamole --');
  await evalJs("(function(){if(!window.__origGetHours){window.__origGetHours=Date.prototype.getHours;}Date.prototype.getHours=function(){return 20;};return true;})()");
  const abrirSnack = async (base) => {
    await evalJs("(function(){window._completarPropuestas=[{titulo:'" + base + "',tipoProp:'micro',kcal:160,p:2,c:16,g:10,volumen:'Poco',tiempo:0,razones:[],clave:'cdpSnack',componentes:[{tipo:'alimento',nombre:'" + base + "',ref:null,kcal:160,p:2,c:16,g:10,tiempo:0,porcion:{texto:'1 oz'}}]}];window._completarExtrasVistas=[];completarPotenciarAbrir(0);return true;})()");
    await new Promise(r => setTimeout(r, 600));
  };
  const loteActual = () => evalJs("(function(){return (window._completarPotExtras||[]).map(function(x){return {base:x.nombreBase,nombre:x.nombre,kcal:x.kcal,etiqueta:x.etiqueta.icono+x.etiqueta.texto,facilidad:x.facilidad?x.facilidad.texto:''};});})()");
  await abrirSnack('Fritos/chips de maíz 1 oz');
  const vistoF = [];
  let shotGuac = false;
  for (let r = 0; r < 6; r++) {
    const lot = await loteActual();
    lot.forEach(x => { if (!vistoF.some(v => v.base === x.base)) vistoF.push(x); });
    if (!shotGuac && lot.some(x => x.base === 'Guacamole 2 cucharadas')) { await shot(ws, 'potenciar-fritos-desktop.png'); shotGuac = true; }
    await evalJs("(function(){completarPotOtros();return true;})()");
    await new Promise(r2 => setTimeout(r2, 400));
  }
  const guacF = vistoF.find(x => x.base === 'Guacamole 2 cucharadas');
  t('fritos: guacamole ofrecido ("🥣 Dip para tu snack" · +50 kcal · 2 cucharadas)', !!guacF && guacF.etiqueta === '🥣Dip para tu snack' && guacF.kcal === 50 && /2 cucharadas/.test(guacF.nombre), guacF ? JSON.stringify(guacF) : vistoF.map(x => x.base).join(','));
  const violF = vistoF.filter(x => /bebida|leche|yogurt|pavo|jamón|pollo|sardina|aceite|huevo|mantequilla/i.test(x.base));
  t('fritos: sin bebidas/proteínas/grasas en ningún lote', violF.length === 0, violF.map(x => x.base).join(','));
  // agregar el guacamole y verificar registro real con fibra
  await abrirSnack('Fritos/chips de maíz 1 oz');
  await evalJs("(function(){var i=-1;var ex=window._completarPotExtras||[];for(var k=0;k<ex.length;k++){if(ex[k].nombreBase==='Guacamole 2 cucharadas'){i=k;break;}}if(i<0){completarPotOtros();setTimeout(function(){var ex2=window._completarPotExtras||[];for(var k2=0;k2<ex2.length;k2++){if(ex2[k2].nombreBase==='Guacamole 2 cucharadas'){completarPotAgregar(k2);break;}}},300);}else{completarPotAgregar(i);}return true;})()");
  await new Promise(r => setTimeout(r, 900));
  const reg = await evalJs("(function(){var today=(typeof todayISO==='function')?todayISO():'';var d=(state.diary&&state.diary[today])||{};var all=[].concat(d.breakfast||[],d.lunch||[],d.dinner||[],d.snacks||[]);var e=null;all.forEach(function(x){if(x&&x.name==='Guacamole 2 cucharadas'&&x.src==='potenciar')e=x;});return e||null;})()");
  t('agregar guacamole → registro REAL con fibra (jamás "Potenciar")', !!reg && reg.name === 'Guacamole 2 cucharadas' && reg.fibra === 1.5 && reg.kcal === 50 && reg.src === 'potenciar', JSON.stringify(reg));

  console.log('-- Totopos: salsa y queso a través de Otros extras --');
  await abrirSnack('Totopos 1 oz');
  const basesTotopos = [];
  for (let r = 0; r < 6; r++) {
    const lot = await loteActual();
    lot.forEach(x => { if (basesTotopos.indexOf(x.base) < 0) basesTotopos.push(x.base); });
    await evalJs("(function(){completarPotOtros();return true;})()");
    await new Promise(r2 => setTimeout(r2, 400));
  }
  t('totopos: salsa y queso ofrecidos (rotación)', basesTotopos.indexOf('Salsa 1/2 taza') >= 0 && basesTotopos.indexOf('Queso 28g') >= 0, basesTotopos.join(','));
  await shot(ws, 'potenciar-totopos-desktop.png');

  console.log('-- Crackers: queso crema y hummus --');
  await abrirSnack('Crackers saladas 6 piezas');
  const loteC = await loteActual();
  const basesC = loteC.map(x => x.base);
  t('crackers: queso crema y hummus en los lotes', basesC.indexOf('Queso crema 2 cucharadas') >= 0 && basesC.indexOf('Hummus 2 cucharadas') >= 0, basesC.join(','));
  await shot(ws, 'potenciar-crackers-desktop.png');

  console.log('-- iPhone (390x844): Potenciar de snack sin overflow --');
  await abrirSnack('Fritos/chips de maíz 1 oz');
  await ws.sendJson('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await new Promise(r => setTimeout(r, 600));
  const ovSnack = await evalJs("(function(){var p=document.getElementById('completarPotPanel');return {sw:document.body.scrollWidth,iw:window.innerWidth,pw:p?p.scrollWidth:-1};})()");
  t('iPhone snack Potenciar sin overflow', ovSnack.sw <= ovSnack.iw + 1 && ovSnack.pw <= ovSnack.iw + 1, JSON.stringify(ovSnack));
  await shot(ws, 'potenciar-snack-iphone.png');
  await ws.sendJson('Emulation.clearDeviceMetricsOverride', {});
  await evalJs("(function(){completarPotCerrar();if(window.__origGetHours)Date.prototype.getHours=window.__origGetHours;return true;})()");

  console.log('-- UX del botón ⚡ Agregar extras --');
  await evalJs("(function(){if(!window.__origGetHours){window.__origGetHours=Date.prototype.getHours;}Date.prototype.getHours=function(){return 14;};completarAbrir();return true;})()");
  await new Promise(r => setTimeout(r, 800));
  const htmlPanel = await evalJs("(function(){var el=document.getElementById('completarPanel');return el?el.innerHTML:'';})()");
  t('tarjetas con extras muestran "⚡ Agregar extras"', /⚡\s*<span class="pot-btn-full">Agregar extras<\/span>/.test(htmlPanel));
  t('variante corta "⚡ Extras" presente (para pantallas estrechas)', /pot-btn-corto">Extras</.test(htmlPanel));
  await shot(ws, 'potenciar-ux-boton-desktop.png');
  // tarjeta SIN extras: el botón no debe existir
  await evalJs("(function(){window._potExtrasHay={};completarRenderPanel([{titulo:'Bebida deportiva 1 botella',tipoProp:'micro',kcal:150,p:0,c:36,g:0,volumen:'Poco',tiempo:0,razones:[],clave:'sinExtras',componentes:[{tipo:'alimento',nombre:'Bebida deportiva 1 botella',ref:null,kcal:150,p:0,c:36,g:0,tiempo:0,porcion:{texto:'1 botella'}}]}]);return true;})()");
  await new Promise(r => setTimeout(r, 600));
  const htmlSin = await evalJs("(function(){var el=document.getElementById('completarPanel');return el?el.innerHTML:'';})()");
  t('tarjeta SIN extras NO muestra "Agregar extras"', !/Agregar extras/.test(htmlSin) && !/pot-btn-full/.test(htmlSin));
  // título del panel, mini tarjeta de la base y tarjeta con fibra
  await abrirSnack('Totopos 1 oz');
  let htmlPot = await evalJs("(function(){var el=document.getElementById('completarPotPanel');return el?el.innerHTML:'';})()");
  t('panel: título "Agregar extras a:" con la comida base', /Agregar extras a:/.test(htmlPot) && /<b[^>]*>Totopos 1 oz<\/b>/.test(htmlPot), (htmlPot.match(/Agregar extras a:[^<]*/) || ['?'])[0]);
  t('mini tarjeta: porción + kcal + proteína + fibra de la base', /1 oz · 160 kcal · 2 g proteína · 1\.5 g fibra/.test(htmlPot), (htmlPot.match(/1 oz[^<]*/) || ['?'])[0]);
  t('después: "Te faltan hoy: X kcal · X g proteína"', /Te faltan hoy: \d+ kcal · \d+(\.\d+)? g proteína/.test(htmlPot), (htmlPot.match(/Te faltan hoy[^<]*/) || ['?'])[0]);
  t('bloque "📊 Progreso de hoy" presente y compacto', /📊 Progreso de hoy/.test(htmlPot));
  t('barra de calorías: "X / Y kcal" + faltante real', /🔥 Calorías/.test(htmlPot) && /\d+ \/ \d+ kcal/.test(htmlPot) && /Te faltan \d+ kcal/.test(htmlPot), (htmlPot.match(/\d+ \/ \d+ kcal/) || ['?'])[0]);
  t('barra de proteína independiente: "X / Y g" + faltante', /💪 Proteína/.test(htmlPot) && /\d+ \/ \d+ g/.test(htmlPot) && /Te faltan \d+ g/.test(htmlPot), (htmlPot.match(/\d+ \/ \d+ g[^<]*/) || ['?'])[0]);
  t('sin barra de fibra (perfil sin objetivo — no se inventa)', !/🌾 Fibra/.test(htmlPot));
  t('barras horizontales simples (sin gráficos complejos)', /border-radius:999px;height:6px/.test(htmlPot) && !/<canvas|<svg/.test(htmlPot));
  for (let i = 0; i < 6 && !/Guacamole/.test(htmlPot); i++) {
    await evalJs("(function(){completarPotOtros();return true;})()");
    await new Promise(r2 => setTimeout(r2, 400));
    htmlPot = await evalJs("(function(){var el=document.getElementById('completarPotPanel');return el?el.innerHTML:'';})()");
  }
  t('tarjeta del guacamole: porción + kcal + proteína + fibra', /2 cucharadas · \+50 kcal · \+0\.5 g proteína · \+1\.5 g fibra/.test(htmlPot), (htmlPot.match(/2 cucharadas[^<]*/) || ['(no encontrado)'])[0]);
  t('botón "🔄 Otros extras" visible', /🔄 Otros extras/.test(htmlPot));
  // iPhone 390px: el botón se reduce a "⚡ Extras"
  await evalJs("(function(){window._potExtrasHay={};completarRenderPanel([{titulo:'Totopos 1 oz',tipoProp:'micro',kcal:140,p:2,c:18,g:7,volumen:'Poco',tiempo:0,razones:[],clave:'botonIphone',componentes:[{tipo:'alimento',nombre:'Totopos 1 oz',ref:null,kcal:140,p:2,c:18,g:7,tiempo:0,porcion:{texto:'1 oz'}}]}]);return true;})()");
  await ws.sendJson('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await new Promise(r => setTimeout(r, 600));
  const cssBtn = await evalJs("(function(){var full=document.querySelector('.pot-btn-full');var corto=document.querySelector('.pot-btn-corto');return {full:full?getComputedStyle(full).display:'(sin botón)',corto:corto?getComputedStyle(corto).display:'(sin botón)'};})()");
  t('iPhone 390px: se muestra "⚡ Extras" (full oculto, corto visible)', cssBtn.full === 'none' && cssBtn.corto !== 'none', JSON.stringify(cssBtn));
  await shot(ws, 'potenciar-ux-boton-iphone.png');
  await ws.sendJson('Emulation.clearDeviceMetricsOverride', {});
  await evalJs("(function(){completarPotCerrar();if(window.__origGetHours)Date.prototype.getHours=window.__origGetHours;return true;})()");

  console.log('-- Barra de progreso: se actualiza en vivo al agregar un extra --');
  await abrirSnack('Totopos 1 oz');
  const barraAntes = await evalJs("(function(){var el=document.getElementById('completarPotPanel');var m=el.innerHTML.match(/(\\d+) \\/ (\\d+) kcal/);return m?+m[1]:-1;})()");
  const faltanAntes = await evalJs("(function(){var el=document.getElementById('completarPotPanel');var m=el.innerHTML.match(/Te faltan hoy: (\\d+) kcal/);return m?+m[1]:-1;})()");
  // agregar un extra REAL distinto al ya agregado (queso +110 kcal) y verificar
  // que barras y "Te faltan hoy" se recalculan con el re-render (sin recargar)
  await evalJs("(function(){window._completarPotExtras=[{nombre:'Queso 56g',nombreBase:'Queso 28g',kcal:110,p:7,c:1,g:9,factor:1,clase:'topping',isMicro:true,categoria:'kcal',score:10,razones:['topping-natural'],etiqueta:{icono:'🧀',texto:'Proteína + calorías'},facilidad:{icono:'🥡',texto:'Listo para comer'}}];completarPotAgregar(0);return true;})()");
  await new Promise(r => setTimeout(r, 900));
  const barraDespues = await evalJs("(function(){var el=document.getElementById('completarPotPanel');var m=el.innerHTML.match(/(\\d+) \\/ (\\d+) kcal/);return m?+m[1]:-1;})()");
  const faltanDespues = await evalJs("(function(){var el=document.getElementById('completarPotPanel');var m=el.innerHTML.match(/Te faltan hoy: (\\d+) kcal/);return m?+m[1]:-1;})()");
  t('la barra de kcal sube en vivo tras agregar (+110)', barraAntes >= 0 && barraDespues === barraAntes + 110, barraAntes + ' → ' + barraDespues);
  t('"Te faltan hoy" baja en vivo (sin recargar)', faltanAntes >= 0 && faltanDespues === faltanAntes - 110, faltanAntes + ' → ' + faltanDespues);
  await shot(ws, 'potenciar-progreso-desktop.png');

  console.log('-- iPhone (390x844): bloque Progreso sin overflow --');
  await ws.sendJson('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await new Promise(r => setTimeout(r, 600));
  const ovProg = await evalJs("(function(){var p=document.getElementById('completarPotPanel');return {sw:document.body.scrollWidth,iw:window.innerWidth,pw:p?p.scrollWidth:-1};})()");
  t('iPhone con Progreso de hoy sin overflow', ovProg.sw <= ovProg.iw + 1 && ovProg.pw <= ovProg.iw + 1, JSON.stringify(ovProg));
  await shot(ws, 'potenciar-progreso-iphone.png');
  await ws.sendJson('Emulation.clearDeviceMetricsOverride', {});

  const ex = ws.events.filter(e => e.method === 'Runtime.exceptionThrown');
  t('sin excepciones JS', ex.length === 0, ex.length + ' excepción(es)');
  console.log('===== RESULTADO: ' + pasadas + ' PASS / ' + falladas + ' FAIL =====');
  // La app queda abierta EN LA PANTALLA DE EXTRAS para revisión manual.
  await evalJs("(function(){window._completarPropuestas=[{titulo:'Totopos 1 oz',tipoProp:'micro',kcal:140,p:2,c:18,g:7,volumen:'Poco',tiempo:0,razones:[],clave:'revision',componentes:[{tipo:'alimento',nombre:'Totopos 1 oz',ref:null,kcal:140,p:2,c:18,g:7,tiempo:0,porcion:{texto:'1 oz'}}]}];window._completarExtrasVistas=[];completarPotenciarAbrir(0);if(window.__origGetHours)Date.prototype.getHours=window.__origGetHours;return true;})()");
  console.log('La app queda ABIERTA en la pantalla de extras para prueba visual manual.');
  process.exit(falladas ? 1 : 0);
})().catch(e => { console.log('ERROR GLOBAL:', e.message); process.exit(2); });
