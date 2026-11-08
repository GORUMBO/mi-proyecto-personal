// ============================================================
// Revisión de las 6 guías muestra (3 salsas + 3 adobos) en la
// app real: abre cada una, verifica contenido completo y
// parámetros TM6 técnicamente razonables, captura cada detalle.
// Uso: node tools/flujo-revision-muestras.js [puerto] (9336)
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
let pasadas = 0, falladas = 0;
function t(label, ok, extra) {
  if (ok) { pasadas++; console.log('PASS ' + label + (extra ? ' · ' + extra : '')); }
  else { falladas++; console.log('FAIL ' + label + (extra ? ' · ' + extra : '')); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

const NOMBRES = ['Salsa roja molcajeteada', 'Salsa verde molcajeteada', 'Salsa de chile de árbol',
  'Adobo para tacos al pastor', 'Adobo para birria de res', 'Adobo de guajillo tradicional'];

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

  await evalJs(`window._rAFOriginal=requestAnimationFrame;window.requestAnimationFrame=null;openTab('🤖 Thermomix TM6');'ok'`);
  for (let i = 0; i < 20; i++) { if (await evalJs(`!!document.getElementById('misGuiasTM6Out')`)) break; await sleep(500); }

  // ---- Verificaciones globales de contenido ----
  const n = await evalJs(`(state.misGuiasTM6||[]).filter(x=>!x.deleted).length`);
  t('las 6 guías están en Mis guías TM6', n === 6, String(n));
  t('ninguna marcada verificada (todas pendientes de prueba)', await evalJs(`(state.misGuiasTM6||[]).filter(x=>!x.deleted).every(x=>x.verificado==='pendiente')`));
  t('todas con ingredientes pesados exactos', await evalJs(`(state.misGuiasTM6||[]).filter(x=>!x.deleted).every(x=>x.ingredientes.length>=6&&/\\d+ g|\\d+ ml/.test(x.ingredientes.join(' ')))`));
  t('todas con prep previa + advertencias + consejos + errores/soluciones + variantes', await evalJs(`(state.misGuiasTM6||[]).filter(x=>!x.deleted).every(x=>x.prepPrevia&&x.advertencias.length>=1&&x.consejos.length>=2&&x.erroresComunes.length>=2&&x.variantes.length>=1)`));
  t('todas con 6 pasos, resultado esperado en cada paso y método tradicional', await evalJs(`(state.misGuiasTM6||[]).filter(x=>!x.deleted).every(x=>x.pasos.length===6&&x.pasos.every(p=>p.r)&&x.pasos.some(p=>/tradicional/i.test(p.t)))`));

  // ---- Parámetros TM6 técnicamente razonables ----
  const razonable = await evalJs(`(()=>{
    const out=[];
    (state.misGuiasTM6||[]).filter(x=>!x.deleted).forEach(g=>{
      g.pasos.forEach(p=>{
        const txt=p.t||'';
        const vel=(txt.match(/vel\\s*(\\d+(?:-\\d+)?)/i)||[])[1];
        const temp=(txt.match(/(\\d{2,3})\\s*°?C/)||[])[1];
        const seg=(txt.match(/(\\d+)\\s*seg/i)||[])[1];
        const min=(txt.match(/(\\d+)\\s*min/i)||[])[1];
        if(vel){vel.split('-').forEach(v=>{if(+v<1||+v>10)out.push(g.nombre+': vel '+v+' fuera de rango');});}
        if(temp&&(+temp<37||+temp>120))out.push(g.nombre+': temp '+temp+' fuera de rango');
        if(seg&&+seg>120)out.push(g.nombre+': '+seg+' seg sospechoso');
        if(min&&+min>60)out.push(g.nombre+': '+min+' min sospechoso en un paso');
      });
    });
    return out;
  })()`);
  t('parámetros TM6 razonables (vel 1-10, temp 37-120°C, tiempos cortos)', razonable.length === 0, razonable.join(' | ') || 'todo en rango');
  const segur = await evalJs(`(()=>{const out=[];(state.misGuiasTM6||[]).filter(x=>!x.deleted).forEach(g=>{(g.consejos||[]).forEach(c=>{if(/74°C|71°C|85-90°C/.test(c)&&!/internos|interna/.test(c))out.push(g.nombre);});if(g.nombre.includes('adobo')||g.nombre.includes('Adobo')){if(!(g.consejos||[]).some(c=>/Marinado/.test(c)))out.push(g.nombre+': sin tiempo de marinado');}});return out;})()`);
  t('seguridad alimentaria coherente (74°C aves, 71°C cerdo, marinado en refri)', segur.length === 0, segur.join(' | ') || 'correcta');

  // ---- Abrir cada guía y capturar ----
  for (const nombre of NOMBRES) {
    await evalJs(`(()=>{const d=[...document.querySelectorAll('#misGuiasTM6Out details')].find(x=>x.textContent.includes(${JSON.stringify(nombre)}));if(d)d.open=true;else return 'NO';return 'ok';})()`);
    await sleep(500);
    const abierta = await evalJs(`(()=>{const d=[...document.querySelectorAll('#misGuiasTM6Out details')].find(x=>x.open&&x.textContent.includes(${JSON.stringify(nombre)}));return d?d.textContent:'';})()`);
    const ok = abierta.includes('Ingredientes') && abierta.includes('Pasos TM6') && abierta.includes('Resultado esperado') && abierta.includes('Pendiente de prueba');
    t('guía completa visible: ' + nombre, ok);
    const slug = nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/g, '');
    const shot = await ws.sendJson('Page.captureScreenshot', { format: 'png' });
    try { fs.writeFileSync(path.join(__dirname, 'pruebas', 'rev-' + slug + '.png'), Buffer.from(shot.data, 'base64')); } catch (e) { }
    await evalJs(`(()=>{const d=[...document.querySelectorAll('#misGuiasTM6Out details')].find(x=>x.open&&x.textContent.includes(${JSON.stringify(nombre)}));if(d)d.open=false;return 'ok';})()`);
    await sleep(300);
  }

  console.log('\n' + pasadas + ' pasadas · ' + falladas + ' falladas');
  console.log('Capturas: tools/pruebas/rev-*.png (una por guía abierta)');
  try { await ws.sendJson('Browser.close', {}); } catch (e) { }
  process.exit(falladas ? 1 : 0);
})().catch(e => { console.error('FALLA GENERAL', e.message); process.exit(2); });
