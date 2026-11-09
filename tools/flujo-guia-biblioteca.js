// ============================================================
// Carga las 49 guías de la biblioteca TM6 (27 salsas + 22 adobos)
// usando EXCLUSIVAMENTE el editor existente (guiaTM6Nueva/
// guiaTM6Guardar) — sin funciones nuevas. Datos: tools/
// guias-biblioteca-data.js (redacción propia, NO Cookidoo;
// todas nacen 'pendiente').
// - Perfil: tools/.tmp-cdp-A (persistente, sesión ya iniciada —
//   NO pide login). Las guías SÍ se sincronizan con la nube.
// - Idempotente: si una guía con el mismo nombre ya existe, la salta.
// - Subcategoría 'cocinar' del archivo de datos → 'especial' (la app
//   no tiene esa subcategoría; decisión de datos, no de código).
// Uso: node tools/flujo-guia-biblioteca.js [puerto] (9336)
// ============================================================
const fs = require('fs');
const path = require('path');
const port = Number(process.argv[2] || 9336);
const { SALSAS, ADOBOS } = require('./guias-biblioteca-data.js');
const SUB_MAP = { cocinar: 'especial' };

async function getTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch('http://127.0.0.1:' + port + '/json/list');
      const list = await res.json();
      const t = list.find(x => x.type === 'page' && x.webSocketDebuggerUrl);
      if (t) return t;
    } catch (e) { }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('No se encontró target CDP en el puerto ' + port);
}
function connect(url) {
  return new Promise((resolve) => {
    const ws = new WebSocket(url);
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
    new Promise(r => { resolver = r; }).then(() => resolve(ws));
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
let creadas = 0, saltadas = 0, fallidas = 0;

(async () => {
  const target = await getTarget();
  const ws = await connect(target.webSocketDebuggerUrl);
  const evalJs = async (expr) => {
    const r = await ws.sendJson('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('EVAL ERROR: ' + JSON.stringify(r.exceptionDetails).slice(0, 500));
    return r.result.value;
  };
  await ws.sendJson('Runtime.enable', {});
  await ws.sendJson('Page.enable', {});
  try { await ws.sendJson('Page.bringToFront', {}); } catch (e) { }

  // Pantalla de acceso (no debería aparecer: perfil persistente con sesión)
  for (let i = 0; i < 30; i++) {
    if (await evalJs(`!document.getElementById('loginScreen')`)) break;
    if (i === 29) throw new Error('Apareció la pantalla de acceso: la sesión del perfil A ya no es válida. Entra una vez y vuelve a correr.');
    await sleep(2000);
  }
  if (await evalJs(`!!document.getElementById('avisoSinCuentaBox')`)) { await evalJs(`document.querySelector('#avisoSinCuentaBox button').click()`); await sleep(500); }
  await evalJs(`window._rAFOriginal=requestAnimationFrame;window.requestAnimationFrame=null;openTab('🤖 Thermomix TM6');'ok'`);
  for (let i = 0; i < 20; i++) { if (await evalJs(`!!document.getElementById('misGuiasTM6Out')`)) break; await sleep(500); }

  const todas = [
    ...SALSAS.map(g => ({ ...g, cat: 'salsas', sub: SUB_MAP[g.sub] || g.sub })),
    ...ADOBOS.map(g => ({ ...g, cat: 'adobos', sub: SUB_MAP[g.sub] || g.sub }))
  ];
  console.log('por cargar: ' + todas.length + ' guías (salsas ' + SALSAS.length + ' + adobos ' + ADOBOS.length + ')');

  for (let idx = 0; idx < todas.length; idx++) {
    const g = todas[idx];
    const existe = await evalJs(`(state.misGuiasTM6||[]).some(x=>!x.deleted&&x.nombre===${JSON.stringify(g.nombre)})`);
    if (existe) { saltadas++; console.log('  salta (ya existe): ' + g.nombre); continue; }
    await evalJs(`guiaTM6Nueva();'ok'`);
    await sleep(400);
    const fill = `(()=>{
      document.getElementById('tm6gNombre').value=${JSON.stringify(g.nombre)};
      document.getElementById('tm6gTiempo').value='${g.tiempo}';
      document.getElementById('tm6gKcal').value='${g.kcal}';
      document.getElementById('tm6gCat').value='${g.cat}';tm6CatChange();
      document.getElementById('tm6gSub').value='${g.sub}';
      document.getElementById('tm6gPrep').value=${JSON.stringify(g.prep)};
      document.getElementById('tm6gIng').value=${JSON.stringify(g.ingredientes.join('\n'))};
      document.getElementById('tm6gAdv').value=${JSON.stringify(g.adv.join('\n'))};
      document.getElementById('tm6gConsejos').value=${JSON.stringify(g.consejos.join('\n'))};
      document.getElementById('tm6gErrores').value=${JSON.stringify(g.errores.join('\n'))};
      document.getElementById('tm6gVariantes').value=${JSON.stringify(g.variantes.join('\n'))};
      ${g.accs.map(a => `tm6AccToggle('${a}');`).join('')}
      return 'ok';
    })()`;
    await evalJs(fill);
    await sleep(300);
    for (let pi = 0; pi < g.pasos.length; pi++) {
      if (pi > 0) { await evalJs(`tm6PasoAgregar();'ok'`); await sleep(250); }
      const pf = `(()=>{
        document.getElementById('tm6gP_t_${pi}').value=${JSON.stringify(g.pasos[pi].t)};
        document.getElementById('tm6gP_r_${pi}').value=${JSON.stringify(g.pasos[pi].r)};
        return 'ok';
      })()`;
      await evalJs(pf);
    }
    await sleep(300);
    await evalJs(`guiaTM6Guardar();'ok'`);
    await sleep(900);
    const guardada = await evalJs(`(state.misGuiasTM6||[]).some(x=>!x.deleted&&x.nombre===${JSON.stringify(g.nombre)})`);
    if (!guardada) { fallidas++; console.log('  FALLÓ al guardar: ' + g.nombre); continue; }
    creadas++;
    console.log('  creada (' + (idx + 1) + '/' + todas.length + '): ' + g.nombre);
    // sincronizar por lotes (~cada 8) para no acumular un payload enorme
    if (creadas % 8 === 0) {
      try { await evalJs(`typeof syncNow==='function'?syncNow():0;'ok'`); } catch (e) { }
      for (let i = 0; i < 15; i++) {
        const b = await evalJs(`(()=>{const el=document.getElementById('syncBadge');return el?el.textContent:'';})()`);
        if (/Sincronizado/.test(b)) break;
        await sleep(2000);
      }
      console.log('  · lote sincronizado');
    }
  }

  // Sync final y verificación
  try { await evalJs(`typeof syncNow==='function'?syncNow():0;'ok'`); } catch (e) { }
  let sinc = false;
  for (let i = 0; i < 20; i++) {
    const b = await evalJs(`(()=>{const el=document.getElementById('syncBadge');return el?el.textContent:'';})()`);
    if (/Sincronizado/.test(b)) { sinc = true; break; }
    await sleep(2000);
  }
  const total = await evalJs(`(state.misGuiasTM6||[]).filter(x=>!x.deleted).length`);
  const dupes = await evalJs(`(()=>{const gs=(state.misGuiasTM6||[]).filter(x=>!x.deleted);const s=new Set();let d=0;gs.forEach(g=>{if(s.has(g.nombre))d++;s.add(g.nombre);});return d;})()`);
  console.log('\n=== creadas: ' + creadas + ' · saltadas: ' + saltadas + ' · fallidas: ' + fallidas + ' ===');
  console.log('total guías TM6 en el perfil: ' + total + ' · duplicados: ' + dupes + ' · sync: ' + (sinc ? 'Sincronizado ✓' : 'PENDIENTE'));
  try { await ws.sendJson('Browser.close', {}); } catch (e) { }
  setTimeout(() => process.exit(fallidas ? 1 : 0), 1500);
})().catch(e => { console.error('FALLA GENERAL', e.message); process.exit(2); });
