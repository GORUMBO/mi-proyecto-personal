// Prueba visual del FONDO v3 (corrección del bloqueador) vía CDP.
// Uso: node tools/prueba-visual-fondo-v3.js [puerto]  (default 9335)
// Verifica de verdad (no solo selectores): visibilidad por elementFromPoint,
// dimensiones y posición de las tarjetas, z-index de capas, superficies
// originales conservadas, contain estándar, recuperación automática ante
// imagen rota, capturas de pantalla para revisión de píxeles.
// Escenarios: sin fondo, oscuro, claro, Aloha Mia (contain), Cubrir/Contener,
// Windows 1280×820 y iPhone 375×667 v/h.
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
function makePNG(w, h, px) {
  const rows = [];
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * 3);
    for (let x = 0; x < w; x++) { const p = px(x, y); row[1 + x * 3] = p[0]; row[2 + x * 3] = p[1]; row[3 + x * 3] = p[2]; }
    rows.push(row);
  }
  const idat = zlib.deflateSync(Buffer.concat(rows));
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}
function escribir(nombre, w, h, px) {
  const p = path.join(__dirname, 'pruebas', nombre);
  if (!fs.existsSync(p)) fs.writeFileSync(p, makePNG(w, h, px));
  return p;
}
const IMG_OSCURO = escribir('v3-fondo-oscuro.png', 1600, 1200, function (x, y) { return [Math.round(8 + (y / 1200) * 16), Math.round(6 + (x / 1600) * 10), Math.round(12 + (y / 1200) * 9)]; });
const IMG_CLARO = escribir('v3-fondo-claro.png', 1600, 1200, function (x, y) { return [Math.round(226 + (x / 1600) * 16), Math.round(230 + (y / 1200) * 12), Math.round(216 + (x / 1600) * 18)]; });
const IMG_ROJO = escribir('v3-fondo-rojo.png', 1600, 1200, function () { return [150, 26, 26]; });
const IMG_ALOHA = escribir('aloha-mia-prueba.png', 800, 600, function (x, y) {
  const flor = function (cx, cy, r, petalos, c1, c2) {
    const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
    if (d > r) return null;
    const ang = Math.atan2(dy, dx);
    const petal = Math.round(((ang + Math.PI) / (Math.PI * 2)) * petalos) % petalos;
    return (d / r) < 0.3 ? c2 : (petal % 2 === 0 ? c1 : c2);
  };
  let p = flor(240, 220, 110, 5, [214, 48, 58], [246, 118, 128]); if (p) return p;
  p = flor(560, 200, 120, 6, [232, 88, 46], [250, 152, 84]); if (p) return p;
  p = flor(170, 430, 100, 5, [226, 42, 92], [246, 130, 152]); if (p) return p;
  p = flor(620, 430, 110, 6, [200, 36, 62], [240, 110, 120]); if (p) return p;
  const dx = x - 400, dy = y - 520, d = Math.hypot(dx, dy);
  if (d < 70 && dx < 40 && dy > -70) return [34, 110, 60];
  return [8, 8, 10];
});

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
// Análisis de PÍXELES reales del PNG capturado: proporción de píxeles
// "superficie clara" (tarjetas) en la banda de contenido [y0,y1] (0..1).
function analizarSuperficies(pngPath, y0, y1) {
  const buf = fs.readFileSync(pngPath);
  if (buf.readUInt32BE(0) !== 0x89504E47) return -1;
  let pos = 8, w = 0, h = 0, colorType = 2, idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const tipo = buf.toString('ascii', pos + 4, pos + 8);
    if (tipo === 'IHDR') { w = buf.readUInt32BE(pos + 8); h = buf.readUInt32BE(pos + 12); colorType = buf[pos + 17]; }
    else if (tipo === 'IDAT') idat.push(buf.slice(pos + 8, pos + 8 + len));
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = colorType === 6 ? 4 : 3; // RGB (2) o RGBA (6)
  const stride = w * bpp;
  const filas = [];
  let prev = Buffer.alloc(stride);
  let off = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[off++];
    const cur = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      let v = raw[off++];
      if (f === 1) v = (v + a) & 255;
      else if (f === 2) v = (v + b) & 255;
      else if (f === 3) v = (v + ((a + b) >> 1)) & 255;
      else if (f === 4) { const p = a + b - c; const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v = (v + (pa <= pb && pa <= pc ? a : (pb <= pc ? b : c))) & 255; }
      cur[x] = v;
    }
    filas.push(cur);
    prev = cur;
  }
  const yA = Math.floor(h * y0), yB = Math.floor(h * y1);
  let claros = 0, total = 0;
  for (let y = yA; y < yB; y++) {
    const fila = filas[y];
    for (let x = 0; x < w; x++) {
      const r = fila[x * 4], g = fila[x * 4 + 1], b = fila[x * 4 + 2];
      if (r > 225 && g > 225 && b > 225) claros++;
      total++;
    }
  }
  return total ? claros / total : -1;
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
  const aplicarFondo = async (imgPath, ajuste) => {
    await evalJs(`f3FondoAbrir()`);
    await wait(400);
    const doc = await ws.sendJson('DOM.getDocument', { depth: -1, pierce: true });
    const q = await ws.sendJson('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '#modoSheet label input[type="file"]' });
    await ws.sendJson('DOM.setFileInputFiles', { nodeId: q.nodeId, files: [imgPath] });
    await wait(1000);
    if (ajuste) await evalJs(`f3FondoBorradorSet('ajuste',{target:{value:'${ajuste}'}})`);
    await evalJs(`f3FondoAplicar()`);
    await wait(1300);
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

  // Escáner de visibilidad REAL en la página: dimensiones + offsetParent +
  // elementFromPoint en el centro (el elemento o un hijo están en pantalla).
  await evalJs(`window.__scan=function(){
    var tab=document.querySelector('.tab.active');if(!tab)return 'SIN TAB';
    var h=tab.innerHTML.trim();if(h.length<200)return 'CORTO:'+h.length;
    var c=[].slice.call(tab.querySelectorAll('.card,details,.btn,.kpi,.fit-card-ej,.fit5-seg-btn,.mini,input,select,textarea,.calc-row,.item'));
    var visibles=0,conSuperficie=0;
    for(var i=0;i<c.length;i++){
      var el=c[i],r=el.getBoundingClientRect();
      if(r.width<24||r.height<12)continue;
      if(el.offsetParent===null)continue;
      var top=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
      if(top&&(top===el||el.contains(top)||top.contains(el)))visibles++;
      var bg=getComputedStyle(el).backgroundColor;
      if(bg!=='rgba(0, 0, 0, 0)'&&bg!=='transparent')conSuperficie++;
    }
    return {len:h.length,visibles:visibles,conSuperficie:conSuperficie};
  };1`);
  const inyectarScanner = async () => evalJs(`window.__scan=function(){
    var tab=document.querySelector('.tab.active');if(!tab)return 'SIN TAB';
    var h=tab.innerHTML.trim();if(h.length<200)return 'CORTO:'+h.length;
    var c=[].slice.call(tab.querySelectorAll('.card,details,.btn,.kpi,.fit-card-ej,.fit5-seg-btn,.mini,input,select,textarea,.calc-row,.item'));
    var visibles=0,conSuperficie=0,enPantalla=0;
    for(var i=0;i<c.length;i++){
      var el=c[i],r=el.getBoundingClientRect();
      if(r.width<24||r.height<12)continue;
      if(el.offsetParent===null)continue;
      // solo elementos que intersectan el viewport (lo que se VE ahora)
      if(r.bottom<=0||r.top>=window.innerHeight)continue;
      enPantalla++;
      var top=document.elementFromPoint(r.left+r.width/2,Math.min(r.top+r.height/2,window.innerHeight-2));
      if(top&&(top===el||el.contains(top)||top.contains(el)))visibles++;
      var bg=getComputedStyle(el).backgroundColor;
      if(bg!=='rgba(0, 0, 0, 0)'&&bg!=='transparent')conSuperficie++;
    }
    return {len:h.length,visibles:visibles,conSuperficie:conSuperficie,enPantalla:enPantalla};
  };1`);
  const escanear = async (gid, tab) => {
    await evalJs(`showGroup('${gid}',false);showTab(tabs.indexOf('${tab}'),null);window.scrollTo(0,0)`);
    await wait(600);
    let s = await evalJs(`window.__scan()`);
    // render/relayout lentos: hasta 3 reintentos con asentamiento
    for (let i = 0; i < 3 && s && s.len >= 200 && s.visibles < 3; i++) { await wait(900); s = await evalJs(`window.__scan()`); }
    return s;
  };
  const secciones = [['inicio', '🏠 Inicio'], ['comer', '🍱 Contador'], ['cuerpo', '💪 Ejercicio'], ['cuerpo', '🚶 Caminata'], ['cuerpo', '⚖️ Peso'], ['dinero', '💳 Gastos'], ['vida', '🧤 Trabajo'], ['ajustes', '👤 Perfil']];

  console.log('== SIN fondo: todo visible (línea base) ==');
  await evalJs(`f3FondoQuitarGuardado()`);
  await wait(400);
  {
    let okTodas = true, det = '';
    for (const [gid, tab] of secciones) {
      let s = await escanear(gid, tab);
      // cuerpo se re-visita: el detalle del día se expande tras el primer render
      if (gid === 'cuerpo' && tab === '💪 Ejercicio') s = await escanear(gid, tab);
      if (!(s && s.len >= 1000 && s.visibles >= 2 && s.conSuperficie >= 1)) { okTodas = false; det += gid + '=' + JSON.stringify(s) + ' '; }
    }
    t('V1 · Sin fondo: las 8 secciones muestran tarjetas reales en pantalla', okTodas, det || undefined);
  }

  console.log('\n== Capas: el fondo es una capa fija independiente ==');
  await aplicarFondo(IMG_OSCURO, 'cover');
  t('V2 · Capa fixed, inset 0, pointer-events none, z-index 0',
    await evalJs(`(function(){var c=document.getElementById('ppCustomBackground');var cs=getComputedStyle(c);return cs.position==='fixed'&&cs.zIndex==='0'&&cs.pointerEvents==='none';})()`));
  t('V3 · El contenido vive en capas superiores (#app z-index 1, header 5)',
    await evalJs(`(function(){var a=getComputedStyle(document.getElementById('app'));var h=getComputedStyle(document.querySelector('header'));return a.zIndex==='1'&&h.zIndex==='5';})()`));
  t('V4 · La capa no forma parte del flujo (no ensancha el documento)',
    await evalJs(`(function(){var c=document.getElementById('ppCustomBackground');return c.scrollWidth===document.documentElement.clientWidth&&c.offsetParent===null;})()`));
  t('V5 · Ni opacity ni filter se aplican al contenedor del contenido',
    await evalJs(`(function(){var a=document.getElementById('app');var cs=getComputedStyle(a);return cs.opacity==='1'&&cs.filter==='none'&&cs.mixBlendMode==='normal';})()`));

  console.log('\n== Fondo OSCURO (cover): contenido visible en TODAS las secciones ==');
  {
    let okTodas = true, det = '';
    for (const [gid, tab] of secciones) {
      let s = await escanear(gid, tab);
      if (gid === 'cuerpo' && tab === '💪 Ejercicio') s = await escanear(gid, tab);
      if (!(s && s.len >= 1000 && s.visibles >= 2 && s.conSuperficie >= 1)) { okTodas = false; det += gid + '=' + JSON.stringify(s) + ' '; }
    }
    t('V6 · Fondo oscuro: las 8 secciones muestran tarjetas reales', okTodas, det || undefined);
  }
  await escanear('inicio', '🏠 Inicio');
  await capturar('v3-inicio-oscuro');
  await escanear('comer', '🍱 Contador');
  await capturar('v3-comer-oscuro');
  await escanear('cuerpo', '💪 Ejercicio');
  await capturar('v3-fitness-oscuro');

  console.log('\n== Superficies ORIGINALES conservadas (tarjetas blancas, texto oscuro) ==');
  t('V7 · Tarjeta con su superficie original opaca (no transparente)',
    await evalJs(`(function(){var el=document.querySelector('.tab.active .card, .tab.active details');if(!el)return false;var bg=getComputedStyle(el).backgroundColor;return bg==='rgb(255, 255, 255)'||!/(rgba\([^)]*,\s*0\)|transparent)/.test(bg);})()`));
  t('V8 · Texto de tarjeta con contraste AA sobre su superficie',
    await evalJs(`(function(){var el=document.querySelector('.tab.active .card, .tab.active details');if(!el)return false;var cs=getComputedStyle(el);var l=function(h){var m=/rgba?\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)/.exec(h||'');if(!m)return 0.5;var f=function(c){c=+c/255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4)};return 0.2126*f(m[1])+0.7152*f(m[2])+0.0722*f(m[3])};var l1=l(cs.backgroundColor),l2=l(cs.color);return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05)>=4.5;})()`));

  console.log('\n== Cubrir ↔ Contener estándar + fondo claro ==');
  await evalJs(`state.fondoCfg.ajuste='cover';f3FondoAplicarVisual(window._fondoObjectURL)`);
  await wait(300);
  t('V9 · Cubrir: background-size "cover" en la capa fija',
    await evalJs(`document.getElementById('ppCustomBackground').style.backgroundSize==='cover'`));
  await evalJs(`state.fondoCfg.ajuste='contain';f3FondoAplicarVisual(window._fondoObjectURL)`);
  await wait(300);
  t('V10 · Contener: background-size "contain" en la capa fija (sin elemento con tamaño de imagen)',
    await evalJs(`(function(){var c=document.getElementById('ppCustomBackground');return c.style.backgroundSize==='contain'&&c.scrollWidth===document.documentElement.clientWidth;})()`));
  await aplicarFondo(IMG_CLARO, 'cover');
  {
    const s = await escanear('inicio', '🏠 Inicio');
    t('V11 · Fondo claro: Inicio con tarjetas reales', s && s.len >= 200 && s.visibles >= 3 && s.conSuperficie >= 1, JSON.stringify(s));
  }
  await aplicarFondo(IMG_ROJO, 'cover');
  {
    const s = await escanear('cuerpo', '💪 Ejercicio');
    t('V12 · Fondo rojo: Fitness con tarjetas reales', s && s.len >= 200 && s.visibles >= 3 && s.conSuperficie >= 1, JSON.stringify(s));
  }

  console.log('\n== Recuperación automática ante imagen rota ==');
  // aplicar fondo válido, luego romper la imagen guardada y recargar.
  // Se intercepta toastReg con registro en sessionStorage (sobrevive la recarga).
  await aplicarFondo(IMG_OSCURO, 'cover');
  await evalJs(`(function(){var orig=toastReg;window.toastReg=function(m){try{sessionStorage.setItem('__ultimosToasts',(sessionStorage.getItem('__ultimosToasts')||'')+'|'+m)}catch(e){}return orig(m)};return 1})()`);
  await evalJs(`(function(){return new Promise(function(res){openPersonalDB().then(function(db){var tx=db.transaction('media','readwrite');tx.objectStore('media').delete('fondo_usuario');tx.oncomplete=function(){res(true)}})})})()`, true);
  await ws.sendJson('Page.reload', { ignoreCache: true });
  await wait(1600); // el toast dura 2.2s: se comprueba ANTES de que desaparezca
  await neutralizar();
  await inyectarScanner();
  t('V13 · Al arrancar con la imagen perdida: fondo desactivado y aviso mostrado',
    await evalJs(`(function(){return !document.body.classList.contains('pp-fondo')&&document.body.innerText.indexOf('No se pudo aplicar el fondo. Se restauró la apariencia anterior.')>=0;})()`));
  t('V14 · La configuración de fondo NO se borró (solo se desactiva en la sesión)',
    await evalJs(`!!state.fondoCfg.imgId&&!!window._fondoDesactivadoTemporal`));
  {
    const s = await escanear('inicio', '🏠 Inicio');
    t('V15 · La interfaz completa se recuperó', s && s.len >= 200 && s.visibles >= 3, JSON.stringify(s));
  }
  await evalJs(`(function(){return new Promise(function(res){f3FondoAbrir();setTimeout(res,300)})})()`, true);

  console.log('\n== Móvil 375×667 ==');
  await ws.sendJson('Emulation.setDeviceMetricsOverride', { width: 375, height: 667, deviceScaleFactor: 2, mobile: true });
  await wait(1000);
  await aplicarFondo(IMG_ALOHA, 'contain');
  await wait(1000); // asentarse tras el resize + aplicar
  // La sección Fitness en móvil es larga (Mi semana apilada, layout propio de
  // la app): el usuario hace scroll. Se comprueba con scroll real: arriba hay
  // contenido (hero) y abajo las tarjetas con su superficie.
  await evalJs(`showGroup('cuerpo',false);showTab(tabs.indexOf('💪 Ejercicio'),null);window.scrollTo(0,0)`);
  await wait(700);
  const sinDesborde = await evalJs(`document.documentElement.scrollWidth<=document.documentElement.clientWidth+2`);
  const arribaOk = await evalJs(`(function(){var t=document.getElementById('tab_'+tabs.indexOf('💪 Ejercicio'));return !!t&&t.innerHTML.length>1000&&!!document.elementFromPoint(187,300);})()`);
  await evalJs(`window.scrollTo(0,1400)`);
  await wait(800);
  await capturar('v3-iphone-fitness');
  const ratioMovil = analizarSuperficies(path.join(__dirname, 'pruebas', 'capturas', 'v3-iphone-fitness.png'), 0.15, 0.9);
  t('V16 · Móvil vertical: contenido arriba, tarjetas visibles al hacer scroll (píxeles) y sin desborde',
    sinDesborde && arribaOk && ratioMovil >= 0.08,
    'superficie clara tras scroll: ' + (ratioMovil * 100).toFixed(1) + '%');
  await evalJs(`window.scrollTo(0,0)`);
  await ws.sendJson('Emulation.setDeviceMetricsOverride', { width: 667, height: 375, deviceScaleFactor: 2, mobile: true });
  await wait(600);
  t('V17 · Móvil horizontal: sin desborde y contenido visible',
    await evalJs(`document.documentElement.scrollWidth<=document.documentElement.clientWidth+2`));
  await ws.sendJson('Emulation.clearDeviceMetricsOverride', {});
  await wait(400);

  console.log('\n== Demo final: Aloha Mia (contain) + Inicio y Fitness ==');
  await aplicarFondo(IMG_ALOHA, 'contain');
  await evalJs(`state.fondoCfg.brillo=115;state.fondoCfg.oscurecer=0;save(true);f3FondoAplicarVisual(window._fondoObjectURL)`);
  await wait(400);
  t('V18 · Aloha Mia: contain centrada con respaldo de la imagen y cabecera de la paleta',
    await evalJs(`(function(){var c=document.getElementById('ppCustomBackground');var v=getComputedStyle(document.documentElement).getPropertyValue('--app-primary').trim();return c.style.backgroundSize==='contain'&&c.style.backgroundPosition.indexOf('center')===0&&c.style.backgroundColor.indexOf('rgb(')===0&&v!=='#15704f';})()`));
  {
    const s = await escanear('inicio', '🏠 Inicio');
    t('V19 · Inicio con Aloha Mia: tarjetas completas visibles', s && s.len >= 1000 && s.visibles >= 2 && s.conSuperficie >= 1, JSON.stringify(s));
  }
  await capturar('v3-inicio-aloha');
  {
    const s = await escanear('cuerpo', '💪 Ejercicio');
    t('V20 · Fitness con Aloha Mia: Mi semana y tarjetas visibles', s && s.len >= 200 && s.visibles >= 3 && s.conSuperficie >= 1, JSON.stringify(s));
  }
  await capturar('v3-fitness-aloha');

  console.log('\n==========================================');
  console.log('RESULTADO: ' + pasadas + ' PASS / ' + falladas + ' FAIL');
  console.log('==========================================');
  console.log('Capturas en tools/pruebas/capturas/. Instancia TEMPORAL dejada ABIERTA');
  console.log('con Aloha Mia aplicado mostrando Fitness (Inicio verificado antes).');
  if (falladas) process.exit(1);
  process.exit(0);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
