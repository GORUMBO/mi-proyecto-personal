// Prueba E2E de Peso + fondo persistente (modo iPhone/PWA) en DOS fases con el
// MISMO perfil: fase 1 configura fondo y registra peso; se cierra la app por
// completo; fase 2 reabre y verifica que fondo y peso siguen ahí.
// Uso: node tools/prueba-peso-fondo.js [puerto] [dirPerfilOpcional] [PP_APP_DIR]
const { spawn } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const wait = ms => new Promise(r => setTimeout(r, ms));
const port = Number(process.argv[2] || 9355);
const rootReal = path.resolve(__dirname, '..');
const appDir = process.env.PP_APP_DIR || rootReal;
const profile = process.argv[3] || fs.mkdtempSync(path.join(os.tmpdir(), 'pp-pf-'));
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
    ws.onopen = () => {
      ws.sj = (m, pa) => new Promise((r2, j2) => { const mid = ++id; pend.set(mid, { r2, j2 }); ws.send(JSON.stringify({ id: mid, method: m, params: pa || {} })); });
      resolve(ws);
    };
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
    try {
      const r = await fetch('http://127.0.0.1:' + port + '/json/list');
      const l = await r.json();
      target = l.find(x => x.type === 'page' && x.webSocketDebuggerUrl);
      if (target) break;
    } catch (e) {}
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
  for (let i = 0; i < 60; i++) {
    await wait(750);
    const r = await ev("!!(document.getElementById('edgeDrawer')&&document.getElementById('mobileNavBar'))");
    if (r === true) { listo = true; break; }
  }
  if (!listo) console.log('AVISO: arranque lento');
  await ev("state.onboarded=true;['loginScreen','onboardingModal','avisoSinCuentaBox','appTutorial','appUpdateBanner'].forEach(id=>{var el=document.getElementById(id);if(el)el.remove();});1");
  return { child, ws, ev };
}
async function cerrarGracioso(ws, child) {
  try { await ws.sj('Runtime.evaluate', { expression: "try{save();}catch(e){}" }); } catch (e) {}
  await wait(800);
  try { await ws.sj('Runtime.evaluate', { expression: "window.close()" }); } catch (e) {}
  for (let i = 0; i < 20; i++) { await wait(500); if (child.exitCode !== null) return; }
  try { child.kill(); } catch (e) {}
  await wait(500);
}

