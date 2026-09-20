// Validación final pre-publicación: diseño predeterminado limpio, validación
// y recuperación de distribuciones rotas, contraste WCAG AA de los modales
// en 6 temas × 4 modos, y navegación iPhone. Uso: node tools/prueba-visual-final.js [puerto]
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

  await ws.sendJson('Runtime.enable', {});
  await ws.sendJson('Page.enable', {});
  await ws.sendJson('DOM.enable', {});
  await ws.sendJson('Page.reload', { ignoreCache: true });
  await wait(3500);
  await neutralizar();
  await wait(400);

  console.log('== F1: primera apertura con diseño predeterminado ordenado ==');
  t('F1a · Sin superposiciones entre logo/nombre/subtítulo/versión/sync/fecha/nav',
    await evalJs(`(function(){
      var sels={logo:'#appLogoBoot',nombre:'#appNombreBoot',subtitulo:'#appMetaBoot',version:'.versionChip',sync:'#syncBadge',syncFecha:'#syncLastLine',nav:'#groupNav'};
      var rects={};
      Object.keys(sels).forEach(function(k){var el=document.querySelector(sels[k]);if(el&&el.offsetParent)rects[k]=el.getBoundingClientRect()});
      var mal=[];
      var ks=Object.keys(rects);
      for(var i=0;i<ks.length;i++)for(var j=i+1;j<ks.length;j++){
        var a=rects[ks[i]],b=rects[ks[j]];
        var ix=Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left));
        var iy=Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
        if(ix>6&&iy>6)mal.push(ks[i]+'+'+ks[j]);
      }
      return mal.length===0;
    })()`),
    await evalJs(`(function(){var out=[];['logo','nombre','subtitulo','version','sync','syncFecha','nav'].forEach(function(k){var sels={logo:'#appLogoBoot',nombre:'#appNombreBoot',subtitulo:'#appMetaBoot',version:'.versionChip',sync:'#syncBadge',syncFecha:'#syncLastLine',nav:'#groupNav'};var el=document.querySelector(sels[k]);if(el&&el.offsetParent)out.push(k+'@'+Math.round(el.getBoundingClientRect().top))});return out.join('|')})()`));
  t('F1b · La navegación está DEBAJO del título (segunda fila)',
    await evalJs(`(function(){var n=document.getElementById('appNombreBoot').getBoundingClientRect();var g=document.getElementById('groupNav').getBoundingClientRect();return g.top>=n.bottom-4;})()`));
  t('F1c · El Puente está abajo a la derecha y Rápido debajo de la cabecera (separados)',
    await evalJs(`(function(){var p=document.getElementById('ppWorkerToggleBar');var q=document.getElementById('quickRail');if(!p||!q)return true;var pr=p.getBoundingClientRect(),qr=q.getBoundingClientRect();var ix=Math.max(0,Math.min(pr.right,qr.right)-Math.max(pr.left,qr.left));var iy=Math.max(0,Math.min(pr.bottom,qr.bottom)-Math.max(pr.top,qr.top));return (ix*iy===0)&&pr.top>window.innerHeight/2&&qr.top<window.innerHeight/2&&pr.left>window.innerWidth/2;})()`));

  console.log('\n== F2: validación y recuperación de distribuciones rotas ==');
  await evalJs(`(function(){var L=f3AparienciaV2().layout;f3LayoutMigrar();var d=L.porDispositivo.desktop;d.header.nombre.x=20;d.header.nombre.y=20;d.header.logo.x=24;d.header.logo.y=22;d.header.subtitulo.x=NaN;d.header.subtitulo.y=5000;save(true);return 1})()`);
  await ws.sendJson('Page.reload', { ignoreCache: true });
  await wait(3500);
  await neutralizar();
  await wait(500);
  t('F2a · Se muestra el aviso de distribución que no cabe',
    await evalJs(`(function(){var a=document.getElementById('ppDistAviso');return !!a&&a.innerText.indexOf('no cabe correctamente')>=0;})()`));
  t('F2b · El aviso ofrece las tres opciones',
    await evalJs(`(function(){var a=document.getElementById('ppDistAviso');var tx=a?a.innerText:'';return tx.indexOf('Reparar automáticamente')>=0&&tx.indexOf('Restaurar diseño predeterminado')>=0&&tx.indexOf('Conservar y editar')>=0;})()`));
  t('F2c · Mientras tanto, la cabecera se muestra SIN superposiciones (flujo limpio)',
    await evalJs(`(function(){var n=document.getElementById('appNombreBoot').getBoundingClientRect();var l=document.getElementById('appLogoBoot').getBoundingClientRect();var ix=Math.max(0,Math.min(n.right,l.right)-Math.max(n.left,l.left));var iy=Math.max(0,Math.min(n.bottom,l.bottom)-Math.max(n.top,l.top));return !(ix>6&&iy>6);})()`));
  const colorAntes = await evalJs(`state.apariencia.coloresV2.header||'auto'`);
  await evalJs(`f3DistReparar()`);
  await wait(500);
  t('F2d · Reparar automáticamente acomoda sin borrar preferencias (colores intactos)',
    await evalJs(`(state.apariencia.coloresV2.header||'auto')`) === colorAntes &&
    await evalJs(`(function(){var n=document.getElementById('appNombreBoot').getBoundingClientRect();var l=document.getElementById('appLogoBoot').getBoundingClientRect();var ix=Math.max(0,Math.min(n.right,l.right)-Math.max(n.left,l.left));var iy=Math.max(0,Math.min(n.bottom,l.bottom)-Math.max(n.top,l.top));return !(ix>6&&iy>6);})()`));
  await evalJs(`(function(){var L=f3AparienciaV2().layout;L.porDispositivo.desktop.header.nombre.x=30;L.porDispositivo.desktop.header.nombre.y=30;save(true);return 1})()`);
  await evalJs(`f3DistRestaurarLimpio()`);
  await wait(400);
  t('F2e · Restaurar diseño predeterminado deja la distribución limpia del dispositivo',
    await evalJs(`(function(){var d=f3AparienciaV2().layout.porDispositivo.desktop;return d.header.nombre.x==null&&d.header.nombre.y==null;})()`));

  console.log('\n== F3: contraste WCAG AA de los modales en 6 temas × modos ==');
  const temas = ['maui', 'oceano', 'atardecer', 'uva', 'rosa', 'carbon'];
  const modos = [['claro', 'Claro'], ['oscuro', 'Oscuro'], ['auto', 'Automático'], ['personalizado', 'Personalizado']];
  let todoOk = true, det2 = '';
  for (const tk of temas) {
    for (const [mk, mn] of modos) {
      await evalJs(`(function(){var a=f3AparienciaV2();state.uiSettings.theme='${tk}';a.colores={modo:'${mk}'};f3AparienciaAplicarColores(f3AparienciaColores());f3EstilosV2Aplicar();f3ColoresEditorAbrir();return 1})()`);
      await wait(350);
      const res = await evalJs(`(function(){
        var panel=document.querySelector('#modoSheet>div');
        if(!panel)return 'SIN PANEL';
        var cs=getComputedStyle(panel);
        var l=function(h){var m=/rgba?\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)/.exec(h||'');if(!m)return 0.5;var f=function(c){c=+c/255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4)};return 0.2126*f(m[1])+0.7152*f(m[2])+0.0722*f(m[3])};
        var c1=function(a,b){var x=l(a),y=l(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05)};
        var problemas=[];
        if(c1(cs.backgroundColor,cs.color)<4.5)problemas.push('panel');
        var btn=panel.querySelector('.btn:not(.primary)');
        if(btn){var bs=getComputedStyle(btn);if(c1(bs.backgroundColor,bs.color)<4.5)problemas.push('boton');}
        var inp=panel.querySelector('input[type=text]');
        if(inp){var is2=getComputedStyle(inp);if(c1(is2.backgroundColor,is2.color)<4.5)problemas.push('hex');}
        var lab=panel.querySelector('label,.muted');
        if(lab){var l2=getComputedStyle(lab);if(c1(cs.backgroundColor,l2.color)<3)problemas.push('etiqueta');}
        return problemas.join(',')||'OK';
      })()`);
      if (res !== 'OK') { todoOk = false; det2 += tk + '/' + mn + '=' + res + ' '; }
      await evalJs(`f3ColoresCancelar()`);
      await wait(200);
    }
  }
  t('F3a · Los 24 combinaciones (6 temas × 4 modos) mantienen modales legibles WCAG AA', todoOk, det2 || undefined);
  await evalJs(`(function(){var a=f3AparienciaV2();state.uiSettings.theme='maui';a.colores={modo:'claro'};f3AparienciaAplicarColores(f3AparienciaColores());f3EstilosV2Aplicar();save(true);return 1})()`);

  console.log('\n== F4: tamaños y navegación iPhone ==');
  for (const [w, h, nombre] of [[1280, 820, '1280×820'], [1024, 768, '1024×768']]) {
    await ws.sendJson('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    await wait(500);
    t('F4a · ' + nombre + ' sin desbordes y cabecera ordenada',
      await evalJs(`document.documentElement.scrollWidth<=document.documentElement.clientWidth+2`) &&
      await evalJs(`(function(){var n=document.getElementById('appNombreBoot').getBoundingClientRect();var g=document.getElementById('groupNav').getBoundingClientRect();return g.top>=n.bottom-4;})()`));
  }
  await ws.sendJson('Emulation.setDeviceMetricsOverride', { width: 375, height: 667, deviceScaleFactor: 2, mobile: true });
  await wait(800);
  await evalJs(`(function(){state.uiSettings.tutorialDone=true;var el=document.getElementById('appTutorial');if(el)el.remove();return 1})()`);
  await evalJs(`(function(){var m=document.getElementById('mobileMasMenu');if(m&&m.style.display&&m.style.display!=='none')f3MobileMasToggle();return 1})()`);
  const boxC = await evalJs(`(function(){var b=[].slice.call(document.querySelectorAll('#mobileNavBar .mnav-item')).find(function(x){return x.getAttribute('data-mnavdest')==='🍱 Contador'});if(!b)return null;var r=b.getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)}})()`);
  if (boxC) {
    await ws.sendJson('Input.dispatchMouseEvent', { type: 'mousePressed', x: boxC.x, y: boxC.y, button: 'left', buttons: 1, clickCount: 1 });
    await wait(60);
    await ws.sendJson('Input.dispatchMouseEvent', { type: 'mouseReleased', x: boxC.x, y: boxC.y, button: 'left', buttons: 0, clickCount: 1 });
    await wait(700);
  }
  t('F4b · iPhone 375×667: botón inferior abre su sección desde arriba y sin desbordes',
    await evalJs(`tabs[_activeTab]==='🍱 Contador'`) &&
    await evalJs(`Math.round((document.scrollingElement||document.documentElement).scrollTop)<=4`) &&
    await evalJs(`document.documentElement.scrollWidth<=document.documentElement.clientWidth+2`));
  await ws.sendJson('Emulation.setDeviceMetricsOverride', { width: 667, height: 375, deviceScaleFactor: 2, mobile: true });
  await wait(600);
  t('F4c · iPhone horizontal sin desbordes', await evalJs(`document.documentElement.scrollWidth<=document.documentElement.clientWidth+2`));
  await ws.sendJson('Emulation.clearDeviceMetricsOverride', {});
  await wait(400);

  console.log('\n== F5: datos intactos y estado final ==');
  t('F5a · Rutinas y comidas intactas', await evalJs(`Array.isArray(state.workoutLog)&&Array.isArray(state.meals)`));
  await evalJs(`showGroup('ajustes',false);showTab(tabs.indexOf('👤 Perfil'),null)`);
  await wait(400);
  await evalJs(`(function(){var d=document.getElementById('ajAp');if(d)d.open=true;return 1})()`);
  await wait(200);
  await evalJs(`f3ColoresEditorAbrir()`);
  await wait(400);
  t('F5b · Instancia final: Colores y tema abierto y legible',
    await evalJs(`(function(){var p=document.querySelector('#modoSheet>div');if(!p)return false;var cs=getComputedStyle(p);var l=function(h){var m=/rgba?\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)/.exec(h||'');if(!m)return 0.5;var f=function(c){c=+c/255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4)};return 0.2126*f(m[1])+0.7152*f(m[2])+0.0722*f(m[3])};var l1=l(cs.backgroundColor),l2=l(cs.color);return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05)>=4.5;})()`));

  console.log('\n==========================================');
  console.log('RESULTADO: ' + pasadas + ' PASS / ' + falladas + ' FAIL');
  console.log('==========================================');
  if (falladas) process.exit(1);
  process.exit(0);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
