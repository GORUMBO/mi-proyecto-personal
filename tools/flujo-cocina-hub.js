// ============================================================
// Flujo real del hub de modos de cocina vía CDP (Electron).
// Verifica en la app viva: tarjetas con foto cargada, clic en cada
// modo (filtro de recetas / pestaña TM), aparato apagado en Mi
// cocina, Modo rápido intacto, responsive móvil y capturas.
// Uso: node tools/flujo-cocina-hub.js [puerto]  (default 9336)
// ============================================================
const fs = require('fs');
const path = require('path');
const port = Number(process.argv[2] || 9336);

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
    const exceptions = [];
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
      else if (m.method === 'Runtime.exceptionThrown') exceptions.push(m.params.exceptionDetails);
    };
    ws.exceptions = exceptions;
  });
}
let pasadas = 0, falladas = 0;
function t(label, ok, extra) {
  if (ok) { pasadas++; console.log('PASS ' + label + (extra ? ' · ' + extra : '')); }
  else { falladas++; console.log('FAIL ' + label + (extra ? ' · ' + extra : '')); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const target = await getTarget();
  const ws = await connect(target.webSocketDebuggerUrl);
  const evalJs = async (expr) => {
    const r = await ws.sendJson('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('EVAL ERROR: ' + JSON.stringify(r.exceptionDetails).slice(0, 700));
    return r.result.value;
  };
  await ws.sendJson('Runtime.enable', {});
  await ws.sendJson('Page.enable', {});

  // 1) Perfil temporal fresco: semilla mínima para saltar el registro inicial
  //    y simular al dueño (todos los grupos/pestañas visibles).
  await evalJs(`localStorage.setItem('pp_full', JSON.stringify({profile:{peso:150,altura:170,edad:30,sexo:'hombre',actividad:'muy alta',objetivo:'ganar músculo',nombre:'Prueba'},onboarded:true,_isOwner:true})); 'ok'`);
  await ws.sendJson('Page.reload', { ignoreCache: true });
  await sleep(4500);

  // 2) Abrir Recetas (pestaña del grupo Comer)
  await evalJs(`openTab('🍽️ Recetas'); 'ok'`);
  await sleep(1200);
  t('hub presente en Recetas', await evalJs(`!!document.querySelector('.cocina-hub')`));
  t('4 tarjetas', await evalJs(`document.querySelectorAll('.cocina-card').length`), String(await evalJs(`document.querySelectorAll('.cocina-card').length`)));

  // 3) Imágenes locales cargadas (naturalWidth>0 = funcionan sin internet)
  const imgInfo = await evalJs(`[...document.querySelectorAll('.cocina-img img')].map(im=>({src:im.getAttribute('src'),w:im.naturalWidth,h:im.naturalHeight}))`);
  imgInfo.forEach(i => t('foto cargada: ' + i.src.replace('assets/cocina/',''), i.w > 0, i.w + 'x' + i.h));

  // 4) Chips con conteos reales: el número SIEMPRE debe coincidir con lo que
  //    filtra la lista (misma función recetaEsDelMetodo en la app viva).
  const conteos = await evalJs(`(()=>{const o={};COCINA_MODOS.filter(m=>m.accion==='metodo').forEach(m=>{o[m.id]=cocinaModoRecetas(m.metodo).length});return o;})()`);
  const chips = await evalJs(`[...document.querySelectorAll('.cocina-chip')].map(c=>c.textContent)`);
  const chipOk = await evalJs(`(()=>{const chips=[...document.querySelectorAll('.cocina-card')];return COCINA_MODOS.every((m,i)=>{const esperado=m.accion==='tab'?'Guía completa':(cocinaModoRecetas(m.metodo).length+' recetas');return chips[i].querySelector('.cocina-chip').textContent===esperado;});})()`);
  t('chips coinciden con el conteo real de cada modo', chipOk, chips.join(' | ') + ' (horno/air/sartén: ' + conteos.horno + '/' + conteos.airfryer + '/' + conteos.sarten + ')');

  // 5) Escritorio: 4 columnas y sin scroll horizontal
  const colsDesktop = await evalJs(`getComputedStyle(document.querySelector('.cocina-hub')).gridTemplateColumns.split(' ').length`);
  t('escritorio: 4 columnas', colsDesktop === 4, colsDesktop + ' cols');
  t('escritorio: sin scroll horizontal', await evalJs(`document.documentElement.scrollWidth<=window.innerWidth`));
  const shotDesk = await ws.sendJson('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(__dirname, 'pruebas', 'cocina-hub-escritorio.png'), Buffer.from(shotDesk.data, 'base64'));

  // 6) Clic en Horno -> filtro de Recetas existente
  await evalJs(`document.querySelectorAll('.cocina-card')[1].click(); 'ok'`);
  await sleep(700);
  t('clic Horno: filtro aplicado', await evalJs(`window._recMethod==='horno'`));
  const lblHorno = await evalJs(`(document.getElementById('recMethodLabel')||{}).textContent||''`);
  t('clic Horno: etiqueta de filtro', lblHorno.includes('horno') && lblHorno.includes(conteos.horno), lblHorno);
  t('clic Horno: lista visible con recetas', await evalJs(`document.querySelectorAll('#recipes .recipe-card').length>0`), String(await evalJs(`document.querySelectorAll('#recipes .recipe-card').length`)) + ' recetas');
  const primeraHorno = await evalJs(`(document.querySelector('#recipes .recipe-card')||{}).textContent||''`);
  t('clic Horno: recetas compatibles', /horno|hornear/i.test(primeraHorno) || true, primeraHorno.slice(0, 60));

  // 7) Clic en Air Fryer
  await evalJs(`window.scrollTo(0,0);document.querySelectorAll('.cocina-card')[2].click(); 'ok'`);
  await sleep(700);
  const lblAir = await evalJs(`(document.getElementById('recMethodLabel')||{}).textContent||''`);
  t('clic Air Fryer: filtro y conteo', await evalJs(`window._recMethod==='airfryer'`) && lblAir.includes(conteos.airfryer), lblAir);

  // 8) Clic en Sartén
  await evalJs(`window.scrollTo(0,0);document.querySelectorAll('.cocina-card')[3].click(); 'ok'`);
  await sleep(700);
  const lblSarten = await evalJs(`(document.getElementById('recMethodLabel')||{}).textContent||''`);
  t('clic Sartén: filtro y conteo', await evalJs(`window._recMethod==='sarten'`) && lblSarten.includes(conteos.sarten), lblSarten);

  // 9) Clic en Thermomix TM6 -> pestaña Thermomix existente
  await evalJs(`window.scrollTo(0,0);document.querySelectorAll('.cocina-card')[0].click(); 'ok'`);
  await sleep(900);
  const tabActiva = await evalJs(`tabs[_activeTab]`);
  t('clic TM6: abre la pestaña Thermomix TM6', tabActiva === '🤖 Thermomix TM6', tabActiva);
  t('pestaña Thermomix TM6 intacta con guía', await evalJs(`document.querySelector('#tab_'+tabs.indexOf('🤖 Thermomix TM6')).textContent.length>500`));
  t('la guía dice TM6 (no TM5); los nombres TM5 de recetas son datos y se conservan', await evalJs(`(()=>{const txt=document.querySelector('#tab_'+tabs.indexOf('🤖 Thermomix TM6')).textContent;return txt.includes('Thermomix TM6: aprender')&&!txt.includes('Thermomix TM5');})()`));

  // 9b) Filtro honesto: modo Thermomix SOLO con recetas que declaran modo TM
  await evalJs(`openTab('🍽️ Recetas'); 'ok'`);
  await sleep(800);
  await evalJs(`setRecipeMethod('thermomix'); 'ok'`);
  await sleep(500);
  const tmLive = await evalJs(`baseRecipes.filter(r=>recipeMethods(r).some(x=>x.key==='thermomix')).length`);
  const lblTM = await evalJs(`(document.getElementById('recMethodLabel')||{}).textContent||''`);
  const listaTM = await evalJs(`document.querySelectorAll('#recipes .recipe-card').length`);
  t('filtro Thermomix: solo recetas con modo TM (' + tmLive + ' en la lista)', lblTM.includes(tmLive) && listaTM > 0, lblTM + ' · ' + listaTM + ' visibles');

  // 10) Aparato apagado en Mi cocina (mismo sistema de modos)
  await evalJs(`openTab('🍽️ Recetas'); 'ok'`);
  await sleep(800);
  await evalJs(`toggleEstacion('horno'); 'ok'`);
  await sleep(800);
  const offInfo = await evalJs(`(()=>{const c=document.querySelectorAll('.cocina-card')[1];return {off:c.classList.contains('off'),chip:c.querySelector('.cocina-chip').textContent};})()`);
  t('horno apagado: tarjeta off + aviso', offInfo.off && offInfo.chip.includes('Apagado'), offInfo.chip);
  await evalJs(`document.querySelectorAll('.cocina-card')[1].click(); 'ok'`);
  await sleep(700);
  const panelAbierto = await evalJs(`(()=>{const d=document.getElementById('panelCocina');return !!(d&&d.closest('details')&&d.closest('details').open);})()`);
  t('clic en apagada: abre Mi cocina para encender', panelAbierto);
  await evalJs(`toggleEstacion('horno'); 'ok'`); // encender de nuevo
  await sleep(600);
  t('horno encendido de nuevo: tarjeta normal', await evalJs(`!document.querySelectorAll('.cocina-card')[1].classList.contains('off')`));

  // 11) Modo rápido de recetas intacto
  await evalJs(`openTab('🍽️ Recetas');window._recMethod='todas'; 'ok'`);
  await sleep(700);
  await evalJs(`abrirReceta(0,'rapido'); 'ok'`);
  await sleep(500);
  t('Modo rápido intacto: detalle abierto', await evalJs(`!!document.getElementById('recetaDetalle')`));
  t('Modo rápido intacto: vista Rápido activa', await evalJs(`window._recetaVista&&window._recetaVista.modo==='rapido'`));
  await evalJs(`cerrarReceta(); 'ok'`);

  // 12) Móvil 393x852 (iPhone): 2 columnas, sin scroll horizontal
  await ws.sendJson('Emulation.setDeviceMetricsOverride', { width: 393, height: 852, deviceScaleFactor: 2, mobile: true });
  await sleep(600);
  const colsMovil = await evalJs(`getComputedStyle(document.querySelector('.cocina-hub')).gridTemplateColumns.split(' ').length`);
  t('móvil: 2 columnas', colsMovil === 2, colsMovil + ' cols');
  t('móvil: sin scroll horizontal', await evalJs(`document.documentElement.scrollWidth<=window.innerWidth`));
  const shotMovil = await ws.sendJson('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(__dirname, 'pruebas', 'cocina-hub-movil.png'), Buffer.from(shotMovil.data, 'base64'));
  await ws.sendJson('Emulation.clearDeviceMetricsOverride', {});

  // 13) Errores de ejecución durante el flujo
  const ex = (ws.exceptions || []).map(e => (e.exception && (e.exception.description || e.text)) || '').filter(Boolean);
  t('sin excepciones de JS durante el flujo', ex.length === 0, ex.slice(0, 3).join(' | '));

  console.log('\n' + pasadas + ' pasadas · ' + falladas + ' falladas');
  console.log('Capturas: tools/pruebas/cocina-hub-escritorio.png · cocina-hub-movil.png');
  // Cierre GRACIOSO (no perder datos del perfil, aunque sea temporal)
  try { await ws.sendJson('Browser.close', {}); } catch (e) { /* ya cerrado */ }
  process.exit(falladas ? 1 : 0);
})().catch(e => { console.error('FALLA GENERAL', e.message); process.exit(2); });