async function fase1() {
  console.log('===== FASE 1 · elegir fondo + registrar peso =====');
  const { child, ws, ev } = await lanzar();

  // 1 · Elegir un fondo (imagen sintética en canvas → File → flujo real de la app)
  await ev(`(()=>{var c=document.createElement('canvas');c.width=120;c.height=90;var x=c.getContext('2d');x.fillStyle='#1a4a7a';x.fillRect(0,0,120,90);x.fillStyle='#c99a3f';x.fillRect(0,60,120,30);return new Promise(function(res){c.toBlob(function(blob){var f=new File([blob],'fondo-prueba.png',{type:'image/png'});f3FondoAbrir();f3FondoProcesar(f);res('procesando');},'image/png');});})()`);
  let proc = false;
  for (let i = 0; i < 20; i++) { await wait(400); proc = await ev("!!window._fondoPendienteDataURL"); if (proc === true) break; }
  t('la imagen se procesa (dataURL pendiente)', proc === true);
  const aplicado = await ev("(function(){try{var r=f3FondoAplicar();return 'ok:'+r;}catch(e){return 'throw:'+e.message;}})()");
  await wait(900);
  let fondo = await ev(`(()=>{var capa=document.getElementById('ppCustomBackground');return {cls:document.body.classList.contains('pp-fondo'),bg:capa?capa.style.backgroundImage:'',cfg:JSON.stringify(state.fondoCfg&&state.fondoCfg.imgId)};})()`);
  t('fondo aplicado (clase pp-fondo + imagen en capa)', fondo.cls === true && /url\(/.test(fondo.bg) && fondo.cfg.indexOf('fondo_usuario') >= 0, fondo.bg.slice(0, 60));

  // 2 · Cambiar entre Ejercicio, Caminata y Peso (sin errores ni secciones vacías)
  const tabsOk = [];
  for (const tab of ['💪 Ejercicio', '🚶 Caminata', '⚖️ Peso']) {
    const r = await ev(`(function(){try{openTab('${tab}');return 'ok';}catch(e){return 'throw:'+e.message;}})()`);
    await wait(1200);
    const c = await ev(`(()=>{var el=document.querySelector('.tab.active');return {tab:tabs[_activeTab],len:el?el.innerHTML.length:-1,blank:el&&el.innerHTML.indexOf('ppCargando')>=0};})()`);
    tabsOk.push({ tab, r, c });
    t('abre ' + tab + ' sin error y con contenido', r === 'ok' && c.tab === tab && c.len > 300, JSON.stringify(c).slice(0, 120));
  }

  // 3 · Peso completo: campos, unidades, botón, estado vacío e historial
  await ev(`openTab('⚖️ Peso')`); await wait(1000);
  const peso = await ev(`(()=>{
    var root=document.getElementById('pesoRoot');
    return {
      len:root?root.innerHTML.length:0,
      vacio:(root?root.textContent:'').indexOf('Todavía no has registrado tu peso')>=0,
      form:!!document.getElementById('wFormCard'),
      fecha:!!document.getElementById('wDate'),
      valor:!!document.getElementById('wVal'),
      historial:!!document.getElementById('weightOut'),
      unidades:(root?root.textContent:'').indexOf('lb')>=0&&(root?root.textContent:'').indexOf('kg')>=0,
      pesoHoy:(root?root.textContent:'').indexOf('Peso de hoy')>=0
    };
  })()`);
  t('Peso: contenido completo (héroe, unidades, formulario, historial)', peso.len > 500 && peso.form && peso.fecha && peso.valor && peso.historial && peso.unidades && peso.pesoHoy, JSON.stringify(peso));
  t('Peso: estado vacío "Todavía no has registrado tu peso"', peso.vacio === true);
  const btnGuardar = await ev(`(()=>{var b=document.querySelector('#wFormCard button');return b?b.textContent:null;})()`);
  t('Peso: botón "Guardar peso" presente', !!btnGuardar && btnGuardar.indexOf('Guardar peso') >= 0, btnGuardar);

  // 4 · Registrar un peso por el formulario real
  await ev(`abrirFormPeso()`); await wait(300);
  await ev(`(()=>{var d=document.getElementById('wDate');if(d)d.value='2026-09-20';var v=document.getElementById('wVal');if(v)v.value='165';return 1;})()`);
  await ev(`addWeight()`); await wait(900);
  const guardado = await ev(`(()=>({n:(state.weight||[]).length,out:document.getElementById('weightOut')?document.getElementById('weightOut').textContent.slice(0,120):''}))()`);
  t('el peso se guarda y aparece en el historial', guardado.n >= 1 && guardado.out.indexOf('165') >= 0, JSON.stringify(guardado));

  // 5 · El Puente Cloudflare no tapa la barra inferior
  const puente = await ev(`(()=>{var p=document.getElementById('ppWorkerToggleBar'),b=document.getElementById('mobileNavBar');if(!p||!b)return null;var pr=p.getBoundingClientRect(),br=b.getBoundingClientRect();return {pb:Math.round(pr.bottom),bt:Math.round(br.top),solapa:pr.bottom>br.top-6};})()`);
  t('Puente Cloudflare no tapa la barra inferior', puente && puente.solapa === false, JSON.stringify(puente));

  // 6 · Cerrar la app por completo
  await cerrarGracioso(ws, child);
  console.log('   app cerrada; perfil conservado en ' + profile);
  return { profile };
}

async function fase2() {
  console.log('===== FASE 2 · reabrir con el mismo perfil =====');
  const { child, ws, ev } = await lanzar();

  // 7 · El fondo sigue visible tras cerrar y abrir
  await wait(1500);
  const fondo = await ev(`(()=>{var capa=document.getElementById('ppCustomBackground');return {cls:document.body.classList.contains('pp-fondo'),bg:capa?capa.style.backgroundImage:'',blob:capa?/blob:/.test(capa.style.backgroundImage):false};})()`);
  t('el fondo continúa visible al reabrir (blob desde IndexedDB)', fondo.cls === true && fondo.blob === true, fondo.bg.slice(0, 60));

  // 8 · Peso completo y registro persistido
  await ev(`openTab('⚖️ Peso')`); await wait(1200);
  const peso = await ev(`(()=>{
    var root=document.getElementById('pesoRoot');
    return {len:root?root.innerHTML.length:0,out:document.getElementById('weightOut')?document.getElementById('weightOut').textContent.slice(0,160):'',n:(state.weight||[]).length};
  })()`);
  t('Peso: sección completa tras reabrir', peso.len > 500, 'len=' + peso.len);
  t('Peso: registro de 165 continúa guardado', peso.n >= 1 && peso.out.indexOf('165') >= 0, JSON.stringify(peso));

  // 9 · Recargar la página: fondo y peso persisten
  await ws.sj('Page.reload', { ignoreCache: true });
  let listo = false;
  for (let i = 0; i < 60; i++) { await wait(750); const r = await ev("!!(document.getElementById('edgeDrawer')&&document.getElementById('mobileNavBar'))"); if (r === true) { listo = true; break; } }
  await ev("state.onboarded=true;['loginScreen','onboardingModal','avisoSinCuentaBox','appTutorial','appUpdateBanner'].forEach(id=>{var el=document.getElementById(id);if(el)el.remove();});1");
  await wait(1500);
  const tras = await ev(`(()=>{var capa=document.getElementById('ppCustomBackground');var root=document.getElementById('pesoRoot');return {fondo:document.body.classList.contains('pp-fondo')&&capa&&/blob:/.test(capa.style.backgroundImage),n:(state.weight||[]).length};})()`);
  t('tras recargar: fondo y peso persisten', tras.fondo === true && tras.n >= 1, JSON.stringify(tras));

  // 10 · Sin excepciones fatales durante todo el flujo
  const fatales = ws.consola.filter(c => /EXCEPCIÓN:/.test(c));
  t('sin excepciones de JavaScript en el flujo', fatales.length === 0, fatales.slice(0, 2).join(' | ').slice(0, 200));

  await cerrarGracioso(ws, child);
}

(async () => {
  await fase1();
  await wait(2000);
  await fase2();
  console.log('\n======== RESULTADO: ' + pasadas + ' PASS · ' + falladas + ' FAIL ========');
  console.log('perfil usado: ' + profile);
  process.exit(falladas ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(2); });
