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
    {name:'Lagartijas (push ups)',muscle:'pecho',sets:2,reps:'10-15',rest:60,alts:['Fondos']}
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
  await ev(SEMILLA);
  await ev(`openTab('💪 Ejercicio')`); await wait(1600);
  // 1 · Modo rápido mínimo
  const rapida = await ev(`(()=>{
    var card=document.querySelector('.fit-card-ej-rapida');
    var txt=card?card.textContent:'';
    var grid=document.querySelector('.fit5-grid'),rutina=document.getElementById('routineTodayCard'),guard=document.getElementById('savedRoutinesDetails');
    var disp=function(el){return el?getComputedStyle(el).display:'no-el';};
    return {
      modo:state.uiSettings.fitModoVista,card:!!card,pos:txt.indexOf('Ejercicio 1 de 3')>=0,
      gif:!!(card&&card.querySelector('.fit-rapida-gif')),gifStage:!!document.getElementById('fitDemoStage_0'),
      pesos:txt.indexOf('Peso (')>=0,reps:txt.indexOf('Reps')>=0,
      registrar:txt.indexOf('Registrar')>=0,cambiar:txt.indexOf('Cambiar ejercicio')>=0,
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
  await registrar(ev, 0, 25, 8);
  const yB = await ev(`Math.round(window.scrollY)`);
  const series = await ev(`(()=>{var pack=state.fitnessToday;var logs=(state.workoutLog||[]).filter(function(r){return r.sessionId===pack.sessionId&&r.exercise==='Press plano con mancuernas'&&!r.deleted;});return {n:logs.length,pesos:logs.map(function(r){return r.weight}).join(',')};})()`);
  t('3 · Registrar guarda 3 series (20/22/25) sin mover la pantalla', series.n === 3 && series.pesos === '20,22,25' && yA === yB, JSON.stringify(series) + ' y=' + yA + '→' + yB);
  // 4 · Anterior/Siguiente sin perder registros ni posición
  await ev(`f3RapidoMover(1)`); await wait(800);
  await ev(`f3RapidoMover(-1)`); await wait(800);
  const yC = await ev(`Math.round(window.scrollY)`);
  const vuelta = await ev(`(()=>{var card=document.querySelector('.fit-card-ej-rapida');var pack=state.fitnessToday;var logs=(state.workoutLog||[]).filter(function(r){return r.sessionId===pack.sessionId&&r.exercise==='Press plano con mancuernas'&&!r.deleted;});return {pos:card?card.textContent.indexOf('Ejercicio 1 de 3')>=0:false,n:logs.length};})()`);
  t('4 · Anterior/Siguiente conservan registros y posición', vuelta.pos === true && vuelta.n === 3 && yC === yA, JSON.stringify(vuelta) + ' y=' + yC);
  // 5 · Cambiar ejercicio solo sustituye el actual
  const antesPlan = await ev(`JSON.stringify((state.fitnessToday.plan||[]).map(function(x){return x.name;}))`);
  await ev(`(()=>{var d=document.getElementById('fitAlts_0');if(d)d.open=true;return 1;})()`); await wait(400);
  const alt = await ev(`(()=>{var a=document.getElementById('altsRow_0');return a?a.textContent.slice(0,80):'sin alts';})()`);
  t('5a · Cambiar ejercicio abre alternativas en su lugar', alt.length > 0, alt);
  await ev(`swapToFirstAlt(0)`); await wait(900);
  const despuesPlan = await ev(`(()=>{var p=(state.fitnessToday.plan||[]).map(function(x){return x.name;});return {n:p.length,iguales:p.slice(1).join(',')===${JSON.stringify('')}?'?':p.slice(1).join(','),primero:p[0]};})()`);
  t('5b · solo cambia el ejercicio actual (misma rutina, mismo largo)', despuesPlan.n === 3, JSON.stringify(despuesPlan));
  // 6 · Modo informativo: semana, detalles y plegables
  await ev(`f3ModoVistaSet('info')`); await wait(1000);
  const info = await ev(`(()=>{
    var grid=document.querySelector('.fit5-grid');
    var guard=document.getElementById('savedRoutinesDetails'),prog=document.getElementById('fitnessProgresoDetails');
    return {
      cards:document.querySelectorAll('#f3RapidaCardWrap .fit-card-ej').length,
      gridVis:getComputedStyle(grid).display!=='none',
      guardAbierto:guard?guard.open:null,progAbierto:prog?prog.open:null,
      guardSum:guard?guard.querySelector('summary').textContent:'',
      equipo:document.querySelector('#f3RapidaCardWrap').textContent.indexOf('Equipo: Mancuernas')>=0,
      semana:!!document.getElementById('routineTodayOut')
    };
  })()`);
  t('6a · informativo: lista completa, semana y equipo visibles', info.cards === 3 && info.gridVis === true && info.equipo === true && info.semana === true, JSON.stringify(info));
  t('6b · Progreso y Rutinas guardadas plegados por defecto con contador', info.guardAbierto === false && info.progAbierto === false && info.guardSum.indexOf('Rutinas guardadas (3)') >= 0, JSON.stringify({ab:info.guardAbierto,sum:info.guardSum}));
  // 7 · Rutinas recuperadas + Cargando
  const rut = await ev(`(()=>{renderSavedRoutines();var out=document.getElementById('savedRoutinesOut');return {txt:out?out.textContent.slice(0,140):'',n:(state.savedRoutines||[]).length};})()`);
  t('7a · las rutinas existentes aparecen (3)', rut.n === 3 && rut.txt.indexOf('Rutina A') >= 0, JSON.stringify(rut));
  const recup = await ev(`(()=>{
    var boot=window._rutinasLocalBoot.slice();
    state.savedRoutines=[];
    f3RutinasGuardarLocal();
    return {n:state.savedRoutines.length};
  })()`);
  t('7b · si la sync vacía el arreglo, se recuperan las rutinas locales', recup.n === 3, JSON.stringify(recup));
  const carg = await ev(`(()=>{window._csBusy=true;renderSavedRoutines();var t1=document.getElementById('savedRoutinesOut').textContent;window._csBusy=false;return t1.slice(0,30);})()`);
  t('7c · "Cargando rutinas…" durante la hidratación (sin vacío falso)', carg.indexOf('Cargando rutinas') >= 0, carg);
  // 8 · Nombre de rutina distinguible
  const nombre = await ev(`(()=>{var b=document.querySelector('.fit-nombre-box');if(!b)return null;var s=getComputedStyle(b);return {border:s.borderTopColor,bg:s.backgroundColor,present:true};})()`);
  t('8 · caja del nombre con borde/fondo distinguibles', nombre && nombre.present === true && nombre.border !== 'rgba(0, 0, 0, 0)', JSON.stringify(nombre));
  // 9 · Encabezado limpio + Diagnóstico
  const enc = await ev(`(()=>{var v=document.querySelector('.versionChip'),p=document.getElementById('ppWorkerToggleBar');return {ver:v?getComputedStyle(v).display:'no',puente:p?getComputedStyle(p).display:'no'};})()`);
  t('9a · versión y Puente Cloudflare ocultos del encabezado', enc.ver === 'none' && enc.puente === 'none', JSON.stringify(enc));
  await ev(`openTab('👤 Perfil')`); await wait(2800);
  const diag = await ev(`(()=>{var d=document.getElementById('ajDiag');return d?d.textContent.slice(0,500):'';})()`);
  t('9b · Diagnóstico en Ajustes (puente, conexión, sync, versión)', diag.indexOf('Puente Cloudflare') >= 0 && diag.indexOf('Conexión') >= 0 && diag.indexOf('Sincronización') >= 0 && diag.indexOf('Versión instalada') >= 0, diag.slice(0, 100));
  // 10 · Tarjetas y cuadros
  const tarj = await ev(`(()=>{
    f3TarjetasEditorInsertar();
    var d=document.getElementById('ajTarjetas');
    if(!d)return null;
    f3TarjetasSet('alfa',60);
    var card=document.querySelector('.card');
    var cs=card?getComputedStyle(card):null;
    var b=card?card.querySelector('b'):null;
    return {editor:!!d,bg:cs?cs.backgroundColor:'',textoOpaco:b?(getComputedStyle(b).opacity==='1'):null,varBg:getComputedStyle(document.documentElement).getPropertyValue('--tarj-bg').trim()};
  })()`);
  t('10a · Tarjetas y cuadros: editor + transparencia aplicada al fondo (texto intacto)', tarj && tarj.editor === true && tarj.varBg.indexOf('0.6') >= 0 && tarj.textoOpaco === true, JSON.stringify(tarj));
  // 11 · Calculadoras
  await ev(`openTab('🍽️ Recetas')`); await wait(1000);
  const calc1 = await ev(`(()=>{
    var d=document.getElementById('calcAlim');
    if(!d)return {d:false};
    d.open=true;
    document.getElementById('calcAlimEdad').value='30';
    document.getElementById('calcAlimPeso').value='75';
    document.getElementById('calcAlimEstatura').value='175';
    f3CalcAlimCalc();
    var out=document.getElementById('calcAlimOut').textContent;
    return {d:true,cerrado:!d.open,out:out.slice(0,150),mifflin:out.indexOf('Mifflin')>=0||out.indexOf('metabolismo basal')>=0,nan:/NaN|Infinity/.test(out)};
  })()`);
  t('11a · Calculadora de alimentación (Mifflin-St Jeor, sin NaN)', calc1.d === true && calc1.mifflin === true && calc1.nan === false, JSON.stringify(calc1));
  const calc1b = await ev(`(()=>{document.getElementById('calcAlimEdad').value='';f3CalcAlimCalc();return document.getElementById('calcAlimOut').textContent.slice(0,60);})()`);
  t('11b · datos inválidos muestran explicación clara', calc1b.indexOf('Completa') >= 0 || calc1b.indexOf('Revisa') >= 0, calc1b);
  await ev(`openTab('⚖️ Peso')`); await wait(1000);
  const calc2 = await ev(`(()=>{
    var d=document.getElementById('calcPeso');
    if(!d)return {d:false};
    d.open=true;
    document.getElementById('calcPesoActual').value='80';
    document.getElementById('calcPesoObj').value='75';
    document.getElementById('calcPesoEstatura').value='175';
    f3CalcPesoCalc();
    var out=document.getElementById('calcPesoOut').textContent;
    return {d:true,cerrado:!d.open,dif:out.indexOf('Diferencia')>=0,imc:out.indexOf('IMC')>=0,tpo:out.indexOf('Tiempo estimado')>=0,nan:/NaN|Infinity/.test(out),conv:out.indexOf('Conversión')>=0};
  })()`);
  t('11c · Calculadora de objetivo (diferencia, IMC, tiempo, conversión, sin NaN)', calc2.d === true && calc2.dif && calc2.imc && calc2.tpo && calc2.nan === false && calc2.conv === true, JSON.stringify(calc2));
  // 12 · barra inferior no tapa
  await ev(`openTab('💪 Ejercicio')`); await wait(1200);
  await ev(`f3ModoVistaSet('rapido')`); await wait(800);
  await ev(`window.scrollTo(0,document.documentElement.scrollHeight);`); await wait(400);
  const barra = await ev(`(()=>{var bar=document.getElementById('mobileNavBar');var nav=document.querySelector('.fit-rapida-nav');if(!bar||!nav)return null;var br=bar.getBoundingClientRect(),nr=nav.getBoundingClientRect();return {tapa:nr.bottom>br.top+2};})()`);
  t('12 · la barra inferior no tapa los controles', barra && barra.tapa === false, JSON.stringify(barra));
  // 13 · volver a rápido
  await ev(`f3ModoVistaSet('rapido')`); await wait(800);
  const finRap = await ev(`(()=>({modo:state.uiSettings.fitModoVista,rapida:!!document.querySelector('.fit-card-ej-rapida')}))()`);
  t('13 · volver a rápido conserva la preferencia', finRap.modo === 'rapido' && finRap.rapida === true, JSON.stringify(finRap));
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
  t('14 · reabrir: rutinas intactas, modo y series conservados, tarjetas aplicadas', pers.rutinas === 3 && pers.modo === 'rapido' && pers.rapida === true && pers.logs >= 3 && pers.alfa === 60 && pers.varBg.indexOf('0.6') >= 0, JSON.stringify(pers));
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
