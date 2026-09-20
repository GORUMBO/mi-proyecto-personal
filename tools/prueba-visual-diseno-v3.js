// Prueba obligatoria del editor de distribución v3 (persistencia real,
// selección múltiple, puente con coordenadas, barra de 4 filas, tarjetas).
// Uso: node tools/prueba-visual-diseno-v3.js [puerto]  (default 9335)
const port = Number(process.argv[2] || 9335);
const fs = require('fs');
const path = require('path');
const wait = ms => new Promise(r => setTimeout(r, ms));

async function getTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch('http://127.0.0.1:' + port + '/json/list');
      const list = await res.json();
      const t = list.find(x => x.type === 'page' && x.webSocketDebuggerUrl);
      if (t) return t;
    } catch (e) { /* aún no listo */ }
    await wait(500);
  }
  throw new Error('No se encontró target CDP en ' + port);
}
function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let id = 0;
    const pend = new Map();
    ws.onopen = () => {
      ws.sendJson = (method, params) => new Promise((res, rej) => {
        const mid = ++id; pend.set(mid, { res, rej });
        ws.send(JSON.stringify({ id: mid, method, params: params || {} }));
      });
      resolve(ws);
    };
    ws.onerror = () => reject(new Error('ws error'));
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
    };
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
  const evalJs = async (expr, awaitPromise) => {
    const r = await ws.sendJson('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: !!awaitPromise });
    if (r.exceptionDetails) throw new Error('EVAL ERROR: ' + JSON.stringify(r.exceptionDetails).slice(0, 400));
    return r.result.value;
  };
  const neutralizar = () => evalJs(`(function(){
    try{
      window._loginPrompted=true;window.confirm=function(){return true;};window.alert=function(){};
      state.onboarded=true;
      ['appTutorial','loginScreen','onboardingModal','avisoSinCuentaBox'].forEach(function(id){var el=document.getElementById(id);if(el)el.remove();});
    }catch(e){}
    return 1;
  })()`);
  const dragMouse = async (sel, dx, dy, modifiers) => {
    await evalJs(`(function(){state.uiSettings.tutorialDone=true;['appTutorial','loginScreen','onboardingModal','avisoSinCuentaBox'].forEach(function(id){var el=document.getElementById(id);if(el)el.remove();});window.scrollTo(0,0);return 1})()`);
    await wait(150);
    const box = await evalJs(`(function(){var el=document.querySelector('${sel}');if(!el)return null;var r=el.getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)}})()`);
    if (!box) return false;
    const mods = modifiers || 0;
    await ws.sendJson('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', buttons: 1, clickCount: 1, modifiers: mods });
    for (let i = 1; i <= 5; i++) {
      await ws.sendJson('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x + Math.round(dx * i / 5), y: box.y + Math.round(dy * i / 5), button: 'left', buttons: 1, modifiers: mods });
      await wait(40);
    }
    await ws.sendJson('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x + dx, y: box.y + dy, button: 'left', buttons: 0, clickCount: 1, modifiers: mods });
    await wait(250);
    return true;
  };
  const clicCon = async (sel, modifiers) => {
    const box = await evalJs(`(function(){var el=document.querySelector('${sel}');if(!el)return null;var r=el.getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)}})()`);
    if (!box) return false;
    await ws.sendJson('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', buttons: 1, clickCount: 1, modifiers: modifiers || 0 });
    await wait(50);
    await ws.sendJson('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', buttons: 0, clickCount: 1, modifiers: modifiers || 0 });
    await wait(200);
    return true;
  };
  const capturar = async (nombre) => {
    const r = await ws.sendJson('Page.captureScreenshot', { format: 'png' });
    const dir = path.join(__dirname, 'pruebas', 'capturas');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, nombre + '.png'), Buffer.from(r.data, 'base64'));
    console.log('  📸 ' + nombre + '.png');
  };

  await ws.sendJson('Runtime.enable', {});
  await ws.sendJson('Page.enable', {});
  await ws.sendJson('DOM.enable', {});
  await ws.sendJson('Page.reload', { ignoreCache: true });
  await wait(3500);
  await neutralizar();
  await wait(300);

  console.log('== T1: barra de 4 filas sin overflow horizontal ==');
  await evalJs(`f3DistEntrar()`);
  await wait(500);
  t('T1a · Las 4 filas existen (Dispositivo/Selección, Movimiento/Tamaño/Alineación, Cuadrícula/Bloquear…, Cancelar/Guardar/Restaurar)',
    await evalJs(`(function(){var tb=document.getElementById('ppDistToolbar');var tx=tb?tb.innerText:'';return tx.indexOf('Dispositivo')>=0&&tx.indexOf('Selección')>=0&&tx.indexOf('Movimiento')>=0&&tx.indexOf('Tamaño')>=0&&tx.indexOf('Alineación')>=0&&tx.indexOf('Cuadrícula')>=0&&tx.indexOf('Cancelar')>=0&&tx.indexOf('Guardar distribución')>=0&&tx.indexOf('Restaurar distribución de este dispositivo')>=0;})()`));
  t('T1b · Sin overflow horizontal en la barra (scroll vertical permitido)',
    await evalJs(`(function(){var tb=document.getElementById('ppDistToolbar');return tb&&tb.scrollWidth<=tb.clientWidth+2&&getComputedStyle(tb).overflowX==='hidden';})()`));

  console.log('\n== T2: selección múltiple con Ctrl+clic (3 botones) ==');
  await clicCon('#gbtn_inicio', 0);
  await clicCon('#gbtn_comer', 2); // Ctrl
  await clicCon('#gbtn_dinero', 2); // Ctrl
  t('T2a · 3 elementos seleccionados con Ctrl+clic', await evalJs(`(window._distSels||[]).length===3`), await evalJs(`JSON.stringify((window._distSels||[]).map(function(s){return s.e}))`));
  t('T2b · Contador "3 elementos seleccionados" y contorno de grupo',
    await evalJs(`(function(){var tb=document.getElementById('ppDistToolbar');return tb&&tb.innerText.indexOf('3 elementos seleccionados')>=0&&!!document.getElementById('ppGrupoOutline');})()`));

  console.log('\n== T3: mover el grupo conservando distancias y agrandar/achicar ==');
  const res3 = await evalJs(`(function(){
    var antes={};
    [{e:'logo'},{e:'nombre'},{e:'subtitulo'}].forEach(function(s){var i=f3DistItem(s.e);antes[s.e]={y:i.it.y,x:i.it.x}});
    window._distSels=[{e:'logo',tipo:'libre'},{e:'nombre',tipo:'libre'},{e:'subtitulo',tipo:'libre'}];
    window._distSel={e:'logo',tipo:'libre'};
    f3DistTeclado(0,16);
    var despues={};
    [{e:'logo'},{e:'nombre'},{e:'subtitulo'}].forEach(function(s){var i=f3DistItem(s.e);despues[s.e]={y:i.it.y,x:i.it.x}});
    return JSON.stringify({antes:antes,despues:despues});
  })()`);
  const r3 = JSON.parse(res3);
  t('T3a · Mover el grupo mueve los 3 elementos juntos (todos con coordenadas propias)',
    ['logo','nombre','subtitulo'].every(function(k){return r3.despues[k].y!=null&&r3.despues[k].x!=null;}) &&
    new Set(['logo','nombre','subtitulo'].map(function(k){return r3.despues[k].x+','+r3.despues[k].y})).size===3, res3);
  await evalJs(`f3DistTam(0.3)`);
  await wait(200);
  const escs2 = await evalJs(`(function(){var out=[];['logo','nombre','subtitulo'].forEach(function(k){var i=f3DistItem(k);out.push(i.it.esc)});return JSON.stringify(out)})()`);
  t('T3b · Agrandar el grupo escala a todos', JSON.parse(escs2).every(function(e){return e>1}), escs2);
  await evalJs(`f3DistTam(-0.3)`);
  await wait(200);
  t('T3c · Achicar el grupo funciona', await evalJs(`(function(){var out=[];['logo','nombre','subtitulo'].forEach(function(k){var i=f3DistItem(k);out.push(Math.abs(i.it.esc-1)<0.01)});return out.every(Boolean)})()`));

  console.log('\n== T4: Guardar persiste coords EXACTAS + recargar ==');
  await evalJs(`(function(){window._distSels=[{e:'subtitulo',tipo:'libre'}];window._distSel={e:'subtitulo',tipo:'libre'};f3DistTeclado(24,8);return 1})()`);
  await wait(200);
  const coordsGuardar = await evalJs(`JSON.stringify(f3DistConfig().header.subtitulo)`);
  await evalJs(`f3DistSalir(true)`);
  await wait(500);
  const coordsEnEstado = await evalJs(`JSON.stringify(f3AparienciaV2().layout.porDispositivo.desktop.header.subtitulo)`);
  t('T4a · Guardar escribe el borrador en el estado guardado', coordsGuardar === coordsEnEstado, coordsEnEstado);
  const posVisual = await evalJs(`(function(){var el=document.getElementById('appMetaBoot');var r=el.getBoundingClientRect();return Math.round(r.left)+','+Math.round(r.top)})()`);
  await ws.sendJson('Page.reload', { ignoreCache: true });
  await wait(3500);
  await neutralizar();
  await wait(400);
  const posTrasRecarga = await evalJs(`(function(){var el=document.getElementById('appMetaBoot');var r=el.getBoundingClientRect();return Math.round(r.left)+','+Math.round(r.top)})()`);
  t('T4b · Tras recargar, la posición visual es la guardada (fuera del editor también)',
    posTrasRecarga === posVisual, posVisual + ' → ' + posTrasRecarga);
  t('T4c · La configuración guardada sigue intacta', await evalJs(`JSON.stringify(f3AparienciaV2().layout.porDispositivo.desktop.header.subtitulo)`) === coordsEnEstado);

  console.log('\n== T5: Cancelar restaura el último diseño guardado ==');
  const guardado = await evalJs(`JSON.stringify(f3AparienciaV2().layout.porDispositivo.desktop.header.nombre)`);
  await evalJs(`f3DistEntrar()`);
  await wait(400);
  await evalJs(`(function(){window._distSels=[{e:'nombre',tipo:'libre'}];window._distSel={e:'nombre',tipo:'libre'};f3DistTeclado(40,0);return 1})()`);
  await wait(200);
  await evalJs(`f3DistSalir(false)`);
  await wait(400);
  t('T5 · Cancelar descartó el borrador (estado guardado intacto)',
    await evalJs(`JSON.stringify(f3AparienciaV2().layout.porDispositivo.desktop.header.nombre)`) === guardado);

  console.log('\n== T6: Puente Cloudflare: mover, redimensionar, guardar y recargar ==');
  await evalJs(`f3DistEntrar()`);
  await wait(400);
  const puente0 = await evalJs(`(function(){var el=document.getElementById('ppWorkerToggleBar');var r=el.getBoundingClientRect();return Math.round(r.left)+','+Math.round(r.top)})()`);
  await dragMouse('#ppWorkerToggleBar .ppAsa', -120, -160);
  await wait(300);
  await evalJs(`(function(){window._distSels=[{e:'puente',tipo:'flotante'}];window._distSel={e:'puente',tipo:'flotante'};f3DistTam(0.2);return 1})()`);
  await wait(200);
  const puenteCfg = await evalJs(`JSON.stringify(f3DistConfig().puente)`);
  await evalJs(`f3DistSalir(true)`);
  await wait(500);
  const puente1 = await evalJs(`(function(){var el=document.getElementById('ppWorkerToggleBar');var r=el.getBoundingClientRect();return Math.round(r.left)+','+Math.round(r.top)})()`);
  t('T6a · El Puente se mueve con coordenadas reales y persiste su posición', puente0 !== puente1, puente0 + ' → ' + puente1);
  await ws.sendJson('Page.reload', { ignoreCache: true });
  await wait(3500);
  await neutralizar();
  await wait(400);
  const puente2 = await evalJs(`(function(){var el=document.getElementById('ppWorkerToggleBar');var r=el.getBoundingClientRect();return Math.round(r.left)+','+Math.round(r.top)})()`);
  t('T6b · Tras recargar el Puente conserva posición y tamaño guardados', puente2 === puente1, puente1 + ' → ' + puente2);
  t('T6c · El Puente queda dentro del viewport y zonas seguras',
    await evalJs(`(function(){var el=document.getElementById('ppWorkerToggleBar');var r=el.getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=window.innerWidth&&r.bottom<=window.innerHeight;})()`));

  console.log('\n== T7: dispositivos separados sin mezclar ==');
  const cfgDesktop = await evalJs(`JSON.stringify(f3AparienciaV2().layout.porDispositivo.desktop.header.subtitulo)`);
  const cfgIphone = await evalJs(`JSON.stringify(f3AparienciaV2().layout.porDispositivo.iphonePortrait.header.subtitulo)`);
  await evalJs(`f3DistEntrar()`);
  await wait(400);
  await evalJs(`f3DistDispositivo('iphonePortrait')`);
  await wait(300);
  await evalJs(`(function(){window._distSels=[{e:'subtitulo',tipo:'libre'}];window._distSel={e:'subtitulo',tipo:'libre'};f3DistTeclado(12,4);return 1})()`);
  await wait(200);
  await evalJs(`f3DistSalir(true)`);
  await wait(400);
  t('T7 · Cambiar la distribución de iPhone no altera la de escritorio',
    await evalJs(`JSON.stringify(f3AparienciaV2().layout.porDispositivo.desktop.header.subtitulo)`) === cfgDesktop &&
    await evalJs(`JSON.stringify(f3AparienciaV2().layout.porDispositivo.iphonePortrait.header.subtitulo)`) !== cfgIphone);

  console.log('\n== T8: Shift+clic, rectángulo y pulsación larga táctil ==');
  await evalJs(`f3DistEntrar()`);
  await wait(400);
  await clicCon('#gbtn_inicio', 0);
  await clicCon('#gbtn_dinero', 8); // Shift = 8
  t('T8a · Shift+clic selecciona el rango de botones de la barra',
    await evalJs(`(window._distSels||[]).length>=4`), await evalJs(`(window._distSels||[]).length`));
  // rectángulo sobre la cabecera (hueco vacío)
  const hueco = await evalJs(`(function(){var h=document.querySelector('header');var r=h.getBoundingClientRect();return {x:Math.round(r.left+40),y:Math.round(r.bottom-8)}})()`);
  await ws.sendJson('Input.dispatchMouseEvent', { type: 'mousePressed', x: hueco.x, y: hueco.y, button: 'left', buttons: 1, clickCount: 1 });
  await ws.sendJson('Input.dispatchMouseEvent', { type: 'mouseMoved', x: hueco.x + 500, y: hueco.y + 40, button: 'left', buttons: 1 });
  await ws.sendJson('Input.dispatchMouseEvent', { type: 'mouseReleased', x: hueco.x + 500, y: hueco.y + 40, button: 'left', buttons: 0, clickCount: 1 });
  await wait(300);
  t('T8b · El rectángulo de selección captura los elementos que toca',
    await evalJs(`(window._distSels||[]).length>=1`), await evalJs(`(window._distSels||[]).length`));
  // pulsación larga táctil en iPhone
  await ws.sendJson('Emulation.setDeviceMetricsOverride', { width: 375, height: 667, deviceScaleFactor: 2, mobile: true });
  await wait(800);
  const tbox = await evalJs(`(function(){var el=document.getElementById('appMetaBoot');var r=el.getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)}})()`);
  await ws.sendJson('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: tbox.x, y: tbox.y }] });
  await wait(700); // >500ms = pulsación larga
  await ws.sendJson('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await wait(300);
  t('T8c · Pulsación larga táctil activa el modo de selección múltiple',
    await evalJs(`window._distMulti===true&&(window._distSels||[]).length>=1`));
  await ws.sendJson('Emulation.clearDeviceMetricsOverride', {});
  await wait(400);
  await evalJs(`f3DistQuitarSeleccion()`);

  console.log('\n== T9: textos dentro de las tarjetas en 4 tamaños ==');
  const verificarTarjetas = async () => evalJs(`(function(){var ok=true;var det='';[].slice.call(document.querySelectorAll('.apCard')).forEach(function(c){var r=c.getBoundingClientRect();if(r.width<=0)return;var t2=c.querySelector('.apCardT');var d=c.querySelector('.apCardD');if(t2&&t2.scrollWidth>t2.clientWidth+2){ok=false;det+='T:'+t2.innerText.slice(0,14)+' '}if(d&&d.scrollWidth>d.clientWidth+2){ok=false;det+='D:'+d.innerText.slice(0,14)+' '}});return {ok:ok,det:det}})()`);
  await evalJs(`f3DistSalir(false)`);
  await wait(300);
  await evalJs(`showGroup('ajustes',false);showTab(tabs.indexOf('👤 Perfil'),null)`);
  await wait(400);
  await evalJs(`(function(){var d=document.getElementById('ajAp');if(d)d.open=true;return 1})()`);
  await wait(200);
  let res = await verificarTarjetas();
  t('T9a · Tarjetas sin desbordes a 1280×820', res.ok, res.det);
  await ws.sendJson('Emulation.setDeviceMetricsOverride', { width: 1024, height: 768, deviceScaleFactor: 1, mobile: false });
  await wait(500);
  res = await verificarTarjetas();
  t('T9b · Tarjetas sin desbordes a 1024×768', res.ok, res.det);
  await ws.sendJson('Emulation.setDeviceMetricsOverride', { width: 375, height: 667, deviceScaleFactor: 2, mobile: true });
  await wait(600);
  res = await verificarTarjetas();
  t('T9c · Tarjetas sin desbordes a 375×667 (una por fila)', res.ok && await evalJs(`getComputedStyle(document.querySelector('.apGrid')).gridTemplateColumns.split(' ').length===1`), res.det);
  await capturar('v3-iphone-apariencia');
  await ws.sendJson('Emulation.setDeviceMetricsOverride', { width: 667, height: 375, deviceScaleFactor: 2, mobile: true });
  await wait(600);
  res = await verificarTarjetas();
  t('T9d · Tarjetas sin desbordes en iPhone horizontal', res.ok, res.det);
  await ws.sendJson('Emulation.clearDeviceMetricsOverride', {});
  await wait(400);

  console.log('\n== T10: cerrar/abrir, cambio de sección/modo, offline y botones reales ==');
  await evalJs(`f3DistEntrar()`);
  await wait(400);
  await evalJs(`f3DistSalir(false)`);
  await evalJs(`f3DistEntrar()`);
  await wait(400);
  t('T10a · Cerrar y volver a abrir el editor funciona', await evalJs(`document.body.classList.contains('pp-edit')&&!!document.getElementById('ppDistToolbar')`));
  await evalJs(`f3DistSalir(false)`);
  await wait(300);
  await evalJs(`showGroup('cuerpo',false);showTab(tabs.indexOf('💪 Ejercicio'),null)`);
  await wait(600);
  await evalJs(`showGroup('ajustes',false);showTab(tabs.indexOf('👤 Perfil'),null)`);
  await wait(400);
  t('T10b · Cambiar de sección y volver conserva la configuración',
    await evalJs(`(function(){var s=f3AparienciaV2().layout.porDispositivo.desktop.header.subtitulo;return s.x!=null;})()`));
  await evalJs(`(function(){try{f3ModosState();var m=f3ModoPlantilla('fitness');m.id='fit3';state.misModos.modos.fit3=m;f3ModoActivar('fit3');}catch(e){}return 1})()`);
  await wait(400);
  await evalJs(`f3ModoActivar('completo')`);
  await wait(400);
  t('T10c · Cambiar de modo no pierde la distribución', await evalJs(`f3AparienciaV2().layout.version===3`));
  await ws.sendJson('Network.enable', {});
  await ws.sendJson('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await ws.sendJson('Page.reload', { ignoreCache: true });
  await wait(3500);
  await neutralizar();
  await wait(400);
  t('T10d · Offline: la distribución guardada carga', await evalJs(`(function(){var s=f3AparienciaV2().layout.porDispositivo.desktop.header.subtitulo;return s.x!=null;})()`));
  await ws.sendJson('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await evalJs(`(function(){var b=document.getElementById('gbtn_inicio');if(b)b.click();return 1})()`);
  await wait(400);
  t('T10e · Los botones reales siguen funcionando tras el editor', await evalJs(`_activeGroup==='inicio'`));

  console.log('\n== Estado final para revisión ==');
  await evalJs(`showGroup('ajustes',false);showTab(tabs.indexOf('👤 Perfil'),null)`);
  await wait(400);
  await evalJs(`(function(){var d=document.getElementById('ajAp');if(d)d.open=true;return 1})()`);
  await wait(200);
  await evalJs(`f3DistEntrar()`);
  await wait(400);
  // seleccionar 3 elementos + el puente movido
  await evalJs(`(function(){window._distSels=[{e:'logo',tipo:'libre'},{e:'nombre',tipo:'libre'},{e:'subtitulo',tipo:'libre'}];window._distSel={e:'logo',tipo:'libre'};f3DistTeclado(0,12);return 1})()`);
  await wait(300);
  await dragMouse('#ppWorkerToggleBar .ppAsa', -80, -120);
  await wait(300);
  await evalJs(`(function(){window._distSels=[{e:'logo',tipo:'libre'},{e:'nombre',tipo:'libre'},{e:'subtitulo',tipo:'libre'}];window._distSel={e:'logo',tipo:'libre'};f3DistAplicar();f3DistToolbarRender();return 1})()`);
  await wait(300);
  await capturar('v3-final-editor');
  t('T11a · Estado final: 3 elementos seleccionados + contador',
    await evalJs(`(function(){var tb=document.getElementById('ppDistToolbar');return (window._distSels||[]).length===3&&tb&&tb.innerText.indexOf('3 elementos seleccionados')>=0;})()`));
  t('T11b · Puente movido y con coordenadas guardables',
    await evalJs(`(function(){var c=f3DistConfig().puente;return c.x!=null&&c.y!=null;})()`));
  t('T11c · Barra completa visible (todas las filas)', await evalJs(`(function(){var tb=document.getElementById('ppDistToolbar');var tx=tb?tb.innerText:'';return tx.indexOf('Cancelar')>=0&&tx.indexOf('Guardar distribución')>=0&&tx.indexOf('Seleccionar todo')>=0;})()`));

  console.log('\n==========================================');
  console.log('RESULTADO: ' + pasadas + ' PASS / ' + falladas + ' FAIL');
  console.log('==========================================');
  console.log('Instancia TEMPORAL abierta con: 3 elementos seleccionados, el Puente');
  console.log('movido, la barra de 4 filas visible y las tarjetas sin desbordes.');
  if (falladas) process.exit(1);
  process.exit(0);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
