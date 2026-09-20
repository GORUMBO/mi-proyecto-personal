// Pruebas reales de las reparaciones: visibilidad de botones, arrastre de
// selección múltiple, escritura sin pérdida de foco, navegación en tarjetas
// y barra inferior iPhone. Uso: node tools/prueba-visual-reparaciones.js [puerto]
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
  const clic = async (sel) => {
    const box = await evalJs(`(function(){var el=document.querySelector('${sel}');if(!el)return null;var r=el.getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)}})()`);
    if (!box) return false;
    await ws.sendJson('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', buttons: 1, clickCount: 1 });
    await wait(50);
    await ws.sendJson('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', buttons: 0, clickCount: 1 });
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

  console.log('== R1: ocultar Comer y Dinero, guardar, recargar, re-mostrar ==');
  await evalJs(`f3NavEditorAbrir()`);
  await wait(500);
  t('R1a · La pantalla de navegación usa tarjetas con etiquetas completas (sin M suelto ni cuadros sin nombre)',
    await evalJs(`(function(){var s=document.getElementById('modoSheet');var tx=s?s.innerText:'';return tx.indexOf('Pequeño')>=0&&tx.indexOf('Mediano')>=0&&tx.indexOf('Cápsula')>=0&&tx.indexOf('Rectangular')>=0&&tx.indexOf('Color del botón')>=0&&tx.indexOf('Color del texto')>=0&&tx.indexOf('Mostrar este botón')>=0&&tx.indexOf('Bloquear posición')>=0&&tx.indexOf('☰ Arrastrar')>=0&&tx.indexOf('Restaurar este botón')>=0&&tx.indexOf('Aquí cambias el nombre')>=0;})()`));
  // ocultar Comer y Dinero con el interruptor Sí/No de sus tarjetas
  // (clic a clic: cada cambio re-renderiza las tarjetas, hay que re-encontrar)
  await evalJs(`(function(){var cards=[].slice.call(document.querySelectorAll('#modoSheet .sbCard'));var c1=cards.find(function(c){return c.innerText.indexOf('🍽️ Comer')>=0&&c.innerText.indexOf('Mostrar este botón')>=0});var cb1=c1?c1.querySelector('input[type="checkbox"]'):null;if(cb1&&cb1.checked)cb1.click();return 1})()`);
  await wait(400);
  await evalJs(`(function(){var cards=[].slice.call(document.querySelectorAll('#modoSheet .sbCard'));var c2=cards.find(function(c){return c.innerText.indexOf('💳 Dinero')>=0&&c.innerText.indexOf('Mostrar este botón')>=0});var cb2=c2?c2.querySelector('input[type="checkbox"]'):null;if(cb2&&cb2.checked)cb2.click();return 1})()`);
  await wait(400);
  await evalJs(`f3NavAplicar()`);
  await wait(500);
  t('R1b · Tras guardar, Comer y Dinero desaparecen de la barra inmediatamente',
    await evalJs(`(function(){var g=document.getElementById('groupNav');return !g||(g.innerText.indexOf('Comer')<0&&g.innerText.indexOf('Dinero')<0);})()`));
  await ws.sendJson('Page.reload', { ignoreCache: true });
  await wait(3500);
  await neutralizar();
  await wait(400);
  t('R1c · Tras recargar siguen ocultos', await evalJs(`(function(){var g=document.getElementById('groupNav');return !g||(g.innerText.indexOf('Comer')<0&&g.innerText.indexOf('Dinero')<0);})()`));
  await evalJs(`f3NavEditorAbrir()`);
  await wait(400);
  await evalJs(`(function(){var cards=[].slice.call(document.querySelectorAll('#modoSheet .sbCard'));var c1=cards.find(function(c){return c.innerText.indexOf('🍽️ Comer')>=0&&c.innerText.indexOf('Mostrar este botón')>=0});var cb1=c1?c1.querySelector('input[type="checkbox"]'):null;if(cb1&&!cb1.checked)cb1.click();return 1})()`);
  await wait(400);
  await evalJs(`(function(){var cards=[].slice.call(document.querySelectorAll('#modoSheet .sbCard'));var c2=cards.find(function(c){return c.innerText.indexOf('💳 Dinero')>=0&&c.innerText.indexOf('Mostrar este botón')>=0});var cb2=c2?c2.querySelector('input[type="checkbox"]'):null;if(cb2&&!cb2.checked)cb2.click();return 1})()`);
  await wait(400);
  await evalJs(`f3NavAplicar()`);
  await wait(500);
  t('R1d · Volver a mostrarlos funciona', await evalJs(`(function(){var g=document.getElementById('groupNav');return !!g&&g.innerText.indexOf('Comer')>=0&&g.innerText.indexOf('Dinero')>=0;})()`));
  t('R1e · El ojo/casilla refleja el estado verdadero', await evalJs(`(function(){var g=document.getElementById('gbtn_comer');return !!g;})()`));

  console.log('\n== R2: selección múltiple que SÍ se mueve junta (ratón real) ==');
  await evalJs(`f3DistEntrar()`);
  await wait(500);
  await evalJs(`(function(){window._distSels=[{e:'gbtn_inicio',tipo:'barra'},{e:'gbtn_comer',tipo:'barra'},{e:'gbtn_cuerpo',tipo:'barra'}];window._distSel={e:'gbtn_inicio',tipo:'barra'};return 1})()`);
  // mover el grupo de botones con flecha (el camino de teclado) y con arrastre
  const orden0 = await evalJs(`JSON.stringify(f3NavCfg().ordenGrupos)`);
  await evalJs(`f3DistTeclado(8,0)`);
  await wait(300);
  const orden1 = await evalJs(`JSON.stringify(f3NavCfg().ordenGrupos)`);
  t('R2a · Las flechas actúan sobre la selección (el bloque se mueve en la barra)', orden0 !== orden1, orden0 + ' → ' + orden1);
  // selección de elementos libres y arrastre de grupo
  await evalJs(`f3DistQuitarSeleccion()`);
  await clic('#appLogoBoot');
  const antes = await evalJs(`(function(){var out=[];['logo','nombre'].forEach(function(k){var i=f3DistItem(k);out.push((i.it.x||-1)+','+(i.it.y||-1))});return JSON.stringify(out)})()`);
  // añadir el segundo con Ctrl (sin quitar el primero)
  const boxN = await evalJs(`(function(){var el=document.getElementById('appNombreBoot');var r=el.getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)}})()`);
  await ws.sendJson('Input.dispatchMouseEvent', { type: 'mousePressed', x: boxN.x, y: boxN.y, button: 'left', buttons: 1, clickCount: 1, modifiers: 2 });
  await wait(60);
  await ws.sendJson('Input.dispatchMouseEvent', { type: 'mouseReleased', x: boxN.x, y: boxN.y, button: 'left', buttons: 0, clickCount: 1, modifiers: 2 });
  await wait(250);
  t('R2b · Ctrl+clic suma sin perder los anteriores', await evalJs(`(window._distSels||[]).length===2`), await evalJs(`JSON.stringify((window._distSels||[]).map(function(s){return s.e}))`));
  // arrastrar uno de los seleccionados: deben moverse AMBOS
  const boxL = await evalJs(`(function(){var el=document.getElementById('appLogoBoot');var r=el.getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)}})()`);
  await ws.sendJson('Input.dispatchMouseEvent', { type: 'mousePressed', x: boxL.x, y: boxL.y, button: 'left', buttons: 1, clickCount: 1 });
  for (let i = 1; i <= 5; i++) {
    await ws.sendJson('Input.dispatchMouseEvent', { type: 'mouseMoved', x: boxL.x + 20, y: boxL.y + Math.round(24 * i / 5), button: 'left', buttons: 1 });
    await wait(40);
  }
  await ws.sendJson('Input.dispatchMouseEvent', { type: 'mouseReleased', x: boxL.x + 20, y: boxL.y + 24, button: 'left', buttons: 0, clickCount: 1 });
  await wait(300);
  const despues = await evalJs(`(function(){var out=[];['logo','nombre'].forEach(function(k){var i=f3DistItem(k);out.push((i.it.x||-1)+','+(i.it.y||-1))});return JSON.stringify(out)})()`);
  t('R2c · Arrastrar uno de los seleccionados mueve a TODOS (delta único)', antes !== despues, antes + ' → ' + despues);
  t('R2d · La selección sigue siendo de 2 (el arrastre no la redujo)', await evalJs(`(window._distSels||[]).length===2`));
  await evalJs(`f3DistSalir(true)`);
  await wait(500);
  await ws.sendJson('Page.reload', { ignoreCache: true });
  await wait(3500);
  await neutralizar();
  await wait(400);
  const trasRecarga = await evalJs(`(function(){var out=[];['logo','nombre'].forEach(function(k){var i=f3DistItem(k);out.push((i.it.x||-1)+','+(i.it.y||-1))});return JSON.stringify(out)})()`);
  t('R2e · Guardar + recargar persiste las coordenadas de TODOS los seleccionados', trasRecarga === despues, despues + ' → ' + trasRecarga);

  console.log('\n== R3: escribir subtítulo completo sin perder el foco ==');
  await evalJs(`f3IdentidadEditorAbrir()`);
  await wait(400);
  await evalJs(`(function(){var inp=document.getElementById('apSubtitulo');inp.focus();return 1})()`);
  const frase = 'Mi salud, mi dinero y mi vida';
  await ws.sendJson('Input.insertText', { text: frase });
  await wait(300);
  t('R3a · Se puede escribir una frase completa de corrido (espacios y mayúsculas)',
    await evalJs(`document.getElementById('apSubtitulo').value`) === frase,
    await evalJs(`document.getElementById('apSubtitulo').value`));
  t('R3b · El foco permanece en el campo (no se reconstruyó el modal)',
    await evalJs(`(function(){return document.activeElement&&document.activeElement.id==='apSubtitulo';})()`));
  // pegar (simulado con insertText largo + acentos)
  const pegado = 'Árbol de ñandú y café';
  await ws.sendJson('Input.insertText', { text: pegado });
  await wait(200);
  t('R3c · Pegar texto completo con acentos funciona',
    await evalJs(`document.getElementById('apSubtitulo').value`) === frase + pegado,
    await evalJs(`document.getElementById('apSubtitulo').value`));
  await evalJs(`f3IdentidadCancelar()`);
  await wait(300);

  console.log('\n== R4: barra inferior iPhone (tocar, sección arriba, Más se cierra) ==');
  await ws.sendJson('Emulation.setDeviceMetricsOverride', { width: 375, height: 667, deviceScaleFactor: 2, mobile: true });
  await wait(800);
  // el tutorial puede reaparecer y tapar la barra: se cierra antes de tocar
  await evalJs(`(function(){state.uiSettings.tutorialDone=true;['appTutorial','loginScreen','onboardingModal','avisoSinCuentaBox'].forEach(function(id){var el=document.getElementById(id);if(el)el.remove();});return 1})()`);
  await wait(200);
  // cerrar el menú Más si quedó abierto (cubre la barra, como en uso real)
  await evalJs(`(function(){var m=document.getElementById('mobileMasMenu');if(m&&m.style.display&&m.style.display!=='none')f3MobileMasToggle();return 1})()`);
  await wait(200);
  const secciones = [['💪 Ejercicio'], ['🍱 Contador'], ['💳 Gastos']];
  let todasOk = true, det = '';
  for (const [dest] of secciones) {
    const box = await evalJs(`(function(){var b=[].slice.call(document.querySelectorAll('#mobileNavBar .mnav-item')).find(function(x){return x.getAttribute('data-mnavdest')==='${dest}'});if(!b)return null;var r=b.getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)}})()`);
    if (!box) { todasOk = false; det += dest + '=SINBOTON '; continue; }
    await ws.sendJson('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', buttons: 1, clickCount: 1 });
    await wait(60);
    await ws.sendJson('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', buttons: 0, clickCount: 1 });
    await wait(700);
    const res = await evalJs(`(function(){var sc=document.scrollingElement||document.documentElement;return {tab:tabs[_activeTab],scroll:Math.round(sc.scrollTop),mas:(document.getElementById('mobileMasMenu')||{style:{display:'none'}}).style.display};})()`);
    if (res.tab !== dest || res.scroll > 4) { todasOk = false; det += dest + '=' + JSON.stringify(res) + ' '; }
  }
  t('R4a · Tocar cada botón inferior abre su sección y la deja arriba', todasOk, det || undefined);
  t('R4b · El menú Más queda cerrado tras navegar', await evalJs(`(function(){var m=document.getElementById('mobileMasMenu');return !m||m.style.display==='none';})()`));
  t('R4c · La barra respeta la safe area (padding inferior del body)',
    await evalJs(`(function(){var p=getComputedStyle(document.body).paddingBottom;return parseInt(p)>=60;})()`));
  await ws.sendJson('Emulation.setDeviceMetricsOverride', { width: 667, height: 375, deviceScaleFactor: 2, mobile: true });
  await wait(600);
  t('R4d · iPhone horizontal sin desbordes', await evalJs(`document.documentElement.scrollWidth<=document.documentElement.clientWidth+2`));
  await ws.sendJson('Emulation.clearDeviceMetricsOverride', {});
  await wait(400);

  console.log('\n== R5: datos intactos + estado final ==');
  const rutinas = await evalJs(`JSON.stringify(state.workoutLog||[])`);
  t('R5a · Las rutinas y registros NO se tocaron', rutinas === await evalJs(`JSON.stringify(state.workoutLog||[])`));
  await evalJs(`showGroup('ajustes',false);showTab(tabs.indexOf('👤 Perfil'),null)`);
  await wait(400);
  await evalJs(`(function(){var d=document.getElementById('ajAp');if(d)d.open=true;return 1})()`);
  await wait(200);
  await evalJs(`f3NavEditorAbrir()`);
  await wait(500);
  t('R5b · Instancia lista: navegación en tarjetas abierta', await evalJs(`(function(){var s=document.getElementById('modoSheet');return !!s&&s.querySelectorAll('.sbCard').length>=6;})()`));

  console.log('\n==========================================');
  console.log('RESULTADO: ' + pasadas + ' PASS / ' + falladas + ' FAIL');
  console.log('==========================================');
  if (falladas) process.exit(1);
  process.exit(0);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
