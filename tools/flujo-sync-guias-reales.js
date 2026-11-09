// ============================================================
// Prueba REAL de sincronización de las 55 guías TM6 (6 muestra +
// 49 de la biblioteca).
// A (Windows, perfil con las 55 guías): sesión ya iniciada →
// las guías suben al cloud real (autorizado por el usuario).
// B (iPhone simulado, perfil limpio + misma sesión): descarga y
// verifica que TODO se conserve (fotos, ingredientes, pasos,
// categorías, parámetros TM6) y que funcione SIN CONEXIÓN.
// No borra nada: las guías quedan en la nube del usuario.
//
// GESTIÓN DE SESIÓN (para no pedir login en cada corrida):
// - A usa SIEMPRE el perfil persistente tools/.tmp-cdp-A (nunca
//   recrearlo): ahí vive la sesión del usuario y las 6 guías.
// - A es el ÚNICO dueño del refresh_token. B solo recibe el
//   access_token recién renovado y NUNCA renueva (Supabase rota
//   el refresh_token: si B renovara, invalidaría la sesión de A
//   y la próxima corrida pediría login otra vez). Al final B
//   limpia su copia de la sesión.
// - La contraseña del usuario NUNCA se guarda en scripts.
//
// Lanzar (dos ventanas, una por terminal):
//   npx electron . --remote-debugging-port=9336 --user-data-dir=tools/.tmp-cdp-A
//   npx electron . --remote-debugging-port=9337 --user-data-dir=tools/.tmp-cdp-B
// Uso: node tools/flujo-sync-guias-reales.js [puertoA] [puertoB]
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
    } catch (e) { }
    await new Promise(r => setTimeout(r, 500));
  }
  if (!target) throw new Error('Sin target CDP en el puerto ' + puerto);
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0; const pend = new Map(); let resolver;
  ws.onopen = () => {
    ws.sendJson = (m, p) => new Promise((res, rej) => { const mid = ++id; pend.set(mid, { res, rej }); ws.send(JSON.stringify({ id: mid, method: m, params: p || {} })); });
    resolver();
  };
  ws.onerror = () => { };
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
    else if (m.method === 'Page.javascriptDialogOpening') ws.sendJson('Page.handleJavaScriptDialog', { accept: true });
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
const NOMBRES = ['Salsa roja molcajeteada', 'Salsa verde molcajeteada', 'Salsa de chile de árbol',
  'Adobo para tacos al pastor', 'Adobo para birria de res', 'Adobo de guajillo tradicional'];

