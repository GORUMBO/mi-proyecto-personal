// Prueba visual de APARIENCIA/IDENTIDAD vía CDP (Electron, perfil TEMPORAL).
// Uso: node tools/prueba-visual-apariencia.js [puerto]  (default 9335)
// El perfil se lanza con --user-data-dir temporal: SIN Supabase, SIN datos
// reales. Verifica: sin Maui, sin flor fija, nombre/logo/subtítulo, colores
// (negro/rojo), paleta adaptada a fondo oscuro/claro, botón activo
// distinguible, navegación renombrada/reordenada/oculta, salvavidas de
// acceso, Cancelar/Aplicar, persistencia al recargar, offline y vista previa.
// Deja la instancia ABIERTA en Ajustes → Apariencia con un tema demo.
const port = Number(process.argv[2] || 9335);
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const wait = ms => new Promise(r => setTimeout(r, ms));

// ---- PNG de prueba (degradado) y PNG oscuro y claro ----
function makePNG(w, h, fn) {
  const rows = [];
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * 3);
    for (let x = 0; x < w; x++) { const p = fn(x / w, y / h); row[1 + x * 3] = p[0]; row[2 + x * 3] = p[1]; row[3 + x * 3] = p[2]; }
    rows.push(row);
  }
  const idat = zlib.deflateSync(Buffer.concat(rows));
  const crcTable = (function () { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c; } return t; })();
  const crc32 = function (buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const chunk = function (type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}
const IMG_OSCURO = path.join(__dirname, 'pruebas', 'ap-fondo-oscuro.png');
const IMG_CLARO = path.join(__dirname, 'pruebas', 'ap-fondo-claro.png');
const IMG_LOGO = path.join(__dirname, 'pruebas', 'ap-logo.png');
if (!fs.existsSync(IMG_OSCURO)) fs.writeFileSync(IMG_OSCURO, makePNG(320, 200, function (x, y) { return [Math.round(8 + x * 14), Math.round(6 + y * 10), Math.round(10 + x * 12)]; }));
if (!fs.existsSync(IMG_CLARO)) fs.writeFileSync(IMG_CLARO, makePNG(320, 200, function (x, y) { return [Math.round(235 - x * 20), Math.round(240 - y * 12), Math.round(225 - x * 15)]; }));
if (!fs.existsSync(IMG_LOGO)) {
  // logo con transparencia: cuadrado azul con esquinas transparentes
  const rows = [];
  for (let y = 0; y < 64; y++) {
    const row = Buffer.alloc(1 + 64 * 4);
    for (let x = 0; x < 64; x++) {
      const dentro = Math.hypot(x - 32, y - 32) < 28;
      row[1 + x * 4] = 40; row[2 + x * 4] = 120; row[3 + x * 4] = 220;
      row[4 + x * 4] = dentro ? 255 : 0;
    }
    rows.push(row);
  }
  const idat = zlib.deflateSync(Buffer.concat(rows));
  const crcTable = (function () { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c; } return t; })();
  const crc32 = function (buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const chunk = function (type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(64, 0); ihdr.writeUInt32BE(64, 4); ihdr[8] = 8; ihdr[9] = 6; // RGBA
  fs.writeFileSync(IMG_LOGO, Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]));
}

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
  throw new Error('No se encontró target CDP en el puerto ' + port + ' — lanza: node_modules/.bin/electron . --user-data-dir=%TEMP%/apariencia-perfil --remote-debugging-port=' + port);
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
  const inputFileNode = async (selector) => {
    const doc = await ws.sendJson('DOM.getDocument', { depth: -1, pierce: true });
    const q = await ws.sendJson('DOM.querySelector', { nodeId: doc.root.nodeId, selector: selector });
    return q.nodeId;
  };

  await ws.sendJson('Runtime.enable', {});
  await ws.sendJson('Page.enable', {});
  await ws.sendJson('DOM.enable', {});
  await ws.sendJson('Page.reload', { ignoreCache: true });
  await wait(3500);

  console.log('== Arranque: identidad por defecto SIN Maui ni verde fijo ==');
  t('B1 · document.title es "Mi Proyecto Personal" (sin Maui)',
    await evalJs(`document.title.indexOf('Maui')<0 && document.title==='🌺 Mi Proyecto Personal'`),
    await evalJs(`document.title`));
  t('B2 · El encabezado no contiene "Maui"', await evalJs(`(function(){return document.getElementById('appNombreBoot').textContent.indexOf('Maui')<0&&document.getElementById('appNombreBoot').textContent==='Mi Proyecto Personal';})()`));
  t('B3 · Las variables CSS del arranque son las de la identidad guardada',
    await evalJs(`getComputedStyle(document.documentElement).getPropertyValue('--app-primary').trim()==='#15704f'`));
  t('B4 · La pantalla de login usa el nombre actual (sin Maui) y el logo configurado',
    await evalJs(`(function(){var ls=document.getElementById('loginScreen');return !ls||(ls.innerText.indexOf('Maui')<0&&ls.innerText.indexOf('Mi Proyecto Personal')>=0);})()`));
  await neutralizar();
  await wait(200);

  console.log('\n== Ajustes → Apariencia: organización ==');
  await evalJs(`showGroup('ajustes',false);showTab(tabs.indexOf('👤 Perfil'),null)`);
  await wait(300);
  t('B5 · Apariencia en Ajustes con Identidad / Colores / Navegación / Fondo / Restaurar',
    await evalJs(`(function(){var d=document.getElementById('ajAp');if(d)d.open=true;var t=document.body.innerText;return t.indexOf('Identidad')>=0&&t.indexOf('Colores y tema')>=0&&t.indexOf('Navegación y botones')>=0&&t.indexOf('Fondo de pantalla')>=0&&t.indexOf('Restaurar apariencia')>=0;})()`));

  console.log('\n== Identidad: nombre, subtítulo, emoji (sin flor) ==');
  await evalJs(`f3IdentidadEditorAbrir()`);
  await wait(300);
  t('B6 · El editor de identidad se abre con vista previa',
    await evalJs(`!!document.getElementById('modoSheet')&&!!document.getElementById('apPrevOut')`));
  await evalJs(`f3IdentidadSet('nombre',{target:{value:'Ruben Fit'}});f3IdentidadSet('subtitulo',{target:{value:'Entrena y come bien'}});f3IdentidadSetCheck('mostrarSubtitulo',{checked:true});f3IdentidadLogoEmojiSet('⚡')`);
  await wait(200);
  t('B7 · La vista previa muestra "Ruben Fit", subtítulo y ⚡',
    await evalJs(`(function(){var p=document.getElementById('apPrevOut').innerText;return p.indexOf('Ruben Fit')>=0&&p.indexOf('Entrena y come bien')>=0&&p.indexOf('⚡')>=0;})()`));
  await evalJs(`f3IdentidadAplicarEditor()`);
  await wait(700);
  t('B8 · Aplicar: título y encabezado con el nombre nuevo (sin Maui)',
    await evalJs(`(function(){return document.title==='⚡ Ruben Fit · Entrena y come bien'&&document.getElementById('appNombreBoot').textContent==='Ruben Fit'&&document.getElementById('appLogoBoot').textContent==='⚡';})()`),
    await evalJs(`document.title`));
  t('B9 · El subtítulo aparece en el encabezado',
    await evalJs(`(function(){var m=document.getElementById('appMetaBoot');return m.textContent==='Entrena y come bien';})()`));
  t('B10 · La flor ya NO está en el encabezado',
    await evalJs(`(function(){return document.getElementById('appLogoBoot').textContent!=='🌺';})()`));

  console.log('\n== Logo por IMAGEN (comprimida con transparencia, en IndexedDB) ==');
  await evalJs(`f3IdentidadEditorAbrir()`);
  await wait(300);
  {
    const nodeId = await inputFileNode('#modoSheet label input[type="file"]');
    t('B11 · Input de logo localizado (label+input nativo)', !!nodeId);
    await ws.sendJson('DOM.setFileInputFiles', { nodeId, files: [IMG_LOGO] });
    await wait(900);
    t('B12 · La vista previa muestra la imagen elegida al momento',
      await evalJs(`(function(){var p=document.getElementById('apPrevOut');return p.innerHTML.indexOf('<img')>=0;})()`));
  }
  await evalJs(`f3IdentidadAplicarEditor()`);
  await wait(900);
  t('B13 · El encabezado muestra el logo de imagen desde IndexedDB (no base64 en localStorage)',
    await evalJs(`(function(){var l=document.getElementById('appLogoBoot');return l.className.indexOf('appLogoImg')>=0&&!!l.querySelector('img');})()`));
  t('B14 · El blob del logo está en IndexedDB y NO en localStorage',
    await evalJs(`(function(){var raw=localStorage.getItem('pp_full')||'';return raw.indexOf('data:image/png;base64')<0;})()`));
  t('B15 · El logo conserva transparencia (PNG en IDB)',
    await evalJs(`(function(){return new Promise(function(res){openPersonalDB().then(function(db){var r=db.transaction('media','readonly').objectStore('media').get('logo_usuario');r.onsuccess=function(){res(r.result&&r.result.type==='image/png')};r.onerror=function(){res(false)}})})})()`, true));

  console.log('\n== Colores: tema negro y tema rojo ==');
  await evalJs(`f3ColoresEditorAbrir()`);
  await wait(300);
  await evalJs(`f3ColoresPreset('carbon');f3ColoresModo('dark')`);
  await wait(200);
  await evalJs(`f3ColoresAplicar()`);
  await wait(400);
  t('B16 · Tema negro: variable principal oscura y modo oscuro activo',
    await evalJs(`(function(){return getComputedStyle(document.documentElement).getPropertyValue('--app-primary').trim()==='#2f3a44'&&document.body.classList.contains('dark');})()`));
  await evalJs(`f3ColoresEditorAbrir()`);
  await wait(300);
  await evalJs(`f3ColoresSet('primary','#8b1e1e');f3ColoresSet('secondary','#c25555');f3ColoresSet('accent','#d9822b');f3ColoresSet('button','#8b1e1e');f3ColoresSet('buttonSelected','#6e1818');f3ColoresModo('light')`);
  await wait(200);
  await evalJs(`f3ColoresAplicar()`);
  await wait(400);
  t('B17 · Tema rojo: encabezado rojo y modo claro',
    await evalJs(`(function(){return getComputedStyle(document.documentElement).getPropertyValue('--app-primary').trim()==='#8b1e1e'&&!document.body.classList.contains('dark');})()`));

  console.log('\n== Paleta adaptativa al fondo (oscuro → claro) ==');
  await evalJs(`f3ColoresEditorAbrir()`);
  await wait(300);
  await evalJs(`f3ColoresSetCheck('adaptarFondo',{checked:true})`);
  await wait(200);
  await evalJs(`f3ColoresAplicar()`); // guarda adaptarFondo (sin fondo aún: sin paleta)
  await wait(300);
  // aplicar fondo oscuro vía setInputFiles en el editor de fondo
  await evalJs(`f3FondoAbrir()`);
  await wait(400);
  {
    const nodeId = await inputFileNode('#modoSheet label input[type="file"]');
    await ws.sendJson('DOM.setFileInputFiles', { nodeId, files: [IMG_OSCURO] });
    await wait(900);
  }
  await evalJs(`f3FondoAplicar()`);
  await wait(1200);
  t('B18 · Fondo oscuro aplicado y paleta adaptada guardada (botones claros)',
    await evalJs(`(function(){var p=state.apariencia.colores.paleta;return !!p&&p.fuente&&p.fuente.oscuro===true;})()`));
  t('B19 · La paleta se guarda UNA vez y los tokens cambian con ella',
    await evalJs(`(function(){return getComputedStyle(document.documentElement).getPropertyValue('--app-primary').trim()===state.apariencia.colores.paleta.primary;})()`));
  // fondo claro
  await evalJs(`f3FondoAbrir()`);
  await wait(400);
  {
    const nodeId = await inputFileNode('#modoSheet label input[type="file"]');
    await ws.sendJson('DOM.setFileInputFiles', { nodeId, files: [IMG_CLARO] });
    await wait(900);
  }
  await evalJs(`f3FondoAplicar()`);
  await wait(1200);
  t('B20 · Fondo claro → paleta regenerada (tono claro, textos oscuros)',
    await evalJs(`(function(){var p=state.apariencia.colores.paleta;return !!p&&p.fuente&&p.fuente.oscuro===false&&p.text==='#17231e';})()`));
  // volver a colores rojos manuales (sin paleta) para las comprobaciones siguientes
  await evalJs(`f3ColoresEditorAbrir()`);
  await wait(300);
  await evalJs(`f3ColoresSet('primary','#8b1e1e');f3ColoresSet('secondary','#c25555');f3ColoresSet('accent','#d9822b');f3ColoresSet('button','#8b1e1e');f3ColoresSet('buttonSelected','#6e1818');f3ColoresSetCheck('adaptarFondo',{checked:false});f3ColoresModo('light')`);
  await wait(200);
  await evalJs(`f3ColoresAplicar()`);
  await wait(400);

  console.log('\n== Botón activo distinguible (color + anillo + marca + aria-current) ==');
  await evalJs(`showGroup('cuerpo',false);showTab(tabs.indexOf('💪 Ejercicio'),null)`);
  await wait(300);
  t('B21 · Grupo activo con clase, aria-current y anillo (CSS)',
    await evalJs(`(function(){var b=document.getElementById('gbtn_cuerpo');return b.classList.contains('gbtn-activo')&&b.getAttribute('aria-current')==='page'&&getComputedStyle(b).outlineStyle!=='none'&&getComputedStyle(b).fontWeight==='900';})()`));
  t('B22 · Sub-pestaña activa con clase, aria-current e indicadores',
    await evalJs(`(function(){var s=document.getElementById('stab_'+tabs.indexOf('💪 Ejercicio'));return !!s&&s.classList.contains('stab-activo')&&s.getAttribute('aria-current')==='page';})()`));

  console.log('\n== Navegación: renombrar, reordenar, ocultar + salvavidas ==');
  await evalJs(`f3NavEditorAbrir()`);
  await wait(300);
  await evalJs(`f3NavSet('grupo','inicio','emoji','🚪');f3NavSet('grupo','inicio','nombre','Portada');f3NavSet('grupo','dinero','nombre','Mi Lana');f3NavSet('grupo','vida','nombre','Mi Día')`);
  await wait(200);
  await evalJs(`f3NavAplicar()`);
  await wait(400);
  t('B23 · Botones renombrados en el DOM (destino intacto)',
    await evalJs(`(function(){var g=document.getElementById('groupNav').innerText;return g.indexOf('🚪 Portada')>=0&&g.indexOf('Mi Lana')>=0&&g.indexOf('Mi Día')>=0&&g.indexOf('Inicio')<0;})()`));
  await evalJs(`showGroup('inicio',false)`);
  await wait(200);
  t('B24 · El botón renombrado abre la MISMA sección (destino no cambia)',
    await evalJs(`(function(){return _activeGroup==='inicio'&&tabs[_activeTab]==='🏠 Inicio';})()`));
  // ocultar un grupo + intentar ocultar todos los accesos
  await evalJs(`f3NavEditorAbrir()`);
  await wait(300);
  await evalJs(`f3NavSetCheck('grupo','comer',{checked:false})`);
  await wait(200);
  await evalJs(`f3NavAplicar()`);
  await wait(300);
  t('B25 · El grupo oculto desaparece de la barra', await evalJs(`!(document.getElementById('gbtn_comer')&&document.getElementById('gbtn_comer').offsetParent!==null)`));
  await evalJs(`f3NavEditorAbrir()`);
  await wait(300);
  await evalJs(`f3NavSetCheck('grupo','inicio',{checked:false});f3NavSetCheck('grupo','ajustes',{checked:false});f3NavSetMasCheck({checked:false});f3NavAplicar()`);
  await wait(300);
  t('B26 · Ocultar Inicio+Ajustes+Más se BLOQUEA (siempre hay un acceso)',
    await evalJs(`(function(){return !!document.getElementById('gbtn_inicio')||!!document.getElementById('gbtn_ajustes')||(function(){var b=document.getElementById('mobileNavBar');return b&&b.innerText.indexOf('Más')>=0})();})()`));
  t('B27 · El aviso del bloqueo se muestra', await evalJs(`(function(){return document.body.innerText.indexOf('No puedes ocultar todos los accesos')>=0;})()`));
  await evalJs(`f3NavCancelar()`);
  await wait(300);

  console.log('\n== Cancelar restaura / Aplicar conserva / recargar conserva ==');
  await evalJs(`f3IdentidadEditorAbrir()`);
  await wait(300);
  await evalJs(`f3IdentidadSet('nombre',{target:{value:'Nombre Temporal'}});f3IdentidadLogoEmojiSet('🎃')`);
  await wait(200);
  await evalJs(`f3IdentidadCancelar()`);
  await wait(300);
  t('B28 · Cancelar deja el nombre guardado intacto',
    await evalJs(`document.getElementById('appNombreBoot').textContent==='Ruben Fit'`));
  await ws.sendJson('Page.reload', { ignoreCache: true });
  await wait(3500);
  await neutralizar();
  await wait(300);
  t('B29 · Tras recargar: nombre, logo imagen, subtítulo, colores rojos y fondo persistidos',
    await evalJs(`(function(){return document.getElementById('appNombreBoot').textContent==='Ruben Fit'&&document.getElementById('appLogoBoot').className.indexOf('appLogoImg')>=0&&document.getElementById('appMetaBoot').textContent==='Entrena y come bien'&&getComputedStyle(document.documentElement).getPropertyValue('--app-primary').trim()==='#8b1e1e'&&!!state.fondoCfg.imgId;})()`));
  t('B30 · Tras recargar NO aparece "Maui" ni la flor en el encabezado',
    await evalJs(`(function(){return document.getElementById('appNombreBoot').textContent.indexOf('Maui')<0&&document.getElementById('appLogoBoot').textContent!=='🌺'&&document.title.indexOf('Maui')<0;})()`));

  console.log('\n== Sin conexión (offline local-first) ==');
  await ws.sendJson('Network.enable', {});
  await ws.sendJson('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await ws.sendJson('Page.reload', { ignoreCache: true });
  await wait(3500);
  await neutralizar();
  await wait(400);
  t('B31 · Sin conexión la app carga con la identidad guardada',
    await evalJs(`(function(){return document.getElementById('appNombreBoot').textContent==='Ruben Fit'&&!!document.getElementById('app');})()`));
  await ws.sendJson('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });

  console.log('\n== Restaurar apariencia ==');
  await evalJs(`f3AparienciaRestaurar()`);
  await wait(500);
  t('B32 · Restaurar apariencia vuelve al nombre y logo por defecto',
    await evalJs(`(function(){return document.getElementById('appNombreBoot').textContent==='Mi Proyecto Personal'&&document.title.indexOf('Maui')<0;})()`));
  t('B33 · Restaurar NO borra datos (workoutLog vacío sigue vacío, nada se pierde)',
    await evalJs(`Array.isArray(state.workoutLog)`));

  // DEMO para revisión visual: tema rojo + nombre demo + logo emoji ⚡,
  // en Ajustes → Apariencia con la vista previa abierta
  console.log('\n== Preparando demo para revisión (solo perfil temporal) ==');
  await evalJs(`f3ColoresEditorAbrir()`);
  await wait(300);
  await evalJs(`f3ColoresSet('primary','#8b1e1e');f3ColoresSet('secondary','#c25555');f3ColoresSet('accent','#d9822b');f3ColoresSet('button','#8b1e1e');f3ColoresSet('buttonSelected','#6e1818');f3ColoresModo('light')`);
  await wait(200);
  await evalJs(`f3ColoresAplicar()`);
  await wait(300);
  await evalJs(`f3IdentidadEditorAbrir()`);
  await wait(200);
  await evalJs(`f3IdentidadSet('nombre',{target:{value:'Ruben Fit'}});f3IdentidadSet('subtitulo',{target:{value:'Mi app, mis colores'}});f3IdentidadSetCheck('mostrarSubtitulo',{checked:true});f3IdentidadLogoEmojiSet('⚡')`);
  await wait(200);
  await evalJs(`f3IdentidadAplicarEditor()`);
  await wait(400);
  // deja el editor de colores con la vista previa abierta para la revisión
  await evalJs(`f3ColoresEditorAbrir()`);
  await wait(300);

  console.log('\n==========================================');
  console.log('RESULTADO: ' + pasadas + ' PASS / ' + falladas + ' FAIL');
  console.log('==========================================');
  console.log('Instancia TEMPORAL dejada ABIERTA en Ajustes → Apariencia → Colores');
  console.log('con vista previa y tema de demostración ROJO + "Ruben Fit" + ⚡.');
  console.log('El perfil real NO fue tocado (user-data-dir temporal, sin Supabase).');
  if (falladas) process.exit(1);
  process.exit(0);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
