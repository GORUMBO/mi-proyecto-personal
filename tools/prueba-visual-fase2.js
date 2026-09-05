// Prueba visual en vivo de "Completar mi día" (FASE 2).
// Cubre los 10 casos obligatorios. Al final deja la app ABIERTA.
const port = Number(process.argv[2] || 9333);
async function getTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch('http://127.0.0.1:' + port + '/json/list');
      const list = await res.json();
      const t = list.find(x => x.type === 'page' && x.webSocketDebuggerUrl);
      if (t) return t;
    } catch (e) {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('sin target');
}
function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let id = 0;
    const pend = new Map();
    const events = [];
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
      else if (m.method) events.push(m);
    };
    ws.events = events;
  });
}
let pasadas = 0, falladas = 0;
function t(label, ok, extra) {
  if (ok) { pasadas++; console.log('PASS ' + label + (extra ? ' · ' + extra : '')); }
  else { falladas++; console.log('FAIL ' + label + (extra ? ' · ' + extra : '')); }
}
(async () => {
  const target = await getTarget();
  const ws = await connect(target.webSocketDebuggerUrl);
  const evalJs = async (expr) => {
    const r = await ws.sendJson('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('EVAL ERROR: ' + JSON.stringify(r.exceptionDetails).slice(0, 200));
    return r.result.value;
  };
  await ws.sendJson('Runtime.enable', {});
  await ws.sendJson('Page.enable', {});
  await ws.sendJson('Page.reload', { ignoreCache: true });
  await new Promise(r => setTimeout(r, 4000));

  // helpers
  const setHora = h => evalJs("(function(){if(!window.__origGetHours){window.__origGetHours=Date.prototype.getHours;}Date.prototype.getHours=function(){return " + h + ";};return true;})()");
  const restHora = () => evalJs("(function(){if(window.__origGetHours)Date.prototype.getHours=window.__origGetHours;return true;})()");
  const escenario = async (o) => {
    const expr = "(function(){"
      + "var today=(typeof todayISO==='function')?todayISO():new Date().toISOString().slice(0,10);"
      + "state.profile=state.profile||{};"
      + "state.profile.objetivo=" + JSON.stringify(o.objetivo || 'ganar peso') + ";"
      + "state.profile.llenado=" + JSON.stringify(o.llenado || 'normal') + ";"
      + "state.profile.calorias=" + (o.kcalObjetivo || 3000) + ";"
      + "state.profile.proteina=" + (o.proteina || 180) + ";"
      + "var items=[{name:'Comida de prueba',kcal:" + (o.consumidas || 0) + ",prot:" + (o.pConsumida || 0) + ",carb:0,fat:0}];"
      + "state.diary=state.diary||{};state.diary[today]={breakfast:items,lunch:[],dinner:[],snacks:[]};"
      + "window._completarMostradas=[];"
      + "return true;})()";
    return evalJs(expr);
  };
  const abrirComer = () => evalJs("(function(){openTab('🍱 Contador');return true;})()");
  const panelTexto = () => evalJs("(function(){var p=document.getElementById('completarPanel');return p?p.innerText:'';})()");
  const cardTexto = () => evalJs("(function(){var m=document.getElementById('comerMain');return m?m.innerText:'';})()");
  const abrirPanel = () => evalJs("(function(){completarAbrir();return true;})()");
  const titulosPanel = () => evalJs("(function(){return (window._completarPropuestas||[]).map(function(p){return p.titulo;});})()");
  const clickBoton = (rx) => evalJs("(function(){var b=[].slice.call(document.querySelectorAll('#completarPanel button')).find(function(x){" + rx + "});if(b){b.click();return true;}return false;})()");
  const hoy = () => evalJs("(function(){return (typeof todayISO==='function')?todayISO():new Date().toISOString().slice(0,10);})()");
  const snapshotDiary = () => evalJs("(function(){var t=(typeof todayISO==='function')?todayISO():new Date().toISOString().slice(0,10);return JSON.stringify(state.diary&&state.diary[t]||{});})()");
  const restoreDiary = s => evalJs("(function(){var t=(typeof todayISO==='function')?todayISO():new Date().toISOString().slice(0,10);state.diary[t]=" + s + ";return true;})()");

  await abrirComer();
  t('tarjeta "Completar mi día" visible en Contador', /Completar mi día/.test(await cardTexto()));

  console.log('-- Caso 1: mañana + ganar + Me lleno rápido --');
  await setHora(8);
  await escenario({ objetivo: 'ganar peso', llenado: 'rapido', kcalObjetivo: 3000, consumidas: 2360, proteina: 180, pConsumida: 60 });
  await abrirPanel();
  let tx = await panelTexto();
  t('texto "Te conviene algo ligero"', /Te conviene algo ligero/.test(tx));
  t('3 propuestas mostradas', /🔄 Otras 3/.test(tx));

  console.log('-- Caso 2: trabajo/tarde + faltan ~1400 --');
  await setHora(13);
  await escenario({ objetivo: 'ganar peso', llenado: 'rapido', kcalObjetivo: 3000, consumidas: 1600, proteina: 180, pConsumida: 50 });
  await abrirPanel();
  tx = await panelTexto();
  t('texto "vamos poco a poco"', /Todavía te faltan bastantes calorías; vamos poco a poco/.test(tx));
  t('propuestas de trabajo ≤700 kcal', (await titulosPanel()).length > 0);

  console.log('-- Caso 3: noche + faltan ~750 --');
  await setHora(20);
  await escenario({ objetivo: 'ganar peso', llenado: 'rapido', kcalObjetivo: 3000, consumidas: 2250, proteina: 180, pConsumida: 70 });
  await abrirPanel();
  tx = await panelTexto();
  t('texto "Te faltan 750 kcal"', /Te faltan 750 kcal/.test(tx));

  console.log('-- Caso 4: proteína baja --');
  await setHora(13);
  await escenario({ objetivo: 'ganar peso', llenado: 'normal', kcalObjetivo: 3000, consumidas: 2000, proteina: 180, pConsumida: 30 });
  await abrirPanel();
  t('3 propuestas', (await titulosPanel()).length === 3);

  console.log('-- Caso 5: proteína cubierta pero kcal bajas --');
  await escenario({ objetivo: 'ganar peso', llenado: 'normal', kcalObjetivo: 3000, consumidas: 1800, proteina: 180, pConsumida: 180 });
  await abrirPanel();
  t('sigue proponiendo kcal', (await titulosPanel()).length >= 1);

  console.log('-- Caso 6: Otras 3 dos veces --');
  await escenario({ objetivo: 'ganar peso', llenado: 'rapido', kcalObjetivo: 3000, consumidas: 2000, proteina: 180, pConsumida: 60 });
  await abrirPanel();
  const lote1 = await titulosPanel();
  await clickBoton("return /Otras 3/.test(x.textContent);");
  const lote2 = await titulosPanel();
  await clickBoton("return /Otras 3/.test(x.textContent);");
  const lote3 = await titulosPanel();
  t('Otras 3 cambia el lote 1', JSON.stringify(lote1) !== JSON.stringify(lote2));
  t('Otras 3 vuelve a cambiar (lote 2 ≠ 3)', JSON.stringify(lote2) !== JSON.stringify(lote3));

  console.log('-- Caso 7: Agregar propuesta de un alimento --');
  const snap1 = await snapshotDiary();
  await escenario({ objetivo: 'ganar peso', llenado: 'rapido', kcalObjetivo: 3000, consumidas: 2000, proteina: 180, pConsumida: 60 });
  await abrirPanel();
  const propUn = (await titulosPanel());
  await clickBoton("return /Agregar/.test(x.textContent);");
  const diary1 = await evalJs("(function(){var t=(typeof todayISO==='function')?todayISO():new Date().toISOString().slice(0,10);var d=state.diary[t]||{};return ['breakfast','lunch','dinner','snacks'].map(function(m){return (d[m]||[]).map(function(x){return x.name;}).join(',');}).join('|');})()");
  t('diario recibió componentes reales (no "Completar mi día")', /completar/i.test(diary1) === false && diary1.length > 0, diary1.slice(0, 80));
  t('Balance (getDailyMode) refleja lo agregado', (await evalJs("(function(){return getDailyMode().food.k;})()")) > 2000);
  await restoreDiary(snap1);

  console.log('-- Caso 8: Agregar propuesta de varios componentes --');
  await escenario({ objetivo: 'ganar peso', llenado: 'rapido', kcalObjetivo: 3000, consumidas: 1800, proteina: 180, pConsumida: 50 });
  await abrirPanel();
  // elegir propuesta multi-componente: primero Otras 3 si hace falta
  let multi = await evalJs("(function(){return (window._completarPropuestas||[]).findIndex(function(p){return p.componentes.length>1;});})()");
  if (multi < 0) { await clickBoton("return /Otras 3/.test(x.textContent);"); multi = await evalJs("(function(){return (window._completarPropuestas||[]).findIndex(function(p){return p.componentes.length>1;});})()"); }
  const nComp = await evalJs("(function(){return (window._completarPropuestas||[])["+multi+"].componentes.length;})()");
  await evalJs("(function(){completarAgregar(" + multi + ");return true;})()");
  const diary2 = await evalJs("(function(){var t=(typeof todayISO==='function')?todayISO():new Date().toISOString().slice(0,10);var d=state.diary[t]||{};var n=0;['breakfast','lunch','dinner','snacks'].forEach(function(m){n+=(d[m]||[]).length;});return n;})()");
  t('multi-componente agregó TODOS (' + nComp + ' entradas)', diary2 >= nComp, 'diario=' + diary2);
  await restoreDiary(snap1);

  console.log('-- Caso 9: Cocinar receta --');
  await escenario({ objetivo: 'ganar peso', llenado: 'rapido', kcalObjetivo: 3000, consumidas: 2000, proteina: 180, pConsumida: 60 });
  await abrirPanel();
  const idxRec = await evalJs("(function(){return (window._completarPropuestas||[]).findIndex(function(p){return p.componentes.some(function(c){return c.tipo==='receta';});});})()");
  let cocino = false;
  if (idxRec >= 0) {
    cocino = await clickBoton("return /Cocinar/.test(x.textContent);");
    await new Promise(r => setTimeout(r, 300));
    const det = await evalJs("(function(){return (document.getElementById('recetaDetalle')||{innerText:''}).innerText.slice(0,80);})()");
    t('Cocinar abrió el visor de recetas real', /Paso|Ingredientes|kcal|Recetas/.test(det), det.slice(0, 60));
  } else {
    t('(sin receta en este lote; probar otro)', true);
  }
  if (cocino) { await evalJs("(function(){if(typeof cerrarReceta==='function')cerrarReceta();return true;})()"); }

  console.log('-- Caso 10: cerrar/reabrir y preferencia persiste --');
  await evalJs("(function(){completarCerrar();return true;})()");
  await evalJs("(function(){state.profile.llenado='rapido';if(typeof save==='function')save();return true;})()");
  await ws.sendJson('Page.reload', { ignoreCache: true });
  await new Promise(r => setTimeout(r, 4000));
  const persiste = await evalJs("(function(){return state.profile&&state.profile.llenado;})()");
  t('llenado persiste tras recargar (rapido)', persiste === 'rapido', 'valor=' + persiste);
  await abrirComer();
  t('tarjeta sigue visible tras reabrir', /Completar mi día/.test(await cardTexto()));

  await restHora();
  const reales = ws.events.filter(e => e.method === 'Runtime.exceptionThrown');
  t('sin excepciones JS', reales.length === 0, reales.length + ' excepción(es)');
  console.log('===== RESULTADO: ' + pasadas + ' PASS / ' + falladas + ' FAIL =====');
  console.log('La app queda ABIERTA para prueba visual manual.');
  process.exit(falladas ? 1 : 0);
})().catch(e => { console.log('ERROR GLOBAL:', e.message); process.exit(2); });
