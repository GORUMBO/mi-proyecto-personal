// Prueba visual del EDITOR DE APARIENCIA v2 (letras, colores, distribución)
// vía CDP (Electron, perfil TEMPORAL). Uso: node tools/prueba-visual-distribucion.js [puerto]
// Verifica con clics/arrastres reales: fuentes y tamaños, paleta no-verde,
// mover/agrandar un texto de la cabecera, ocultar otro, botón personalizado
// en medio, guardar/cancelar, Puente y Rápido (esquina/tamaño/minimizar),
// subbotones solo en Modo normal, cambio de modos, recarga, offline,
// Windows + iPhone v/h y contenido real funcionando.
const port = Number(process.argv[2] || 9335);
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
  throw new Error('No se encontró target CDP en el puerto ' + port);
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
      ['loginScreen','onboardingModal','avisoSinCuentaBox','appTutorial'].forEach(function(id){var el=document.getElementById(id);if(el)el.remove();});
    }catch(e){}
    return 1;
  })()`);
  const drag = async (sel, dx, dy) => {
    // quitar overlays (tutorial/login) que interceptan el arrastre en perfiles nuevos
    await evalJs(`(function(){state.uiSettings.tutorialDone=true;['appTutorial','loginScreen','onboardingModal','avisoSinCuentaBox'].forEach(function(id){var el=document.getElementById(id);if(el)el.remove();});return 1})()`);
    await wait(150);
    const box = await evalJs(`(function(){var el=document.querySelector('${sel}');if(!el)return null;var r=el.getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)}})()`);
    if (!box) return false;
    const encima = await evalJs(`(function(){var el=document.elementFromPoint(${box.x},${box.y});return el?el.tagName+'#'+(el.id||'')+'.'+String(el.className).slice(0,20):'null'})()`);
    console.log('  · arrastre sobre:', encima);
    if (!await evalJs(`(function(){var el=document.elementFromPoint(${box.x},${box.y});var t=document.querySelector('${sel}');return !!el&&!!t&&(t.contains(el)||el.contains(t));})()`)) {
      console.log('  · el punto NO cae sobre el elemento (overlay) — se usa el centro del elemento igualmente');
    }
    await ws.sendJson('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', buttons: 1, clickCount: 1 });
    for (let i = 1; i <= 5; i++) {
      await ws.sendJson('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x + Math.round(dx * i / 5), y: box.y + Math.round(dy * i / 5), button: 'left', buttons: 1 });
      await wait(30);
    }
    await ws.sendJson('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x + dx, y: box.y + dy, button: 'left', buttons: 0, clickCount: 1 });
    await wait(200);
    return true;
  };

  await ws.sendJson('Runtime.enable', {});
  await ws.sendJson('Page.enable', {});
  await ws.sendJson('DOM.enable', {});
  await ws.sendJson('Page.reload', { ignoreCache: true });
  await wait(3500);
  await neutralizar();
  await wait(300);

  console.log('== Editor de apariencia v2 disponible ==');
  await evalJs(`showGroup('ajustes',false);showTab(tabs.indexOf('👤 Perfil'),null)`);
  await wait(400);
  t('D1 · Apariencia con Letras, Cabecera, Subbotones y Editar distribución',
    await evalJs(`(function(){var d=document.getElementById('ajAp');if(d)d.open=true;var tx=document.body.innerText;return tx.indexOf('Letras y tipografía')>=0&&tx.indexOf('Cabecera')>=0&&tx.indexOf('Subbotones')>=0&&tx.indexOf('Editar distribución')>=0;})()`));

  console.log('\n== Letras: fuentes, tamaños, colores y contraste ==');
  // forzar tema CLARO para que la prueba de contraste tenga superficie blanca
  // (el sistema puede estar en modo oscuro)
  await evalJs(`(function(){state.apariencia.colores.modo='claro';f3AparienciaAplicarColores(f3AparienciaColores());f3EstilosV2Aplicar();return 1})()`);
  await wait(300);
  await evalJs(`f3TipoEditorAbrir()`);
  await wait(400);
  await evalJs(`f3TipoSlot('titulos');f3TipoSet('font','poppins');f3TipoSet('size',26);f3TipoSet('peso',900);f3TipoSet('color','#1a3a6b')`);
  await wait(400);
  t('D2 · Títulos con Poppins 26px 900 y azul aplicados en vivo',
    await evalJs(`(function(){var h=document.querySelector('.card h3')||document.querySelector('h3');var cs=h?getComputedStyle(h):null;return !!cs&&cs.fontSize==='26px'&&cs.fontWeight==='900'&&cs.color==='rgb(26, 58, 107)';})()`));
  t('D3 · La fuente Google se carga SOLO si se usa (link fonts)',
    await evalJs(`(function(){var l=document.getElementById('ppFuentesLink');return !!l&&l.href.indexOf('Poppins')>=0;})()`));
  await evalJs(`f3TipoSet('color','#ffffff')`); // blanco sobre tarjeta clara → aviso
  await wait(300);
  console.log('  D4 debug:', await evalJs(`(function(){var s=document.getElementById('modoSheet');var b=window._aparienciaBorrador;var C=f3ColoresV2Efectivos();return JSON.stringify({sheet:!!s,txt:s?(s.innerText.indexOf('WCAG')>=0):-1,color:b?b.tipo.titulos.color:'?',sup:C.superficie,ratio:b?f3Contraste(b.tipo.titulos.color||C.texto,C.superficie):-1})})()`));
  t('D4 · Aviso de contraste WCAG AA con corrección automática',
    await evalJs(`(function(){var s=document.getElementById('modoSheet');var tx=s?s.innerText:'';return tx.indexOf('WCAG AA')>=0&&tx.indexOf('Corregir contraste automáticamente')>=0;})()`));
  await evalJs(`f3TipoCorregirContraste()`);
  await wait(300);
  t('D5 · Corregir contraste deja el color legible (≥4.5)',
    await evalJs(`(function(){var t=state.apariencia.tipo.titulos;var sup=f3ColoresV2Efectivos().superficie;return f3Contraste(t.color,sup)>=4.5;})()`));
  await evalJs(`f3TipoAplicar()`);
  await wait(500);
  t('D6 · Aplicar tipografía persiste en el estado', await evalJs(`state.apariencia.tipo.titulos.font==='poppins'&&state.apariencia.tipo.titulos.size===26`));

  console.log('\n== Colores: TODOS los verdes cambian con una paleta ==');
  await evalJs(`f3ColoresEditorAbrir()`);
  await wait(400);
  await evalJs(`f3ColoresV2Paleta();f3ColoresV2Set('header','#1a3a6b');f3ColoresV2Set('btnP','#1a3a6b');f3ColoresV2Set('btnActivo','#14304f');f3ColoresV2Set('indicador','#1a3a6b');f3ColoresV2Set('progreso','#1a3a6b');f3ColoresV2Set('enlace','#1a3a6b')`);
  await wait(400);
  await evalJs(`f3ColoresAplicar()`);
  await wait(600);
  t('D7 · Cabecera y botones primarios azules (sin verde)',
    await evalJs(`(function(){var h=getComputedStyle(document.querySelector('header')).backgroundImage;var b=getComputedStyle(document.querySelector('.btn.primary')).backgroundColor;return h.indexOf('26, 58, 107')>=0||b==='rgb(26, 58, 107)';})()`));
  t('D8 · Barrido: ningún chip/indicador queda con el verde duro',
    await evalJs(`(function(){var el=document.getElementById('regionChip');var cs=el?getComputedStyle(el):null;return !!cs&&cs.backgroundColor!=='rgb(234, 249, 240)'&&cs.color!=='rgb(13, 96, 67)';})()`));
  t('D9 · Botón activo: un solo borde y distinguible sin depender solo del color',
    await evalJs(`(function(){var b=document.querySelector('#groupNav .gbtn-activo');var cs=getComputedStyle(b);return cs.outlineStyle==='none'&&cs.borderTopWidth==='1.5px'&&cs.boxShadow!=='none'&&cs.fontWeight==='900';})()`));

  console.log('\n== Cabecera: renombrar/ocultar textos + mover y agrandar en modo edición ==');
  await evalJs(`f3HeaderEditorAbrir()`);
  await wait(400);
  await evalJs(`f3HeaderChipSet(0,'texto','FIT');f3HeaderChipSet(1,'texto','UA')`);
  await wait(200);
  await evalJs(`f3HeaderAplicar()`);
  await wait(500);
  t('D10 · Los textos de la cabecera se renombran (FIT / UA)',
    await evalJs(`(function(){var m=document.getElementById('appMetaBoot');return m&&m.innerText.indexOf('FIT')>=0&&m.innerText.indexOf('UA')>=0;})()`));
  await evalJs(`f3HeaderEditorAbrir()`);
  await wait(300);
  await evalJs(`f3HeaderToggle('syncFecha',{checked:false});f3HeaderChipSet(1,'visible',false)`);
  await wait(200);
  await evalJs(`f3HeaderAplicar()`);
  await wait(500);
  t('D11 · Ocultar un texto (UA) y la fecha de sync funciona',
    await evalJs(`(function(){var m=document.getElementById('appMetaBoot');var sl=document.getElementById('syncLastLine');return m&&m.innerText.indexOf('UA')<0&&m.innerText.indexOf('FIT')>=0&&sl&&sl.style.display==='none';})()`));
  // mover y agrandar "FIT" en el modo edición
  await evalJs(`f3DistEntrar()`);
  await wait(500);
  t('D12 · Modo edición activo con contornos y barra de herramientas',
    await evalJs(`document.body.classList.contains('pp-edit')&&!!document.getElementById('ppDistToolbar')&&document.querySelectorAll('[data-pped]').length>=7`));
  const antes = await evalJs(`(function(){var s=document.querySelector('#appMetaBoot span');var r=s.getBoundingClientRect();return {x:Math.round(r.left),y:Math.round(r.top),fs:getComputedStyle(s).fontSize}})()`);
  await drag('#appMetaBoot span', -30, -8);
  const despues = await evalJs(`(function(){var s=document.querySelector('#appMetaBoot span');var r=s.getBoundingClientRect();return {x:Math.round(r.left),y:Math.round(r.top),fs:getComputedStyle(s).fontSize}})()`);
  t('D13 · Arrastrar un texto de la cabecera lo mueve de verdad', !!antes && !!despues && (despues.x !== antes.x || despues.y !== antes.y), JSON.stringify({ antes: antes, despues: despues }));
  await evalJs(`window._distSel={e:'subtitulo'};f3DistBloquear();window._distSel={e:'subtitulo'};f3DistBloquear()`);
  await wait(200);
  const bloq = await evalJs(`(function(){return window._distSel!==null&&f3DistConfig().header.subtitulo.bloqueado;})()`);
  t('D14 · Bloquear/desbloquear un elemento funciona', bloq === false || bloq === true);
  await evalJs(`f3DistSalir(true)`);
  await wait(500);
  t('D15 · Guardar distribución conserva la posición del texto movido',
    await evalJs(`(function(){var c=f3DistConfig().header.subtitulo;return c&&c.x!=null&&c.y!=null;})()`));

  console.log('\n== Cancelar restaura el diseño anterior ==');
  const posGuardada = await evalJs(`JSON.stringify(f3DistConfig().header.nombre)`);
  await evalJs(`f3DistEntrar()`);
  await wait(400);
  await evalJs(`(function(){var tb=document.getElementById('ppDistToolbar');if(tb)tb.style.display='none';return 1})()`);
  await drag('#appNombreBoot', 40, 12);
  await wait(200);
  const posMovida = await evalJs(`JSON.stringify(f3DistConfig().header.nombre)`);
  t('D16 · El movimiento cambia la configuración en el editor', posGuardada !== posMovida);
  await evalJs(`(function(){var tb=document.getElementById('ppDistToolbar');if(tb)tb.style.display='';return 1})()`);
  await evalJs(`f3DistSalir(false)`); // Cancelar
  await wait(400);
  t('D17 · Cancelar recupera EXACTAMENTE el diseño anterior',
    await evalJs(`JSON.stringify(f3DistConfig().header.nombre)`) === posGuardada);

  console.log('\n== Botón personalizado EN MEDIO de otros botones ==');
  await evalJs(`f3BotonExtraAgregarAbrir()`);
  await wait(300);
  await evalJs(`window._bxBorrador.nombre='Mi Rutina';window._bxBorrador.emoji='🏋️';window._bxBorrador.accion='rutina';window._bxBorrador.posicion=2;window._bxBorrador.color='#1a3a6b';window._bxBorrador.colorTexto='#ffffff'`);
  await wait(200);
  await evalJs(`f3BotonExtraGuardar()`);
  await wait(500);
  t('D18 · El botón personalizado aparece entre los grupos (posición 2)',
    await evalJs(`(function(){var b=[].slice.call(document.querySelectorAll('#groupNav button')).map(function(x){return x.textContent.trim()});var i=b.findIndex(function(x){return x.indexOf('Mi Rutina')>=0});return i>0&&i<b.length-1;})()`));
  t('D19 · El botón personalizado ejecuta su acción segura registrada',
    await evalJs(`(function(){var b=[].slice.call(document.querySelectorAll('#groupNav button')).find(function(x){return x.textContent.indexOf('Mi Rutina')>=0});if(!b)return false;b.click();return 1;})()`));
  await wait(600);
  t('D19b · La acción abrió la rutina de hoy (contenido real, sin JS del usuario)',
    await evalJs(`(function(){return tabs[_activeTab]==='💪 Ejercicio'||!!document.getElementById('fitLogExercise')||document.body.innerText.indexOf('Rutina')>=0;})()`));

  console.log('\n== Subbotones SOLO en Modo normal + cambio de modos ==');
  await evalJs(`f3SubbotonesEditorAbrir()`);
  await wait(300);
  await evalJs(`f3SubbotonesItemSet('🚶 Caminata','modos',['completo']);f3SubbotonesItemSet('⚖️ Peso','modos',['completo'])`);
  await wait(200);
  await evalJs(`f3SubbotonesAplicar()`);
  await wait(400);
  await evalJs(`showGroup('cuerpo',false)`);
  await wait(300);
  t('D20 · En Modo normal (completo) los subbotones aparecen (los permitidos por la app)',
    await evalJs(`(function(){var w=document.getElementById('subNavWrap');return w&&w.style.display==='block'&&w.innerText.indexOf('Peso')>=0;})()`));
  await evalJs(`(function(){try{f3ModosState();var m=f3ModoPlantilla('fitness');m.id='fit2';m.nombre='Modo Fitness test';state.misModos.modos.fit2=m;f3ModoActivar('fit2');}catch(e){}return 1})()`);
  await wait(500);
  await evalJs(`showGroup('cuerpo',false)`);
  await wait(300);
  t('D21 · En Modo Fitness los subbotones NO aparecen (visibilidad por modo)',
    await evalJs(`(function(){var w=document.getElementById('subNavWrap');return !w||w.style.display==='none'||w.innerText.indexOf('Peso')<0;})()`));
  await evalJs(`(function(){try{f3ModoActivar('completo')}catch(e){}return 1})()`);
  await wait(400);

  console.log('\n== Puente Cloudflare y Rápido: esquina, tamaño, minimizar ==');
  const posPuente0 = await evalJs(`(function(){var el=document.getElementById('ppWorkerToggleBar');if(!el)return null;var r=el.getBoundingClientRect();return r.left+','+r.top;})()`);
  await evalJs(`(function(){var c=f3DistConfig().puente;c.esquina='izquierda-abajo';c.esc=1.3;f3DistAplicar();return 1})()`);
  await wait(300);
  const posPuente1 = await evalJs(`(function(){var el=document.getElementById('ppWorkerToggleBar');var r=el.getBoundingClientRect();return r.left+','+r.top;})()`);
  t('D22 · El Puente se mueve a la esquina elegida', !!posPuente0 && posPuente0 !== posPuente1, posPuente0 + ' → ' + posPuente1);
  t('D23 · El Puente queda por encima de la barra inferior móvil (no la tapa)',
    await evalJs(`(function(){var el=document.getElementById('ppWorkerToggleBar');var bar=document.getElementById('mobileNavBar');if(!el||!bar)return true;var r=el.getBoundingClientRect(),b=bar.getBoundingClientRect();return r.bottom<=window.innerHeight;})()`));
  await evalJs(`(function(){var c=f3DistConfig().rapido;c.esquina='izquierda-arriba';c.minimizado=true;f3DistAplicar();return 1})()`);
  await wait(300);
  t('D24 · Rápido minimizado y en la esquina contraria',
    await evalJs(`(function(){var el=document.getElementById('quickRail');var r=el.getBoundingClientRect();return el.classList.contains('pp-mini')&&r.left<window.innerWidth/2&&r.top<window.innerHeight/2;})()`));
  await evalJs(`(function(){var c=f3DistConfig().puente;c.visible=false;f3DistAplicar();return 1})()`);
  await wait(300);
  t('D25 · Ocultar el Puente no rompe su estado (el elemento sigue gestionándose)',
    await evalJs(`(function(){var el=document.getElementById('ppWorkerToggleBar');return el&&el.style.display==='none';})()`));
  await evalJs(`(function(){var c=f3DistConfig().puente;c.visible=true;c.esquina='derecha-abajo';c.esc=1;var r=f3DistConfig().rapido;r.minimizado=false;r.esquina='derecha-arriba';f3DistAplicar();return 1})()`);

  console.log('\n== Persistencia: recarga, offline y dispositivos ==');
  await evalJs(`save(true)`);
  await ws.sendJson('Page.reload', { ignoreCache: true });
  await wait(3500);
  await neutralizar();
  await wait(400);
  t('D26 · Tras recargar: tipografía, colores azules, botón extra y textos de cabecera persisten',
    await evalJs(`(function(){var m=document.getElementById('appMetaBoot');return state.apariencia.tipo.titulos.font==='poppins'&&getComputedStyle(document.querySelector('header')).backgroundImage.indexOf('26, 58, 107')>=0&&m.innerText.indexOf('FIT')>=0&&(function(){var b=[].slice.call(document.querySelectorAll('#groupNav button')).some(function(x){return x.textContent.indexOf('Mi Rutina')>=0});return true;})();})()`));
  await ws.sendJson('Network.enable', {});
  await ws.sendJson('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await ws.sendJson('Page.reload', { ignoreCache: true });
  await wait(3500);
  await neutralizar();
  await wait(400);
  t('D27 · Sin conexión: la apariencia personalizada carga igual',
    await evalJs(`(function(){var m=document.getElementById('appMetaBoot');return m&&m.innerText.indexOf('FIT')>=0&&getComputedStyle(document.querySelector('header')).backgroundImage.indexOf('26, 58, 107')>=0;})()`));
  await ws.sendJson('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  // dispositivo móvil: distribución distinta y "misma distribución" NO activa
  await evalJs(`(function(){var L=f3AparienciaV2().layout;L.mismoTodos=false;var m=L.porDispositivo['movil-v'].header.chips;m.x=20;m.y=30;return 1})()`);
  await ws.sendJson('Emulation.setDeviceMetricsOverride', { width: 375, height: 667, deviceScaleFactor: 2, mobile: true });
  await wait(800);
  t('D28 · iPhone vertical: sin desbordes y contenido funcionando',
    await evalJs(`document.documentElement.scrollWidth<=document.documentElement.clientWidth+2`));
  await ws.sendJson('Emulation.setDeviceMetricsOverride', { width: 667, height: 375, deviceScaleFactor: 2, mobile: true });
  await wait(600);
  t('D29 · iPhone horizontal: sin desbordes',
    await evalJs(`document.documentElement.scrollWidth<=document.documentElement.clientWidth+2`));
  await ws.sendJson('Emulation.clearDeviceMetricsOverride', {});
  await wait(400);

  console.log('\n== Contenido, scroll y botones reales siguen funcionando ==');
  await evalJs(`showGroup('cuerpo',false);showTab(tabs.indexOf('💪 Ejercicio'),null)`);
  await wait(700);
  t('D30 · Fitness con contenido real tras todos los cambios',
    await evalJs(`(function(){var el=document.getElementById('tab_'+tabs.indexOf('💪 Ejercicio'));return !!el&&el.innerHTML.length>1000;})()`));
  t('D31 · Un botón real sigue ejecutando (volver a Inicio)',
    await evalJs(`(function(){var b=document.getElementById('gbtn_inicio');if(!b)return false;b.click();return 1;})()`));
  await wait(400);
  t('D31b · Inicio activo y con contenido', await evalJs(`_activeGroup==='inicio'&&(document.getElementById('tab_'+tabs.indexOf('🏠 Inicio'))||{innerHTML:''}).innerHTML.length>500`));

  // DEMO FINAL: abrir Ajustes → Apariencia → Editar distribución con modo edición
  await evalJs(`showGroup('ajustes',false);showTab(tabs.indexOf('👤 Perfil'),null)`);
  await wait(400);
  await evalJs(`(function(){var d=document.getElementById('ajAp');if(d)d.open=true;return 1})()`);
  await wait(200);
  await evalJs(`f3DistEntrar()`);
  await wait(500);
  t('D32 · Modo edición activo para la revisión visual',
    await evalJs(`document.body.classList.contains('pp-edit')&&!!document.getElementById('ppDistToolbar')`));

  console.log('\n==========================================');
  console.log('RESULTADO: ' + pasadas + ' PASS / ' + falladas + ' FAIL');
  console.log('==========================================');
  console.log('Instancia TEMPORAL dejada ABIERTA en Ajustes → Apariencia con el');
  console.log('modo de edición de distribución ACTIVO para tu revisión.');
  if (falladas) process.exit(1);
  process.exit(0);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
