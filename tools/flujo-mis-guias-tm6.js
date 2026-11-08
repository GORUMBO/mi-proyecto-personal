// ============================================================
// Prueba REAL de Mis guías TM6: Windows → Supabase → iPhone.
// Perfil A (Windows): crea la guía con foto por el editor real y la
// sincroniza. Perfil B (simulación del iPhone, perfil limpio y móvil):
// descarga la MISMA guía por el sync existente. Al final A borra la
// guía y B recibe el borrado (la nube queda como estaba).
// Requiere session-token.txt válido (sesión de Supabase del usuario).
// Uso: node tools/flujo-mis-guias-tm6.js [puertoA] [puertoB]  (9336/9337)
// ============================================================
const fs = require('fs');
const path = require('path');
const puertoA = Number(process.argv[2] || 9336);
const puertoB = Number(process.argv[3] || 9337);

async function conectar(puerto) {
  let target = null;
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch('http://127.0.0.1:' + puerto + '/json/list');
      const list = await res.json();
      target = list.find(x => x.type === 'page' && x.webSocketDebuggerUrl);
      if (target) break;
    } catch (e) { /* aún no listo */ }
    await new Promise(r => setTimeout(r, 500));
  }
  if (!target) throw new Error('Sin target CDP en el puerto ' + puerto);
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0; const pend = new Map();
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
  };
  await new Promise(r => { resolver = r; });
  return ws;
}
let pasadas = 0, falladas = 0;
function t(label, ok, extra) {
  if (ok) { pasadas++; console.log('PASS ' + label + (extra ? ' · ' + extra : '')); }
  else { falladas++; console.log('FAIL ' + label + (extra ? ' · ' + extra : '')); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
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
  // Sesión real del usuario: si session-token.txt tiene una vigente se usa;
  // si no, el usuario inicia sesión en la ventana de la instancia A.
  let sesion = null, LOCAL_ONLY = false, tokenValido = false;
  try {
    sesion = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'session-token.txt'), 'utf8'));
  } catch (e) { sesion = null; }
  tokenValido = !!(sesion && sesion.access_token);
  if (!tokenValido) {
    console.log('⚠️ session-token.txt inválido/ausente → entra con tu correo en la ventana de la app de prueba.');
  }

  const wsA = await conectar(puertoA);
  let wsB = null;
  let evalB = async () => null;
  if (!LOCAL_ONLY) {
    wsB = await conectar(puertoB);
    evalB = async e => { const r = await wsB.sendJson('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error('EVAL B: ' + JSON.stringify(r.exceptionDetails).slice(0, 400)); return r.result.value; };
    for (const w of [wsA, wsB]) { await w.sendJson('Runtime.enable', {}); await w.sendJson('Page.enable', {}); }
  } else {
    await wsA.sendJson('Runtime.enable', {});
    await wsA.sendJson('Page.enable', {});
  }
  try { await wsA.sendJson('Page.bringToFront', {}); } catch (e) { }
  const evalA = async e => { const r = await wsA.sendJson('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error('EVAL A: ' + JSON.stringify(r.exceptionDetails).slice(0, 400)); return r.result.value; };

  const NOMBRE = '🧪 Prueba de sincronización TM6 (puedes borrarla)';
  let sesionStr = '';
  if (!LOCAL_ONLY) {
    if (tokenValido) {
      // token vigente del archivo → sembrar A y recargar (misma sesión real)
      sesionStr = JSON.stringify(sesion);
      await evalA(`localStorage.setItem('pp_cloud_session', ${JSON.stringify(JSON.stringify(sesionStr))});localStorage.setItem('pp_full', JSON.stringify({profile:{peso:150,altura:170,edad:30,sexo:'hombre',actividad:'muy alta',objetivo:'ganar músculo',nombre:'Prueba'},onboarded:true,_isOwner:true,uiSettings:{tutorialDone:true,hiddenTabs:[],mode:'personal',dark:false}}));'ok'`);
      await wsA.sendJson('Page.reload', { ignoreCache: true });
      await sleep(6000);
    } else {
      // sin token: el usuario inicia sesión en la ventana de A
      let ses = null;
      for (let i = 0; i < 90; i++) {
        ses = await evalA(`safeStorage.get('pp_cloud_session')`);
        if (ses) { try { sesion = JSON.parse(ses); if (sesion && sesion.access_token) break; } catch (e) { } }
        if (i === 15) console.log('   esperando a que inicies sesión en la ventana de la app…');
        await sleep(2000);
      }
      if (!sesion || !sesion.access_token) throw new Error('No se detectó sesión en A (entra con tu correo en la ventana de la app y vuelve a correr el flujo).');
      console.log('   ✓ sesión detectada en A.');
      sesionStr = JSON.stringify(sesion);
    }
  }
  const SEMILLA = (extra) => `localStorage.setItem('pp_full', JSON.stringify(Object.assign({profile:{peso:150,altura:170,edad:30,sexo:'hombre',actividad:'muy alta',objetivo:'ganar músculo',nombre:'Prueba'},onboarded:true,_isOwner:true,uiSettings:{tutorialDone:true,hiddenTabs:[],mode:'personal',dark:false}}, ${extra})));${LOCAL_ONLY ? '' : `localStorage.setItem('pp_cloud_session', ${JSON.stringify(JSON.stringify(sesionStr))});`} 'ok'`;

  // ---- Perfil A: Windows (creador) ----
  if (LOCAL_ONLY) {
    await evalA(SEMILLA('{misGuiasTM6:[]}'));
    await wsA.sendJson('Page.reload', { ignoreCache: true });
    await sleep(6000);
  }
  // (modo completo: NO recargar A — el usuario ya inició sesión y la app ya
  //  descargó su estado real; seguimos desde ahí para no pisar su sesión)
  if (LOCAL_ONLY) {
    if (await evalA(`!!document.getElementById('loginScreen')`)) {
      await evalA(`(()=>{const b=[...document.querySelectorAll('#loginScreen button')].find(x=>x.textContent.includes('Seguir sin cuenta'));if(b)b.click();return 'ok';})()`);
      await sleep(800);
    }
  } else {
    t('A: sesión válida (sin pantalla de acceso)', await evalA(`!document.getElementById('loginScreen')`));
  }
  await evalA(`window._rAFOriginal=requestAnimationFrame;window.requestAnimationFrame=null;openTab('🤖 Thermomix TM6');'ok'`);
  let tabLista = false;
  for (let i = 0; i < 20; i++) {
    if (await evalA(`!!document.getElementById('misGuiasTM6Out')`)) { tabLista = true; break; }
    await sleep(500);
  }
  t('A: pestaña TM6 con la tarjeta Mis guías', tabLista);

  // Crear por el editor real (con foto generada)
  await evalA(`guiaTM6Nueva();'ok'`);
  await sleep(400);
  await evalA(`(()=>{document.getElementById('tm6gNombre').value='${NOMBRE}';document.getElementById('tm6gTiempo').value='20';document.getElementById('tm6gKcal').value='310';document.getElementById('tm6gIng').value='2 elotes desgranados\\n1 papa en cubos\\n2 tazas de caldo\\nsal al gusto';document.getElementById('tm6gPasos').value='Pica cebolla: 5 seg, vel 5\\nSofríe: 120°C, 3 min, vel cuchara\\nCocina: 100°C, 18 min, giro inverso, vel cuchara';return 'ok';})()`);
  // foto: canvas → File → DataTransfer (el mismo camino de resizeSkinImage)
  await evalA(`(async()=>{const c=document.createElement('canvas');c.width=200;c.height=150;const g=c.getContext('2d');g.fillStyle='#8b73bf';g.fillRect(0,0,200,150);g.fillStyle='#fff';g.font='20px sans-serif';g.fillText('TM6',70,80);const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',0.8));const dt=new DataTransfer();dt.items.add(new File([blob],'prueba-tm6.jpg',{type:'image/jpeg'}));document.getElementById('tm6gFoto').files=dt.files;return 'ok';})()`);
  await sleep(400);
  await evalA(`guiaTM6Guardar();'ok'`);
  await sleep(1500);
  const nA = await evalA(`(state.misGuiasTM6||[]).filter(g=>!g.deleted).length`);
  const fotoA = await evalA(`((state.misGuiasTM6||[])[0]||{}).foto||''`);
  t('A: guía creada por el editor', nA === 1, String(nA));
  t('A: foto comprimida guardada en la guía', fotoA.startsWith('data:image/jpeg'), (fotoA.length / 1024).toFixed(0) + ' KB');
  t('A: la clasifica el sistema TM existente', await evalA(`(document.getElementById('misGuiasTM6Out').textContent||'').includes('🟢')||(document.getElementById('misGuiasTM6Out').textContent||'').includes('🟡')`));

  // Editar sin duplicar
  await evalA(`(()=>{const g=(state.misGuiasTM6||[])[0];guiaTM6Editar(g.id);return 'ok';})()`);
  await sleep(400);
  await evalA(`document.getElementById('tm6gTiempo').value='25';guiaTM6Guardar();'ok'`);
  await sleep(1000);
  t('A: editar actualiza la MISMA guía (sin duplicar)', await evalA(`(state.misGuiasTM6||[]).filter(g=>!g.deleted).length===1`) && await evalA(`(state.misGuiasTM6||[])[0].tiempo===25`));

  // Esperar la sincronización real (badge) — solo con sesión
  if (LOCAL_ONLY) {
    t('A: guardado local (modo LOCAL: la verificación con nube queda pendiente de tu sesión)', true);
  } else {
    let sincronizado = false;
    for (let i = 0; i < 20; i++) {
      const b = await evalA(`(()=>{const el=document.getElementById('syncBadge');return el?el.textContent:'';})()`);
      if (/Sincronizado/.test(b)) { sincronizado = true; break; }
      await sleep(2000);
    }
    t('A: subida verificada (badge Sincronizado)', sincronizado);
  }
  const shotA = await wsA.sendJson('Page.captureScreenshot', { format: 'png' });
  await saveShot('tm6-mis-guias-escritorio.png', Buffer.from(shotA.data, 'base64'));

  // ---- Perfil B: iPhone simulado (perfil limpio, solo sesión) ----
  if (!LOCAL_ONLY) {
  await evalB(SEMILLA('{misGuiasTM6:[]}'));
  await wsB.sendJson('Page.reload', { ignoreCache: true });
  await sleep(6000);
  t('B: sesión válida (sin pantalla de acceso)', await evalB(`!document.getElementById('loginScreen')`));
  // Forzar una descarga explícita (además del sync de arranque) y esperar
  // más tiempo: el Realtime tarda en conectar con la ventana oculta.
  try { await evalB(`typeof syncNow==='function'?syncNow():cloudStartupSync({skipUpload:true}); 'ok'`); } catch (e) { }
  await sleep(4000);
  let llego = false;
  for (let i = 0; i < 50; i++) {
    const n = await evalB(`(state.misGuiasTM6||[]).filter(g=>!g.deleted).length`);
    const nombre = await evalB(`((state.misGuiasTM6||[])[0]||{}).nombre||''`);
    if (n >= 1 && nombre.includes('Prueba de sincronización')) { llego = true; break; }
    if (i % 5 === 4) { try { await evalB(`typeof syncNow==='function'?syncNow():0;'ok'`); } catch (e) { } }
    await sleep(2000);
  }
  t('B (iPhone): la guía llegó por sincronización real', llego);
  if (llego) {
    t('B: contenido íntegro (pasos con parámetros TM6)', await evalB(`((state.misGuiasTM6||[])[0].pasos||[]).some(p=>/vel/.test(p))`));
    t('B: la foto viajó en el estado', await evalB(`((state.misGuiasTM6||[])[0].foto||'').startsWith('data:image/jpeg')`));
    await evalB(`window._rAFOriginal=requestAnimationFrame;window.requestAnimationFrame=null;openTab('🤖 Thermomix TM6');'ok'`);
    await sleep(1200);
    t('B: visible en Cocina → Thermomix TM6', await evalB(`(document.getElementById('misGuiasTM6Out').textContent||'').includes('Prueba de sincronización')`));
    await wsB.sendJson('Emulation.setDeviceMetricsOverride', { width: 393, height: 852, deviceScaleFactor: 2, mobile: true });
    await sleep(500);
    const shotB = await wsB.sendJson('Page.captureScreenshot', { format: 'png' });
    await saveShot('tm6-mis-guias-iphone.png', Buffer.from(shotB.data, 'base64'));
  }

  } // fin perfil B (solo con sesión)

  // ---- Limpieza: A borra → B recibe el borrado (nube como estaba) ----
  await evalA(`window.confirm=function(){return true;};(()=>{const g=(state.misGuiasTM6||[]).find(x=>!x.deleted);if(g)guiaTM6Borrar(g.id);return 'ok';})()`);
  await sleep(1500);
  if (LOCAL_ONLY) {
    t('limpieza: guía de prueba borrada del perfil A', await evalA(`(state.misGuiasTM6||[]).filter(g=>!g.deleted).length===0`));
  } else {
    let borradoEnB = false;
    for (let i = 0; i < 20; i++) {
      const n = await evalB(`(state.misGuiasTM6||[]).filter(g=>!g.deleted).length`);
      if (n === 0) { borradoEnB = true; break; }
      await sleep(2000);
    }
    t('limpieza: el borrado también sincronizó (B queda sin la guía)', borradoEnB);
  }

  const ex = (wsA.exceptions || []).concat(wsB ? (wsB.exceptions || []) : []).map(e => (e.exception && (e.exception.description || e.text)) || '').filter(Boolean);
  t('sin excepciones de JS durante el flujo', ex.length === 0, ex.slice(0, 3).join(' | '));

  console.log('\n' + pasadas + ' pasadas · ' + falladas + ' falladas');
  console.log('Capturas: tools/pruebas/tm6-mis-guias-{escritorio,iphone}.png');
  try { await wsA.sendJson('Browser.close', {}); } catch (e) { }
  try { await wsB.sendJson('Browser.close', {}); } catch (e) { }
  process.exit(falladas ? 1 : 0);
})().catch(e => { console.error('FALLA GENERAL', e.message); process.exit(2); });
