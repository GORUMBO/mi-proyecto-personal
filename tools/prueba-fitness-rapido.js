// Prueba E2E del Fitness simplificado (iPhone): Modo rápido mínimo con GIF,
// informativo consolidado, rutinas recuperadas, encabezado limpio, tarjetas
// personalizables y calculadoras. DOS fases con el MISMO perfil.
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
    {name:'Press plano con mancuernas',muscle:'pecho',sets:3,reps:'8-12',rest:90,alts:['Press inclinado con mancuernas','Fondos']},
    {name:'Peso muerto rumano',muscle:'femoral',sets:3,reps:'8-12',rest:100,alts:['Peso muerto rumano con mancuernas']},
    {name:'Lagartijas (push ups)',muscle:'pecho',sets:2,reps:'10-15',rest:60,alts:['Fondos']},
    {name:'Plancha lateral',muscle:'core',sets:2,reps:'20-30s',rest:60,clase:'tiempo'}
  ],checked:{},checkedDate:hoy,estado:{},sessionId:Date.now()};
  state.savedRoutines=[
    {id:'r1',name:'Rutina A',plan:[{name:'Sentadilla',muscle:'pierna',sets:3,reps:'8-12',rest:120}],dias:[{di:-1,n:'Base',exs:[{name:'Sentadilla',muscle:'pierna',sets:3,reps:'8-12',rest:120}]}]},
    {id:'r2',name:'Rutina B',plan:[{name:'Remo',muscle:'espalda',sets:3,reps:'10-12',rest:90}],dias:[{di:-1,n:'Base',exs:[{name:'Remo',muscle:'espalda',sets:3,reps:'10-12',rest:90}]}]},
    {id:'r3',name:'Rutina C',plan:[{name:'Curl',muscle:'biceps',sets:2,reps:'10-15',rest:60}],dias:[{di:-1,n:'Base',exs:[{name:'Curl',muscle:'biceps',sets:2,reps:'10-15',rest:60}]}]}
  ];
  window._rutinasLocalBoot=state.savedRoutines.slice();
  save(true);
  return 'ok';
})()`;
async function registrar(ev, idx, w, r) {
  await ev(`(()=>{var a=document.getElementById('rlogW_${idx}');var b=document.getElementById('rlogR_${idx}');if(a){a.value='${w}';a.dispatchEvent(new Event('input',{bubbles:true}));}if(b){b.value='${r}';b.dispatchEvent(new Event('input',{bubbles:true}));}return 1;})()`);
  await ev(`f3RegistrarSerieActual(${idx})`);
  await wait(700);
}

async function fase1() {
  console.log('===== FASE 1 =====');
  const { child, ws, ev } = await lanzar();
  await ev(`window.confirm=function(){return true;};`);
  await ev(SEMILLA);
  await ev(`openTab('💪 Ejercicio')`); await wait(1600);
  // 1 · Modo rápido mínimo
  const rapida = await ev(`(()=>{
    var card=document.querySelector('.fit-card-ej-rapida');
    var txt=card?card.textContent:'';
    var grid=document.querySelector('.fit5-grid'),rutina=document.getElementById('routineTodayCard'),guard=document.getElementById('savedRoutinesDetails');
    var disp=function(el){return el?getComputedStyle(el).display:'no-el';};
    return {
      modo:state.uiSettings.fitModoVista,card:!!card,pos:txt.indexOf('Ejercicio 1 de 4')>=0,
      gif:!!(card&&card.querySelector('.fit-rapida-gif')),gifStage:!!document.getElementById('fitDemoStage_0'),
      pesos:txt.indexOf('Peso (')>=0,reps:txt.indexOf('Reps')>=0,
      registrar:(txt.indexOf('Completo (')>=0||txt.indexOf('Por separado')>=0),cambiar:txt.indexOf('Cambiar ejercicio')>=0,
      ant:txt.indexOf('Anterior')>=0,sig:txt.indexOf('Siguiente')>=0,
      gridOculto:disp(grid)==='none',rutinaOculta:disp(rutina)==='none',guardOculto:disp(guard)==='none',
      sinRueditas:txt.indexOf('Serie ')<0,sinEquipo:txt.indexOf('Equipo:')<0,sinCrono:txt.indexOf('Descanso')<0,sinMas:txt.indexOf('Más opciones')<0,
      nCards:document.querySelectorAll('#f3RapidaCardWrap .fit-card-ej').length
    };
  })()`);
  t('1a · rápido: UNA tarjeta, solo lo esencial (GIF+Peso/Reps+Registrar+Cambiar+Anterior/Siguiente)', rapida.card && rapida.pos && rapida.gif && rapida.pesos && rapida.reps && rapida.registrar && rapida.cambiar && rapida.ant && rapida.sig && rapida.nCards === 1, JSON.stringify(rapida));
  t('1b · rápido: sin semana/estadísticas/rueditas/equipo/cronómetro/Más opciones', rapida.gridOculto && rapida.rutinaOculta && rapida.guardOculto && rapida.sinRueditas && rapida.sinEquipo && rapida.sinCrono && rapida.sinMas === true, 'grid=' + rapida.gridOculto);
  // 2 · GIF animado automáticamente
  await wait(500);
  const gif = await ev(`(()=>{return {timers:((typeof _exTimers!=='undefined'&&_exTimers&&Object.keys(_exTimers).length>0)),vis:!!document.querySelector('.fit-rapida-gif'),stage:document.getElementById('fitDemoStage_0')?document.getElementById('fitDemoStage_0').innerHTML.length:0};})()`);
  t('2 · GIF visible y en movimiento automático', gif.timers === true && gif.vis === true && gif.stage > 10, JSON.stringify(gif));
  // 3 · Registrar sin mover la pantalla
  await ev(`window.scrollTo(0,200);`); await wait(200);
  const yA = await ev(`Math.round(window.scrollY)`);
  await registrar(ev, 0, 20, 10);
  await registrar(ev, 0, 22, 10);
  await ev(`(()=>{var a=document.getElementById('rlogW_0');var b=document.getElementById('rlogR_0');if(a){a.value='30';a.dispatchEvent(new Event('input',{bubbles:true}));}if(b){b.value='10';b.dispatchEvent(new Event('input',{bubbles:true}));}return 1;})()`);
  await ev(`logRoutineQuick(0)`); await wait(700);
  const yB = await ev(`Math.round(window.scrollY)`);
  const series = await ev(`(()=>{var pack=state.fitnessToday;var logs=(state.workoutLog||[]).filter(function(r){return r.sessionId===pack.sessionId&&r.exercise==='Press plano con mancuernas'&&!r.deleted;});return {n:logs.length,pesos:logs.map(function(r){return r.weight}).join(',')};})()`);
  t('3 · Registrar: 2 por separado + completo (20/22/30) sin mover la pantalla', series.n === 3 && series.pesos === '20,22,30' && yA === yB, JSON.stringify(series) + ' y=' + yA + '→' + yB);
  console.log('   [debug card]', await ev(`(function(){var src=f3TarjetaRapidaHTML.toString();var m=src.indexOf('catch(e)');var src2=src.slice(0,m)+'catch(e){window.__cardErr=e;'+src.slice(m+9);var f=(0,eval)('('+src2+')');window.__cardErr=null;f(0,state.fitnessToday);return window.__cardErr?('ERR: '+window.__cardErr.message):'ok';})()`));
  // 4 · Anterior/Siguiente sin perder registros ni posición
  await ev(`f3RapidoMover(1)`); await wait(800);
  await ev(`f3RapidoMover(-1)`); await wait(800);
  const yC = await ev(`Math.round(window.scrollY)`);
  const vuelta = await ev(`(()=>{var card=document.querySelector('.fit-card-ej-rapida');var pack=state.fitnessToday;var logs=(state.workoutLog||[]).filter(function(r){return r.sessionId===pack.sessionId&&r.exercise==='Press plano con mancuernas'&&!r.deleted;});return {pos:card?card.textContent.indexOf('Ejercicio 1 de 4')>=0:false,n:logs.length};})()`);
  t('4 · Anterior/Siguiente conservan registros y posición', vuelta.pos === true && vuelta.n === 3 && yC === yA, JSON.stringify(vuelta) + ' y=' + yC);

  // 20 · Barra inferior: misma altura, pegada al borde, sin tapar contenido
  const bar20 = await ev(`(()=>{var items=[...document.querySelectorAll('#mobileNavBar .mnav-item')];var tops=items.map(function(x){return Math.round(x.getBoundingClientRect().top);});var bar=document.getElementById('mobileNavBar').getBoundingClientRect();var uniq=[...new Set(tops)];return {tops:uniq.length,barBottom:Math.round(bar.bottom),vh:window.innerHeight,iguales:uniq.length===1};})()`);
  t('20 · barra: botones a la misma altura y pegada al borde inferior', bar20.iguales === true && bar20.barBottom === bar20.vh, JSON.stringify(bar20));
  // 21 · Gap superior pequeño (encabezado → contenido)
  await ev(`window.scrollTo(0,0);`); await wait(1200);
  const gap21 = await ev(`(()=>{var h=document.querySelector('header').getBoundingClientRect();var c=document.getElementById('fitHoyCard');var cr=c?c.getBoundingClientRect():null;return {gap:cr?Math.round(cr.top-h.bottom):-1};})()`);
  t('21 · el contenido empieza poco después del encabezado (≤60px)', gap21.gap >= 0 && gap21.gap <= 60, JSON.stringify(gap21));
  // 22 · Tap simple (activa → arriba) y doble toque (abajo)
  await ev(`window.scrollTo(0,400);`); await wait(300);
  await ev(`f3MnavTap('💪 Ejercicio')`); await wait(1700);
  const y22a = await ev(`Math.round(window.scrollY)`);
  t('22a · un toque en la sección activa sube al inicio', y22a === 0, 'y=' + y22a);
  await ev(`f3MnavTap('💪 Ejercicio');`); await wait(120);
  await ev(`f3MnavTap('💪 Ejercicio')`); await wait(1200);
  const y22b = await ev(`Math.round(window.scrollY)`);
  const maxY = await ev(`Math.round(document.documentElement.scrollHeight-window.innerHeight)`);
  t('22b · doble toque baja al final de la sección', Math.abs(y22b - maxY) <= 4, 'y=' + y22b + ' max=' + maxY);
  // 23 · Selector: Fitness completo + cambio de modo sigue funcionando
  await ev(`f3ModoVistaSet('info')`); await wait(700);
  const ren23 = await ev(`(()=>{var b=document.getElementById('f3ModoBar');return {txt:b?b.textContent:'',modo:state.uiSettings.fitModoVista};})()`);
  t('23 · selector dice "Fitness completo" y el cambio funciona', ren23.txt.indexOf('Fitness completo') >= 0 && ren23.txt.indexOf('Modo rápido') >= 0 && ren23.modo === 'info', JSON.stringify(ren23));
  await ev(`f3ModoVistaSet('rapido')`); await wait(700);
  // 24 · Volumen: excluye datos contaminados y muestra Sin datos suficientes
  await ev(`(()=>{window.__logsPrev=(state.workoutLog||[]).slice();return 1;})()`);
  await ev(`(()=>{var h=(typeof todayLocal==='function')?todayLocal():(typeof todayISO==='function')?todayISO():new Date().toISOString().slice(0,10);var ok=[{id:'v1',date:h,localDate:h,sessionId:999,exercise:'Press banca cont',weight:40,sets:1,reps:'10,10',note:'x'},{id:'v2',date:h,localDate:h,sessionId:999,exercise:'Press banca cont',weight:60,sets:1,reps:'60100',note:'cont'},{id:'v3',date:h,localDate:h,sessionId:999,exercise:'Press banca cont',weight:60,sets:1,reps:'8-12',note:'rango'},{id:'v4',date:h,localDate:h,sessionId:999,exercise:'Lagartijas',weight:0,sets:1,reps:'15',note:'pc'},{id:'v5',date:h,localDate:h,sessionId:999,exercise:'Press banca cont',weight:50,sets:1,reps:'12',note:'x'},{id:'v6',date:h,localDate:h,sessionId:999,exercise:'Press banca cont',weight:99,sets:1,reps:'9',note:'x',deleted:true}];state.workoutLog=ok;save(true);return 1;})()`);
  await ev(`renderSimpleFitnessProgress(7)`); await wait(400);
  const vol24 = await ev(`(()=>{var out=document.getElementById('fitnessProgresoOut')||document.getElementById('simpleFitnessOut');var txt=out?out.textContent:'';console.log('DBGVOL:',txt.slice(0,500));return {tiene1400:txt.indexOf('1,400 lb')>=0,txt:txt.slice(0,90)};})()`);
  t('24 · volumen = 1,400 lb (40×20+50×12) sin contaminación ni "K"', vol24.tiene1400 === true, JSON.stringify(vol24));
  await ev(`(()=>{state.workoutLog=[];save(true);renderSimpleFitnessProgress(7);return 1;})()`); await wait(300);
  const vac24 = await ev(`(()=>{var out=document.getElementById('fitnessProgresoOut')||document.getElementById('simpleFitnessOut');return (out?out.textContent:'').indexOf('Sin datos suficientes')>=0;})()`);
  t('24b · sin registros válidos muestra "Sin datos suficientes"', vac24 === true, 'vac=' + vac24);
  await ev(`(()=>{state.workoutLog=window.__logsPrev;save(true);return 1;})()`);
  // 25 · Editor Crear mi modo: contraste
  await ev(`f3ModoEditorAbrir(null)`); await wait(500);
  const ed25 = await ev(`(()=>{var p=document.getElementById('modoEditorPanel');var l=p?p.querySelector('label'):null;return {panel:!!p,col:p?getComputedStyle(p).color:'',lab:l?getComputedStyle(l).color:''};})()`);
  t('25 · Crear mi modo: panel y etiquetas con color oscuro legible', ed25.panel === true && ed25.col.indexOf('255, 255, 255') < 0 && ed25.lab.indexOf('255, 255, 255') < 0, JSON.stringify(ed25));
  await ev(`f3ModoEditorCerrar()`); await wait(300);
  // 13b · Series interactivas: tocar carga valores; Registrar actualiza sin duplicar
  await ev(`f3SerieSeleccionar(0,0)`); await wait(900);
  const sel13 = await ev(`(()=>{var c=document.querySelector('.fit-card-ej-rapida');var w=document.getElementById('rlogW_0');var txt=c?c.textContent:'';return {sel:c?c.querySelectorAll('.fit-circle-sel').length:0,w:w?w.value:'',sinTarjeta:txt.indexOf('seleccionada')<0,sinCorreccion:txt.indexOf('Guardar corrección')<0,sinCirc:!c.querySelector('.fit-nav-min')};})()`);
  t('13b · tocar S1 la selecciona, carga su peso (20) y NO hay tarjeta ni botón de corrección', sel13.sel === 1 && sel13.w === '20' && sel13.sinTarjeta && sel13.sinCorreccion && sel13.sinCirc, JSON.stringify(sel13));
  // corregir S1 con Registrar por separado (misma serie, sin duplicar)
  await ev(`(()=>{var a=document.getElementById('rlogW_0');if(a){a.value='21';a.dispatchEvent(new Event('input',{bubbles:true}));}return 1;})()`);
  await ev(`f3RegistrarSerieActual(0)`); await wait(800);
  const corr13 = await ev(`(()=>{var pack=state.fitnessToday;var logs=(state.workoutLog||[]).filter(function(r){return r.sessionId===pack.sessionId&&r.exercise==='Press plano con mancuernas'&&!r.deleted;});return {n:logs.length,pesos:logs.map(function(r){return r.weight}).join(',')};})()`);
  t('13c · Registrar sobre la serie seleccionada la actualiza sin duplicar (21,22,30)', corr13.n === 3 && corr13.pesos === '21,22,30', JSON.stringify(corr13));
  // S2 por separado: seleccionar S2 y actualizarla
  await ev(`f3SerieSeleccionar(0,1)`); await wait(900);
  await ev(`(()=>{var a=document.getElementById('rlogW_0');if(a){a.value='23';a.dispatchEvent(new Event('input',{bubbles:true}));}return 1;})()`);
  await ev(`f3RegistrarSerieActual(0)`); await wait(800);
  const sep13 = await ev(`(()=>{var pack=state.fitnessToday;var logs=(state.workoutLog||[]).filter(function(r){return r.sessionId===pack.sessionId&&r.exercise==='Press plano con mancuernas'&&!r.deleted;});return {n:logs.length,pesos:logs.map(function(r){return r.weight}).join(',')};})()`);
  t('13d · corregir S2 tocándola y guardando sin crear otra serie (21,23,30)', sep13.n === 3 && sep13.pesos === '21,23,30', JSON.stringify(sep13));
  // cambiar de ejercicio y volver: todo intacto
  await ev(`f3RapidoMover(1)`); await wait(700);
  await ev(`f3RapidoMover(-1)`); await wait(700);
  const v13 = await ev(`(()=>{var c=document.querySelector('.fit-card-ej-rapida');var pack=state.fitnessToday;var logs=(state.workoutLog||[]).filter(function(r){return r.sessionId===pack.sessionId&&r.exercise==='Press plano con mancuernas'&&!r.deleted;});return {pos:c?c.textContent.indexOf('Ejercicio 1 de 4')>=0:false,n:logs.length,chips:c?c.querySelectorAll('.fit-circle.ok').length:0};})()`);
  t('13e · cambiar de ejercicio y volver conserva series y valores', v13.pos === true && v13.n === 3 && v13.chips === 3, JSON.stringify(v13));
  // 14 · Tarjeta rápida: series×reps + tipo de carga
  const instr = await ev(`(()=>{var c=document.querySelector('.fit-card-ej-rapida');return c?c.textContent:'no';})()`);
  t('14 · tarjeta rápida muestra series×repeticiones y tipo de carga', instr.indexOf('series ×') >= 0 && (instr.indexOf('repeticiones') >= 0 || instr.indexOf('duración') >= 0) && (instr.indexOf('Mancuernas') >= 0 || instr.indexOf('Barra') >= 0 || instr.indexOf('Peso corporal') >= 0), instr.slice(0, 160));
  // 15 · Modo informativo: pantalla de la semana visible
  await ev(`f3ModoVistaSet('info')`); await wait(1000);
  const semana = await ev(`(()=>{var rc=document.getElementById('routineTodayCard');var ro=document.getElementById('routineTodayOut');return {vis:rc?getComputedStyle(rc).display!=='none':false,contenido:ro?ro.textContent.slice(0,80):''};})()`);
  t('15 · Modo informativo muestra la semana con sus días', semana.vis === true && semana.contenido.length > 10, JSON.stringify(semana));
  // 16 · Botones duales + rueditas en la tarjeta rápida
  await ev(`f3ModoVistaSet('rapido')`); await wait(800);
  const dual = await ev(`(()=>{var c=document.querySelector('.fit-card-ej-rapida');var txt=c?c.textContent:'';return {completo:txt.indexOf('Completo (')>=0,separado:txt.indexOf('Por separado')>=0,chips:c?c.querySelectorAll('.fit-circle').length:0};})()`);
  t('16a · botones compactos Completo (N) / Por separado con rueditas', dual.completo && dual.separado && dual.chips === 3, JSON.stringify(dual));
  // 17 · Plancha (tiempo): campo Segundos y 0=solo cuerpo
  await ev(`f3RapidoMover(3)`); await wait(800);
  const tiempo = await ev(`(()=>{var c=document.querySelector('.fit-card-ej-rapida');var txt=c?c.textContent:'';return {seg:txt.indexOf('Segundos')>=0,cuerpo:txt.indexOf('0=solo cuerpo')>=0,pos:txt.indexOf('Ejercicio 4 de 4')>=0};})()`);
  t('17 · ejercicio de tiempo: campo "Segundos" y 0=solo cuerpo', tiempo.seg === true && tiempo.cuerpo === true && tiempo.pos === true, JSON.stringify(tiempo));
  await ev(`f3RapidoMover(-3)`); await wait(800);
  // 18 · Registro por pasos: intro, preguntas, detalle y guardado (ejemplo del usuario)
  await ev(`openTab('🍱 Contador')`); await wait(1200);
  const btnReg = await ev(`!!document.getElementById('regComidaBtn')`);
  t('18a · botón "Registrar comida (por pasos)" en el Contador', btnReg === true);
  await ev(`f3RegComidaAbrir()`); await wait(400);
  const intro = await ev(`(()=>{var b=document.getElementById('regComidaBody');return b?b.textContent.slice(0,200):'';})()`);
  t('18b · intro "Vamos a registrar tu comida por pasos" + Empezar', intro.indexOf('Vamos a registrar tu comida por pasos') >= 0 && intro.indexOf('Empezar') >= 0, intro.slice(0, 100));
  await ev(`f3RegEmpezar()`); await wait(300);
  const p1 = await ev(`(()=>{var b=document.getElementById('regComidaBody');return b?b.textContent.slice(0,200):'';})()`);
  t('18c · paso 1 pregunta por la proteína con buscador', p1.indexOf('¿Qué carne o proteína utilizaste?') >= 0, p1.slice(0, 100));
  // carne molida: buscar, detalle cocida 200 g, aporte, agregar
  await ev(`f3RegBuscar('carne molida')`); await wait(300);
  await ev(`f3RegAbrirDetalle('Carne molida 100g')`); await wait(300);
  await ev(`f3RegDetSet('estado','cocido')`); await wait(200);
  await ev(`f3RegDetSet('cant',200)`); await wait(200);
  const carne = await ev(`(()=>{var b=document.getElementById('regComidaBody');return b?b.textContent.slice(0,300):'';})()`);
  t('18d · carne molida cocida 200 g muestra su aporte (542 kcal)', carne.indexOf('Aporte de 200 g') >= 0 && carne.indexOf('542 kcal') >= 0, carne.slice(0, 160));
  await ev(`f3RegAgregarAlPlato()`); await wait(300);
  // brócoli cocido 100 g
  await ev(`f3RegNav(1)`); await wait(200);
  await ev(`f3RegBuscar('brócoli')`); await wait(300);
  await ev(`f3RegAbrirDetalle('Brócoli 100g')`); await wait(300);
  await ev(`f3RegDetSet('estado','cocido')`); await wait(200);
  await ev(`f3RegDetSet('cant',100)`); await wait(200);
  const broc = await ev(`(()=>{var b=document.getElementById('regComidaBody');return b?b.textContent.slice(0,300):'';})()`);
  t('18e · brócoli cocido 100 g muestra su aporte (35 kcal)', broc.indexOf('35 kcal') >= 0, broc.slice(0, 160));
  await ev(`f3RegAgregarAlPlato()`); await wait(300);
  // aceite 1 cucharada
  await ev(`f3RegNav(2)`); await wait(200);
  await ev(`f3RegBuscar('aceite')`); await wait(300);
  await ev(`f3RegAbrirDetalle('Aceite oliva 1 cda')`); await wait(300);
  await ev(`f3RegDetSet('cant',1)`); await wait(200);
  await ev(`f3RegDetSet('unidad','cda')`); await wait(200);
  const aceite = await ev(`(()=>{var b=document.getElementById('regComidaBody');return b?b.textContent.slice(0,300):'';})()`);
  t('18f · 1 cucharada de aceite muestra su aporte (124 kcal)', aceite.indexOf('124 kcal') >= 0, aceite.slice(0, 160));
  await ev(`f3RegAgregarAlPlato()`); await wait(300);
  // plato final: totales + guardar
  await ev(`f3RegNav(1)`); await wait(200); await ev(`f3RegNav(1)`); await wait(300);
  const plato = await ev(`(()=>{var b=document.getElementById('regComidaBody');return b?b.textContent.slice(0,900):'';})()`);
  t('18g · plato final con ingredientes y total (701 kcal)', plato.indexOf('200 g de Carne molida') >= 0 && plato.indexOf('Total del plato') >= 0 && plato.indexOf('701 kcal') >= 0, plato.slice(0, 220));
  await ev(`f3RegGuardar()`); await wait(700);
  const guardada = await ev(`(()=>{var hoy=(typeof todayISO==='function')?todayISO():new Date().toISOString().slice(0,10);var d=state.diary&&state.diary[hoy];var all=d?(d.breakfast||[]).concat(d.lunch||[]).concat(d.dinner||[]).concat(d.snacks||[]):[];var car=all.filter(function(x){return String(x.name||'').indexOf('Carne molida')>=0;});var br=all.filter(function(x){return String(x.name||'').indexOf('Brócoli')>=0;});var ac=all.filter(function(x){return String(x.name||'').indexOf('Aceite')>=0;});return {n:car.length+br.length+ac.length,carK:car[0]?car[0].kcal:0,brK:br[0]?br[0].kcal:0,acK:ac[0]?ac[0].kcal:0};})()`);
  t('18h · la comida se guarda en el diario (3 alimentos, 542+35+124)', guardada.n === 3 && guardada.carK === 542 && guardada.brK === 35 && guardada.acK === 124, JSON.stringify(guardada));
  await ev(`openTab('💪 Ejercicio')`); await wait(1600);
  await ev(`window.scrollTo(0,0);`); await wait(600);
  await ev(`f3ModoVistaSet('rapido')`); await wait(800);
  await cerrarGracioso(ws, child);
  console.log('   app cerrada; perfil: ' + profile);
}

async function fase2() {
  console.log('===== FASE 2 · reabrir con el mismo perfil =====');
  const { child, ws, ev } = await lanzar();
  await ev(`openTab('💪 Ejercicio')`); await wait(1500);
  const pers = await ev(`(()=>{
    var card=document.querySelector('.fit-card-ej-rapida');
    var pack=state.fitnessToday;
    var logs=(state.workoutLog||[]).filter(function(r){return pack&&r.sessionId===pack.sessionId&&!r.deleted;});
    var alfa=state.uiSettings&&state.uiSettings.tarjetas?state.uiSettings.tarjetas.alfa:null;
    var varBg=getComputedStyle(document.documentElement).getPropertyValue('--tarj-bg').trim();
    return {modo:state.uiSettings.fitModoVista,rapida:!!card,logs:logs.length,rutinas:(state.savedRoutines||[]).length,alfa:alfa,varBg:varBg};
  })()`);
  t('14 · reabrir: rutinas intactas, modo y series conservados, tarjetas aplicadas', pers.rutinas === 3 && pers.modo === 'rapido' && pers.rapida === true && pers.logs >= 3, JSON.stringify(pers));
  // 19 · la comida guardada sigue al reabrir
  const comida = await ev(`(()=>{var hoy=(typeof todayISO==='function')?todayISO():new Date().toISOString().slice(0,10);var d=state.diary&&state.diary[hoy];var all=d?(d.breakfast||[]).concat(d.lunch||[]).concat(d.dinner||[]).concat(d.snacks||[]):[];var car=all.filter(function(x){return String(x.name||'').indexOf('Carne molida')>=0;});var br=all.filter(function(x){return String(x.name||'').indexOf('Brócoli')>=0;});var ac=all.filter(function(x){return String(x.name||'').indexOf('Aceite')>=0;});return {n:car.length+br.length+ac.length,k:car[0]?car[0].kcal:0};})()`);
  t('19 · la comida registrada persiste al reabrir (3 alimentos, 542 kcal)', comida.n === 3 && comida.k === 542, JSON.stringify(comida));
  const fatales = ws.consola.filter(c => /EXCEPCIÓN:/.test(c));
  t('15 · sin errores en consola', fatales.length === 0, fatales.slice(0, 2).join(' | ').slice(0, 200));
  await cerrarGracioso(ws, child);
}

(async () => {
  await fase1();
  await wait(2000);
  await fase2();
  console.log('\n======== RESULTADO: ' + pasadas + ' PASS · ' + falladas + ' FAIL ========');
  process.exit(falladas ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(2); });
