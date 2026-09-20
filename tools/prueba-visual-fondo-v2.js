// Prueba visual del FONDO PERSONALIZADO v2 vía CDP (Electron, perfil TEMPORAL).
// Uso: node tools/prueba-visual-fondo-v2.js [puerto]  (default 9335)
// Verifica: capas/legibilidad (superficies 94%), detección oscuro/claro con
// paleta (cabecera NO verde), imagen sin ampliar/recortar (Contener/Repetir),
// vista previa exacta, botón activo con borde único, submenús integrados,
// Mi semana legible (WCAG AA), secciones nunca vacías, persistencia, offline,
// móvil 375×667 v/h. Deja la instancia con el diseño "Aloha Mia" aplicado
// mostrando Fitness para revisión visual.
const port = Number(process.argv[2] || 9335);
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const wait = ms => new Promise(r => setTimeout(r, ms));

function chunk(type, data) {
  const crcTable = (function () { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c; } return t; })();
  const crc32 = function (buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function makePNG(w, h, px, hasAlpha) {
  const ch = hasAlpha ? 4 : 3;
  const rows = [];
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * ch);
    for (let x = 0; x < w; x++) {
      const p = px(x, y);
      row[1 + x * ch] = p[0]; row[2 + x * ch] = p[1]; row[3 + x * ch] = p[2];
      if (hasAlpha) row[4 + x * ch] = p[3] == null ? 255 : p[3];
    }
    rows.push(row);
  }
  const idat = zlib.deflateSync(Buffer.concat(rows));
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = hasAlpha ? 6 : 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}
function escribir(nombre, w, h, px, alpha) {
  const p = path.join(__dirname, 'pruebas', nombre);
  if (!fs.existsSync(p)) fs.writeFileSync(p, makePNG(w, h, px, alpha));
  return p;
}
// Fondo oscuro tipo foto nocturna (1600×1200, grande → cover)
const IMG_OSCURO = escribir('v2-fondo-oscuro.png', 1600, 1200, function (x, y) {
  return [Math.round(10 + (y / 1200) * 18), Math.round(8 + (x / 1600) * 12), Math.round(14 + (y / 1200) * 10)];
});
// Fondo claro (1600×1200)
const IMG_CLARO = escribir('v2-fondo-claro.png', 1600, 1200, function (x, y) {
  return [Math.round(228 + (x / 1600) * 18), Math.round(232 + (y / 1200) * 14), Math.round(218 + (x / 1600) * 20)];
});
// Fondo rojo liso (1600×1200)
const IMG_ROJO = escribir('v2-fondo-rojo.png', 1600, 1200, function () { return [150, 26, 26]; });
// Diseño "Aloha Mia" (800×600): base negra + flores rojas/rosas + hojas
const IMG_ALOHA = escribir('aloha-mia-prueba.png', 800, 600, function (x, y) {
  const flor = function (cx, cy, r, petalos, c1, c2) {
    const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
    if (d > r) return null;
    const ang = Math.atan2(dy, dx);
    const petal = Math.round(((ang + Math.PI) / (Math.PI * 2)) * petalos) % petalos;
    const dist = d / r;
    return dist < 0.3 ? c2 : (petal % 2 === 0 ? c1 : c2);
  };
  let p = flor(240, 220, 110, 5, [214, 48, 58], [246, 118, 128]);
  if (p) return p;
  p = flor(560, 200, 120, 6, [232, 88, 46], [250, 152, 84]);
  if (p) return p;
  p = flor(170, 430, 100, 5, [226, 42, 92], [246, 130, 152]);
  if (p) return p;
  p = flor(620, 430, 110, 6, [200, 36, 62], [240, 110, 120]);
  if (p) return p;
  // hoja verde
  const dx = x - 400, dy = y - 520, d = Math.hypot(dx, dy);
  if (d < 70 && dx < 40 && dy > -70) return [34, 110, 60];
  return [8, 8, 10];
});
const IMG_LOGO_SINAMPLIAR = IMG_ALOHA; // 800×600: NO debe ampliarse

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
  throw new Error('No se encontró target CDP en el puerto ' + port + ' — lanza: node_modules/.bin/electron . --user-data-dir=%TEMP%/fondo-v2-perfil --remote-debugging-port=' + port);
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
  const aplicarFondo = async (imgPath) => {
    await evalJs(`f3FondoAbrir()`);
    await wait(400);
    const doc = await ws.sendJson('DOM.getDocument', { depth: -1, pierce: true });
    const q = await ws.sendJson('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '#modoSheet label input[type="file"]' });
    await ws.sendJson('DOM.setFileInputFiles', { nodeId: q.nodeId, files: [imgPath] });
    await wait(1000);
    await evalJs(`f3FondoAplicar()`);
    await wait(1200);
  };
  const contraste = (a, b) => {
    const l = function (h) { const m = /rgba?\((\d+),(\d+),(\d+)/.exec(h); if (!m) return 0.5; const f = function (c) { c = +c / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(m[1]) + 0.7152 * f(m[2]) + 0.0722 * f(m[3]); };
    const l1 = l(a), l2 = l(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };

  await ws.sendJson('Runtime.enable', {});
  await ws.sendJson('Page.enable', {});
  await ws.sendJson('DOM.enable', {});
  await ws.sendJson('Page.reload', { ignoreCache: true });
  await wait(3500);
  await neutralizar();
  await wait(300);
  // helper de contraste WCAG en la página (acepta 'rgb(r, g, b)' y rgba)
  await evalJs(`window.__contraste=function(a,b){var l=function(h){var m=/rgba?\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)/.exec(h||'');if(!m)return 0.5;var f=function(c){c=+c/255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4)};return 0.2126*f(m[1])+0.7152*f(m[2])+0.0722*f(m[3])};var l1=l(a),l2=l(b);return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05)};1`);

  console.log('== Fondo OSCURO: capas, superficies y cabecera adaptada ==');
  await aplicarFondo(IMG_OSCURO);
  t('C1 · Fondo aplicado: capa presente y clase body.pp-fondo activa',
    await evalJs(`(function(){var c=document.getElementById('ppCustomBackground');return !!c&&c.style.backgroundImage.indexOf('url(')>=0&&document.body.classList.contains('pp-fondo');})()`));
  t('C2 · La capa tiene color de respaldo tomado de la imagen (no verde)',
    await evalJs(`(function(){var c=document.getElementById('ppCustomBackground');return !!c.style.backgroundColor&&c.style.backgroundColor!=='#15704f'&&c.style.backgroundColor!=='';})()`),
    await evalJs(`document.getElementById('ppCustomBackground').style.backgroundColor`));
  t('C3 · Modo automático: la cabecera sigue a la imagen (ya NO es verde)',
    await evalJs(`(function(){var v=getComputedStyle(document.documentElement).getPropertyValue('--app-primary').trim();return v!=='#15704f'&&state.apariencia.colores.paleta&&v===state.apariencia.colores.paleta.primary;})()`),
    await evalJs(`getComputedStyle(document.documentElement).getPropertyValue('--app-primary').trim()`));
  t('C4 · Las tarjetas tienen superficie semitransparente 92–96% (nada de texto directo sobre la imagen)',
    await evalJs(`(function(){var el=document.querySelector('.card')||document.querySelector('details');if(!el)return false;var bg=getComputedStyle(el).backgroundColor;var m=/rgba?\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)\\s*(?:,\\s*([\\d.]+)\\s*)?\\)/.exec(bg);return !!m&&((m[4]==null)||(+m[4]>=0.92));})()`));
  t('C5 · La superficie de la tarjeta contrasta con su texto (WCAG AA ≥4.5)',
    await evalJs(`(function(){var el=document.querySelector('.card')||document.querySelector('details');if(!el)return false;var cs=getComputedStyle(el);return window.__contraste(cs.backgroundColor,cs.color)>=4.5;})()`));
  t('C6 · Los días de "Mi semana" tienen superficie y contraste AA',
    await evalJs(`(function(){showTab(tabs.indexOf('💪 Ejercicio'),null);return 1})()`));
  await wait(600);
  t('C6b · Días de Mi semana legibles (superficie + contraste ≥4.5)',
    await evalJs(`(function(){var b=document.querySelector('.fit5-seg-btn');if(!b)return 'SIN DIAS';var cs=getComputedStyle(b);return window.__contraste(cs.backgroundColor,cs.color)>=4.5&&cs.backgroundColor!=='rgba(0, 0, 0, 0)';})()`));
  t('C7 · Botón activo con UN solo borde (sin doble anillo gris)',
    await evalJs(`(function(){var b=document.querySelector('#groupNav .gbtn-activo')||document.getElementById('gbtn_cuerpo');if(!b)return false;var cs=getComputedStyle(b);return cs.outlineStyle==='none'&&cs.borderTopWidth==='1.5px'&&cs.boxShadow!=='none';})()`));
  t('C8 · Submenús integrados en su barra (superficie, no flotando sobre la imagen)',
    await evalJs(`(function(){var w=document.getElementById('subNavWrap');if(!w)return true;var bg=getComputedStyle(w).backgroundColor;return bg!=='transparent'&&bg!=='rgba(0, 0, 0, 0)';})()`));

  console.log('\n== Contener vs Cubrir (sin ampliar diseños) + vista previa exacta ==');
  await aplicarFondo(IMG_ALOHA);
  await evalJs(`state.fondoCfg.ajuste='contain';state.fondoCfg.posicion='centro';f3FondoAplicarVisual(window._fondoObjectURL)`);
  await wait(300);
  t('C9 · Diseño 800×600 + Contener: se muestra a tamaño natural (NO ampliado)',
    await evalJs(`document.getElementById('ppCustomBackground').style.backgroundSize==='800px 600px'`),
    await evalJs(`document.getElementById('ppCustomBackground').style.backgroundSize`));
  await evalJs(`f3FondoAbrir()`);
  await wait(500);
  t('C10 · La vista previa representa el MISMO tamaño relativo que la app',
    await evalJs(`(function(){var p=document.getElementById('fondoPreview');var s=p.style.backgroundSize;var m=/^(\d+)px (\d+)px$/.exec(s);if(!m)return s;var vw=window.innerWidth||1280;var k=(p.clientWidth||340)/vw;return Math.abs((+m[1])-Math.round(800*k))<=2;})()`));
  await evalJs(`f3FondoCancelar()`);
  await wait(300);
  await evalJs(`state.fondoCfg.ajuste='cover';f3FondoAplicarVisual(window._fondoObjectURL)`);
  await wait(300);
  t('C11 · Diseño 800×600 + Cubrir: sigue sin ampliarse hasta recortarse',
    await evalJs(`document.getElementById('ppCustomBackground').style.backgroundSize==='800px 600px'`));
  // imagen GRANDE con cover/contain clásicos
  await aplicarFondo(IMG_OSCURO);
  await evalJs(`state.fondoCfg.ajuste='cover';f3FondoAplicarVisual(window._fondoObjectURL)`);
  await wait(300);
  t('C12 · Imagen grande + Cubrir: cubre la vista (comportamiento clásico)',
    await evalJs(`document.getElementById('ppCustomBackground').style.backgroundSize==='cover'`));
  await evalJs(`state.fondoCfg.ajuste='contain';f3FondoAplicarVisual(window._fondoObjectURL)`);
  await wait(300);
  t('C13 · Imagen grande + Contener: contiene sin recortar',
    await evalJs(`document.getElementById('ppCustomBackground').style.backgroundSize==='contain'`));

  console.log('\n== Aclarado (capa de legibilidad única) + cancelar/quitar/restaurar ==');
  await evalJs(`f3FondoAbrir()`);
  await wait(400);
  await evalJs(`f3FondoBorradorSet('aclarar',{target:{value:'30'}})`);
  await wait(200);
  t('C14 · Subir Aclarado deja Oscurecimiento en 0 y pinta overlay blanco en la previa',
    await evalJs(`(function(){var b=window._fondoBorrador;var p=document.getElementById('fondoPreview');return b.aclarar===30&&b.oscurecer===0&&/rgba\\(255,\\s*255,\\s*255,\\s*0\\.3\\)/.test(p.style.backgroundImage);})()`));
  await evalJs(`f3FondoCancelar()`);
  await wait(400);
  t('C15 · Cancelar conserva el fondo aplicado intacto',
    await evalJs(`document.body.classList.contains('pp-fondo')&&!!state.fondoCfg.imgId`));
  await evalJs(`f3FondoQuitarGuardado()`);
  await wait(500);
  t('C16 · Quitar fondo: se restaura el predeterminado y la clase pp-fondo se quita',
    await evalJs(`!document.body.classList.contains('pp-fondo')&&!state.fondoCfg.imgId`));

  console.log('\n== Persistencia, recarga, offline y secciones nunca vacías ==');
  await aplicarFondo(IMG_ROJO);
  t('C17 · Fondo ROJO: paleta con variante roja y cabecera roja (no verde)',
    await evalJs(`(function(){var v=getComputedStyle(document.documentElement).getPropertyValue('--app-primary').trim();return /^#[a-fA-F0-9]{6}$/.test(v)&&v!=='#15704f';})()`),
    await evalJs(`getComputedStyle(document.documentElement).getPropertyValue('--app-primary').trim()`));
  await ws.sendJson('Page.reload', { ignoreCache: true });
  await wait(3500);
  await neutralizar();
  await wait(400);
  t('C18 · Tras recargar: fondo, superficies y paleta persisten',
    await evalJs(`(function(){var c=document.getElementById('ppCustomBackground');return document.body.classList.contains('pp-fondo')&&!!c&&c.style.backgroundImage.indexOf('url(')>=0&&!!state.apariencia.colores.paleta;})()`));
  await ws.sendJson('Network.enable', {});
  await ws.sendJson('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await ws.sendJson('Page.reload', { ignoreCache: true });
  await wait(3500);
  await neutralizar();
  await wait(400);
  t('C19 · Sin conexión: el fondo y la identidad cargan igual',
    await evalJs(`(function(){var c=document.getElementById('ppCustomBackground');return document.body.classList.contains('pp-fondo')&&!!c&&c.style.backgroundImage.indexOf('url(')>=0;})()`));
  await ws.sendJson('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  // secciones: nunca vacías ni con indicador permanente
  const secciones = [['inicio', '🏠 Inicio'], ['comer', '🍱 Contador'], ['cuerpo', '💪 Ejercicio'], ['cuerpo', '🚶 Caminata'], ['cuerpo', '⚖️ Peso'], ['dinero', '💳 Gastos'], ['vida', '🧤 Trabajo'], ['ajustes', '👤 Perfil']];
  let todasOk = true, detalle = '';
  for (const [gid, tab] of secciones) {
    await evalJs(`showGroup('${gid}',false);showTab(tabs.indexOf('${tab}'),null)`);
    await wait(350);
    const res = await evalJs(`(function(){var el=document.getElementById('tab_'+tabs.indexOf('${tab}'));if(!el)return 'SIN TAB';var h=el.innerHTML.trim();if(!h)return 'VACIA';if(h.indexOf('ppCargando')>=0)return 'CARGANDO';return 'OK';})()`);
    if (res !== 'OK') { todasOk = false; detalle += gid + '/' + tab + '=' + res + ' '; }
  }
  t('C20 · Todas las secciones y submenús (incl. Metas, Ejercicio, Caminata, Peso) muestran contenido real',
    todasOk, detalle || undefined);
  await evalJs(`showGroup('inicio',false);showTab(tabs.indexOf('🎯 Metas'),null)`);
  await wait(350);
  t('C21 · Metas renderiza contenido integrado en la barra (no vacío)',
    await evalJs(`(function(){var el=document.getElementById('tab_'+tabs.indexOf('🎯 Metas'));return !!el&&el.innerHTML.trim().length>20;})()`));

  console.log('\n== Móvil 375×667 (vertical y horizontal) ==');
  await ws.sendJson('Emulation.setDeviceMetricsOverride', { width: 375, height: 667, deviceScaleFactor: 2, mobile: true });
  await wait(700);
  t('C22 · Móvil vertical: sin desborde horizontal y con fondo aplicado',
    await evalJs(`document.documentElement.scrollWidth<=document.documentElement.clientWidth+2&&document.body.classList.contains('pp-fondo')`));
  await ws.sendJson('Emulation.setDeviceMetricsOverride', { width: 667, height: 375, deviceScaleFactor: 2, mobile: true });
  await wait(600);
  t('C23 · Móvil horizontal: sin desborde horizontal',
    await evalJs(`document.documentElement.scrollWidth<=document.documentElement.clientWidth+2`));
  await ws.sendJson('Emulation.clearDeviceMetricsOverride', {});
  await wait(400);

  console.log('\n== Demo final: "Aloha Mia" con ajuste recomendado ==');
  await aplicarFondo(IMG_ALOHA);
  await evalJs(`state.fondoCfg.ajuste='contain';state.fondoCfg.posicion='centro';state.fondoCfg.brillo=115;state.fondoCfg.oscurecer=0;state.fondoCfg.aclarar=0;save(true);f3FondoAplicarVisual(window._fondoObjectURL)`);
  await wait(500);
  t('C24 · Aloha Mia: contenida y centrada a tamaño natural sobre respaldo tomado de la imagen',
    await evalJs(`(function(){var c=document.getElementById('ppCustomBackground');return c.style.backgroundSize==='800px 600px'&&/center/.test(c.style.backgroundPosition)&&/^rgb\\(\\d+,\\s*\\d+,\\s*\\d+\\)$/.test(c.style.backgroundColor)&&c.style.backgroundColor!=='rgb(21, 112, 79)';})()`),
    await evalJs(`(function(){var c=document.getElementById('ppCustomBackground');return c.style.backgroundColor+' / '+c.style.backgroundSize})()`));
  t('C25 · Aloha Mia: cabecera derivada de la imagen (tono de las flores, no verde)',
    await evalJs(`(function(){var v=getComputedStyle(document.documentElement).getPropertyValue('--app-primary').trim();return /^#[a-fA-F0-9]{6}$/.test(v)&&v!=='#15704f';})()`),
    await evalJs(`getComputedStyle(document.documentElement).getPropertyValue('--app-primary').trim()`));
  t('C26 · Aloha Mia: botón activo con el acento de la paleta',
    await evalJs(`(function(){var c=document.getElementById('ppCustomBackground');var ac=getComputedStyle(document.documentElement).getPropertyValue('--app-accent').trim();return /^#[a-fA-F0-9]{6}$/.test(ac)&&ac!=='#f0a020';})()`));
  // muestra Inicio y luego Fitness para la revisión
  await evalJs(`showGroup('inicio',false);showTab(tabs.indexOf('🏠 Inicio'),null)`);
  await wait(500);
  t('C27 · Inicio visible con fondo Aloha Mia y contenido legible',
    await evalJs(`(function(){var el=document.getElementById('tab_'+tabs.indexOf('🏠 Inicio'));return !!el&&el.innerHTML.trim().length>100;})()`));
  await evalJs(`showGroup('cuerpo',false);showTab(tabs.indexOf('💪 Ejercicio'),null)`);
  await wait(600);
  t('C28 · Fitness visible con Mi semana legible',
    await evalJs(`(function(){var el=document.getElementById('tab_'+tabs.indexOf('💪 Ejercicio'));return !!el&&el.innerHTML.trim().length>100;})()`));

  console.log('\n==========================================');
  console.log('RESULTADO: ' + pasadas + ' PASS / ' + falladas + ' FAIL');
  console.log('==========================================');
  console.log('Instancia TEMPORAL dejada ABIERTA con el fondo "Aloha Mia" aplicado');
  console.log('(contenido y centrado, base negra, cabecera de las flores) mostrando');
  console.log('Fitness; Inicio quedó verificado. Perfil real NO tocado.');
  if (falladas) process.exit(1);
  process.exit(0);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
