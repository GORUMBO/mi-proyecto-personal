// Prueba E2E del Modo rápido de Fitness (iPhone) + persistencia, en DOS fases
// con el MISMO perfil: fase 1 entrena y configura; fase 2 reabre y verifica.
// Uso: node tools/prueba-fitness-rapido.js [puerto] [dirPerfilOpcional] [PP_APP_DIR]
const { spawn } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const wait = ms => new Promise(r => setTimeout(r, ms));
const port = Number(process.argv[2] || 9356);
const rootReal = path.resolve(__dirname, '..');
const appDir = process.env.PP_APP_DIR || rootReal;
const profile = process.argv[3] || fs.mkdtempSync(path.join(os.tmpdir(), 'pp-fr-'));
const exe = path.join(rootReal, 'node_modules', 'electron', 'dist', 'electron.exe');
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

let pasadas = 0, falladas = 0;
function t(label, ok, extra) {
  if (ok) { pasadas++; console.log('PASS ' + label + (extra ? ' · ' + extra : '')); }
  else { falladas++; console.log('FAIL ' + label + (extra ? ' · ' + extra : '')); }
}
function conectar(ws) {
  return new Promise((resolve, reject) => {
    let id = 0; const pend = new Map(); const consola = [];
    ws.onopen = () => { ws.sj = (m, pa) => new Promise((r2, j2) => { const mid = ++id; pend.set(mid, { r2, j2 }); ws.send(JSON.stringify({ id: mid, method: m, params: pa || {} })); }); resolve(ws); };
    ws.onerror = reject;
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.id && pend.has(m.id)) { const q = pend.get(m.id); pend.delete(m.id); m.error ? q.j2(new Error(JSON.stringify(m.error))) : q.r2(m); }
      else if (m.method === 'Runtime.consoleAPICalled') { try { consola.push(m.params.args.map(a => (a.value !== undefined ? a.value : (a.description || a.type))).join(' ')); } catch (e2) {} }
      else if (m.method === 'Runtime.exceptionThrown') { try { consola.push('EXCEPCIÓN: ' + (m.params.exceptionDetails.exception ? m.params.exceptionDetails.exception.description : m.params.exceptionDetails.text)); } catch (e2) {} }
    };
    ws.consola = consola;
  });
}
async function lanzar() {
  const child = spawn(exe, [appDir, '--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--disable-gpu'], { stdio: 'ignore' });
  let target = null;
  for (let i = 0; i < 90; i++) {
    try { const r = await fetch('http://127.0.0.1:' + port + '/json/list'); const l = await r.json(); target = l.find(x => x.type === 'page' && x.webSocketDebuggerUrl); if (target) break; } catch (e) {}
    await wait(500);
  }
  if (!target) { try { child.kill(); } catch (e) {} throw new Error('sin target CDP'); }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await conectar(ws);
  await ws.sj('Runtime.enable', {});
  await ws.sj('Network.enable', {});
  await ws.sj('Network.setUserAgentOverride', { userAgent: UA });
  await ws.sj('Emulation.setDeviceMetricsOverride', { width: 393, height: 844, deviceScaleFactor: 3, mobile: true, screenWidth: 393, screenHeight: 844 });
  await ws.sj('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  const ev = async e => {
    const m = await ws.sj('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
    if (m.result && m.result.exceptionDetails) return 'EXC:' + (m.result.exceptionDetails.exception ? m.result.exceptionDetails.exception.description : m.result.exceptionDetails.text);
    return m.result && m.result.result ? m.result.result.value : undefined;
  };
  let listo = false;
  for (let i = 0; i < 60; i++) { await wait(750); const r = await ev("!!(document.getElementById('edgeDrawer')&&document.getElementById('mobileNavBar'))"); if (r === true) { listo = true; break; } }
  if (!listo) console.log('AVISO: arranque lento');
  await ev("state.onboarded=true;['loginScreen','onboardingModal','avisoSinCuentaBox','appTutorial','appUpdateBanner'].forEach(id=>{var el=document.getElementById(id);if(el)el.remove();});1");
  return { child, ws, ev };
}
async function cerrarGracioso(ws, child) {
  try { await ws.sj('Runtime.evaluate', { expression: "try{save(true);}catch(e){}" }); } catch (e) {}
  await wait(800);
  try { await ws.sj('Runtime.evaluate', { expression: "window.close()" }); } catch (e) {}
  for (let i = 0; i < 20; i++) { await wait(500); if (child.exitCode !== null) return; }
  try { child.kill(); } catch (e) {}
  await wait(500);
}
const SEMILLA = `(function(){
  var hoy=(typeof todayISO==='function')?todayISO():new Date().toISOString().slice(0,10);
  state.fitnessToday={date:hoy,ctx:{},adaptedOnlyToday:false,oneOff:false,plan:[
    {name:'Press plano con mancuernas',muscle:'pecho',sets:3,reps:'8-12',rest:90},
    {name:'Peso muerto rumano',muscle:'femoral',sets:3,reps:'8-12',rest:100},
    {name:'Lagartijas (push ups)',muscle:'pecho',sets:2,reps:'10-15',rest:60},
    {name:'Plancha',muscle:'core',sets:2,reps:'30-45s',rest:60}
  ],checked:{},checkedDate:hoy,estado:{},sessionId:Date.now()};
  save(true);
  return 'ok';
})()`;
async function registrarSerie(ev, idx, w, r) {
  await ev(`(()=>{var a=document.getElementById('rlogW_${idx}');var b=document.getElementById('rlogR_${idx}');if(a)a.value='${w}';if(b)b.value='${r}';return 1;})()`);
  await ev(`f3RegistrarSerieActual(${idx})`);
  await wait(700);
}

async function fase1() {
  console.log('===== FASE 1 · entrenar en Modo rápido =====');
  const { child, ws, ev } = await lanzar();
  await ev(SEMILLA);
  await ev(`openTab('💪 Ejercicio')`); await wait(1500);
  // 1 · Entrada directa
  const entrada = await ev(`(()=>{
    var bar=document.getElementById('f3ModoBar');
    var hoy=document.getElementById('fitHoyCard'),grid=document.querySelector('.fit5-grid');
    var hr=hoy?hoy.getBoundingClientRect():null,gr=grid?grid.getBoundingClientRect():null;
    var card=document.querySelector('.fit-card-ej-rapida');
    return {modo:state.uiSettings&&state.uiSettings.fitModoVista,bar:!!bar,rapida:!!card,hoyAntesQueGrid:hr&&gr?hr.top<=gr.top:null,pos:card?card.textContent.indexOf('Ejercicio 1 de 4')>=0:false,cardCount:document.querySelectorAll('#f3RapidaCardWrap .fit-card-ej').length};
  })()`);
  t('1a · Fitness abre directo en la rutina (tarjeta antes que el héroe)', entrada.rapida === true && entrada.hoyAntesQueGrid === true, JSON.stringify(entrada));
  t('1b · Modo rápido predeterminado en iPhone + selector visible', entrada.modo === 'rapido' && entrada.bar === true, 'modo=' + entrada.modo);
  t('1c · Un solo ejercicio a la vez ("Ejercicio 1 de 4")', entrada.pos === true && entrada.cardCount === 1, 'cards=' + entrada.cardCount);
  // 2 · Cambiar entre modos
  await ev(`f3ModoVistaSet('info')`); await wait(1000);
  const info = await ev(`(()=>({cards:document.querySelectorAll('#f3RapidaCardWrap .fit-card-ej').length,rapida:!!document.querySelector('.fit-card-ej-rapida')}))()`);
  t('2 · Modo informativo = lista completa (4), volver a rápido = 1 y persiste', info.cards === 4 && info.rapida === false, JSON.stringify(info));
  await ev(`f3ModoVistaSet('rapido')`); await wait(1000);
  const vuelta = await ev(`(()=>({cards:document.querySelectorAll('#f3RapidaCardWrap .fit-card-ej').length,modo:state.uiSettings.fitModoVista}))()`);
  t('2b · volver a rápido: 1 tarjeta y modo persistido', vuelta.cards === 1 && vuelta.modo === 'rapido', JSON.stringify(vuelta));
  // 3 · Tres series con pesos y reps DIFERENTES (una a una)
  await registrarSerie(ev, 0, 20, 10);
  await registrarSerie(ev, 0, 22, 10);
  await registrarSerie(ev, 0, 25, 8);
  const series = await ev(`(()=>{
    var pack=state.fitnessToday;var x=pack.plan[0];
    var logs=(state.workoutLog||[]).filter(function(r){return r.sessionId===pack.sessionId&&r.exercise===x.name&&!r.deleted;});
    var card=document.querySelector('.fit-card-ej-rapida');
    return {n:logs.length,pesos:logs.map(function(r){return r.weight}).join(','),reps:logs.map(function(r){return r.reps}).join(','),circs:card?card.querySelectorAll('.fit-circle.ok').length:0,chips:card?card.textContent.indexOf('20 lb × 10')>=0&&card.textContent.indexOf('25 lb × 8')>=0:false};
  })()`);
  t('3 · 3 series distintas (20/22/25 × 10/10/8) y rueditas ✓', series.n === 3 && series.pesos === '20,22,25' && series.reps === '10,10,8' && series.circs === 3 && series.chips === true, JSON.stringify(series));
  // borrador: escribir sin registrar, irse y volver → conservado
  await ev(`(()=>{var a=document.getElementById('rlogW_0');if(a){a.value='30';a.dispatchEvent(new Event('input',{bubbles:true}));}return 1;})()`);
  await ev(`f3RapidoMover(1)`); await wait(900);
  const ej2 = await ev(`(()=>{var card=document.querySelector('.fit-card-ej-rapida');return {pos:card?card.textContent.indexOf('Ejercicio 2 de 4')>=0:false,eq:card?card.textContent.indexOf('Barra · peso total (barra + discos)')>=0:false};})()`);
  t('4a · Siguiente → Ejercicio 2 con equipo "Barra · peso total"', ej2.pos === true && ej2.eq === true, JSON.stringify(ej2));
  await ev(`f3RapidoMover(-1)`); await wait(900);
  const borrador = await ev(`(()=>{var a=document.getElementById('rlogW_0');return {w:a?a.value:'',pos:document.querySelector('.fit-card-ej-rapida')?document.querySelector('.fit-card-ej-rapida').textContent.indexOf('Ejercicio 1 de 4')>=0:false};})()`);
  t('4b · regresar conserva series y el peso tecleado sin registrar', borrador.pos === true && borrador.w === '30', JSON.stringify(borrador));
  // 4c · peso corporal (lagartijas): registrar con 0 funciona, 2 series
  await ev(`f3RapidoMover(2)`); await wait(900);
  await registrarSerie(ev, 2, 0, 12);
  await registrarSerie(ev, 2, 0, 12);
  const pc = await ev(`(()=>{var pack=state.fitnessToday;var logs=(state.workoutLog||[]).filter(function(r){return r.sessionId===pack.sessionId&&r.exercise==='Lagartijas (push ups)'&&!r.deleted;});return {n:logs.length,w:logs[0]?logs[0].weight:null,nota:logs[0]?logs[0].note:''};})()`);
  t('4c · peso corporal: peso 0 válido (2 series, nota Peso corporal)', pc.n === 2 && pc.w === 0 && pc.nota.indexOf('Peso corporal') >= 0, JSON.stringify(pc));
  // 4d · último ejercicio: Finalizar rutina
  await ev(`f3RapidoMover(1)`); await wait(900);
  const ej4 = await ev(`(()=>{var card=document.querySelector('.fit-card-ej-rapida');var btns=[...document.querySelectorAll('.fit-rapida-nav button')].map(function(b){return b.textContent;});return {pos:card?card.textContent.indexOf('Ejercicio 4 de 4')>=0:false,eq:card?card.textContent.indexOf('Peso corporal')>=0:false,fin:btns.some(function(x){return x.indexOf('Finalizar rutina')>=0;})};})()`);
  t('4d · último: "🏁 Finalizar rutina" en lugar de Siguiente', ej4.pos === true && ej4.fin === true, JSON.stringify(ej4));
  // 4e · volver al ejercicio 1: todo conservado
  await ev(`f3RapidoMover(-3)`); await wait(900);
  const regreso = await ev(`(()=>{var card=document.querySelector('.fit-card-ej-rapida');return {pos:card?card.textContent.indexOf('Ejercicio 1 de 4')>=0:false,circs:card?card.querySelectorAll('.fit-circle.ok').length:0,chips:card?card.textContent.indexOf('20 lb × 10')>=0:false};})()`);
  t('4e · volver al ejercicio 1 conserva series y progreso', regreso.pos === true && regreso.circs === 3 && regreso.chips === true, JSON.stringify(regreso));
  // 5 · sin duplicados
  const antes = await ev(`(state.workoutLog||[]).filter(function(r){return r.sessionId===state.fitnessToday.sessionId&&!r.deleted;}).length`);
  await ev(`f3RegistrarSerieActual(0)`); await wait(700);
  const despues = await ev(`(state.workoutLog||[]).filter(function(r){return r.sessionId===state.fitnessToday.sessionId&&!r.deleted;}).length`);
  t('5 · repetir "Registrar serie" con el ejercicio completo NO duplica', despues === antes, 'antes=' + antes + ' después=' + despues);
  // 6 · cambiar ejercicio no sube la pantalla
  await ev(`window.scrollTo(0,300);`); await wait(300);
  const y1 = await ev(`Math.round(window.scrollY)`);
  await ev(`f3CambiarEjercicio(0,true)`); await wait(400);
  const y2 = await ev(`Math.round(window.scrollY)`);
  t('6 · abrir "Cambiar ejercicio" no mueve la pantalla', y1 === y2, 'y=' + y1 + '→' + y2);
  // 7 · barra inferior no tapa controles
  await ev(`window.scrollTo(0,document.documentElement.scrollHeight);`); await wait(500);
  const barra = await ev(`(()=>{var bar=document.getElementById('mobileNavBar');var nav=document.querySelector('.fit-rapida-nav');if(!bar||!nav)return null;var br=bar.getBoundingClientRect(),nr=nav.getBoundingClientRect();return {navBottom:Math.round(nr.bottom),barTop:Math.round(br.top),tapa:nr.bottom>br.top+2};})()`);
  t('7 · la barra inferior no tapa Anterior/Siguiente', barra && barra.tapa === false, JSON.stringify(barra));
  // 8 · equipo visible también en informativo
  await ev(`f3ModoVistaSet('info')`); await wait(900);
  const eqInfo = await ev(`(()=>{var cards=[...document.querySelectorAll('#f3RapidaCardWrap .fit-card-ej')].map(function(c){return c.textContent.indexOf('Equipo: Mancuernas')>=0||c.textContent.indexOf('Equipo: Barra')>=0||c.textContent.indexOf('Equipo: Peso corporal')>=0;}).filter(Boolean).length;return cards;})()`);
  t('8 · Modo informativo muestra el equipo de cada ejercicio', eqInfo >= 3, 'con equipo=' + eqInfo);
  await ev(`f3ModoVistaSet('rapido')`); await wait(800);
  // 9 · sin conexión: registrar en el ejercicio 2
  await ev(`f3RapidoMover(1)`); await wait(900);
  await ws.sj('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await registrarSerie(ev, 1, 100, 8);
  const offline = await ev(`(()=>{var pack=state.fitnessToday;var logs=(state.workoutLog||[]).filter(function(r){return r.sessionId===pack.sessionId&&r.exercise==='Peso muerto rumano'&&!r.deleted;});return {n:logs.length};})()`);
  t('9 · sin conexión: registrar serie funciona', offline.n === 1, JSON.stringify(offline));
  await ws.sj('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await cerrarGracioso(ws, child);
  console.log('   app cerrada; perfil: ' + profile);
}

async function fase2() {
  console.log('===== FASE 2 · reabrir y verificar persistencia =====');
  const { child, ws, ev } = await lanzar();
  await ev(`openTab('💪 Ejercicio')`); await wait(1500);
  const pers = await ev(`(()=>{
    var card=document.querySelector('.fit-card-ej-rapida');
    var pack=state.fitnessToday;
    var logs=(state.workoutLog||[]).filter(function(r){return pack&&r.sessionId===pack.sessionId&&!r.deleted;});
    return {modo:state.uiSettings.fitModoVista,rapida:!!card,pos2:card?card.textContent.indexOf('Ejercicio 2 de 4')>=0:false,circs:card?card.querySelectorAll('.fit-circle.ok').length:0,logs:logs.length};
  })()`);
  t('10 · reabrir: modo rápido, índice conservado (ej. 2) y series intactas', pers.modo === 'rapido' && pers.rapida === true && pers.pos2 === true && pers.circs === 1 && pers.logs === 6, JSON.stringify(pers));
  await ws.sj('Page.reload', { ignoreCache: true });
  let listo = false;
  for (let i = 0; i < 60; i++) { await wait(750); const r = await ev("!!(document.getElementById('edgeDrawer')&&document.getElementById('mobileNavBar'))"); if (r === true) { listo = true; break; } }
  await ev("state.onboarded=true;['loginScreen','onboardingModal','avisoSinCuentaBox','appTutorial','appUpdateBanner'].forEach(id=>{var el=document.getElementById(id);if(el)el.remove();});1");
  await ev(`openTab('💪 Ejercicio')`); await wait(1500);
  const tras = await ev(`(()=>{var pack=state.fitnessToday;var logs=(state.workoutLog||[]).filter(function(r){return pack&&r.sessionId===pack.sessionId&&r.exercise==='Press plano con mancuernas'&&!r.deleted;});var card=document.querySelector('.fit-card-ej-rapida');return {logs:logs.length,modo:state.uiSettings.fitModoVista,rapida:!!card};})()`);
  t('11 · tras recargar: sin duplicados y modo conservado', tras.logs === 3 && tras.modo === 'rapido' && tras.rapida === true, JSON.stringify(tras));
  const fatales = ws.consola.filter(c => /EXCEPCIÓN:/.test(c));
  t('12 · sin excepciones de JavaScript en el flujo', fatales.length === 0, fatales.slice(0, 2).join(' | ').slice(0, 200));
  await cerrarGracioso(ws, child);
}

(async () => {
  await fase1();
  await wait(2000);
  await fase2();
  console.log('\n======== RESULTADO: ' + pasadas + ' PASS · ' + falladas + ' FAIL ========');
  process.exit(falladas ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(2); });
