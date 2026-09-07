// Prueba CDP de la herramienta temporal DEBUG-PERSISTENCIA en el PC.
// Usa datos SIMULADOS: respalda state.workoutLog real, inyecta 3 reales
// simulados + 5 DEBUG, ejecuta el botón real, verifica y RESTAURA el
// respaldo. Uso: node tools/prueba-herramienta-debug.js [puerto]
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
  await ws.sendJson('Page.reload', { ignoreCache: true });
  await new Promise(r => setTimeout(r, 6000));

  console.log('== 1 · Oculta sin flag ==');
  const oculta = await evalJs("(function(){try{sessionStorage.removeItem('pp_debugpersistencia');}catch(e){}debugPersistenciaActivar();return {flag:!!window._debugPersistencia,panel:!!document.getElementById('debugPersistenciaHost')};})()");
  console.log('  sin flag:', JSON.stringify(oculta), (!oculta.flag && !oculta.panel) ? '✓ oculta' : '✗');

  console.log('== 2 · Activar con datos simulados ==');
  const r = await evalJs("(function(){window.__backupWl=JSON.stringify(state.workoutLog||[]);var sim=[];for(var i=1;i<=3;i++)sim.push({id:'SIM-REAL-'+i,exercise:'Simulado real '+i,weight:40+i,reps:'10',date:'2026-09-07',localDate:'2026-09-06'});for(var j=1;j<=5;j++)sim.push({id:'SIM-DEBUG-'+j,exercise:'DEBUG-PERSISTENCIA',weight:0,reps:'0',date:'2026-09-07',localDate:'2026-09-06'});sim.push({id:'SIM-VARIANTE',exercise:'DEBUG-PERSISTENCIA-extra'});state.workoutLog=sim;try{sessionStorage.setItem('pp_debugpersistencia','1');}catch(e){}debugPersistenciaActivar();var p=document.getElementById('debugPersistenciaHost');return {panel:!!p,texto:document.getElementById('debugPersistenciaN')?document.getElementById('debugPersistenciaN').textContent:'(sin)'};})()");
  console.log('  panel:', JSON.stringify(r), r.panel && /5 DEBUG · 4 workouts reales/.test(r.texto) ? '✓ conteos correctos' : '✗');

  console.log('== 3 · Botón real con confirmación ==');
  await evalJs("(function(){window.__confirmOrig=window.confirm;window.confirm=function(){return true;};return true;})()");
  await evalJs("(function(){var b=document.querySelector('#debugPersistenciaHost button');if(b)b.click();return true;})()");
  await new Promise(r => setTimeout(r, 800));
  const despues = await evalJs("(function(){var wl=state.workoutLog||[];var debug=wl.filter(function(x){return x.exercise==='DEBUG-PERSISTENCIA';}).length;var status=document.getElementById('debugPersistenciaStatus');return {total:wl.length,debug:debug,reales:wl.filter(function(x){return x.exercise!=='DEBUG-PERSISTENCIA';}).length,quedoVariante:wl.some(function(x){return x.exercise==='DEBUG-PERSISTENCIA-extra';}),status:status?status.textContent:''};})()");
  console.log('  tras click:', JSON.stringify(despues));
  console.log('  ', despues.debug === 0 && despues.reales === 4 && despues.quedoVariante ? '✓ filtro exacto correcto' : '✗');
  console.log('  ', /✔ DEBUG antes\/después: 5 → 0/.test(despues.status) ? '✓ mensaje con antes/después' : '✗');

  console.log('== 4 · Restaurar el estado real ==');
  await evalJs("(function(){if(window.confirm===undefined||window.__confirmOrig)window.confirm=window.__confirmOrig;state.workoutLog=JSON.parse(window.__backupWl);save(true);try{sessionStorage.removeItem('pp_debugpersistencia');}catch(e){}var h=document.getElementById('debugPersistenciaHost');if(h)h.remove();window._debugPersistencia=false;return true;})()");
  const rest = await evalJs("(function(){var wl=state.workoutLog||[];return {total:wl.length,debug:wl.filter(function(x){return x.exercise==='DEBUG-PERSISTENCIA';}).length,reales:wl.filter(function(x){return x.exercise!=='DEBUG-PERSISTENCIA';}).length};})()");
  console.log('  restaurado:', JSON.stringify(rest));
  console.log('  ', rest.total === 108 && rest.debug === 14 && rest.reales === 94 ? '✓ estado real intacto (108 · 14 DEBUG · 94 reales — pendiente de la limpieza coordinada)' : '✗ revisar');
  process.exit(0);
})().catch(e => { console.log('ERROR GLOBAL:', e.message); process.exit(2); });
