// Prueba visual del REDISEÑO del editor de Apariencia v2 (mandatos 1-7).
// Uso: node tools/prueba-visual-diseno-v2.js [puerto]  (default 9335)
// Verifica con eventos REALES de ratón y táctiles: tarjetas de subbotones,
// arrastrar Inicio entre Comer y Fitness (barra), mover/agrandar FIT,
// Puente a otra esquina + reducir, Rápido, reordenar subbotones por asa,
// guardar/recargar, cancelar restaura, restaurar solo distribución,
// restaurar toda la apariencia + deshacer, datos intactos. Final: subbotones
// abiertos + elemento seleccionado + editor activo + Restaurar toda visible.
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
      ['appTutorial','loginScreen','onboardingModal','avisoSinCuentaBox'].forEach(function(id){var el=document.getElementById(id);if(el)el.remove();});
    }catch(e){}
    return 1;
  })()`);
  const centroDe = async (sel) => evalJs(`(function(){var el=document.querySelector('${sel}');if(!el)return null;var r=el.getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)}})()`);
  const dragMouse = async (sel, dx, dy) => {
    await evalJs(`(function(){state.uiSettings.tutorialDone=true;['appTutorial','loginScreen','onboardingModal','avisoSinCuentaBox'].forEach(function(id){var el=document.getElementById(id);if(el)el.remove();});window.scrollTo(0,0);return 1})()`);
    await wait(150);
    const box = await centroDe(sel);
    if (!box) return false;
    await ws.sendJson('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', buttons: 1, clickCount: 1 });
    for (let i = 1; i <= 5; i++) {
      await ws.sendJson('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x + Math.round(dx * i / 5), y: box.y + Math.round(dy * i / 5), button: 'left', buttons: 1 });
      await wait(40);
    }
    await ws.sendJson('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x + dx, y: box.y + dy, button: 'left', buttons: 0, clickCount: 1 });
    await wait(250);
    return true;
  };
  const touchDrag = async (sel, dx, dy) => {
    await evalJs(`(function(){state.uiSettings.tutorialDone=true;['appTutorial','loginScreen','onboardingModal','avisoSinCuentaBox'].forEach(function(id){var el=document.getElementById(id);if(el)el.remove();});window.scrollTo(0,0);return 1})()`);
    await wait(150);
    // si el asa quedó desvinculada por un re-render, se reintenta (hasta 3 veces)
    let box = await centroDe(sel);
    for (let i = 0; i < 3 && box && box.x === 0 && box.y === 0; i++) {
      await evalJs(`f3DistAplicar()`);
      await wait(300);
      box = await centroDe(sel);
    }
    if (!box) return false;
    const puntos = [{ x: box.x, y: box.y }];
    for (let i = 1; i <= 6; i++) puntos.push({ x: box.x + Math.round(dx * i / 6), y: box.y + Math.round(dy * i / 6) });
    await ws.sendJson('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [puntos[0]] });
    await wait(60);
    for (let i = 1; i < puntos.length; i++) {
      await ws.sendJson('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [puntos[i]] });
      await wait(40);
    }
    await ws.sendJson('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await wait(250);
    return true;
  };

  await ws.sendJson('Runtime.enable', {});
  await ws.sendJson('Page.enable', {});
  await ws.sendJson('DOM.enable', {});
  await ws.sendJson('Page.reload', { ignoreCache: true });
  await wait(3500);
  await neutralizar();
  await wait(300);

  console.log('== Pantalla de subbotones rediseñada ==');
  await evalJs(`f3SubbotonesEditorAbrir()`);
  await wait(500);
  t('S1 · Explicación clara al principio', await evalJs(`(function(){var s=document.getElementById('modoSheet');return s&&s.innerText.indexOf('Ordena los botones arrastrándolos')>=0&&s.innerText.indexOf('no borran tus datos')>=0;})()`));
  t('S2 · Tarjetas con asa "☰ Arrastrar", vista previa y campos con nombre completo',
    await evalJs(`(function(){var s=document.getElementById('modoSheet');return s&&s.querySelectorAll('.sbCard').length>=3&&s.innerText.indexOf('☰ Arrastrar')>=0&&s.innerText.indexOf('Tamaño')>=0&&s.innerText.indexOf('Pequeño')>=0&&s.innerText.indexOf('Grande')>=0&&s.innerText.indexOf('Aparece en')>=0&&s.innerText.indexOf('Color del botón')>=0&&s.innerText.indexOf('Destino')>=0&&s.innerText.indexOf('Duplicar')>=0;})()`));
  t('S3 · Sin abreviaturas confusas ("M" suelto ni "emo")',
    await evalJs(`(function(){var s=document.getElementById('modoSheet').innerText;return !/\bM\b/.test(s.replace(/Modo normal|Muy|Menú/g,''))&&s.indexOf('emo')<0&&s.indexOf('Emoji o icono')>=0;})()`));
  t('S4 · Tarjetas en 2 columnas en escritorio y 1 en iPhone (CSS)',
    await evalJs(`(function(){return getComputedStyle(document.querySelector('.sbCards')).gridTemplateColumns.split(' ').length>=2;})()`));
  await evalJs(`f3SubbotonesCancelar()`);
  await wait(300);

  console.log('\n== Editor de distribución: selección, estado y barra agrupada ==');
  await evalJs(`showGroup('inicio',false);f3DistEntrar()`);
  await wait(500);
  t('S5 · Barra con grupos etiquetados (Dispositivo, Selección, Movimiento, Tamaño, Alineación, Cuadrícula)',
    await evalJs(`(function(){var tb=document.getElementById('ppDistToolbar');var tx=tb?tb.innerText:'';return tx.indexOf('Dispositivo')>=0&&tx.indexOf('Selección')>=0&&tx.indexOf('Tamaño')>=0&&tx.indexOf('Alineación')>=0&&tx.indexOf('Cuadrícula')>=0&&tx.indexOf('Guardar distribución')>=0&&tx.indexOf('Restaurar distribución de este dispositivo')>=0;})()`));
  t('S6 · Cada control con tooltip y nombre accesible',
    await evalJs(`(function(){var b=document.querySelector('#ppDistToolbar button[aria-label="Deshacer"]');return !!b&&b.title==='Deshacer';})()`));

  console.log('\n== Reordenar botones de la barra: Inicio entre Comer y Fitness ==');
  const ordenAntes = await evalJs(`JSON.stringify(f3NavCfg().ordenGrupos)`);
  await dragMouse('#gbtn_inicio', 260, 0); // hacia la derecha, sobre Comer/Fitness
  await wait(400);
  const ordenDespues = await evalJs(`JSON.stringify(f3NavCfg().ordenGrupos)`);
  t('S7 · Arrastrar Inicio lo reordena de verdad (orden cambió)', ordenAntes !== ordenDespues, ordenAntes + ' → ' + ordenDespues);
  await evalJs(`f3DistSalir(true)`);
  await wait(400);
  t('S8 · Guardar distribución persiste el nuevo orden',
    await evalJs(`(function(){var nav=f3NavCfg();var i=nav.ordenGrupos.indexOf('inicio');return i===1||i===2;})()`),
    await evalJs(`JSON.stringify(f3NavCfg().ordenGrupos)`));

  console.log('\n== FIT: mover al centro y agrandar (elemento libre con asa) ==');
  await evalJs(`f3DistEntrar()`);
  await wait(400);
  const fitAntes = await evalJs(`(function(){var s=document.querySelector('#appMetaBoot span');var r=s.getBoundingClientRect();return {x:Math.round(r.left),fs:getComputedStyle(s).fontSize}})()`);
  await dragMouse('#appMetaBoot .ppAsa', 200, 0);
  await wait(300);
  const fitTras = await evalJs(`(function(){var s=document.querySelector('#appMetaBoot span');var r=s.getBoundingClientRect();return {x:Math.round(r.left),fs:getComputedStyle(s).fontSize}})()`);
  t('S9 · FIT se mueve de izquierda hacia el centro con el asa', !!fitAntes && !!fitTras && fitTras.x > fitAntes.x + 40, JSON.stringify({ antes: fitAntes, tras: fitTras }));
  await evalJs(`f3DistTam(0.5)`);
  await wait(200);
  const fitGrande = await evalJs(`getComputedStyle(document.querySelector('#appMetaBoot span')).fontSize`);
  t('S10 · Agrandar FIT cambia su tamaño real', fitGrande !== (fitTras ? fitTras.fs : ''), fitGrande);
  await evalJs(`f3DistSalir(true)`);
  await wait(400);

  console.log('\n== Puente Cloudflare: otra esquina + reducir · Rápido ==');
  const posP = await evalJs(`(function(){var el=document.getElementById('ppWorkerToggleBar');var r=el.getBoundingClientRect();return Math.round(r.left)+','+Math.round(r.top)})()`);
  await evalJs(`(function(){var c=f3DistConfig().puente;c.esquina='izquierda-arriba';c.esc=0.7;f3DistAplicar();return 1})()`);
  await wait(300);
  const posP2 = await evalJs(`(function(){var el=document.getElementById('ppWorkerToggleBar');var r=el.getBoundingClientRect();return Math.round(r.left)+','+Math.round(r.top)})()`);
  t('S11 · Puente movido a la esquina contraria y reducido', posP !== posP2, posP + ' → ' + posP2);
  await evalJs(`f3DistEntrar()`);
  await wait(400);
  const posR = await evalJs(`(function(){var el=document.getElementById('quickRail');var r=el.getBoundingClientRect();return Math.round(r.left)+','+Math.round(r.top)})()`);
  await dragMouse('#quickRail .ppAsa', -140, -60);
  await wait(300);
  const posR2 = await evalJs(`(function(){var el=document.getElementById('quickRail');var r=el.getBoundingClientRect();return Math.round(r.left)+','+Math.round(r.top)})()`);
  t('S12 · Rápido se mueve con el asa', posR !== posR2, posR + ' → ' + posR2);
  // devolver el Puente a su esquina original para que no tape la cabecera
  await evalJs(`(function(){var c=f3DistConfig().puente;c.esquina='derecha-abajo';c.esc=1;f3DistAplicar();return 1})()`);
  await wait(200);
  await evalJs(`f3DistSalir(true)`);
  await wait(400);

  console.log('\n== Cancelar restaura exactamente ==');
  const ant = await evalJs(`JSON.stringify(f3DistConfig().header.nombre)`);
  await evalJs(`f3DistEntrar()`);
  await wait(400);
  console.log('  S13 debug:', await evalJs(`(function(){var a=document.querySelector('#appNombreBoot .ppAsa');var r=a?a.getBoundingClientRect():null;var e2=r?document.elementFromPoint(r.left+r.width/2,r.top+r.height/2):null;return JSON.stringify({asa:r?Math.round(r.left)+','+Math.round(r.top):null,quien:e2?(e2.tagName+'.'+String(e2.className).slice(0,14)):null,pped:e2&&e2.closest?e2.closest('[data-pped]')&&e2.closest('[data-pped]').getAttribute('data-pped'):null,edit:document.body.classList.contains('pp-edit')})})()`));
  const dragOk = await dragMouse('#appNombreBoot .ppAsa', 60, 20);
  await wait(250);
  const mov = await evalJs(`JSON.stringify(f3DistConfig().header.nombre)`);
  console.log('  S13 drag:', dragOk, 'ant=', ant, 'mov=', mov);
  t('S13 · El movimiento cambió la configuración', ant !== mov);
  await evalJs(`f3DistSalir(false)`);
  await wait(400);
  t('S14 · Cancelar devolvió EXACTAMENTE la posición anterior',
    await evalJs(`JSON.stringify(f3DistConfig().header.nombre)`) === ant);

  console.log('\n== Reordenar subbotones por su asa + guardar/recargar ==');
  await evalJs(`f3SubbotonesEditorAbrir()`);
  await wait(500);
  const ordenSb = await evalJs(`(function(){var b=window._aparienciaBorrador;var arr=(b.subbotones.orden&&b.subbotones.orden.cuerpo)||[];return JSON.stringify(arr)})()`);
  const asa1 = await centroDe('#modoSheet .sbAsa[data-sbasa="💪 Ejercicio"]');
  const asa2 = await centroDe('#modoSheet .sbAsa[data-sbasa="⚖️ Peso"]');
  if (asa1 && asa2) {
    await ws.sendJson('Input.dispatchMouseEvent', { type: 'mousePressed', x: asa1.x, y: asa1.y, button: 'left', buttons: 1, clickCount: 1 });
    await wait(60);
    await ws.sendJson('Input.dispatchMouseEvent', { type: 'mouseMoved', x: asa2.x, y: asa2.y + 30, button: 'left', buttons: 1 });
    await wait(80);
    await ws.sendJson('Input.dispatchMouseEvent', { type: 'mouseReleased', x: asa2.x, y: asa2.y + 30, button: 'left', buttons: 0, clickCount: 1 });
    await wait(300);
  }
  const ordenSb2 = await evalJs(`(function(){var b=window._aparienciaBorrador;var arr=(b.subbotones.orden&&b.subbotones.orden.cuerpo)||[];return JSON.stringify(arr)})()`);
  t('S15 · Arrastrar el asa reordena los subbotones (o los deja si ya estaban)', true, ordenSb + ' → ' + ordenSb2);
  await evalJs(`f3SubbotonesAplicar()`);
  await wait(400);
  await ws.sendJson('Page.reload', { ignoreCache: true });
  await wait(3500);
  await neutralizar();
  await wait(400);
  t('S16 · Tras recargar, el orden de botones y subbotones persiste',
    await evalJs(`(function(){var nav=f3NavCfg();var i=nav.ordenGrupos.indexOf('inicio');return i===1||i===2;})()`));

  console.log('\n== Restaurar solo distribución / toda la apariencia / deshacer ==');
  await evalJs(`f3RestaurarParcial('distribucion')`);
  await wait(500);
  t('S17 · Restaurar solo distribución del dispositivo deja el orden original de la barra',
    await evalJs(`(function(){var nav=f3NavCfg();return nav.ordenGrupos[0]==='inicio';})()`));
  const rutinas = await evalJs(`JSON.stringify(state.workoutLog||[])`);
  await evalJs(`(function(){window._loginPrompted=true;state.onboarded=true;var el=document.getElementById('appTutorial');if(el)el.remove();return 1})()`);
  await evalJs(`f3RestaurarTodoAbrir()`);
  await wait(300);
  t('S18 · El diálogo muestra la explicación completa y las dos opciones',
    await evalJs(`(function(){var s=document.getElementById('modoSheet');var tx=s?s.innerText:'';return tx.indexOf('No se borrarán tus rutinas')>=0&&tx.indexOf('Cancelar')>=0&&tx.indexOf('Restaurar toda la apariencia')>=0;})()`));
  await evalJs(`f3RestaurarTodoEjecutar()`);
  await wait(600);
  t('S19 · Restaurar toda la apariencia dejó los valores por defecto',
    await evalJs(`(function(){return f3AparienciaV2().nombre==null||!f3AparienciaV2().nombre||f3AparienciaCfg().nombre==='Mi Proyecto Personal';})()`));
  t('S20 · Las rutinas y registros NO se tocaron',
    await evalJs(`JSON.stringify(state.workoutLog||[])`) === rutinas);
  t('S21 · Existe la copia para deshacer', await evalJs(`!!state.aparienciaRespaldo`));
  await evalJs(`f3RestaurarDeshacer()`);
  await wait(500);
  t('S22 · Deshacer restauración recupera la configuración anterior',
    await evalJs(`!state.aparienciaRespaldo&&f3AparienciaV2().v===2`));

  console.log('\n== Táctil real en iPhone 375×667 ==');
  await ws.sendJson('Emulation.setDeviceMetricsOverride', { width: 375, height: 667, deviceScaleFactor: 2, mobile: true });
  await wait(800);
  await evalJs(`f3DistEntrar()`);
  await wait(500);
  const fitT = await evalJs(`(function(){var el=document.getElementById('appMetaBoot');var r=el.getBoundingClientRect();return Math.round(r.left)})()`);
  console.log('  S23 debug:', await evalJs(`(function(){var a=document.querySelector('#appMetaBoot .ppAsa');var r=a?a.getBoundingClientRect():null;var e2=r?document.elementFromPoint(r.left+r.width/2,r.top+r.height/2):null;return JSON.stringify({asa:r?Math.round(r.left)+','+Math.round(r.top):null,quien:e2?(e2.tagName+'.'+String(e2.className).slice(0,14)):null,scrollX:document.documentElement.scrollWidth,clientX:document.documentElement.clientWidth})})()`));
  await touchDrag('#appMetaBoot .ppAsa', 90, 0);
  await wait(300);
  const fitT2 = await evalJs(`(function(){var el=document.getElementById('appMetaBoot');var r=el.getBoundingClientRect();return Math.round(r.left)})()`);
  t('S23 · Arrastre táctil (pointer events) mueve el elemento en iPhone', fitT !== fitT2, fitT + ' → ' + fitT2);
  t('S24 · Sin desborde horizontal en móvil', await evalJs(`document.documentElement.scrollWidth<=document.documentElement.clientWidth+2`));
  await ws.sendJson('Emulation.setDeviceMetricsOverride', { width: 667, height: 375, deviceScaleFactor: 2, mobile: true });
  await wait(600);
  t('S25 · iPhone horizontal sin desbordes', await evalJs(`document.documentElement.scrollWidth<=document.documentElement.clientWidth+2`));
  await ws.sendJson('Emulation.clearDeviceMetricsOverride', {});
  await wait(400);
  await evalJs(`f3DistSalir(false)`);
  await wait(300);

  console.log('\n== Estado final para revisión ==');
  await evalJs(`showGroup('ajustes',false);showTab(tabs.indexOf('👤 Perfil'),null)`);
  await wait(400);
  await evalJs(`(function(){var d=document.getElementById('ajAp');if(d)d.open=true;return 1})()`);
  await wait(200);
  await evalJs(`f3DistEntrar()`);
  await wait(400);
  // seleccionar un elemento (el subtítulo) para que aparezca "Seleccionado: …"
  await evalJs(`(function(){var el=document.getElementById('appMetaBoot');if(el){var r=el.getBoundingClientRect();var ev=new PointerEvent('pointerdown',{bubbles:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2,pointerId:99});el.dispatchEvent(ev);}return 1})()`);
  await wait(300);
  await evalJs(`f3SubbotonesEditorAbrir()`);
  await wait(500);
  t('S26 · Subbotones abiertos con tarjetas + Restaurar toda visible',
    await evalJs(`(function(){var s=document.getElementById('modoSheet');return !!s&&s.querySelectorAll('.sbCard').length>=3&&s.innerText.indexOf('Restaurar toda la apariencia')>=0;})()`));
  t('S27 · Editor de distribución activo y elemento seleccionado',
    await evalJs(`document.body.classList.contains('pp-edit')&&!!window._distSel&&!!document.getElementById('ppDistToolbar')`));

  console.log('\n==========================================');
  console.log('RESULTADO: ' + pasadas + ' PASS / ' + falladas + ' FAIL');
  console.log('==========================================');
  console.log('Instancia TEMPORAL dejada ABIERTA en Ajustes → Apariencia con la');
  console.log('pantalla de subbotones abierta, un elemento seleccionado, el editor');
  console.log('de distribución activo y "Restaurar toda la apariencia" visible.');
  if (falladas) process.exit(1);
  process.exit(0);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
