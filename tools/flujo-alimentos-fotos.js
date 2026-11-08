// ============================================================
// Flujo real de las fotos de alimentos vía CDP (Electron).
// Verifica en la app viva: guía de verduras con fotos, Nevera con
// fotos en accesos rápidos y categorías, fallback emoji donde no
// hay foto, créditos visibles, responsive y capturas.
// Uso: node tools/flujo-alimentos-fotos.js [puerto]  (default 9336)
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
  const esperarFotos = async () => esperar(`(()=>{const ims=[...document.querySelectorAll('.alim-foto img')];return ims.length>0&&ims.every(im=>im.complete&&im.naturalWidth>0);})()`, 20);
  const posicionarVeg = `(()=>{const out=document.getElementById('veggiesOut');if(!out)return 'SIN-OUT';let d=out.closest('details');while(d){d.open=true;d=d.parentElement.closest('details');}const hdr=document.querySelector('.appTop');const objetivo=(hdr?hdr.getBoundingClientRect().bottom:0)+8;const top=out.getBoundingClientRect().top;let p=out.parentElement,sc=null;while(p){const o=getComputedStyle(p).overflowY;if(o==='auto'||o==='scroll'){sc=p;break;}p=p.parentElement;}sc=sc||document.scrollingElement;sc.scrollTop+=(top-objetivo);return 'top:'+Math.round(out.getBoundingClientRect().top);})()`;

  // 1) Perfil temporal desechable + entrada real
  await evalJs(`localStorage.setItem('pp_full', JSON.stringify({profile:{peso:150,altura:170,edad:30,sexo:'hombre',actividad:'muy alta',objetivo:'ganar músculo',nombre:'Prueba'},onboarded:true,_isOwner:true,uiSettings:{tutorialDone:true,hiddenTabs:[],mode:'personal',dark:false}})); 'ok'`);
  await ws.sendJson('Page.reload', { ignoreCache: true });
  await sleep(4500);
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
      await evalJs(`document.querySelector('#avisoSinCuentaBox button').click()`);
      await sleep(500);
      break;
    }
    await sleep(500);
  }
  t('sin modales encima', await evalJs(`!document.getElementById('loginScreen')&&!document.getElementById('avisoSinCuentaBox')`));

  // 2) Guía de verduras (dentro de Recetas → Más herramientas)
  await evalJs(`window._rAFOriginal=requestAnimationFrame;window.requestAnimationFrame=null;'ok'`);
  await evalJs(`openTab('🍽️ Recetas')`);
  await sleep(1200);
  await esperar(`!!document.getElementById('soloFotoBtn')`, 25);
  await evalJs(`(()=>{const det=[...document.querySelectorAll('details')].find(d=>d.querySelector('summary')&&d.querySelector('summary').textContent.includes('Más herramientas'));if(det)det.open=true;const veg=[...document.querySelectorAll('details')].find(d=>d.querySelector('summary')&&d.querySelector('summary').textContent.includes('Verduras cocidas'));if(veg)veg.open=true;return 'ok';})()`);
  await sleep(600);
  await esperarFotos();
  const nVeg = await evalJs(`document.querySelectorAll('#veggiesOut .alim-foto img').length`);
  const nVegEmoji = await evalJs(`document.querySelectorAll('#veggiesOut .alim-foto:not(:has(img))').length`);
  t('guía de verduras: fotos visibles', nVeg >= 20, nVeg + ' fotos + ' + nVegEmoji + ' emoji-fallback');
  t('guía de verduras: fallback emoji conservado donde no hay foto', nVegEmoji >= 0, String(nVegEmoji));
  t('créditos visibles en la guía', await evalJs(`[...document.querySelectorAll('details')].some(d=>d.querySelector('summary')&&d.querySelector('summary').textContent.includes('Créditos de las fotografías'))`));
  // Posicionar → decodificar → medir y capturar INMEDIATAMENTE (un render
  // tardío entre medición y captura desalinearía el sidecar).
  await evalJs(`window.scrollTo(0,0); ${posicionarVeg}`);
  await sleep(450);
  await esperarFotos();
  const sidecarVeg = await evalJs(`(()=>({viewport:{w:window.innerWidth,h:window.innerHeight},fotos:[...document.querySelectorAll('#veggiesOut .alim-foto img')].map(im=>{const r=im.getBoundingClientRect();return {src:im.getAttribute('src'),rect:{x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)}};}).filter(f=>f.rect.y>=0&&f.rect.y+f.rect.h<=window.innerHeight-4)}))()`);
  const shotVegDesk = await ws.sendJson('Page.captureScreenshot', { format: 'png' });
  await saveShot('alimentos-verduras-escritorio.png', Buffer.from(shotVegDesk.data, 'base64'));

  // 3) Nevera: accesos rápidos + categorías
  await evalJs(`openTab('🥗 Nevera')`);
  await sleep(1500);
  await evalJs(`(()=>{const det=[...document.querySelectorAll('details')].find(d=>d.querySelector('summary')&&d.querySelector('summary').textContent.includes('Ver todos los ingredientes'));if(det)det.open=true;document.querySelectorAll('.fridge-cat').forEach(d=>{if(['Verduras','Frutas'].some(c=>d.querySelector('.fridge-cat-head').textContent.includes(c)))d.open=true;});return 'ok';})()`);
  await sleep(600);
  await esperarFotos();
  const nQuick = await evalJs(`document.querySelectorAll('.quick-choice .alim-foto img').length`);
  const nCat = await evalJs(`document.querySelectorAll('.fridge-cat .alim-foto img').length`);
  t('Nevera: accesos rápidos con foto', nQuick >= 8, nQuick + ' fotos');
  t('Nevera: categorías con foto', nCat >= 20, nCat + ' fotos');
  await evalJs(`(()=>{const box=[...document.querySelectorAll('.card')].find(c=>c.querySelector('.quick-choice'));if(box)box.scrollIntoView({block:'start'});return 'ok';})()`);
  await sleep(500);
  const sidecarNevera = await evalJs(`(()=>({viewport:{w:window.innerWidth,h:window.innerHeight},fotos:[...document.querySelectorAll('.quick-choice .alim-foto img')].map(im=>{const r=im.getBoundingClientRect();return {src:im.getAttribute('src'),rect:{x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)}};}).filter(f=>f.rect.y>=0&&f.rect.y+f.rect.h<=window.innerHeight-4)}))()`);
  const shotNeveraDesk = await ws.sendJson('Page.captureScreenshot', { format: 'png' });
  await saveShot('alimentos-nevera-escritorio.png', Buffer.from(shotNeveraDesk.data, 'base64'));
  t('escritorio: sin scroll horizontal', await evalJs(`document.documentElement.scrollWidth<=window.innerWidth`));

  // 4) Móvil 393x852: guía de verduras
  await ws.sendJson('Emulation.setDeviceMetricsOverride', { width: 393, height: 852, deviceScaleFactor: 2, mobile: true });
  await sleep(600);
  await evalJs(`openTab('🍽️ Recetas')`);
  await sleep(1200);
  await evalJs(`(()=>{const det=[...document.querySelectorAll('details')].find(d=>d.querySelector('summary')&&d.querySelector('summary').textContent.includes('Más herramientas'));if(det)det.open=true;const veg=[...document.querySelectorAll('details')].find(d=>d.querySelector('summary')&&d.querySelector('summary').textContent.includes('Verduras cocidas'));if(veg)veg.open=true;return 'ok';})()`);
  await sleep(600);
  await evalJs(`window.scrollTo(0,0); ${posicionarVeg}`);
  await sleep(500);
  await esperarFotos();
  const sidecarVegMov = await evalJs(`(()=>({viewport:{w:window.innerWidth,h:window.innerHeight},fotos:[...document.querySelectorAll('#veggiesOut .alim-foto img')].map(im=>{const r=im.getBoundingClientRect();return {src:im.getAttribute('src'),rect:{x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)}};}).filter(f=>f.rect.y>=0&&f.rect.y+f.rect.h<=window.innerHeight-4)}))()`);
  const shotVegMov = await ws.sendJson('Page.captureScreenshot', { format: 'png' });
  await saveShot('alimentos-verduras-movil.png', Buffer.from(shotVegMov.data, 'base64'));
  t('móvil: sin scroll horizontal', await evalJs(`document.documentElement.scrollWidth<=window.innerWidth`));
  await ws.sendJson('Emulation.clearDeviceMetricsOverride', {});

  fs.writeFileSync(path.join(__dirname, 'pruebas', 'alimentos-fotos-info.json'), JSON.stringify({
    verduras_escritorio: sidecarVeg, nevera_escritorio: sidecarNevera, verduras_movil: sidecarVegMov
  }, null, 1));

  // 5) Sin excepciones
  const ex = (ws.exceptions || []).map(e => (e.exception && (e.exception.description || e.text)) || '').filter(Boolean);
  t('sin excepciones de JS durante el flujo', ex.length === 0, ex.slice(0, 3).join(' | '));

  console.log('\n' + pasadas + ' pasadas · ' + falladas + ' falladas');
  console.log('Capturas: tools/pruebas/alimentos-{verduras-escritorio,nevera-escritorio,verduras-movil}.png');
  try { await ws.sendJson('Browser.close', {}); } catch (e) { /* ya cerrado */ }
  process.exit(falladas ? 1 : 0);
})().catch(e => { console.error('FALLA GENERAL', e.message); process.exit(2); });