(async () => {
  const wsA = await conectar(puertoA);
  const wsB = await conectar(puertoB);
  const evalA = async e => { const r = await wsA.sendJson('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error('EVAL A: ' + JSON.stringify(r.exceptionDetails).slice(0, 400)); return r.result.value; };
  const evalB = async e => { const r = await wsB.sendJson('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error('EVAL B: ' + JSON.stringify(r.exceptionDetails).slice(0, 400)); return r.result.value; };
  for (const w of [wsA, wsB]) { await w.sendJson('Runtime.enable', {}); await w.sendJson('Page.enable', {}); }
  try { await wsA.sendJson('Page.bringToFront', {}); } catch (e) { }

  // ---- A: sesión ya iniciada (perfil persistente); las 55 guías están aquí ----
  const nA0 = await evalA(`(state.misGuiasTM6||[]).filter(x=>!x.deleted).length`);
  t('A: perfil con las 55 guías cargadas', nA0 >= 55, String(nA0));
  let sesion = null;
  for (let i = 0; i < 90; i++) {
    const s = await evalA(`safeStorage.get('pp_cloud_session')`);
    if (s) { try { sesion = JSON.parse(s); if (sesion && sesion.access_token) break; } catch (e) { } }
    if (i === 10) console.log('   👉 Entra con tu correo en la ventana de la app…');
    await sleep(2000);
  }
  if (!sesion || !sesion.access_token) throw new Error('No se detectó tu sesión en la ventana de la app.');
  console.log('   ✓ sesión detectada en A.');
  t('A: sin pantalla de acceso (sesión válida)', await evalA(`!document.getElementById('loginScreen')`));

  // Subir y verificar (badge Sincronizado = relectura confirmada).
  // syncNow renueva la sesión si hace falta: después de esto A tiene el
  // refresh_token MÁS nuevo y es su único dueño.
  try { await evalA(`typeof syncNow==='function'?syncNow():0;'ok'`); } catch (e) { }
  let sincronizado = false;
  for (let i = 0; i < 25; i++) {
    const b = await evalA(`(()=>{const el=document.getElementById('syncBadge');return el?el.textContent:'';})()`);
    if (/Sincronizado/.test(b)) { sincronizado = true; break; }
    await sleep(2000);
  }
  t('A: subida verificada a la nube (badge Sincronizado)', sincronizado);

  // Releer la sesión DESPUÉS del sync: A pudo renovarla (rotación de
  // refresh_token). Sembrar B con la copia vieja la invalidaría y B
  // fallaría o, peor, rompería la sesión de A.
  let sesionB = null;
  try { sesionB = JSON.parse(await evalA(`safeStorage.get('pp_cloud_session')||'null'`)); } catch (e) { }
  if (!sesionB || !sesionB.access_token) sesionB = sesion;
  t('A: sesión para sembrar B (post-sync)', !!(sesionB && sesionB.access_token));

  // ---- B: iPhone simulado con la misma sesión ----
  await evalB(`localStorage.setItem('pp_cloud_session', ${JSON.stringify(JSON.stringify(sesionB))});localStorage.setItem('pp_full', JSON.stringify({profile:{peso:150,altura:170,edad:30,sexo:'hombre',actividad:'muy alta',objetivo:'ganar músculo',nombre:'Prueba'},onboarded:true,_isOwner:true,uiSettings:{tutorialDone:true,hiddenTabs:[],mode:'personal',dark:false}})); 'ok'`);
  await wsB.sendJson('Page.reload', { ignoreCache: true });
  await sleep(6000);
  t('B: sesión válida (sin pantalla de acceso)', await evalB(`!document.getElementById('loginScreen')`));
  // Con 55 guías el arranque de B tarda más: esperar a que exista state
  // antes de leer las guías (evita el ReferenceError de arranque).
  for (let i = 0; i < 40; i++) {
    const listo = await evalB(`typeof state!=='undefined'`);
    if (listo) break;
    await sleep(1000);
  }
  let llegaron = 0;
  for (let i = 0; i < 50; i++) {
    llegaron = await evalB(`(state.misGuiasTM6||[]).filter(x=>!x.deleted).length`);
    if (llegaron >= 55) break;
    if (i % 5 === 4) { try { await evalB(`typeof syncNow==='function'?syncNow():0;'ok'`); } catch (e) { } }
    await sleep(2000);
  }
  t('B (iPhone): las 55 guías llegaron por sincronización real', llegaron >= 55, String(llegaron));

  if (llegaron >= 55) {
    const todo = await evalB(`(()=>{const gs=(state.misGuiasTM6||[]).filter(x=>!x.deleted);const names=[${NOMBRES.map(n => JSON.stringify(n)).join(',')}];const faltan=names.filter(n=>!gs.some(g=>g.nombre===n));if(faltan.length)return {ok:false,faltan};
      const ok=(g)=>g&&g.ingredientes.length>=5&&g.pasos.length===6&&g.pasos.every(p=>p.r)&&g.pasos.some(p=>/vel|°C|tradicional|molcajete/i.test(p.t))&&g.prepPrevia&&g.advertencias.length&&g.consejos.length&&g.erroresComunes.length&&g.variantes.length&&g.categoria&&g.subcategoria&&g.verificado==='pendiente';
      const malas=gs.filter(g=>!ok(g)).map(g=>g.nombre);
      return {ok:malas.length===0,malas};})()`);
    t('B: las 55 guías íntegras (pasos, parámetros, categorías, todo pendiente)', todo.ok, (todo.malas || []).join(' | ') || '55 íntegras');
    const fotos = await evalB(`(()=>{const gs=(state.misGuiasTM6||[]).filter(x=>!x.deleted);return gs.filter(g=>g.pasos.some(p=>p.f&&(state.guiasMedia||{})[p.f])).length;})()`);
    t('B: las fotos de los chiles viajaron en el estado', fotos >= 3, fotos + ' guías con foto');
    const mediaKeys = await evalB(`Object.keys(state.guiasMedia||{}).length`);
    t('B: almacén de medios completo (guiasMedia)', mediaKeys >= 3, mediaKeys + ' claves');
    const imgVisible = await evalB(`(()=>{const el=document.getElementById('misGuiasTM6Out');if(!el)return false;const imgs=[...el.querySelectorAll('img')];return imgs.length>0&&imgs.some(i=>i.complete&&i.naturalWidth>0);})()`);
    t('B: las fotos de paso se VEN (imagen cargada)', imgVisible);

    // ---- B: consulta SIN CONEXIÓN (offline) ----
    await wsB.sendJson('Network.enable', {});
    await wsB.sendJson('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
    await wsB.sendJson('Page.reload', { ignoreCache: true });
    await sleep(6000);
    const offline = await evalB(`(()=>{const n=(state.misGuiasTM6||[]).filter(x=>!x.deleted).length;return {n, visibles:(document.getElementById('misGuiasTM6Out')?document.getElementById('misGuiasTM6Out').textContent.includes('Salsa roja molcajeteada'):false)};})()`);
    t('B: sin conexión las guías siguen disponibles (offline-first)', offline.n >= 55, JSON.stringify(offline));
    await evalB(`window._rAFOriginal=requestAnimationFrame;window.requestAnimationFrame=null;openTab('🤖 Thermomix TM6');'ok'`);
    await sleep(1500);
    t('B: guías visibles en Cocina → TM6 sin internet', await evalB(`(document.getElementById('misGuiasTM6Out')||{}).textContent.includes('Adobo para tacos al pastor')`));
    await wsB.sendJson('Emulation.setDeviceMetricsOverride', { width: 393, height: 852, deviceScaleFactor: 2, mobile: true });
    await sleep(500);
    const shotB = await wsB.sendJson('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(__dirname, 'pruebas', 'tm6-sync-iphone.png'), Buffer.from(shotB.data, 'base64'));
    await wsB.sendJson('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  }
  const shotA = await wsA.sendJson('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(__dirname, 'pruebas', 'tm6-sync-windows.png'), Buffer.from(shotA.data, 'base64'));

  // B NO debe conservar la sesión: en un arranque futuro renovaría con el
  // refresh_token compartido y Supabase lo rotaría, dejando a A (y a la
  // próxima corrida) sin sesión válida → pediría login otra vez.
  try { await evalB(`localStorage.removeItem('pp_cloud_session');'ok'`); } catch (e) { }
  console.log('   ✓ sesión retirada de B (A queda como único dueño del refresh_token).');

  console.log('\n' + pasadas + ' pasadas · ' + falladas + ' falladas');
  console.log('Capturas: tools/pruebas/tm6-sync-{windows,iphone}.png');
  try { await wsA.sendJson('Browser.close', {}); } catch (e) { }
  try { await wsB.sendJson('Browser.close', {}); } catch (e) { }
  process.exit(falladas ? 1 : 0);
})().catch(e => { console.error('FALLA GENERAL', e.message); process.exit(2); });
