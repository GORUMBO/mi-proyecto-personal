// Verificación del arreglo de visibilidad de series: datos REALES del usuario
// + flujo guiado completo con refresh. Uso: node tools/verificar-fix-guiado.js [puerto]
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

  console.log('== 1 · Rutina de hoy con datos REALES: chips visibles tras refresh ==');
  await evalJs("(function(){try{openTab('💪 Ejercicio',false);}catch(e){}try{quickFitnessToday();}catch(e){}return true;})()");
  await new Promise(r => setTimeout(r, 1500));
  const uiReal = await evalJs("(function(){var out=document.getElementById('simpleFitnessOut');var html=(out&&out.innerHTML)||'';var m=/Series de hoy:[^<]*/.exec(html);return {chips:(html.match(/data-wlogid/g)||[]).length,pressBanca:html.indexOf('Press banca')>=0,seriesHoy:m?m[0]:'(sin)'};})()");
  console.log(JSON.stringify(uiReal, null, 1));

  console.log('== 2 · Flujo GUIADO completo: registrar → refresh inmediato → visible y persistido ==');
  const backup = await evalJs("(function(){return JSON.stringify({fitnessToday:state.fitnessToday||null,activeWorkout:state.activeWorkout||null});})()");
  const montar = () => evalJs("(function(){var plan=[{name:'DEBUG-PERSISTENCIA',muscle:'pecho',sets:3,reps:'8-12',rest:90,target:50}];state.fitnessToday={date:(typeof todayISO==='function'?todayISO():''),localDate:(typeof todayLocal==='function'?todayLocal():''),sessionId:Date.now(),ctx:{focus:'DEBUG',equip:'Gimnasio',hard:false,steps:0,energy:3,pain:0,sleep:7},plan:plan,createdAt:new Date().toISOString()};state.activeWorkout={date:(typeof todayISO==='function'?todayISO():''),step:0,done:[],doneSteps:{},plan:plan,startedAt:new Date().toISOString()};save(true);renderGuidedWorkout();return true;})()");
  const registrar = () => evalJs("(function(){var w=document.getElementById('guidedWeight');if(w)w.value='50';var r=document.getElementById('guidedReps');if(r)r.value='10';var btn=null;var all=document.querySelectorAll('button');for(var i=0;i<all.length;i++){if(String(all[i].getAttribute('onclick')||'').indexOf('saveGuidedWorkoutStep')>=0){btn=all[i];break;}}if(!btn)return 'SIN BOTÓN';btn.click();return 'OK';})()");
  await montar();
  await new Promise(r => setTimeout(r, 500));
  const clic = await registrar();
  console.log('botón real:', clic);
  const uiGuia = await evalJs("(function(){var aw=state.activeWorkout;return {guardados:aw?(aw.done||[]).length:-1};})()");
  console.log('UI guiada:', JSON.stringify(uiGuia));
  // refresh INMEDIATO tras registrar
  await ws.sendJson('Page.reload', { ignoreCache: true });
  await new Promise(r => setTimeout(r, 6000));
  const tras = await evalJs("(function(){var hoyL=(typeof todayLocal==='function'?todayLocal():'');var serie=(state.workoutLog||[]).filter(function(x){return x.exercise==='DEBUG-PERSISTENCIA';}).slice(-1)[0];var visible=(function(){var ft=state.fitnessToday;if(!ft)return false;var sidP=ft.sessionId||null;var hoyS=(state.workoutLog||[]).filter(function(x){return (x.localDate||x.date||'')===hoyL&&(+x.weight>0);});if(hoyS.some(function(x){return x.sessionId===sidP;}))return serie?serie.sessionId===sidP:false;var ult=hoyS.slice(-1)[0];return serie?serie.sessionId===ult.sessionId:false;})();return {seriePersistida:!!serie,serieId:serie?serie.id:'—',sessionId:serie?serie.sessionId:'—',visibleEnRutina:visible,enLocal:(function(){try{var ls=JSON.parse(localStorage.getItem('pp_full')||'{}');return !!(ls.workoutLog&&ls.workoutLog.some(function(x){return x.exercise==='DEBUG-PERSISTENCIA';}));}catch(e){return false;}})()};})()");
  console.log('tras refresh inmediato:', JSON.stringify(tras, null, 1));

  console.log('== 3 · Restaurar estado real y limpiar DEBUG ==');
  await evalJs("(function(){var b=" + JSON.stringify(backup).replace(/</g, '\\u003c') + ";b=JSON.parse(b);state.fitnessToday=b.fitnessToday;state.activeWorkout=b.activeWorkout;state.workoutLog=(state.workoutLog||[]).filter(function(x){return x.exercise!=='DEBUG-PERSISTENCIA';});save(true);return true;})()");
  await new Promise(r => setTimeout(r, 2000));
  const limpio = await evalJs("(function(){return {quedanDEBUG:(state.workoutLog||[]).filter(function(x){return x.exercise==='DEBUG-PERSISTENCIA';}).length,seriesRealesHoy:(state.workoutLog||[]).filter(function(x){return (x.localDate||x.date||'')===(typeof todayLocal==='function'?todayLocal():'')&&x.weight>0&&x.exercise!=='DEBUG-PERSISTENCIA';}).length};})()");
  console.log('estado limpio:', JSON.stringify(limpio));
  process.exit(0);
})().catch(e => { console.log('ERROR GLOBAL:', e.message); process.exit(2); });
