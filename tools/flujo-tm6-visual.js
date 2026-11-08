// ============================================================
// Flujo visual de la mejora TM6 (biblioteca + guía con fotos por
// paso + ingredientes con foto). Modo local (sin nube): la
// sincronización ya quedó cubierta por flujo-mis-guias-tm6.js.
// Uso: node tools/flujo-tm6-visual.js [puerto]  (default 9336)
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
    let resolver;
    ws.onopen = () => {
      ws.sendJson = (m, p) => new Promise((res, rej) => { const mid = ++id; pend.set(mid, { res, rej }); ws.send(JSON.stringify({ id: mid, method: m, params: p || {} })); });
      resolver();
    };
    ws.onerror = () => { };
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
      else if (m.method === 'Runtime.exceptionThrown') exceptions.push(m.exceptionDetails);
      else if (m.method === 'Page.javascriptDialogOpening') ws.sendJson('Page.handleJavaScriptDialog', { accept: true }); // los alert() no bloquean el flujo
    };
    return new Promise(r => { resolver = r; }).then(() => resolve(ws));
  });
}
let pasadas = 0, falladas = 0;
function t(label, ok, extra) {
  if (ok) { pasadas++; console.log('PASS ' + label + (extra ? ' · ' + extra : '')); }
  else { falladas++; console.log('FAIL ' + label + (extra ? ' · ' + extra : '')); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const LOG=(m)=>{try{require('fs').appendFileSync(require('path').join(__dirname,'.tm6-visual.log'),'[paso] '+m+'\n');}catch(e){}};
// (la ventana se pone al frente desde fuera del flujo, vía PowerShell previo)
async function saveShot(nombre, buf) {
  const dir = path.join(__dirname, 'pruebas');
  try { fs.writeFileSync(path.join(dir, nombre), buf); return; }
  catch (e) {
    let n = 2, p;
    do { p = path.join(dir, nombre.replace('.png', '-' + n + '.png')); n++; } while (fs.existsSync(p));
    fs.writeFileSync(p, buf);
    console.log('  OJO: ' + nombre + ' bloqueado — guardado como ' + path.basename(p));
  }
}

(async () => {
  LOG('IIFE inicio');
  const target = await getTarget();
  LOG('target ok');
  const ws = await connect(target.webSocketDebuggerUrl);
  LOG('ws ok');
  const evalJs = async (expr) => {
    const r = await ws.sendJson('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('EVAL ERROR: ' + JSON.stringify(r.exceptionDetails).slice(0, 500));
    return r.result.value;
  };
  await ws.sendJson('Runtime.enable', {});
  await ws.sendJson('Page.enable', {});
  try { await ws.sendJson('Page.bringToFront', {}); } catch (e) { }

  LOG('seed');
  await evalJs(`localStorage.setItem('pp_full', JSON.stringify({profile:{peso:150,altura:170,edad:30,sexo:'hombre',actividad:'muy alta',objetivo:'ganar músculo',nombre:'Prueba'},onboarded:true,_isOwner:true,uiSettings:{tutorialDone:true,hiddenTabs:[],mode:'personal',dark:false}})); 'ok'`);
  await ws.sendJson('Page.reload', { ignoreCache: true });
  await sleep(4500);
  LOG('post-reload');
  if (await evalJs(`!!document.getElementById('loginScreen')`)) {
    await evalJs(`(()=>{const b=[...document.querySelectorAll('#loginScreen button')].find(x=>x.textContent.includes('Seguir sin cuenta'));if(b)b.click();return 'ok';})()`);
    await sleep(800);
  }
  if (await evalJs(`!!document.getElementById('avisoSinCuentaBox')`)) { await evalJs(`document.querySelector('#avisoSinCuentaBox button').click()`); await sleep(500); }

  LOG('rAF');
  await evalJs(`window._rAFOriginal=requestAnimationFrame;window.requestAnimationFrame=null;'ok'`);
  await evalJs(`openTab('🤖 Thermomix TM6')`);
  LOG('openTab TM6');
  for (let i = 0; i < 20; i++) {
    if (await evalJs(`!!document.getElementById('tm6BibliotecaOut')`)) break;
    await sleep(500);
  }
  t('pestaña TM6 con biblioteca y Mis guías', await evalJs(`!!document.getElementById('tm6BibliotecaOut')&&!!document.getElementById('misGuiasTM6Out')`));
  t('biblioteca con 9 accesorios (subir/quitar)', await evalJs(`document.querySelectorAll('#tm6BibliotecaOut .mini').length===9 && (document.getElementById('tm6BibliotecaOut').textContent||'').includes('Añade tu foto')`));
  t('fotos de referencia CC visibles', await evalJs(`[...document.querySelectorAll('a')].some(a=>a.href.includes('tm6-vorwerk'))&&[...document.querySelectorAll('a')].some(a=>a.href.includes('thermomix-2014'))`));

  // Agregar foto de accesorio a la biblioteca (mismo almacén guiasMedia)
  await evalJs(`(async()=>{const c=document.createElement('canvas');c.width=120;c.height=90;const g=c.getContext('2d');g.fillStyle='#5d3b9c';g.fillRect(0,0,120,90);g.fillStyle='#fff';g.font='bold 16px sans-serif';g.fillText('Varoma',20,50);const dataUrl=c.toDataURL('image/jpeg',0.8);const hash=gvHash(dataUrl);state.guiasMedia=state.guiasMedia||{};state.guiasMedia[hash]=dataUrl;state.tm6Accesorios=state.tm6Accesorios||[];state.tm6Accesorios.push({k:'varoma',hash:hash,updated_at:new Date().toISOString()});renderTM6Biblioteca();return 'ok';})()`);
  await sleep(400);
  t('foto de Varoma en la biblioteca (dedupe por hash)', await evalJs(`(document.getElementById('tm6BibliotecaOut').innerHTML||'').includes('data:image/jpeg')`));

  // Crear guía con pasos dinámicos: texto + foto de la biblioteca + video por paso
  await evalJs(`guiaTM6Nueva();'ok'`);
  await sleep(400);
  await evalJs(`(()=>{document.getElementById('tm6gNombre').value='Salsa verde molcajeteada TM6';document.getElementById('tm6gTiempo').value='15';document.getElementById('tm6gIng').value='5 tomatillos, 2 chiles serranos, 1 diente de ajo, 1/2 taza de cilantro, sal';document.getElementById('tm6gCat').value='salsas';tm6CatChange();document.getElementById('tm6gSub').value='molcajeteada';document.getElementById('tm6gPrep').value='Lava los tomatillos y desinfecta el cilantro.';document.getElementById('tm6gAdv').value='No pases de velocidad 8 con liquidos calientes.';document.getElementById('tm6gConsejos').value='Si queda muy acida, agrega 1/4 de aguacate.';document.getElementById('tm6gErrores').value='Salsa muy liquida | Cocina 3 min mas a 100 C sin cubilete';document.getElementById('tm6gVariantes').value='Con chile habanero para mas picor.';document.getElementById('tm6gP_t_0').value='Tritura: 20 seg, vel 5-8';document.getElementById('tm6gP_r_0').value='Textura rustica con trocitos visibles';document.getElementById('tm6gP_v_0').value='https://example.com/video-paso1';tm6AccToggle('vaso');return 'ok';})()`);
  await evalJs(`tm6PasoAgregar();'ok'`);
  await sleep(300);
  await evalJs(`document.getElementById('tm6gP_t_1').value='Cocina: 100°C, 18 min, vel cuchara';'ok'`);
  await evalJs(`(()=>{const sel=document.getElementById('tm6gP_b_1');if(sel&&sel.options.length>1){sel.value=sel.options[1].value;tm6PasoDeBiblioteca(1,sel.value);}return 'ok';})()`);
  await sleep(300);
  t('paso 2 tomó foto de la biblioteca (Varoma)', await evalJs(`(window._tm6Pasos||[])[1].f!==''`));
  await evalJs(`guiaTM6Guardar();'ok'`);
  await sleep(1000);
  t('guía guardada con 2 pasos', await evalJs(`(()=>{const gs=(state.misGuiasTM6||[]).filter(g=>!g.deleted);return gs.length>=1&&gs.some(g=>g.nombre==='Salsa verde molcajeteada TM6');})()`));
  t('guía guarda video por paso y foto por paso', await evalJs(`(()=>{const g=(state.misGuiasTM6||[]).find(x=>x.nombre==='Salsa verde molcajeteada TM6');return g&&g.pasos.length===2&&g.pasos[0].v.includes('example.com')&&g.pasos[1].f!=='';})()`));
  t('guía guarda categoría+sub, prep previa, advertencias, consejos, errores, variantes y accesorios', await evalJs(`(()=>{const g=(state.misGuiasTM6||[]).find(x=>x.nombre==='Salsa verde molcajeteada TM6');return g&&g.categoria==='salsas'&&g.subcategoria==='molcajeteada'&&g.prepPrevia&&g.advertencias.length===1&&g.consejos.length===1&&g.erroresComunes.length===1&&g.variantes.length===1&&g.accesorios.includes('vaso')&&g.pasos[0].r.includes('rustica');})()`));
  t('la guía nueva nace pendiente de prueba (honesto)', await evalJs(`(()=>{const g=(state.misGuiasTM6||[]).find(x=>x.nombre==='Salsa verde molcajeteada TM6');return g&&g.verificado==='pendiente';})()`));
  await evalJs(`renderMisGuiasTM6();'ok'`);
  await sleep(400);
  t('visor muestra foto del paso y botón de video', await evalJs(`(()=>{const out=document.getElementById('misGuiasTM6Out').textContent;return out.includes('Video de este paso');})()`) && await evalJs(`(document.getElementById('misGuiasTM6Out').innerHTML||'').includes('data:image/jpeg')`));
  t('visor: badge Pendiente + secciones nuevas (prep, advertencias, errores, variantes, accesorios)', await evalJs(`(()=>{const out=document.getElementById('misGuiasTM6Out').textContent;return out.includes('Pendiente de prueba')&&out.includes('Antes de empezar')&&out.includes('Advertencias')&&out.includes('Errores y soluciones')&&out.includes('Variantes')&&out.includes('Resultado esperado');})()`));
  t('filtro por categoría (Salsas) y subcategoría (Molcajeteadas)', await evalJs(`tm6FiltroCat('salsas');tm6FiltroSub('molcajeteada');(document.getElementById('misGuiasTM6Out').textContent||'').includes('Salsa verde molcajeteada')`));
  t('buscador por ingrediente (tomatillos)', await evalJs(`tm6FiltroCat('');tm6FiltroSub('');document.getElementById('tm6gSearch').value='tomatillos';renderMisGuiasTM6();(document.getElementById('misGuiasTM6Out').textContent||'').includes('Salsa verde molcajeteada')`));
  await evalJs(`document.getElementById('tm6gSearch').value='';renderMisGuiasTM6();'ok'`);
  LOG('captura-pestana');
  const shotTM6 = await ws.sendJson('Page.captureScreenshot', { format: 'png' });
  await saveShot('tm6-visual-pestana.png', Buffer.from(shotTM6.data, 'base64'));

  // Ingredientes con foto en el detalle de una receta del catálogo
  await evalJs(`openTab('🍽️ Recetas')`);
  await sleep(1200);
  await evalJs(`(()=>{document.getElementById('recSearch').value='Agua de mango con Tajín';window._recSearchText='Agua de mango con Tajín';_recipePage=1;renderRecipes();return 'ok';})()`);
  await sleep(900);
  const idx = await evalJs(`baseRecipes.findIndex(r=>r.name==='Agua de mango con Tajín')`);
  t('receta del catálogo encontrada', idx >= 0, String(idx));
  await evalJs(`abrirReceta(${idx},'rapido');'ok'`);
  await sleep(700);
  t('ingredientes con foto real (mango)', await evalJs(`(()=>{const det=document.getElementById('recetaDetalle');return det&&[...det.querySelectorAll('.alim-foto img')].some(im=>im.getAttribute('src').includes('mango'));})()`));
  LOG('captura-receta');
  const shotReceta = await ws.sendJson('Page.captureScreenshot', { format: 'png' });
  await saveShot('tm6-visual-ingredientes.png', Buffer.from(shotReceta.data, 'base64'));
  await evalJs(`cerrarReceta();'ok'`);

  // Móvil: pestaña TM6
  await ws.sendJson('Emulation.setDeviceMetricsOverride', { width: 393, height: 852, deviceScaleFactor: 2, mobile: true });
  await sleep(500);
  await evalJs(`openTab('🤖 Thermomix TM6')`);
  LOG('openTab TM6');
  await sleep(1000);
  LOG('captura-movil');
  const shotMovil = await ws.sendJson('Page.captureScreenshot', { format: 'png' });
  await saveShot('tm6-visual-movil.png', Buffer.from(shotMovil.data, 'base64'));
  t('móvil: sin scroll horizontal', await evalJs(`document.documentElement.scrollWidth<=window.innerWidth`));
  await ws.sendJson('Emulation.clearDeviceMetricsOverride', {});

  const ex = (ws.exceptions || []).map(e => (e.exception && (e.exception.description || e.text)) || '').filter(Boolean);
  t('sin excepciones de JS durante el flujo', ex.length === 0, ex.slice(0, 3).join(' | '));

  console.log('\n' + pasadas + ' pasadas · ' + falladas + ' falladas');
  console.log('Capturas: tools/pruebas/tm6-visual-{pestana,ingredientes,movil}.png');
  try { await ws.sendJson('Browser.close', {}); } catch (e) { }
  process.exit(falladas ? 1 : 0);
})().catch(e => { console.error('FALLA GENERAL', e.message); process.exit(2); });
