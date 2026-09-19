// Prueba visual del FONDO PERSONALIZADO vía CDP (Electron).
// Uso: node tools/prueba-visual-fondos.js [puerto]  (default 9333)
// El control real es <label> con <input type="file"> ANIDADO; la prueba
// automatizada usa DOM.setFileInputFiles sobre ESE input (no un clic
// sintético, que no puede abrir el selector nativo sin activación de
// usuario). Al final la instancia queda ABIERTA en el editor para la
// comprobación manual del selector nativo.
// NO toca datos reales: captura el fondo guardado antes de la prueba y
// lo restaura al terminar.
const port = Number(process.argv[2] || 9333);
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const wait = ms => new Promise(r => setTimeout(r, ms));

// ---- PNG de prueba (320x200 degradado), generado sin dependencias ----
const IMG = path.join(__dirname, 'pruebas', 'fondo-prueba.png');
function makePNG(w, h) {
  const rows = [];
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * 3); // filtro 0 + RGB
    for (let x = 0; x < w; x++) {
      row[1 + x * 3] = Math.round(30 + (x / w) * 90);
      row[2 + x * 3] = Math.round(140 + (y / h) * 90);
      row[3 + x * 3] = Math.round(80 + (x / w) * 120);
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
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; // 8-bit, truecolor
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))
  ]);
}
if (!fs.existsSync(IMG)) {
  fs.mkdirSync(path.dirname(IMG), { recursive: true });
  fs.writeFileSync(IMG, makePNG(320, 200));
  console.log('PNG de prueba generado:', IMG);
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
  throw new Error('No se encontró target CDP en el puerto ' + port + ' — lanza: node_modules/.bin/electron . --remote-debugging-port=' + port);
}
function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let id = 0;
    const pend = new Map();
    ws.onopen = () => {
      ws.sendJson = (method, params) => new Promise((res, rej) => {
        const mid = ++id;
        pend.set(mid, { res, rej });
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
  const neutralizarOverlays = () => evalJs(`(function(){
    try{
      window._loginPrompted=true;
      window.confirm=function(){return true;};
      window.alert=function(m){window.__alerts=window.__alerts||[];window.__alerts.push(String(m));};
      state.onboarded=true;
      ['loginScreen','onboardingModal','avisoSinCuentaBox','appTutorial'].forEach(function(id){var el=document.getElementById(id);if(el)el.remove();});
    }catch(e){}
    return 1;
  })()`);

  await ws.sendJson('Runtime.enable', {});
  await ws.sendJson('Page.enable', {});
  await ws.sendJson('DOM.enable', {});
  await ws.sendJson('Page.reload', { ignoreCache: true });
  await wait(3500); // arranque de la app
  await neutralizarOverlays();
  await wait(200);

  const capaConImagen = () => evalJs(`(function(){var c=document.getElementById('ppCustomBackground');return !!(c&&c.style.backgroundImage&&c.style.backgroundImage.indexOf('url(')>=0);})()`);
  const previaConImagen = () => evalJs(`(function(){var p=document.getElementById('fondoPreview');return !!(p&&p.style.backgroundImage&&p.style.backgroundImage.indexOf('url(')>=0);})()`);
  const inputElegirNodeId = async () => {
    const doc = await ws.sendJson('DOM.getDocument', { depth: -1, pierce: true });
    const q = await ws.sendJson('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '#modoSheet label input[type="file"]' });
    return q.nodeId;
  };

  // 0. CAPTURAR el fondo real guardado (para restaurarlo al final)
  const origCfg = await evalJs(`(function(){return state.fondoCfg?JSON.stringify(state.fondoCfg):null;})()`);
  const origImgIdJS = origCfg ? JSON.stringify(JSON.parse(origCfg).imgId || null) : 'null';
  const origBlob = await evalJs(`(function(){
    return new Promise(function(res){
      try{
        openPersonalDB().then(function(db){
          var r=db.transaction('media','readonly').objectStore('media').get('fondo_usuario');
          r.onsuccess=function(){
            try{
              if(r.result instanceof Blob){
                var fr=new FileReader();
                fr.onload=function(){res(fr.result);};
                fr.onerror=function(){res(null);};
                fr.readAsDataURL(r.result);
              }else res(null);
            }catch(e){res(null);}
          };
          r.onerror=function(){res(null);};
        }).catch(function(){res(null);});
      }catch(e){res(null);}
    });
  })()`, true);
  console.log('Fondo previo del perfil:', origCfg, origBlob ? '(imagen capturada para restaurar)' : '(sin imagen)');

  console.log('\n== Editor: label+input reales en el DOM ==');
  await evalJs(`f3FondoAbrir()`);
  await wait(400);
  t('E1 · El editor se abre', await evalJs(`!!document.getElementById('modoSheet')`));
  t('E2 · El input de Elegir imagen está ANIDADO en su label (patrón nativo)',
    await evalJs(`(function(){var l=[].slice.call(document.querySelectorAll('#modoSheet label')).find(function(x){return /Elegir imagen/.test(x.textContent)});return !!(l&&l.querySelector('input[type="file"]'));})()`));
  t('E3 · NO existe ningún button "Elegir imagen"',
    await evalJs(`(function(){return ![].slice.call(document.querySelectorAll('#modoSheet button')).some(function(b){return /Elegir imagen/.test(b.textContent)});})()`));
  t('E4 · El input está conectado al DOM (modoSheet lo contiene)',
    await evalJs(`(function(){var i=document.querySelector('#modoSheet label input[type="file"]');return !!(i&&document.getElementById('modoSheet').contains(i));})()`));

  console.log('\n== setInputFiles sobre el input REAL: previa inmediata ==');
  {
    const nodeId = await inputElegirNodeId();
    t('E5 · Localizado el nodo real del input (CDP DOM)', !!nodeId);
    await ws.sendJson('DOM.setFileInputFiles', { nodeId, files: [IMG] });
    await wait(900); // decode asíncrono (createImageBitmap + canvas)
    t('E6 · La imagen elegida aparece en la vista previa AL MOMENTO', await previaConImagen());
    t('E7 · El borrador tiene la imagen pendiente (imgId fondo_usuario)',
      await evalJs(`(function(){return !!(window._fondoBorrador&&window._fondoBorrador.imgId==='fondo_usuario');})()`));
    t('E8 · Elegir imagen NO guarda nada todavía (el estado sigue igual que antes)',
      await evalJs(`(function(){return state.fondoCfg&&state.fondoCfg.imgId===${origImgIdJS};})()`));
  }

  console.log('\n== Aplicar cambia el fondo ==');
  await evalJs(`f3FondoAplicar()`);
  await wait(900);
  t('E9 · La capa #ppCustomBackground quedó con la imagen', await capaConImagen());
  t('E10 · El editor se cerró', await evalJs(`!document.getElementById('modoSheet')`));
  t('E11 · El estado guardó la configuración (una sola fuente)', await evalJs(`(function(){return state.fondoCfg&&state.fondoCfg.imgId==='fondo_usuario'&&state.fondoCfg.nombreArchivo==='fondo-prueba.png';})()`));

  console.log('\n== Cerrar y reabrir el editor conserva la miniatura ==');
  await evalJs(`f3FondoAbrir()`);
  await wait(500);
  t('E12 · Al reabrir, la miniatura sigue en la vista previa', await previaConImagen());
  await evalJs(`f3FondoCancelar()`);
  await wait(400);
  t('E13 · Cancelar cierra el editor y deja el fondo aplicado intacto',
    await evalJs(`!document.getElementById('modoSheet')`) && await capaConImagen());

  console.log('\n== Recargar: el fondo persiste desde IndexedDB ==');
  await ws.sendJson('Page.reload', { ignoreCache: true });
  await wait(3500);
  await neutralizarOverlays();
  await wait(300);
  t('E14 · Tras recargar, la capa vuelve con la imagen (persistencia)', await capaConImagen());
  await evalJs(`f3FondoAbrir()`);
  await wait(500);
  t('E15 · Tras recargar, el editor muestra la miniatura', await previaConImagen());

  console.log('\n== Quitar fondo ==');
  await evalJs(`f3FondoQuitar()`); // limpia el BORRADOR (confirm stubbed a true)
  await wait(300);
  await evalJs(`f3FondoAplicar()`); // aplicar borrador sin imagen = quitar
  await wait(700);
  t('E16 · Quitar fondo deja la capa sin imagen', await evalJs(`(function(){var c=document.getElementById('ppCustomBackground');return !!(c&&!c.style.backgroundImage);})()`));
  t('E17 · El estado queda sin imagen personalizada', await evalJs(`(function(){return !(state.fondoCfg&&state.fondoCfg.imgId);})()`));

  console.log('\n== Sin texto de prueba en la interfaz ==');
  t('E18 · "FONDO DE PRUEBA" no aparece en ninguna parte de la UI',
    await evalJs(`(function(){return document.body.innerText.indexOf('FONDO DE PRUEBA')<0;})()`));

  console.log('\n== Restaurar el fondo original del perfil (no tocar datos reales) ==');
  if (origCfg) {
    const cfg = JSON.parse(origCfg);
    if (cfg.imgId && origBlob) {
      const restaurado = await evalJs(`(function(){
        return new Promise(function(res){
          try{
            var cfg=${origCfg};
            var bytes=atob('${origBlob.split(',')[1]}');
            var arr=new Uint8Array(bytes.length);
            for(var i=0;i<bytes.length;i++)arr[i]=bytes.charCodeAt(i);
            var blob=new Blob([arr],{type:'image/jpeg'});
            openPersonalDB().then(function(db){
              var tx=db.transaction('media','readwrite');
              tx.objectStore('media').put(blob,'fondo_usuario');
              tx.oncomplete=function(){
                try{
                  state.fondoCfg=cfg;
                  save(true);
                  window._fondoObjectURL=null;
                  if(typeof f3FondoCargarVisual==='function')f3FondoCargarVisual();
                  res(true);
                }catch(e){res(false);}
              };
              tx.onerror=function(){res(false);};
            }).catch(function(){res(false);});
          }catch(e){res(false);}
        });
      })()`, true);
      t('E19 · Fondo original del perfil restaurado (blob + configuración)', restaurado === true);
    } else if (cfg.imgId && !origBlob) {
      console.log('AVISO: había fondo guardado pero no se pudo capturar la imagen; NO se restauró.');
    }
  } else {
    await evalJs(`(function(){state.fondoCfg={imgId:null,alcance:'app',modoId:null,ajuste:'cover',posicion:'centro',brillo:100,oscurecer:20,desenfoque:0,transparencia:100,nombreArchivo:null,actualizado:null};save(true);if(typeof f3FondoCargarVisual==='function')f3FondoCargarVisual();return 1;})()`);
    console.log('Sin fondo previo: perfil dejado en fondo predeterminado.');
  }

  // Dejar el editor abierto con la imagen de prueba en el BORRADOR para que
  // se compruebe el selector nativo a mano (Elegir imagen → selector del SO).
  await evalJs(`f3FondoAbrir()`);
  await wait(300);
  {
    const nodeId = await inputElegirNodeId();
    if (nodeId) await ws.sendJson('DOM.setFileInputFiles', { nodeId, files: [IMG] });
    await wait(900);
  }
  console.log('\n==========================================');
  console.log('RESULTADO: ' + pasadas + ' PASS / ' + falladas + ' FAIL');
  console.log('==========================================');
  console.log('La instancia queda ABIERTA en el editor con la imagen de prueba en');
  console.log('el borrador. Comprueba a mano: clic en "Elegir imagen" → se abre el');
  console.log('selector del sistema → elegir un archivo → aparece al momento en la');
  console.log('vista previa. Después pulsa Cancelar para no guardar nada.');
  if (falladas) process.exit(1);
  process.exit(0);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
