// Prueba CDP del GATE de arranque (?limpiadebugboot=1) en el PC con datos
// simulados: inyecta 6 DEBUG, activa el flag, recarga, verifica que el gate
// limpió ANTES del sync, muestra el banner y libera el sync; restaura al final.
// Uso: node tools/prueba-gate-boot.js [puerto]
const port = Number(process.argv[2] || 9333);

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
  throw new Error('sin target CDP');
}
function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let id = 0;
    const pend = new Map();
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
    };
  });
}

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

  console.log('== 1 · Inyectar 6 DEBUG simulados + activar flag del gate ==');
  await evalJs("(function(){window.__bk=JSON.stringify(state.workoutLog||[]);var sim=(state.workoutLog||[]).slice();for(var i=1;i<=6;i++)sim.push({id:'SIM-D-'+i,exercise:'DEBUG-PERSISTENCIA',weight:0,reps:'0',date:'2026-09-07',localDate:'2026-09-06'});state.workoutLog=sim;save(true);try{localStorage.setItem('pp_limpiadebugboot','1');}catch(e){}return true;})()");
  await new Promise(r => setTimeout(r, 800));

  console.log('== 2 · Recargar con el gate activo ==');
  await ws.sendJson('Page.reload', { ignoreCache: true });
  await new Promise(r => setTimeout(r, 6000));
  const r = await evalJs("(function(){var cuenta=function(wl){return {debug:wl.filter(function(x){return x.exercise==='DEBUG-PERSISTENCIA';}).length,reales:wl.filter(function(x){return x.exercise!=='DEBUG-PERSISTENCIA';}).length};};var ls=null;try{ls=JSON.parse(localStorage.getItem('pp_full')||'{}');}catch(e){}var texto=document.body.textContent||'';var m=texto.match(/DEBUG iPhone:[^\\n]*/);return {memoria:cuenta(state.workoutLog||[]),localStorage:cuenta(ls?ls.workoutLog:[]),bannerVisible:texto.indexOf('Limpieza de arranque')>=0,bannerTexto:m?m[0]:null,syncLiberado:!window._syncing};})()");
  console.log(JSON.stringify(r, null, 1));

  console.log('== 3 · Restaurar ==');
  await evalJs("(function(){state.workoutLog=JSON.parse(window.__bk);try{localStorage.removeItem('pp_limpiadebugboot');}catch(e){}save(true);return true;})()");
  await new Promise(r => setTimeout(r, 800));
  const rest = await evalJs("(function(){var cuenta=function(wl){return {debug:wl.filter(function(x){return x.exercise==='DEBUG-PERSISTENCIA';}).length,reales:wl.filter(function(x){return x.exercise!=='DEBUG-PERSISTENCIA';}).length};};return {memoria:cuenta(state.workoutLog||[]),flag:localStorage.getItem('pp_limpiadebugboot')};})()");
  console.log('restaurado:', JSON.stringify(rest));
  process.exit(0);
})().catch(e => { console.log('ERROR GLOBAL:', e.message); process.exit(2); });
