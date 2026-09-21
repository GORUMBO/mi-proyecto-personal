// Prueba E2E del menú lateral por gestos + responsive móvil (CDP sobre Electron).
// Uso: node tools/prueba-drawer-gestos.js [puerto]
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const wait = ms => new Promise(r => setTimeout(r, ms));

const port = Number(process.argv[2] || 9340);
const rootReal = path.resolve(__dirname, '..');
// PP_APP_DIR permite probar una copia distinta de la app (p. ej. el árbol de un commit)
const root = process.env.PP_APP_DIR || rootReal;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-drawer-'));

async function getTarget() {
  for (let i = 0; i < 90; i++) {
    try {
      const res = await fetch('http://127.0.0.1:' + port + '/json/list');
      const list = await res.json();
      const t = list.find(x => x.type === 'page' && x.webSocketDebuggerUrl);
      if (t) return t;
    } catch (e) {}
    await wait(500);
  }
  throw new Error('sin target CDP');
}
function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let id = 0; const pend = new Map();
    ws.onopen = () => {
      ws.sendJson = (method, params) => new Promise((res, rej) => {
        const mid = ++id; pend.set(mid, { res, rej });
        ws.send(JSON.stringify({ id: mid, method, params: params || {} }));
      });
      resolve(ws);
    };
    ws.onerror = e => reject(new Error('ws error'));
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m); }
    };
  });
}

let pasadas = 0, falladas = 0;
function t(label, ok, extra) {
  if (ok) { pasadas++; console.log('PASS ' + label + (extra ? ' · ' + extra : '')); }
  else { falladas++; console.log('FAIL ' + label + (extra ? ' · ' + extra : '')); }
}

