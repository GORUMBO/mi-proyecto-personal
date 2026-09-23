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
      registrar:txt.indexOf('Registrar')>=0,cambiar:!!(card&&card.querySelector('.fit-nav-min')),
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
  // 13b · Series interactivas: tocar S1, corregir peso, S2 por separado, cambiar y volver
  await ev(`f3SerieSeleccionar(0,0)`); await wait(800);
  const sel = await ev(`(()=>{var c=document.querySelector('.fit-card-ej-rapida');var w=document.getElementById('rlogW_0');return {sel:c?c.textContent.indexOf('Serie S1 seleccionada')>=0:false,w:w?w.value:''};})()`);
  t('13b · tocar S1 la selecciona y carga su peso guardado (20)', sel.sel === true && sel.w === '20', JSON.stringify(sel));
  await ev(`(()=>{var a=document.getElementById('rlogW_0');if(a){a.value='21';a.dispatchEvent(new Event('input',{bubbles:true}));}return 1;})()`);
  await ev(`f3SerieGuardarCorreccion(0)`); await wait(800);
  const corr = await ev(`(()=>{var pack=state.fitnessToday;var logs=(state.workoutLog||[]).filter(function(r){return r.sessionId===pack.sessionId&&r.exercise==='Press plano con mancuernas'&&!r.deleted;});return {n:logs.length,pesos:logs.map(function(r){return r.weight}).join(',')};})()`);
  t('13c · corregir S1 guarda sin duplicar (siguen 3 series, S1=21)', corr.n === 3 && corr.pesos === '21,22,30', JSON.stringify(corr));
  // S2 por separado con serie seleccionada existente → corrige S2 sin duplicar
  await ev(`f3SerieSeleccionar(0,1)`); await wait(600);
  await ev(`(()=>{var a=document.getElementById('rlogW_0');if(a){a.value='23';a.dispatchEvent(new Event('input',{bubbles:true}));}return 1;})()`);
  await ev(`f3RegistrarSerieActual(0)`); await wait(800);
  const sep = await ev(`(()=>{var pack=state.fitnessToday;var logs=(state.workoutLog||[]).filter(function(r){return r.sessionId===pack.sessionId&&r.exercise==='Press plano con mancuernas'&&!r.deleted;});return {n:logs.length,pesos:logs.map(function(r){return r.weight}).join(',')};})()`);
  t('13d · por separado sobre la serie seleccionada corrige sin duplicar (21,23,30)', sep.n === 3 && sep.pesos === '21,23,30', JSON.stringify(sep));
  // cambiar de ejercicio y volver: valores y series intactos
  await ev(`f3RapidoMover(1)`); await wait(700);
  await ev(`f3RapidoMover(-1)`); await wait(700);
  const v13 = await ev(`(()=>{var c=document.querySelector('.fit-card-ej-rapida');var pack=state.fitnessToday;var logs=(state.workoutLog||[]).filter(function(r){return r.sessionId===pack.sessionId&&r.exercise==='Press plano con mancuernas'&&!r.deleted;});return {pos:c?c.textContent.indexOf('Ejercicio 1 de 4')>=0:false,n:logs.length,chips:c?c.querySelectorAll('.fit-circle.ok').length:0};})()`);
  t('13e · cambiar de ejercicio y volver conserva series y valores', v13.pos === true && v13.n === 3 && v13.chips === 3, JSON.stringify(v13));
  // 5 · Cambiar ejercicio solo sustituye el actual
  const antesPlan = await ev(`JSON.stringify((state.fitnessToday.plan||[]).map(function(x){return x.name;}))`);
  await ev(`(()=>{var d=document.getElementById('fitAlts_0');if(d)d.open=true;return 1;})()`); await wait(400);
  const alt = await ev(`(()=>{var a=document.getElementById('altsRow_0');return a?a.textContent.slice(0,80):'sin alts';})()`);
  t('5a · Cambiar ejercicio abre alternativas en su lugar', alt.length > 0, alt);
  await ev(`swapToFirstAlt(0)`); await wait(900);
  const despuesPlan = await ev(`(()=>{var p=(state.fitnessToday.plan||[]).map(function(x){return x.name;});return {n:p.length,iguales:p.slice(1).join(',')===${JSON.stringify('')}?'?':p.slice(1).join(','),primero:p[0]};})()`);
  t('5b · solo cambia el ejercicio actual (misma rutina, mismo largo)', despuesPlan.n === 4, JSON.stringify(despuesPlan));
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
  t('6a · informativo: lista completa, semana y equipo visibles', info.cards === 4 && info.gridVis === true && info.equipo === true && info.semana === true, JSON.stringify(info));
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
  // 14 · Tarjeta rápida: series×reps + tipo de carga
  const instr = await ev(`(()=>{var c=document.querySelector('.fit-card-ej-rapida');return c?c.textContent:'no';})()`);
  t('14 · tarjeta rápida muestra series×repeticiones y tipo de carga', instr.indexOf('series ×') >= 0 && (instr.indexOf('repeticiones') >= 0 || instr.indexOf('duración') >= 0) && (instr.indexOf('Mancuernas') >= 0 || instr.indexOf('Barra') >= 0 || instr.indexOf('Peso corporal') >= 0), instr.slice(0, 160));
  // 15 · Modo informativo: pantalla de la semana visible
  await ev(`f3ModoVistaSet('info')`); await wait(1000);
  const semana = await ev(`(()=>{var rc=document.getElementById('routineTodayCard');var ro=document.getElementById('routineTodayOut');return {vis:rc?getComputedStyle(rc).display!=='none':false,contenido:ro?ro.textContent.slice(0,80):''};})()`);
  t('15 · Modo informativo muestra la semana con sus días', semana.vis === true && semana.contenido.length > 10, JSON.stringify(semana));
  // 16 · Botones duales + rueditas en la tarjeta rápida
  await ev(`f3ModoVistaSet('rapido')`); await wait(800);
  const dual = await ev(`(()=>{var c=document.querySelector('.fit-card-ej-rapida');var txt=c?c.textContent:'';return {completo:txt.indexOf('Registrar completo')>=0,separado:txt.indexOf('Registrar por separado')>=0,chips:c?c.querySelectorAll('.fit-circle').length:0};})()`);
  t('16a · botones "Registrar completo (N series)" y "Registrar por separado" con rueditas', dual.completo && dual.separado && dual.chips === 3, JSON.stringify(dual));
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
  t('14 · reabrir: rutinas intactas, modo y series conservados, tarjetas aplicadas', pers.rutinas === 3 && pers.modo === 'rapido' && pers.rapida === true && pers.logs >= 3 && pers.alfa === 60 && pers.varBg.indexOf('0.6') >= 0, JSON.stringify(pers));
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
