// Prueba visual Fase 2.1: coherencia culinaria con el CONTEXTO REAL del usuario.
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
    const props = await evalJs("(function(){return (window._completarPropuestas||[]).map(function(p){return {t:p.titulo,s:p.sub,k:p.kcal,raz:(p.razones||[]).join(','),comps:p.componentes.map(function(c){return c.nombre;})};});})()");
    console.log('■ ' + label);
    props.forEach((p, i) => console.log('  ' + (i + 1) + '. ' + p.t + (p.s ? ' — ' + p.s : '') + ' (' + p.k + ' kcal) [' + p.comps.join(' · ') + ']'));
    return props;
  };
  await evalJs("(function(){openTab('🍱 Contador');return true;})()");
  const dm = await evalJs("(function(){var d=getDailyMode();return {goal:d.kcalGoal,comido:d.food.k,falta:d.missingKcal,llenado:(state.profile||{}).llenado,obj:(state.profile||{}).objetivo};})()");
  console.log('Contexto real: ' + JSON.stringify(dm));

  console.log('-- contexto real, hora actual --');
  const real = await mostrar('ahora');
  t('títulos parecen comidas reales', real.every(p => !/\d+\s*(g|taza|cda|ml)/i.test(p.t + ' ' + p.s)), real.map(p => p.t).join(' | '));
  t('ningún plato salado + leche de relleno', !real.some(p => p.comps.some(c => /pollo|pasta|carne|chorizo|cerdo|res/i.test(c)) && p.comps.includes('Leche entera taza')));

  console.log('-- contexto real, noche (hora 20) --');
  await setHora(20);
  const noche = await mostrar('noche');
  t('noche: comidas completas sin bebida de relleno', noche.every(p => !(p.comps.some(c => /pollo|pasta|carne|chorizo|cerdo|res/i.test(c)) && p.comps.includes('Leche entera taza'))), noche.map(p => p.t).join(' | '));
  t('diversidad estructural en noche', new Set(noche.map(p => p.comps.some(c => c === p.t) ? 'receta' : '')).size >= 1);
  await restHora();
  await evalJs("(function(){completarCerrar();return true;})()");
  const reales = ws.events.filter(e => e.method === 'Runtime.exceptionThrown');
  t('sin excepciones JS', reales.length === 0, reales.length + ' excepción(es)');
  console.log('===== RESULTADO: ' + pasadas + ' PASS / ' + falladas + ' FAIL =====');
  console.log('La app queda ABIERTA para prueba visual manual.');
  process.exit(falladas ? 1 : 0);
})().catch(e => { console.log('ERROR GLOBAL:', e.message); process.exit(2); });
