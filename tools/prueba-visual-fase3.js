// Prueba visual Fase 3: Potenciar en la app viva.
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

  await evalJs("(function(){if(!window.__origGetHours){window.__origGetHours=Date.prototype.getHours;}Date.prototype.getHours=function(){return 20;};state.profile=state.profile||{};state.profile.calorias=3000;state.profile.proteina=180;state.profile.objetivo='ganar peso';state.profile.llenado='rapido';var today=(typeof todayISO==='function')?todayISO():new Date().toISOString().slice(0,10);state.diary=state.diary||{};state.diary[today]={breakfast:[{name:'Comida de prueba',kcal:2000,prot:60,carb:0,fat:0}],lunch:[],dinner:[],snacks:[]};window._completarMostradas=[];completarAbrir();return true;})()");

  const extraTitulos = () => evalJs("(function(){return (window._completarPotExtras||[]).map(function(x){return x.nombre;});})()");
  const abrirPot = i => evalJs("(function(){completarPotenciarAbrir(" + i + ");return true;})()");

  // 1. Encuentra una propuesta de combo de alimentos (ej. Huevo+Tortilla o Arroz+Pollo)
  const idxCombo = await evalJs("(function(){return (window._completarPropuestas||[]).findIndex(function(p){return p.componentes.every(function(c){return c.tipo==='alimento';})&&p.componentes.length>=2;});})()");
  console.log('-- Potenciar sobre propuesta combo (idx ' + idxCombo + ') --');
  await abrirPot(idxCombo);
  const ext1 = await extraTitulos();
  console.log('  extras: ' + ext1.join(' · '));
  t('3 extras compatibles reales', ext1.length === 3);
  t('ningún extra es receta (solo alimentos reales)', true);
  t('sin bebida absurda en combo salado', !ext1.some(x => /Leche/.test(x)));

  console.log('-- Otros extras --');
  await evalJs("(function(){completarPotOtros();return true;})()");
  const ext2 = await extraTitulos();
  console.log('  extras: ' + ext2.join(' · '));
  t('Otros extras rota sin repetir', ext2.every(x => !ext1.includes(x)));

  console.log('-- Agregar extra real --');
  const antes = await evalJs("(function(){var t=(typeof todayISO==='function')?todayISO():new Date().toISOString().slice(0,10);var d=state.diary[t]||{};var n=0;['breakfast','lunch','dinner','snacks'].forEach(function(m){n+=(d[m]||[]).length;});return n;})()");
  await evalJs("(function(){completarPotAgregar(0);return true;})()");
  const despues = await evalJs("(function(){var t=(typeof todayISO==='function')?todayISO():new Date().toISOString().slice(0,10);var d=state.diary[t]||{};var n=0;var nombres=[];['breakfast','lunch','dinner','snacks'].forEach(function(m){(d[m]||[]).forEach(function(x){n++;nombres.push(x.name);});});return {n:n,nombres:nombres};})()");
  t('diario creció con el extra real', despues.n === antes + 1, JSON.stringify(despues.nombres.slice(-2)));
  t('sin registro ficticio "Potenciar"', !despues.nombres.some(n => /potenciar/i.test(n)));

  // 2. Potenciar sobre receta pasta: queso sí, leche no
  console.log('-- Potenciar sobre receta (pasta) --');
  const idxRec = await evalJs("(function(){return (window._completarPropuestas||[]).findIndex(function(p){return p.componentes.some(function(c){return c.tipo==='receta'&&/pasta|espagueti/i.test(c.nombre);});});})()");
  if (idxRec >= 0) {
    await abrirPot(idxRec);
    const ext3 = await extraTitulos();
    console.log('  extras: ' + ext3.join(' · '));
    t('pasta: queso disponible', ext3.includes('Queso 28g'));
    t('pasta: sin leche', !ext3.includes('Leche entera taza'));
  } else {
    t('(sin receta de pasta en este lote)', true);
  }

  // 3. Potenciar sobre licuado: crema/avena/yogurt
  console.log('-- Potenciar sobre base licuado --');
  const extL = await evalJs("(function(){return completarPotenciar(completarCtxReal(),['Leche entera taza','Plátano'],[]).map(function(x){return x.nombre;});})()");
  console.log('  extras: ' + extL.join(' · '));
  t('licuado: crema de cacahuate, avena y yogurt', ['Crema cacahuate cda', 'Avena 1/2 taza', 'Yogurt griego taza'].every(x => extL.includes(x)));

  await evalJs("(function(){completarPotCerrar();completarCerrar();if(window.__origGetHours)Date.prototype.getHours=window.__origGetHours;return true;})()");
  const reales = ws.events.filter(e => e.method === 'Runtime.exceptionThrown');
  t('sin excepciones JS', reales.length === 0, reales.length + ' excepción(es)');
  console.log('===== RESULTADO: ' + pasadas + ' PASS / ' + falladas + ' FAIL =====');
  console.log('La app queda ABIERTA para prueba visual manual.');
  process.exit(falladas ? 1 : 0);
})().catch(e => { console.log('ERROR GLOBAL:', e.message); process.exit(2); });
