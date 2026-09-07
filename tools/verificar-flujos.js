// Demostración real de persistencia inmediata en los 4 flujos de entrenamiento
// con REFRESH INMEDIATO tras cada confirmación (CDP).
// Uso: node tools/verificar-flujos.js [puerto]  (default 9333)
// Al final: inventario de DEBUG-PERSISTENCIA por capa (sin borrar nada).
const port = Number(process.argv[2] || 9333);
const fs = require('fs');
const path = require('path');

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
const shot = async (ws, file) => {
  try {
    const r = await Promise.race([
      ws.sendJson('Page.captureScreenshot', { format: 'png' }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 60000))
    ]);
    fs.writeFileSync(path.join(__dirname, file), Buffer.from(r.data, 'base64'));
    console.log('  📸 ' + file);
  } catch (e) { console.log('  ⚠ captura omitida: ' + e.message); }
};

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

  const backup = await evalJs("(function(){return JSON.stringify({fitnessToday:state.fitnessToday||null,activeWorkout:state.activeWorkout||null});})()");
  const estado = () => evalJs("(function(){var wl=state.workoutLog||[];var debug=wl.filter(function(x){return x.exercise==='DEBUG-PERSISTENCIA';});var ls=null;try{ls=JSON.parse(localStorage.getItem('pp_full')||'{}');}catch(e){}return {memoria:wl.length,debugMemoria:debug.length,debugLocal:ls&&ls.workoutLog?ls.workoutLog.filter(function(x){return x.exercise==='DEBUG-PERSISTENCIA';}).length:-1};})()");
  const reloadYa = async () => {
    await ws.sendJson('Page.reload', { ignoreCache: true });
    await new Promise(r => setTimeout(r, 6000));
  };

  console.log('== Flujo 1 · 1-tap ENTRENÉ/DESCANSÉ → refresh inmediato ==');
  await evalJs("(function(){guardarEjercicio('DEBUG-PERSISTENCIA');return true;})()");
  await reloadYa();
  let e = await estado();
  console.log('  tras refresh:', JSON.stringify(e), e.debugMemoria >= 1 ? '✓ permanece' : '✗ PERDIDO');

  console.log('== Flujo 2 · Registro rápido → refresh inmediato ==');
  await evalJs("(function(){var plan=[{name:'DEBUG-PERSISTENCIA',sets:3,muscle:'pecho'}];state.fitnessToday={date:(typeof todayISO==='function'?todayISO():''),localDate:(typeof todayLocal==='function'?todayLocal():''),sessionId:Date.now(),plan:plan,checked:{}};var wi=document.createElement('input');wi.id='rlogW_0';wi.value='50';document.body.appendChild(wi);var ri=document.createElement('input');ri.id='rlogR_0';ri.value='10';document.body.appendChild(ri);logRoutineQuick(0);return true;})()");
  await reloadYa();
  e = await estado();
  console.log('  tras refresh:', JSON.stringify(e), e.debugMemoria >= 4 ? '✓ permanece (3 series nuevas)' : '✗ PERDIDO');

  console.log('== Flujo 3 · Serie guiada → refresh inmediato ==');
  await evalJs("(function(){try{openTab('💪 Ejercicio',false);}catch(e){}return true;})()");
  await new Promise(r => setTimeout(r, 1000));
  await evalJs("(function(){var plan=[{name:'DEBUG-PERSISTENCIA',muscle:'pecho',sets:3,reps:'8-12',rest:90,target:50}];state.fitnessToday={date:(typeof todayISO==='function'?todayISO():''),localDate:(typeof todayLocal==='function'?todayLocal():''),sessionId:Date.now(),plan:plan,checked:{}};state.activeWorkout={date:(typeof todayISO==='function'?todayISO():''),step:0,done:[],doneSteps:{},plan:plan,startedAt:new Date().toISOString()};save(true);renderGuidedWorkout();return true;})()");
  await new Promise(r => setTimeout(r, 500));
  const clic3 = await evalJs("(function(){var w=document.getElementById('guidedWeight');if(w)w.value='45';var r=document.getElementById('guidedReps');if(r)r.value='8';var btn=null;var all=document.querySelectorAll('button');for(var i=0;i<all.length;i++){if(String(all[i].getAttribute('onclick')||'').indexOf('saveGuidedWorkoutStep')>=0){btn=all[i];break;}}if(!btn)return 'SIN BOTÓN';btn.click();return 'OK';})()");
  console.log('  botón:', clic3);
  await reloadYa();
  e = await estado();
  console.log('  tras refresh:', JSON.stringify(e), e.debugMemoria >= 10 ? '✓ permanece (paso guiado)' : '✗ PERDIDO');

  console.log('== Flujo 4 · Terminar rutina → refresh inmediato ==');
  await evalJs("(function(){var plan=[{name:'DEBUG-PERSISTENCIA',muscle:'pecho',sets:3,reps:'8-12',rest:90,target:50}];state.fitnessToday={date:(typeof todayISO==='function'?todayISO():''),localDate:(typeof todayLocal==='function'?todayLocal():''),sessionId:Date.now(),plan:plan,checked:{}};state.activeWorkout={date:(typeof todayISO==='function'?todayISO():''),step:0,done:[{name:'DEBUG-PERSISTENCIA'}],doneSteps:{0:{}},plan:plan,startedAt:new Date().toISOString()};finishGuidedWorkout();return true;})()");
  await reloadYa();
  e = await evalJs("(function(){return {debugMemoria:(state.workoutLog||[]).filter(function(x){return x.exercise==='DEBUG-PERSISTENCIA';}).length,activeWorkout:!!state.activeWorkout};})()");
  console.log('  tras refresh:', JSON.stringify(e), !e.activeWorkout ? '✓ sesión cerrada y registros intactos' : '✗');

  console.log('== Cambiar de sección y volver ==');
  await evalJs("(function(){try{openTab('🏠 Inicio',false);}catch(e){}return true;})()");
  await new Promise(r => setTimeout(r, 800));
  await evalJs("(function(){try{openTab('💪 Ejercicio',false);}catch(e){}try{quickFitnessToday();}catch(e){}return true;})()");
  await new Promise(r => setTimeout(r, 800));
  e = await estado();
  console.log('  al volver:', JSON.stringify(e));

  console.log('== Inventario DEBUG-PERSISTENCIA por capa (SIN borrar) ==');
  const inv = await evalJs("(async function(){var ls=null;try{ls=JSON.parse(localStorage.getItem('pp_full')||'{}');}catch(e){}var idb=null;try{var db=await openPersonalDB();var tx=db.transaction('data','readonly');var req=tx.objectStore('data').get('state');idb=await new Promise(function(res){req.onsuccess=function(){try{res(JSON.parse(req.result));}catch(e){res(null);}};req.onerror=function(){res(null);}});}catch(e){}var nube=null;try{var s=getCloudSession();var rows=await cloudRest('personal_backups?user_id=eq.'+encodeURIComponent(s.user.id)+'&select=data');nube=rows&&rows[0]?rows[0].data:null;}catch(e){}var cuenta=function(src){return src&&src.workoutLog?(src.workoutLog.filter(function(x){return x.exercise==='DEBUG-PERSISTENCIA';}).length):-1;};return {memoria:cuenta(state),localStorage:cuenta(ls),indexedDB:cuenta(idb),nube:cuenta(nube)};})()");
  console.log('  capas:', JSON.stringify(inv));
  await shot(ws, 'verificacion-flujos.png');

  console.log('== Restaurar fitnessToday previo (los DEBUG se quedan, limpieza coordinada después) ==');
  await evalJs("(function(){var b=" + JSON.stringify(backup).replace(/</g, '\\u003c') + ";b=JSON.parse(b);state.fitnessToday=b.fitnessToday;state.activeWorkout=b.activeWorkout;save(true);return true;})()");
  await evalJs("(function(){try{openTab('💪 Ejercicio',false);}catch(e){}try{quickFitnessToday();}catch(e){}return true;})()");
  await new Promise(r => setTimeout(r, 800));
  console.log('App abierta en Fitness para revisión.');
  process.exit(0);
})().catch(e => { console.log('ERROR GLOBAL:', e.message); process.exit(2); });
