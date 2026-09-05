// Prueba visual Fase 2.2: calibración por franja con contexto real
// (objetivo 3000, comido 2000, Me lleno rápido).
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
  await new Promise(r => setTimeout(r, 4500));

  const setHora = h => evalJs("(function(){if(!window.__origGetHours){window.__origGetHours=Date.prototype.getHours;}Date.prototype.getHours=function(){return " + h + ";};return true;})()");
  const restHora = () => evalJs("(function(){if(window.__origGetHours)Date.prototype.getHours=window.__origGetHours;return true;})()");
  const mostrar = async (label) => {
    await evalJs("(function(){window._completarMostradas=[];completarAbrir();return true;})()");
    const props = await evalJs("(function(){return (window._completarPropuestas||[]).map(function(p){return {t:p.titulo,s:p.sub,k:p.kcal,tiempo:p.tiempo,vol:p.volumen,raz:(p.razones||[]).join(','),comps:p.componentes.map(function(c){return c.nombre;})};});})()");
    console.log('■ ' + label);
    props.forEach((p, i) => console.log('  ' + (i + 1) + '. ' + p.t + (p.s ? ' — ' + p.s : '') + ' (' + p.k + ' kcal · ' + p.tiempo + ' min · Vol ' + p.vol + ')'));
    return props;
  };

  await evalJs("(function(){state.profile=state.profile||{};state.profile.calorias=3000;state.profile.proteina=180;state.profile.objetivo='ganar peso';state.profile.llenado='rapido';var today=(typeof todayISO==='function')?todayISO():new Date().toISOString().slice(0,10);state.diary=state.diary||{};state.diary[today]={breakfast:[{name:'Comida de prueba',kcal:2000,prot:60,carb:0,fat:0}],lunch:[],dinner:[],snacks:[]};openTab('🍱 Contador');return true;})()");

  console.log('-- MAÑANA (hora 8) --');
  await setHora(8);
  const man = await mostrar('mañana');
  t('mañana: ≤600 y nada gigante', man.every(p => p.k <= 600), man.map(p => p.k).join('/'));
  console.log('-- TRABAJO (hora 13) --');
  await setHora(13);
  const tra = await mostrar('trabajo');
  t('trabajo: ≤600 y manejables', tra.every(p => p.k <= 600), tra.map(p => p.k).join('/'));
  t('trabajo: mensaje "vamos poco a poco"', /vamos poco a poco/.test(await evalJs("(function(){completarAbrir();var p=document.getElementById('completarPanel');return p?p.innerText:'';})()")));
  t('trabajo: diversidad ideal (≥2 categorías)', new Set(tra.map(p => p.comps.some(c => c === p.t) ? 'receta' : p.comps.length <= 2 && /leche|yogurt|platano|crema/i.test(p.comps.join(' ')) ? 'ligera' : 'combo')).size >= 2);
  console.log('-- NOCHE (hora 20) --');
  await setHora(20);
  const noc = await mostrar('noche');
  t('noche: permite comida completa ≥600', noc.some(p => p.k >= 600), noc.map(p => p.k).join('/'));
  await restHora();
  await evalJs("(function(){completarCerrar();return true;})()");
  const reales = ws.events.filter(e => e.method === 'Runtime.exceptionThrown');
  t('sin excepciones JS', reales.length === 0, reales.length + ' excepción(es)');
  console.log('===== RESULTADO: ' + pasadas + ' PASS / ' + falladas + ' FAIL =====');
  console.log('La app queda ABIERTA para prueba visual manual.');
  process.exit(falladas ? 1 : 0);
})().catch(e => { console.log('ERROR GLOBAL:', e.message); process.exit(2); });
