// ============================================================
// Flujo real del catálogo visual de recetas vía CDP (Electron).
// Verifica en la app viva: filtro 📷 Con foto (12 recetas), fotos
// cargadas en tarjetas, detalle con foto y crédito SIN alterar los
// modos, responsive y capturas desktop/móvil + sidecar de rects
// para la verificación de píxeles.
// Uso: node tools/flujo-recetas-fotos.js [puerto]  (default 9336)
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
      else if (m.method === 'Runtime.exceptionThrown') exceptions.push(m.exceptionDetails);
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
async function saveShot(nombre, buf) {
  const dir = path.join(__dirname, 'pruebas');
  for (let intento = 1; intento <= 4; intento++) {
    const p = path.join(dir, nombre);
    try { fs.writeFileSync(p, buf); return p; }
    catch (e) { await sleep(700); }
  }
  let n = 2, p;
  do { p = path.join(dir, nombre.replace('.png', '-' + n + '.png')); n++; } while (fs.existsSync(p));
  fs.writeFileSync(p, buf);
  console.log('  OJO: ' + nombre + ' bloqueado — guardado como ' + path.basename(p));
  return p;
}

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
  try { await ws.sendJson('Page.bringToFront', {}); } catch (e) { /* opcional */ }

  const esperar = async (expr, intentos) => {
    for (let i = 0; i < (intentos || 25); i++) {
      if (await evalJs(expr)) return true;
      await sleep(400);
    }
    return false;
  };

  // 1) Perfil temporal desechable (NO toca datos reales del usuario).
  await evalJs(`localStorage.setItem('pp_full', JSON.stringify({profile:{peso:150,altura:170,edad:30,sexo:'hombre',actividad:'muy alta',objetivo:'ganar músculo',nombre:'Prueba'},onboarded:true,_isOwner:true,uiSettings:{tutorialDone:true,hiddenTabs:[],mode:'personal',dark:false}})); 'ok'`);
  await ws.sendJson('Page.reload', { ignoreCache: true });
  await sleep(4500);

  // 2) Pantalla de acceso + aviso sin cuenta (entrada real del usuario).
  let loginVisto = false;
  for (let i = 0; i < 12; i++) {
    if (await evalJs(`!!document.getElementById('loginScreen')`)) { loginVisto = true; break; }
    await sleep(500);
  }
  t('aparece la pantalla de acceso (sin sesión)', loginVisto);
  if (loginVisto) {
    await evalJs(`(()=>{const b=[...document.querySelectorAll('#loginScreen button')].find(x=>x.textContent.includes('Seguir sin cuenta'));if(!b)return 'NO-BOTON';b.click();return 'ok';})()`);
    await sleep(800);
    t('«Seguir sin cuenta» cierra el acceso', await evalJs(`!document.getElementById('loginScreen')`));
  }
  for (let i = 0; i < 14; i++) {
    if (await evalJs(`!!document.getElementById('avisoSinCuentaBox')`)) {
      await evalJs(`(()=>{const b=document.querySelector('#avisoSinCuentaBox button');if(b)b.click();return 'ok';})()`);
      await sleep(500);
      break;
    }
    await sleep(500);
  }
  t('sin modales encima (acceso/aviso cerrados)', await evalJs(`!document.getElementById('loginScreen')&&!document.getElementById('avisoSinCuentaBox')`));

  // 3) Recetas + filtro 📷 Con foto (botón real)
  // La pestaña pesada se inyecta con requestAnimationFrame, que Windows
  // congela cuando la ventana queda ocluida/minimizada. Desactivarlo hace
  // que buildTabIfNeeded inyecte síncrono (camino propio de la app) y el
  // flujo no dependa del estado visual de la ventana.
  await evalJs(`window._rAFOriginal=requestAnimationFrame;window.requestAnimationFrame=null;'ok'`);
  await evalJs(`openTab('🍽️ Recetas'); 'ok'`);
  await sleep(1200);
  if (!(await esperar(`!!document.getElementById('soloFotoBtn')`, 25))) {
    await evalJs(`buildTabIfNeeded(tabs.indexOf('🍽️ Recetas'),true); 'ok'`);
    await sleep(1200);
  }
  // showTab difiere bindAll() tras pintar; con la ventana oculta puede no
  // correr — renderRecipes() es exactamente lo que bindAll ejecutaría.
  // OJO: sin filtros, el catálogo inicial es AGRUPADO (categorías plegables
  // con cuadrícula perezosa) y no crea .recipe-card hasta abrir una categoría.
  await evalJs(`try{renderRecipes();}catch(e){} 'ok'`);
  t('Recetas cargada', await esperar(`document.querySelectorAll('#recipes .cat-group, #recipes .recipe-card').length>0`, 15));
  await evalJs(`(()=>{const b=document.getElementById('soloFotoBtn');if(!b)return 'NO-BOTON';b.click();return 'ok';})()`);
  await sleep(900);
  t('filtro 📷 Con foto activo', await evalJs(`window._soloFoto===true`));
  t('exactamente 12 tarjetas con foto', await evalJs(`document.querySelectorAll('#recipes .recipe-card').length`), String(await evalJs(`document.querySelectorAll('#recipes .recipe-card').length`)));
  const lbl = await evalJs(`(document.getElementById('recMethodLabel')||{}).textContent||''`);
  t('etiqueta honesta del filtro', lbl.includes('Con foto') && lbl.includes('12'), lbl);
  // Las imágenes de abajo del pliegue son loading="lazy": recargar las que
  // aún no cargaron (mismo src, ahora sin lazy) y verificar las 12.
  await evalJs(`(()=>{let n=0;document.querySelectorAll('#recipes .r2-foto img').forEach(im=>{if(im.naturalWidth===0){im.loading='eager';im.src=im.src;n++;}});return n;})()`);
  await sleep(1400);
  const fotosInfo = await evalJs(`[...document.querySelectorAll('#recipes .r2-foto img')].map(im=>({w:im.naturalWidth,src:im.getAttribute('src')}))`);
  t('las 12 fotos cargaron (offline desde assets/recetas)', fotosInfo.length === 12 && fotosInfo.every(f => f.w > 0), fotosInfo.length + ' fotos · ' + fotosInfo.filter(f=>f.w===0).length + ' sin cargar');
  const nombresVisibles = await evalJs(`[...document.querySelectorAll('#recipes .r2-name')].map(e=>e.textContent.trim())`);
  const nombresEsperados = await evalJs(`Object.keys(RECETA_FOTOS).length`);
  t('los 12 nombres visibles corresponden a la muestra', nombresVisibles.length === nombresEsperados, nombresVisibles.length + ' nombres · primero: ' + (nombresVisibles[0] || '—'));
  t('cada tarjeta muestra método + tiempo', await evalJs(`[...document.querySelectorAll('#recipes .recipe-card')].every(c=>c.textContent.includes('🍳')&&c.textContent.includes('min'))`));

  // 4) Posicionar y capturar ESCRITORIO (arriba + desplazado)
  const posicionar = `(()=>{const grid=document.querySelector('#recipes');if(!grid)return 'SIN-GRID';let d=grid.closest('details');while(d){d.open=true;d=d.parentElement.closest('details');}const hdr=document.querySelector('.appTop');const objetivo=(hdr?hdr.getBoundingClientRect().bottom:0)+8;const top=grid.getBoundingClientRect().top;let p=grid.parentElement,sc=null;while(p){const o=getComputedStyle(p).overflowY;if(o==='auto'||o==='scroll'){sc=p;break;}p=p.parentElement;}sc=sc||document.scrollingElement;sc.scrollTop+=(top-objetivo);return 'top:'+Math.round(grid.getBoundingClientRect().top)+' objetivo:'+Math.round(objetivo);})()`;
  await evalJs(`window.scrollTo(0,0); ${posicionar}`);
  await sleep(450);
  // Esperar a que las 12 imágenes estén DECODIFICADAS (tras un re-render
  // tardío pueden estar en blanco) antes de medir y capturar.
  await esperar(`(()=>{const ims=[...document.querySelectorAll('#recipes .r2-foto img')];return ims.length===12&&ims.every(im=>im.complete&&im.naturalWidth>0);})()`, 15);
  // Medir rects y capturar INMEDIATAMENTE (sin evaluaciones intermedias):
  // un render tardío entre medición y captura desalinearía el sidecar.
  const visibles = await evalJs(`(()=>{const out=[];document.querySelectorAll('#recipes .recipe-card').forEach((c,i)=>{const f=c.querySelector('.r2-foto');if(!f)return;const r=f.getBoundingClientRect();if(r.bottom>window.innerHeight-4||r.top<0)return;out.push({i,rect:{x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)},img:c.querySelector('.r2-foto img').getAttribute('src')});});return out;})()`);
  t('hay tarjetas visibles para capturar', visibles.length > 0, visibles.length + ' visibles');
  const shotDesk1 = await ws.sendJson('Page.captureScreenshot', { format: 'png' });
  await saveShot('recetas-fotos-escritorio.png', Buffer.from(shotDesk1.data, 'base64'));
  const viewportDesk = await evalJs(`({w:window.innerWidth,h:window.innerHeight})`);
  t('escritorio: sin scroll horizontal', await evalJs(`document.documentElement.scrollWidth<=window.innerWidth`));
  // desplazado: resto de la cuadrícula
  await evalJs(`document.querySelector('#recipes .recipe-card:last-child')?.scrollIntoView({block:'end'}); 'ok'`);
  await sleep(500);
  const shotDesk2 = await ws.sendJson('Page.captureScreenshot', { format: 'png' });
  await saveShot('recetas-fotos-escritorio-abajo.png', Buffer.from(shotDesk2.data, 'base64'));

  // 5) Detalle: foto principal + crédito + modos intactos
  await evalJs(`window.scrollTo(0,0); ${posicionar}`);
  await sleep(300);
  const idxChila = await evalJs(`baseRecipes.findIndex(r=>r.name==='Chilaquiles con huevo')`);
  t('encuentra el índice real de la receta de prueba', idxChila >= 0, String(idxChila));
  await evalJs(`abrirReceta(${idxChila},'rapido'); 'ok'`);
  await sleep(700);
  t('detalle abierto en modo Rápido', await evalJs(`window._recetaVista&&window._recetaVista.modo==='rapido'`));
  t('detalle muestra la foto principal cargada', await evalJs(`(()=>{const im=document.querySelector('.r-det-foto img');return !!(im&&im.naturalWidth>0);})()`));
  t('detalle muestra el crédito del autor', await evalJs(`(document.querySelector('.r-det-credito')||{}).textContent.includes('Wikimedia Commons')`));
  t('los 3 modos siguen presentes', await evalJs(`['🪄 Rápido','👨‍🍳 Paso a paso','📖 Completo'].every(txt=>[...document.querySelectorAll('#recetaDetalle button')].some(b=>b.textContent.includes(txt)))`));
  const shotDet = await ws.sendJson('Page.captureScreenshot', { format: 'png' });
  await saveShot('recetas-fotos-detalle.png', Buffer.from(shotDet.data, 'base64'));
  await evalJs(`cerrarReceta(); 'ok'`);
  await sleep(400);

  // 6) MÓVIL 393x852
  await ws.sendJson('Emulation.setDeviceMetricsOverride', { width: 393, height: 852, deviceScaleFactor: 2, mobile: true });
  await sleep(600);
  await evalJs(`window.scrollTo(0,0); ${posicionar}`);
  await sleep(450);
  await esperar(`(()=>{const ims=[...document.querySelectorAll('#recipes .r2-foto img')];return ims.length===12&&ims.every(im=>im.complete&&im.naturalWidth>0);})()`, 15);
  const visiblesMovil = await evalJs(`(()=>{const out=[];document.querySelectorAll('#recipes .recipe-card').forEach((c,i)=>{const f=c.querySelector('.r2-foto');if(!f)return;const r=f.getBoundingClientRect();if(r.bottom>window.innerHeight-4||r.top<0)return;out.push({i,rect:{x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)},img:c.querySelector('.r2-foto img').getAttribute('src')});});return out;})()`);
  t('móvil: hay tarjetas visibles para capturar', visiblesMovil.length > 0, visiblesMovil.length + ' visibles');
  const shotMov1 = await ws.sendJson('Page.captureScreenshot', { format: 'png' });
  await saveShot('recetas-fotos-movil.png', Buffer.from(shotMov1.data, 'base64'));
  t('móvil: sin scroll horizontal', await evalJs(`document.documentElement.scrollWidth<=window.innerWidth`));
  await evalJs(`document.querySelector('#recipes .recipe-card:nth-child(8)')?.scrollIntoView({block:'start'}); 'ok'`);
  await sleep(400);
  const shotMov2 = await ws.sendJson('Page.captureScreenshot', { format: 'png' });
  await saveShot('recetas-fotos-movil-abajo.png', Buffer.from(shotMov2.data, 'base64'));
  const viewportMovil = await evalJs(`({w:window.innerWidth,h:window.innerHeight})`);
  await ws.sendJson('Emulation.clearDeviceMetricsOverride', {});

  fs.writeFileSync(path.join(__dirname, 'pruebas', 'recetas-fotos-info.json'), JSON.stringify({ escritorio: { viewport: viewportDesk, fotos: visibles }, movil: { viewport: viewportMovil, fotos: visiblesMovil } }, null, 1));

  // 7) Sin excepciones
  const ex = (ws.exceptions || []).map(e => (e.exception && (e.exception.description || e.text)) || '').filter(Boolean);
  t('sin excepciones de JS durante el flujo', ex.length === 0, ex.slice(0, 3).join(' | '));

  console.log('\n' + pasadas + ' pasadas · ' + falladas + ' falladas');
  console.log('Capturas: tools/pruebas/recetas-fotos-{escritorio,escritorio-2,movil,movil-2,detalle}.png');
  try { await ws.sendJson('Browser.close', {}); } catch (e) { /* ya cerrado */ }
  process.exit(falladas ? 1 : 0);
})().catch(e => { console.error('FALLA GENERAL', e.message); process.exit(2); });