async function main() {
  const exe = path.join(rootReal, 'node_modules', 'electron', 'dist', 'electron.exe');
  const child = spawn(exe, [root, '--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--disable-gpu'], { stdio: 'ignore' });
  const target = await getTarget();
  const ws = await connect(target.webSocketDebuggerUrl);
  await ws.sendJson('Runtime.enable', {});
  await ws.sendJson('Page.enable', {});
  await ws.sendJson('Network.enable', {});
  const ev = async (e) => {
    const m = await ws.sendJson('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
    if (m.result && m.result.exceptionDetails) return 'EXC:' + (m.result.exceptionDetails.exception ? m.result.exceptionDetails.exception.description : m.result.exceptionDetails.text);
    return m.result && m.result.result ? m.result.result.value : undefined;
  };
  const prep = () => ev(`(()=>{try{state.onboarded=true;state.uiSettings=state.uiSettings||{};state.uiSettings.tutorialDone=true;}catch(e){}['loginScreen','onboardingModal','avisoSinCuentaBox','appTutorial','appUpdateBanner'].forEach(function(id){var el=document.getElementById(id);if(el)el.remove();});try{f3DrawerSync();}catch(e){}return 1;})()`);

  const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
  async function setView(w, h, mobile) {
    await ws.sendJson('Emulation.setDeviceMetricsOverride', {
      width: w, height: h, deviceScaleFactor: 3, mobile: mobile,
      screenWidth: w, screenHeight: h
    });
    await ws.sendJson('Emulation.setTouchEmulationEnabled', { enabled: !!mobile, maxTouchPoints: 5 });
    await wait(500);
    await prep();
  }
  async function setUA(ua) { await ws.sendJson('Network.setUserAgentOverride', { userAgent: ua }); }
  async function recargar() {
    await ws.sendJson('Page.reload', { ignoreCache: true });
    let listo = false;
    for (let i = 0; i < 60; i++) { // hasta 30 s esperando el arranque completo
      await wait(500);
      const r = await ev(`!!(document.getElementById('groupNav')&&document.getElementById('mobileNavBar')&&document.getElementById('edgeDrawer'))`);
      if (r === true) { listo = true; break; }
    }
    if (!listo) console.log('AVISO: el arranque tardó >30s');
    await prep();
  }
  async function swipe(x1, y1, x2, y2, pasos) {
    const n = pasos || 8;
    await ws.sendJson('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x1, y: y1 }] });
    for (let i = 1; i <= n; i++) {
      await ws.sendJson('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x1 + (x2 - x1) * i / n, y: y1 + (y2 - y1) * i / n }] });
      await wait(16);
    }
    await ws.sendJson('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await wait(120);
  }
  const clickAt = async (sel) => {
    const box = await ev(`(()=>{var el=document.querySelector(${JSON.stringify(sel)});if(!el)return null;var r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    if (!box) return false;
    await ws.sendJson('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 });
    await ws.sendJson('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 });
    return true;
  };
  const estado = () => ev(`(()=>({ab:window._edgeDrawer.abierto,desde:window._edgeDrawer.desde,open:document.getElementById('edgeDrawer').classList.contains('edge-open'),exp:document.getElementById('edgeHandle').getAttribute('aria-expanded'),ov:document.body.style.overflow,iph:document.documentElement.classList.contains('pp-iphone')}))()`);

  // ============ arranque con UA de iPhone ============
  await setUA(UA);
  await setView(393, 844, true);
  await recargar();
  await ev(`window.scrollTo(0,0);`);

  // ============ 1 · Matriz de anchos: sin desbordamiento, header íntegro ============
  console.log('== 1 · Anchos 320/375/390/393/402/430 (móvil iPhone) ==');
  for (const w of [320, 375, 390, 393, 402, 430]) {
    await setView(w, 844, true);
    const r = await ev(`(()=>{
      var vw=window.innerWidth,doc=document.documentElement;
      var hdr=document.querySelector('header');
      var hr=hdr?hdr.getBoundingClientRect():null;
      var out={vw:vw,sw:doc.scrollWidth,hdrW:hr?Math.round(hr.width):0,hdrL:hr?Math.round(hr.left):0,hdrR:hr?Math.round(hr.right):0,chips:[]};
      document.querySelectorAll('.appStatusBox *').forEach(function(c){
        var cr=c.getBoundingClientRect();
        if(cr.width>0)out.chips.push(Math.round(cr.left)+'-'+Math.round(cr.right));
      });
      return out;
    })()`);
    t(w + 'px sin scroll horizontal', r.sw <= r.vw + 1, 'scrollWidth=' + r.sw + ' vw=' + r.vw);
    t(w + 'px header dentro del viewport', r.hdrL >= 0 && r.hdrR <= r.vw + 1, 'L' + r.hdrL + ' R' + r.hdrR + ' vw' + r.vw);
    t(w + 'px chips del header dentro', r.chips.every(c => { const p = c.split('-').map(Number); return p[0] >= 0 && p[1] <= r.vw + 1; }), r.chips.join(' '));
    const h = await ev(`(()=>{var el=document.getElementById('edgeHandle');if(!el)return null;var r=el.getBoundingClientRect();return {disp:el.style.display,w:Math.round(r.width),h:Math.round(r.height)};})()`);
    t(w + 'px pestaña ☰ visible y >=44x44', h && h.disp !== 'none' && h.w >= 44 && h.h >= 44, h ? h.disp + ' ' + h.w + 'x' + h.h : 'sin handle');
  }

  // ============ 2 · Gestos de apertura y cierre ============
  await setView(393, 844, true);
  console.log('== 2 · Gestos ==');
  await ev(`f3DrawerSync();window.scrollTo(0,0);`);
  let st = await estado();
  t('inicial: cerrado, aria-expanded=false, scroll libre, pp-iphone', st.ab === false && st.exp === 'false' && st.ov === '' && st.iph === true, JSON.stringify(st));

  await swipe(2, 200, 160, 200); // borde izquierdo → derecha
  st = await estado();
  t('gesto izquierda→derecha abre el menú', st.ab === true && st.open === true && st.exp === 'true' && st.ov === 'hidden', JSON.stringify(st));
  t('desde borde izquierdo', st.desde === 'izq', 'desde=' + st.desde);
  let tit = await ev(`document.getElementById('edgeDrawerTitle').textContent`);
  t('título = grupo activo (Inicio)', tit === '🏠 Inicio', tit);
  let btns = await ev(`[...document.querySelectorAll('#edgeDrawerBody .edge-tabbtn')].map(function(b){return b.textContent})`);
  t('minibotones de Inicio (2)', Array.isArray(btns) && btns.length === 2 && btns[0] === '🏠 Inicio' && btns[1] === '🎯 Metas', JSON.stringify(btns));

  // cierre: tocar fuera (scrim)
  const scrimBox = await ev(`(()=>{var r=document.getElementById('edgeScrim').getBoundingClientRect();return {x:r.x+r.width-20,y:r.y+r.height/2};})()`);
  await ws.sendJson('Input.dispatchMouseEvent', { type: 'mousePressed', x: scrimBox.x, y: scrimBox.y, button: 'left', clickCount: 1 });
  await ws.sendJson('Input.dispatchMouseEvent', { type: 'mouseReleased', x: scrimBox.x, y: scrimBox.y, button: 'left', clickCount: 1 });
  await wait(250);
  st = await estado();
  t('tocar fuera cierra y libera scroll', st.ab === false && st.ov === '' && st.exp === 'false', JSON.stringify(st));

  // abrir desde IZQUIERDA → cerrar con gesto CONTRARIO (hacia la izquierda) sobre el telón
  await swipe(2, 200, 160, 200);
  st = await estado();
  t('reabre desde el borde izquierdo', st.ab === true && st.desde === 'izq', JSON.stringify(st));
  await swipe(350, 400, 150, 400);
  st = await estado();
  t('cierre con gesto contrario (izquierda) sobre el telón', st.ab === false, 'abierto=' + st.ab);

  // abrir desde la DERECHA → cerrar con gesto CONTRARIO (hacia la derecha) sobre el telón
  await swipe(391, 200, 240, 200);
  st = await estado();
  t('gesto derecha→izquierda abre el MISMO menú', st.ab === true && st.desde === 'der', JSON.stringify(st));
  await swipe(330, 400, 388, 400); // inicia sobre el TELÓN (a la derecha del panel de 306px)
  st = await estado();
  t('cierre con gesto contrario (derecha) sobre el telón', st.ab === false, 'abierto=' + st.ab);

  // cerrar deslizando el PANEL hacia su posición cerrada (izquierda), siempre
  await swipe(2, 200, 160, 200);
  await swipe(150, 400, 40, 400);
  st = await estado();
  t('deslizar el panel hacia la izquierda cierra', st.ab === false, 'abierto=' + st.ab);

  // gesto vertical desde el borde NO abre (con el menú cerrado)
  await swipe(2, 300, 6, 150);
  st = await estado();
  t('desplazamiento vertical NO abre el menú', st.ab === false, 'abierto=' + st.ab);
  // gesto desde el centro NO abre
  await swipe(196, 300, 330, 300);
  st = await estado();
  t('desliz desde el centro NO abre el menú', st.ab === false, 'abierto=' + st.ab);
  // scroll normal de la página sigue funcionando (gesto vertical en contenido alto)
  await ev(`openTab('🍽️ Recetas');`); await wait(600);
  await ev(`window.scrollTo(0,0);`);
  await swipe(196, 500, 196, 200);
  const yDespues = await ev(`Math.round(window.scrollY)`);
  t('el scroll vertical de la página no se bloquea', yDespues > 0, 'scrollY=' + yDespues);

  // pestaña visible ☰ abre
  await clickAt('#edgeHandle');
  await wait(250);
  st = await estado();
  t('la pestaña ☰ abre el menú (alternativa a los gestos)', st.ab === true && st.exp === 'true', JSON.stringify(st));
  // Escape cierra y devuelve foco
  await ws.sendJson('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  await ws.sendJson('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  await wait(300);
  st = await ev(`(()=>({ab:window._edgeDrawer.abierto,foco:document.activeElement?document.activeElement.id:''}))()`);
  t('Escape cierra y devuelve el foco al botón que abrió', st.ab === false && st.foco === 'edgeHandle', JSON.stringify(st));

  // botón ✕ visible cierra
  await clickAt('#edgeHandle'); await wait(250);
  await clickAt('#edgeDrawerClose'); await wait(250);
  st = await estado();
  t('botón ✕ cierra el menú', st.ab === false, 'abierto=' + st.ab);

  // ============ 3 · Minibotones por sección + navegar y subir ============
  console.log('== 3 · Minibotones por sección ==');
  console.log('   [grupoNav existe]', await ev(`!!document.getElementById('groupNav')`));
  await ev(`showGroup('comer',false)`);
  await wait(400);
  await swipe(2, 200, 160, 200);
  st = await ev(`(()=>({tit:document.getElementById('edgeDrawerTitle').textContent,btns:[...document.querySelectorAll('#edgeDrawerBody .edge-tabbtn')].map(function(b){return b.textContent})}))()`);
  t('en Comer el menú lista las partes de Cocina (modo personal)', st.tit === '🍽️ Comer' && st.btns.length === 4 && st.btns.includes('🍱 Contador') && st.btns.includes('🍽️ Recetas') && st.btns.includes('🥗 Nevera') && st.btns.includes('🔧 Aparatos'), JSON.stringify(st));
  await ev(`f3DrawerCerrar();state._isOwner=true;`);
  await wait(200);
  await swipe(2, 200, 160, 200);
  st = await ev(`(()=>({ab:window._edgeDrawer.abierto,btns:[...document.querySelectorAll('#edgeDrawerBody .edge-tabbtn')].map(function(b){return b.textContent})}))()`);
  t('con modo profesional aparece también Thermomix (respeta tabAllowed)', st.ab === true && st.btns.length === 5 && st.btns.includes('🤖 Thermomix TM5'), JSON.stringify(st));
  await ev(`f3DrawerCerrar();state._isOwner=false;showGroup('vida',false)`);
  await wait(400);
  await swipe(2, 200, 160, 200);
  st = await ev(`(()=>({btns:[...document.querySelectorAll('#edgeDrawerBody .edge-tabbtn')].map(function(b){return b.textContent})}))()`);
  t('en Día a día solo las pestañas permitidas (modo personal)', st.btns.length === 1 && st.btns[0] === '🗣️ Inglés', JSON.stringify(st));
  await ev(`f3DrawerCerrar();showGroup('comer',false)`);
  await wait(400);
  // navegar con minibotón: Nevera + subir hasta arriba
  await ev(`window.scrollTo(0,600);`);
  await swipe(2, 200, 160, 200);
  const btnNevera = await ev(`(()=>{var b=[...document.querySelectorAll('#edgeDrawerBody .edge-tabbtn')].find(function(x){return x.textContent==='🥗 Nevera'});if(!b)return null;var r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  if (btnNevera) {
    await ws.sendJson('Input.dispatchMouseEvent', { type: 'mousePressed', x: btnNevera.x, y: btnNevera.y, button: 'left', clickCount: 1 });
    await ws.sendJson('Input.dispatchMouseEvent', { type: 'mouseReleased', x: btnNevera.x, y: btnNevera.y, button: 'left', clickCount: 1 });
  }
  let navOk = false;
  for (let i = 0; i < 20; i++) {
    await wait(300);
    const r2 = await ev(`(()=>({tab:tabs[_activeTab],y:Math.round(window.scrollY),ab:window._edgeDrawer.abierto}))()`);
    if (r2.tab === '🥗 Nevera' && r2.ab === false && r2.y === 0) { navOk = true; t('minibotón abre Nevera, cierra el menú y sube hasta arriba', true, JSON.stringify(r2)); break; }
  }
  if (!navOk) t('minibotón abre Nevera, cierra el menú y sube hasta arriba', false, 'no llegó al estado esperado');

  // ============ 4 · Solo Modo completo (modo normal) ============
  console.log('== 4 · Solo en modo normal (completo) ==');
  console.log('   [grupoNav existe]', await ev(`!!document.getElementById('groupNav')`));
  await ev(`(()=>{f3ModosState();var id='mprueba';state.misModos.modos[id]={id:id,nombre:'Modo prueba',icono:'🧪',color:'#15704f',inicio:'🏠 Inicio',barra:[{dest:'💪 Ejercicio',icono:'💪',txt:'Fitness'}],mas:[],resumen:[],auto:null};if(state.misModos.orden.indexOf(id)<0)state.misModos.orden.push(id);f3ModoActivar(id);return 1;})()`);
  let modoOk = false;
  for (let i = 0; i < 15; i++) { // espera tolerante: el cambio de modo re-renderiza
    await wait(300);
    const r4 = await ev(`(()=>({disp:document.getElementById('edgeHandle').style.display,ab:window._edgeDrawer.abierto,activo:state.misModos.activo}))()`);
    if (r4.activo === 'mprueba' && r4.disp === 'none' && r4.ab === false) { modoOk = true; st = r4; break; }
    st = r4;
  }
  t('en un modo propio la pestaña desaparece y el menú se cierra', modoOk === true, JSON.stringify(st));
  await swipe(2, 200, 160, 200);
  st = await estado();
  t('el gesto NO abre en un modo propio', st.ab === false, 'abierto=' + st.ab);
  await ev(`f3ModoActivar('completo')`);
  await wait(500);
  st = await ev(`(()=>({disp:document.getElementById('edgeHandle').style.display}))()`);
  t('volver al Modo completo devuelve la pestaña', st.disp !== 'none', 'display=' + st.disp);

  // ============ 5 · Protecciones: carruseles, inputs, arrastrables ============
  console.log('== 5 · Protecciones contra gestos accidentales ==');
  console.log('   [grupoNav existe]', await ev(`!!document.getElementById('groupNav')`));
  const zona = await ev(`(()=>{
    function mk(attrs,css){var el=document.createElement('div');if(attrs)for(var k in attrs)el.setAttribute(k,attrs[k]);if(css)el.style.cssText=css;document.body.appendChild(el);return el;}
    var c=mk({},'position:fixed;left:0;top:40px;width:120px;height:60px;overflow-x:auto;background:#fff;z-index:5000');
    var inner=mk({},'width:400px;height:30px');
    c.appendChild(inner);
    var inp=document.createElement('input');inp.style.cssText='position:fixed;left:0;top:110px;width:120px;z-index:5000';document.body.appendChild(inp);
    var arr=mk({draggable:'true'},'position:fixed;left:0;top:180px;width:120px;height:50px;background:#fff;z-index:5000');
    var plano=mk({},'position:fixed;left:0;top:240px;width:120px;height:50px;background:#fff;z-index:5000');
    var r={};
    r.carrusel=!!f3DrawerZonaOk(inner);
    r.input=!!f3DrawerZonaOk(inp);
    r.arrastrable=!!f3DrawerZonaOk(arr);
    r.plano=!!f3DrawerZonaOk(plano);
    [c,inp,arr,plano].forEach(function(x){x.remove();});
    return r;
  })()`);
  t('zona OK: carrusel horizontal rechazado', zona.carrusel === false, 'carrusel=' + zona.carrusel);
  t('zona OK: input rechazado', zona.input === false, 'input=' + zona.input);
  t('zona OK: arrastrable rechazado', zona.arrastrable === false, 'arrastrable=' + zona.arrastrable);
  t('zona OK: área neutra aceptada', zona.plano === true, 'plano=' + zona.plano);
  // carrusel horizontal de verdad: el gesto no abre
  await ev(`(()=>{var c=document.createElement('div');c.id='tCarrusel';c.style.cssText='position:fixed;left:0;top:60px;width:120px;height:80px;overflow-x:auto;background:#fff;z-index:5000';c.innerHTML='<div style="width:500px;height:60px">x</div>';document.body.appendChild(c);return 1;})()`);
  await swipe(2, 100, 170, 100);
  st = await estado();
  t('gesto sobre carrusel NO abre', st.ab === false, 'abierto=' + st.ab);
  await ev(`(()=>{var c=document.getElementById('tCarrusel');if(c)c.remove();return 1;})()`);

  // ============ 5b · Carruseles, videos, formularios y campos siguen funcionando ============
  console.log('== 5b · Funcionalidad real de carrusel / campos / video ==');
  // Carrusel horizontal real en el borde: el gesto no lo roba y no cancela sus
  // eventos táctiles (preventDefault=false en cada touchmove ⇒ el scroll nativo
  // del iPhone funciona). El desplazamiento se verifica con entrada real (wheel).
  await ev(`(()=>{var c=document.createElement('div');c.id='tCarruselReal';c.style.cssText='position:fixed;left:0;top:60px;width:130px;height:90px;overflow-x:auto;background:#fff;z-index:5000';c.innerHTML='<div id="tCarruselRealIn" style="width:520px;height:60px;background:linear-gradient(90deg,#9dd5b4,#15704f)"></div>';document.body.appendChild(c);window.__prevented=[];document.addEventListener('touchmove',function(e){window.__prevented.push(!!e.defaultPrevented);},{passive:false});return 1;})()`);
  await swipe(10, 100, 115, 100);
  let carr = await ev(`(()=>({ab:window._edgeDrawer.abierto,sl:Math.round(document.getElementById('tCarruselReal').scrollLeft),prev:window.__prevented.slice()}))()`);
  t('deslizar sobre un carrusel NO abre el menú y NO cancela sus eventos táctiles', carr.ab === false && carr.prev.length > 0 && carr.prev.every(p => p === false), JSON.stringify(carr));
  await ws.sendJson('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 60, y: 100, deltaX: 150, deltaY: 0 });
  await wait(300);
  carr = await ev(`(()=>({sl:Math.round(document.getElementById('tCarruselReal').scrollLeft)}))()`);
  t('el carrusel sigue desplazándose (entrada del navegador intacta)', carr.sl > 0, 'scrollLeft=' + carr.sl);
  await ev(`(()=>{var c=document.getElementById('tCarruselReal');if(c)c.remove();return 1;})()`);
  // Campo de texto en el borde: el toque no abre el menú y SÍ se puede escribir
  await ev(`(()=>{var i=document.createElement('input');i.id='tCampoBorde';i.style.cssText='position:fixed;left:0;top:170px;width:150px;height:44px;z-index:5000;font-size:16px';document.body.appendChild(i);return 1;})()`);
  await swipe(10, 190, 120, 190);
  let campo = await ev(`(()=>({ab:window._edgeDrawer.abierto,foco:document.activeElement&&document.activeElement.id}))()`);
  t('tocar un campo de texto NO abre el menú', campo.ab === false, 'abierto=' + campo.ab);
  const cbox = await ev(`(()=>{var r=document.getElementById('tCampoBorde').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  await ws.sendJson('Input.dispatchMouseEvent', { type: 'mousePressed', x: cbox.x, y: cbox.y, button: 'left', clickCount: 1 });
  await ws.sendJson('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cbox.x, y: cbox.y, button: 'left', clickCount: 1 });
  await ws.sendJson('Input.insertText', { text: 'abc' });
  await wait(200);
  campo = await ev(`(()=>({val:document.getElementById('tCampoBorde').value,ab:window._edgeDrawer.abierto}))()`);
  t('el campo recibe foco y acepta escritura', campo.val === 'abc' && campo.ab === false, JSON.stringify(campo));
  await ev(`(()=>{var i=document.getElementById('tCampoBorde');if(i)i.remove();return 1;})()`);
  // Video y select: zona rechazada + el gesto no abre
  await ev(`(()=>{var v=document.createElement('video');v.id='tVideo';v.setAttribute('controls','');v.style.cssText='position:fixed;left:0;top:230px;width:150px;height:80px;z-index:5000;background:#000';var s=document.createElement('select');s.id='tSelect';s.style.cssText='position:fixed;left:0;top:320px;width:150px;z-index:5000';s.innerHTML='<option>1</option>';document.body.appendChild(v);document.body.appendChild(s);return 1;})()`);
  const zona2 = await ev(`(()=>({video:!!f3DrawerZonaOk(document.getElementById('tVideo')),select:!!f3DrawerZonaOk(document.getElementById('tSelect'))}))()`);
  t('zona OK: video rechazado', zona2.video === false, 'video=' + zona2.video);
  t('zona OK: select rechazado', zona2.select === false, 'select=' + zona2.select);
  await swipe(10, 265, 120, 265);
  st = await estado();
  t('gesto sobre video NO abre el menú', st.ab === false, 'abierto=' + st.ab);
  await ev(`(()=>{var v=document.getElementById('tVideo'),s=document.getElementById('tSelect');if(v)v.remove();if(s)s.remove();return 1;})()`);

  // ============ 5c · Insignias del encabezado en estado de ERROR ============
  console.log('== 5c · Encabezado con versión, flor y estado de error ==');
  await setView(320, 844, true);
  await ev(`(()=>{
    var v=document.querySelector('.versionChip');if(v)v.textContent='v1.195.3';
    var sb=document.getElementById('syncBadge');if(sb)sb.textContent='⚠ Error al sincronizar';
    var sl=document.getElementById('syncLastLine');if(sl)sl.textContent='Último intento: hoy 14:32 · sin conexión al puente';
    return 1;
  })()`);
  await wait(300);
  const hdrErr = await ev(`(()=>{
    var vw=window.innerWidth;
    var hdr=document.querySelector('header').getBoundingClientRect();
    var out={vw:vw,hdrR:Math.round(hdr.right),hdrL:Math.round(hdr.left),sw:document.documentElement.scrollWidth,dentro:true,piezas:{}};
    ['#appLogoBoot','.versionChip','#syncBadge','#syncLastLine'].forEach(function(sel){
      var el=document.querySelector(sel);
      if(!el){out.piezas[sel]='FALTA';out.dentro=false;return;}
      var r=el.getBoundingClientRect();
      out.piezas[sel]=Math.round(r.left)+'-'+Math.round(r.right);
      if(r.width===0||r.left<hdr.left-1||r.right>hdr.right+1)out.dentro=false;
    });
    return out;
  })()`);
  t('320px con error: header dentro del viewport y sin desborde', hdrErr.hdrL >= 0 && hdrErr.hdrR <= hdrErr.vw + 1 && hdrErr.sw <= hdrErr.vw + 1, JSON.stringify(hdrErr));
  t('flor, versión, sync y línea de error caben dentro del header', hdrErr.dentro === true, JSON.stringify(hdrErr.piezas));
  await ev(`(()=>{var sb=document.getElementById('syncBadge');if(sb)sb.textContent='● Local';var sl=document.getElementById('syncLastLine');if(sl)sl.textContent='';var v=document.querySelector('.versionChip');if(v)v.textContent='v1.182';return 1;})()`);
  await setView(393, 844, true);

  // ============ 6 · Escritorio 1280 y tableta 768 ============
  console.log('== 6 · Escritorio y tableta ==');
  await setUA('');
  await setView(1280, 820, false);
  // El cambio de UA puede recargar la página: esperar el arranque completo
  for (let i = 0; i < 40; i++) {
    await wait(500);
    const listo6 = await ev(`!!(document.getElementById('groupNav')&&document.getElementById('mobileNavBar')&&document.getElementById('edgeDrawer')&&document.getElementById('edgeHandle'))`);
    if (listo6 === true) break;
  }
  await ev(`f3DrawerSync();`);
  await wait(300);
  st = await ev(`(()=>({disp:document.getElementById('edgeHandle').style.display,gnav:getComputedStyle(document.getElementById('groupNav')).display,mnav:getComputedStyle(document.getElementById('mobileNavBar')).display,iph:document.documentElement.classList.contains('pp-iphone'),pad:getComputedStyle(document.querySelector('header')).paddingLeft,sw:document.documentElement.scrollWidth,vw:window.innerWidth}))()`);
  t('escritorio: sin ☰, navegación de escritorio intacta, sin desborde', st.disp === 'none' && st.gnav !== 'none' && st.mnav === 'none' && st.iph === false && st.sw <= st.vw + 1 && st.pad === '12px', JSON.stringify(st));
  // Escape disponible en escritorio si el drawer se muestra en pruebas
  await ev(`f3DrawerAbrir('izq')`); await wait(250);
  await ws.sendJson('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  await ws.sendJson('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  await wait(300);
  st = await ev(`(()=>({ab:window._edgeDrawer.abierto}))()`);
  t('escritorio: Escape cierra el drawer si llega a mostrarse', st.ab === false, 'abierto=' + st.ab);

  await setView(768, 820, false);
  await ev(`f3DrawerSync();`);
  st = await ev(`(()=>({sw:document.documentElement.scrollWidth,vw:window.innerWidth}))()`);
  t('768px: sin desborde horizontal', st.sw <= st.vw + 1, 'sw=' + st.sw + ' vw=' + st.vw);

  // ============ 7 · iPhone en horizontal (causa real del reporte) ============
  console.log('== 7 · iPhone horizontal (852px, UA iPhone) ==');
  await setUA(UA);
  await setView(852, 393, true);
  for (let i = 0; i < 40; i++) {
    await wait(500);
    const listo7 = await ev(`!!(document.getElementById('groupNav')&&document.getElementById('mobileNavBar')&&document.getElementById('edgeDrawer')&&document.getElementById('edgeHandle'))`);
    if (listo7 === true) break;
  }
  await ev(`f3DrawerSync();`);
  await wait(300);
  st = await ev(`(()=>({iph:document.documentElement.classList.contains('pp-iphone'),gnav:getComputedStyle(document.getElementById('groupNav')).display,mnav:getComputedStyle(document.getElementById('mobileNavBar')).display,disp:document.getElementById('edgeHandle').style.display,sw:document.documentElement.scrollWidth,vw:window.innerWidth}))()`);
  t('horizontal: navegación móvil (no de escritorio) + ☰ + sin desborde', st.iph === true && st.gnav === 'none' && st.mnav !== 'none' && st.disp !== 'none' && st.sw <= st.vw + 1, JSON.stringify(st));
  await swipe(2, 100, 170, 100);
  st = await estado();
  t('horizontal: el gesto abre el menú', st.ab === true, 'abierto=' + st.ab);
  await ev(`f3DrawerCerrar();`);

  // ============ 8 · SE 2 (375) y accesibilidad ============
  console.log('== 8 · SE 2 y accesibilidad ==');
  await setView(375, 667, true);
  st = await ev(`(()=>({pad:getComputedStyle(document.querySelector('header')).paddingLeft,gnav:getComputedStyle(document.getElementById('groupNav')).display,mnav:getComputedStyle(document.getElementById('mobileNavBar')).display,sw:document.documentElement.scrollWidth,vw:window.innerWidth}))()`);
  t('SE 2: header 10px, navegación móvil, sin desborde (igual que antes)', st.pad === '10px' && st.gnav === 'none' && st.mnav !== 'none' && st.sw <= st.vw + 1, JSON.stringify(st));
  await ev(`f3DrawerCrear();f3DrawerSync();f3DrawerAbrir('izq');`);
  await wait(250);
  st = await ev(`(()=>{var d=document.getElementById('edgeDrawer');return {role:d.getAttribute('role'),modal:d.getAttribute('aria-modal'),label:d.getAttribute('aria-label'),ah:d.getAttribute('aria-hidden'),haria:document.getElementById('edgeHandle').getAttribute('aria-label'),hcont:document.getElementById('edgeHandle').getAttribute('aria-controls'),foco:document.activeElement?document.activeElement.className:'none'};})()`);
  t('a11y: role=dialog, aria-modal, aria-label, aria-hidden, aria-controls', st.role === 'dialog' && st.modal === 'true' && !!st.label && st.ah === 'false' && !!st.haria && st.hcont === 'edgeDrawer' && String(st.foco).indexOf('edge-tabbtn') === 0, JSON.stringify(st));
  await ev(`f3DrawerCerrar();`);
  // prefers-reduced-motion: transiciones apagadas
  await ws.sendJson('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await wait(200);
  st = await ev(`(()=>({dur:getComputedStyle(document.getElementById('edgeDrawer')).transitionDuration}))()`);
  t('prefers-reduced-motion: sin transición', st.dur === '0s', 'duration=' + st.dur);
  await ws.sendJson('Emulation.setEmulatedMedia', { features: [] });

  // ============ 9 · Sección actual se conserva al abrir/cerrar ============
  console.log('== 9 · Abrir/cerrar conserva la sección ==');
  await ev(`showGroup('cuerpo',false);openTab('💪 Ejercicio');window.scrollTo(0,300);`);
  await wait(800);
  const antes = await ev(`(()=>({tab:tabs[_activeTab],grp:_activeGroup}))()`);
  await swipe(2, 200, 160, 200);
  await ev(`f3DrawerCerrar()`);
  const despues = await ev(`(()=>({tab:tabs[_activeTab],grp:_activeGroup}))()`);
  t('abrir y cerrar no cambia la sección', antes.tab === despues.tab && antes.grp === despues.grp && despues.tab === '💪 Ejercicio', JSON.stringify({ antes, despues }));

  console.log('\n======== RESULTADO: ' + pasadas + ' PASS · ' + falladas + ' FAIL ========');
  await wait(600);
  try { child.kill(); } catch (e) {}
  await wait(500);
  try { child.kill('SIGKILL'); } catch (e) {}
  process.exit(falladas ? 1 : 0);
}
main().catch(e => { console.error('ERROR', e); process.exit(2); });
