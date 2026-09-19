// ============================================================
// PRUEBAS — Fondo de pantalla personalizado (una sola fuente)
// Uso: node tests/fondos.test.js
// Cubre: el editor usa <label> con <input type="file"> ANIDADO
// (nunca un button ni un input suelto fuera del DOM), la vista
// previa muestra la imagen elegida inmediatamente, Aplicar guarda
// en IndexedDB y aplica el visual verificado, Cancelar descarta
// el borrador y restaura lo guardado, Quitar limpia el borrador,
// Quitar fondo guardado restaura el predeterminado, y reabrir el
// editor conserva la miniatura.
// ============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extractFunc(name) {
  const src = HTML;
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('No se encontró function ' + name);
  let depth = 0, j = i, q = null, bodyStart = -1;
  for (; j < src.length; j++) {
    const c = src[j];
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '(') depth++;
    else if (c === ')') { depth--; if (depth === 0) { bodyStart = j + 1; break; } }
  }
  depth = 0; q = null; j = bodyStart;
  for (; j < src.length; j++) {
    const c = src[j];
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return src.slice(i, j + 1); }
  }
  throw new Error('incompleta: ' + name);
}

let passed = 0, failed = 0;
const failures = [];
function t(name, cond, extra) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; failures.push(name + (extra ? ' → ' + extra : '')); console.log('  ✗ ' + name + (extra ? ' → ' + extra : '')); }
}
const wait = ms => new Promise(r => setTimeout(r, ms));

// ============================================================
// Sandbox: mini-DOM con registro de elementos por id
// ============================================================
function buildSandbox() {
  const sb = {
    console,
    _elements: [],
    _sheetHTML: '',
    _saveCalls: 0,
    _cargarVisualCalls: 0,
    _estadoRenderCalls: 0,
    _idbMedia: {},
    _urlN: 0,
    _toasts: [],
    state: {
      misModos: { activo: 'completo', modos: { completo: { id: 'completo', nombre: 'Modo completo' } } },
      profile: {}
    }
  };
  sb._mkEl = function (tag) {
    // style fiel a CSS: asignar el shorthand 'background' limpia backgroundImage
    const style = new Proxy({}, {
      set: function (target, prop, value) {
        target[prop] = value;
        if (prop === 'background') target.backgroundImage = '';
        return true;
      }
    });
    const el = {
      tagName: (tag || 'div').toUpperCase(),
      id: '',
      style,
      textContent: '',
      innerHTML: '',
      value: '',
      files: [],
      appendChild: function () {},
      insertBefore: function () {},
      remove: function () { const i = sb._elements.indexOf(el); if (i >= 0) sb._elements.splice(i, 1); },
      querySelectorAll: function () { return []; },
      classList: { toggle: function () {} },
      onclick: null
    };
    if (el.tagName === 'CANVAS') {
      el.width = 0; el.height = 0;
      el.getContext = function () { return { drawImage: function () {} }; };
      el.toDataURL = function () { return 'data:image/jpeg;base64,QUFBQUFB'; };
    }
    sb._elements.push(el);
    return el;
  };
  sb._byId = function (id) {
    for (let i = sb._elements.length - 1; i >= 0; i--) if (sb._elements[i].id === id) return sb._elements[i];
    return null;
  };
  sb.document = {
    getElementById: function (id) { return sb._byId(id); },
    createElement: function (tag) { return sb._mkEl(tag); },
    body: { insertBefore: function () {}, appendChild: function () {}, firstChild: null, style: {} },
    head: { appendChild: function () {} },
    querySelector: function () { return null; }
  };
  // f3ModoSheetHTML real se sustituye: captura el HTML y monta la hoja.
  // Como aquí no hay parser, se recrean los elementos con id que el HTML
  // trae (fondoPreview, fondoError) igual que haría el innerHTML real.
  sb.f3ModoSheetHTML = function (html) {
    sb._sheetHTML = html;
    let ov = sb._byId('modoSheet');
    if (!ov) { ov = sb._mkEl('div'); ov.id = 'modoSheet'; }
    ov.innerHTML = html;
    ['fondoPreview', 'fondoError'].forEach(function (id) {
      const viejo = sb._byId(id);
      if (viejo) viejo.remove(); // el innerHTML real reemplaza el contenido
      if (html.indexOf('id="' + id + '"') >= 0) { const el = sb._mkEl('div'); el.id = id; }
    });
  };
  sb.f3ModoActivo = function () { return sb.state.misModos.modos.completo; };
  sb.f3FondoCargarVisual = function () { sb._cargarVisualCalls++; };
  sb.f3FondoEstadoRender = function () { sb._estadoRenderCalls++; };
  sb.save = function () { sb._saveCalls++; };
  sb.confirm = function () { return true; };
  sb.toastReg = function (txt) { sb._toasts.push(txt); };
  sb.safeText = function (x) { return String(x == null ? '' : x); };
  sb.URL = {
    createObjectURL: function () { sb._urlN++; return 'blob:fondo-' + sb._urlN; },
    revokeObjectURL: function () {}
  };
  sb.createImageBitmap = function () { return Promise.resolve({ width: 2000, height: 1000 }); };
  sb.Blob = Blob;
  sb.Uint8Array = Uint8Array;
  sb.atob = atob;
  sb.File = function (name) { this.name = name; this.type = 'image/jpeg'; };
  // IndexedDB personal simulada (media/fondo_usuario)
  sb.openPersonalDB = function () {
    return Promise.resolve({
      transaction: function () {
        const tx = {
          oncomplete: null,
          onerror: null,
          objectStore: function () {
            return {
              put: function (v, k) { sb._idbMedia[k] = v; },
              get: function (k) { return { onsuccess: null, onerror: null, result: sb._idbMedia[k] || null }; }
            };
          }
        };
        setTimeout(function () { if (tx.oncomplete) tx.oncomplete(); }, 0);
        return tx;
      }
    });
  };
  sb.window = sb;
  sb.setTimeout = setTimeout;
  sb.clearTimeout = clearTimeout;
  vm.createContext(sb);
  ['f3FondoCfg', 'f3FondoCapa', 'f3FondoAplicaEnModo', 'f3FondoAplicarVisual',
    'f3FondoAbrir', 'f3FondoEditorRender', 'f3FondoBorradorSet', 'f3FondoBorradorAlcance',
    'f3FondoCancelar', 'f3FondoQuitar', 'f3FondoInputChange', 'f3FondoProcesar',
    'f3FondoPreviewUpdate', 'f3FondoAplicar', 'f3FondoQuitarGuardado'
  ].forEach(function (n) { vm.runInContext(extractFunc(n), sb); });
  return sb;
}

(async function () {
  console.log('== Editor: label con input ANIDADO (la acción visual es un label) ==');
  {
    const sb = buildSandbox();
    vm.runInContext('f3FondoAbrir()', sb);
    const html = sb._sheetHTML;
    t('F1 · Elegir imagen es un <label> con <input type="file"> anidado (no un button)',
      /<label[^>]*>[^<]*🖼️ Elegir imagen<input[^>]*type="file"/.test(html) && !/<button[^>]*>[^<]*🖼️ Elegir imagen/.test(html));
    t('F2 · Tomar foto también es label+input (con capture)',
      /<label[^>]*>[^<]*📷 Tomar foto<input[^>]*type="file"[^>]*capture="environment"/.test(html));
    t('F3 · Sin imagen guardada, la vista previa dice "Fondo predeterminado"',
      (sb._byId('fondoPreview') || {}).textContent === 'Fondo predeterminado');
    t('F4 · El borrador arranca como copia de la configuración guardada',
      vm.runInContext('window._fondoBorrador.alcance', sb) === 'app' && vm.runInContext('window._fondoBorrador.imgId', sb) === null);
  }

  console.log('\n== Elegir imagen: vista previa INMEDIATA (sin tocar Aplicar) ==');
  {
    const sb = buildSandbox();
    vm.runInContext('f3FondoAbrir()', sb);
    const inp = { files: [new sb.File('mi-fondo.png')], value: 'archivo' };
    sb._tmpInp = inp;
    vm.runInContext('f3FondoInputChange(_tmpInp)', sb);
    await wait(60); // decode asíncrono (createImageBitmap + canvas)
    const prev = sb._byId('fondoPreview');
    t('F5 · La imagen elegida aparece en la vista previa AL MOMENTO',
      prev && prev.style.backgroundImage && prev.style.backgroundImage.indexOf('url(') >= 0, prev ? prev.style.backgroundImage : 'sin preview');
    t('F6 · El borrador registra la imagen pendiente (imgId fondo_usuario)',
      vm.runInContext('window._fondoBorrador.imgId', sb) === 'fondo_usuario');
    t('F7 · El input se limpia tras leer el archivo (permite elegir la misma otra vez)',
      inp.value === '');
    t('F8 · NADA se guardó todavía (estado y IndexedDB intactos)',
      vm.runInContext('state.fondoCfg.imgId', sb) === null && Object.keys(sb._idbMedia).length === 0);
  }

  console.log('\n== Aplicar: guarda en IndexedDB y aplica el visual verificado ==');
  {
    const sb = buildSandbox();
    vm.runInContext('f3FondoAbrir()', sb);
    sb._tmpInp = { files: [new sb.File('mi-fondo.png')], value: 'a' };
    vm.runInContext('f3FondoInputChange(_tmpInp)', sb);
    await wait(60);
    vm.runInContext('f3FondoAplicar()', sb);
    await wait(60);
    t('F9 · Aplicar guarda el blob en IndexedDB (media/fondo_usuario)',
      !!sb._idbMedia['fondo_usuario'] && sb._idbMedia['fondo_usuario'] instanceof Blob);
    t('F10 · El estado guarda solo id+configuración (una sola fuente)',
      vm.runInContext('state.fondoCfg.imgId', sb) === 'fondo_usuario' && vm.runInContext('state.fondoCfg.nombreArchivo', sb) === 'mi-fondo.png');
    t('F11 · save(true) persistió el cambio', sb._saveCalls >= 1);
    const capa = sb._byId('ppCustomBackground');
    t('F12 · La capa #ppCustomBackground quedó con la imagen aplicada',
      capa && capa.style.backgroundImage && capa.style.backgroundImage.indexOf('url(') >= 0);
    t('F13 · La hoja del editor se cerró al aplicar', sb._byId('modoSheet') === null);
    t('F14 · El visual verificado avisa con el toast correcto',
      sb._toasts.some(x => /Fondo aplicado/.test(x)) && !sb._toasts.some(x => /no se pudo aplicar/.test(x)));
  }

  console.log('\n== Cerrar y reabrir el editor conserva la miniatura ==');
  {
    const sb = buildSandbox();
    vm.runInContext('f3FondoAbrir()', sb);
    sb._tmpInp = { files: [new sb.File('mi-fondo.png')], value: 'a' };
    vm.runInContext('f3FondoInputChange(_tmpInp)', sb);
    await wait(60);
    vm.runInContext('f3FondoAplicar()', sb);
    await wait(60);
    vm.runInContext('f3FondoAbrir()', sb); // reabrir con fondo ya guardado
    const prev = sb._byId('fondoPreview');
    t('F15 · Al reabrir el editor la miniatura sigue ahí (objectURL existente)',
      prev && prev.style.backgroundImage && prev.style.backgroundImage.indexOf('url(') >= 0);
    t('F16 · Reabrir NO duplica blobs ni sobrescribe el estado',
      vm.runInContext('state.fondoCfg.imgId', sb) === 'fondo_usuario' && vm.runInContext('state.fondoCfg.nombreArchivo', sb) === 'mi-fondo.png');
  }

  console.log('\n== Cancelar descarta el borrador y restaura lo guardado ==');
  {
    const sb = buildSandbox();
    vm.runInContext('f3FondoAbrir()', sb);
    sb._tmpInp = { files: [new sb.File('no-me-guardo.png')], value: 'a' };
    vm.runInContext('f3FondoInputChange(_tmpInp)', sb);
    await wait(60);
    vm.runInContext('f3FondoCancelar()', sb);
    t('F17 · Cancelar limpia borrador, URL pendiente y dataURL pendiente',
      vm.runInContext('window._fondoBorrador', sb) === null && vm.runInContext('window._fondoPendienteURL', sb) === null && vm.runInContext('window._fondoPendienteDataURL', sb) === null);
    t('F18 · Cancelar cierra la hoja y recarga el visual guardado',
      sb._byId('modoSheet') === null && sb._cargarVisualCalls >= 1);
    t('F19 · Cancelar NO guarda nada', sb._saveCalls === 0 && Object.keys(sb._idbMedia).length === 0);
  }

  console.log('\n== Quitar fondo (borrador y guardado) ==');
  {
    const sb = buildSandbox();
    vm.runInContext('f3FondoAbrir()', sb);
    sb._tmpInp = { files: [new sb.File('mi-fondo.png')], value: 'a' };
    vm.runInContext('f3FondoInputChange(_tmpInp)', sb);
    await wait(60);
    vm.runInContext('f3FondoQuitar()', sb); // quita la imagen del BORRADOR
    t('F20 · Quitar limpia el borrador (imgId y nombre)',
      vm.runInContext('window._fondoBorrador.imgId', sb) === null && vm.runInContext('window._fondoBorrador.nombreArchivo', sb) === null);
    const prev = sb._byId('fondoPreview');
    t('F21 · La vista previa vuelve a "Fondo predeterminado"',
      !!prev && prev.textContent === 'Fondo predeterminado' && !prev.style.backgroundImage);
  }
  {
    const sb = buildSandbox();
    vm.runInContext('f3FondoAbrir()', sb);
    sb._tmpInp = { files: [new sb.File('mi-fondo.png')], value: 'a' };
    vm.runInContext('f3FondoInputChange(_tmpInp)', sb);
    await wait(60);
    vm.runInContext('f3FondoAplicar()', sb);
    await wait(60);
    vm.runInContext('f3FondoQuitarGuardado()', sb);
    t('F22 · Quitar fondo guardado limpia el estado y revoca la objectURL',
      vm.runInContext('state.fondoCfg.imgId', sb) === null && vm.runInContext('window._fondoObjectURL', sb) === null);
    const capa = sb._byId('ppCustomBackground');
    t('F23 · La capa queda sin imagen (fondo predeterminado restaurado)',
      !!capa && !capa.style.backgroundImage);
    t('F24 · Quitar fondo guardado persiste (save) y avisa', sb._saveCalls >= 1 && sb._toasts.some(x => /restaurado/.test(x)));
  }

  console.log('\n== Quitar + Aplicar persiste la eliminación (no solo el visual) ==');
  {
    const sb = buildSandbox();
    vm.runInContext('f3FondoAbrir()', sb);
    sb._tmpInp = { files: [new sb.File('mi-fondo.png')], value: 'a' };
    vm.runInContext('f3FondoInputChange(_tmpInp)', sb);
    await wait(60);
    vm.runInContext('f3FondoAplicar()', sb);
    await wait(60);
    vm.runInContext('f3FondoAbrir()', sb);
    vm.runInContext('f3FondoQuitar()', sb);   // borrador sin imagen
    vm.runInContext('f3FondoAplicar()', sb);  // aplicar la eliminación
    await wait(60);
    t('F27 · Quitar + Aplicar deja el estado persistido SIN imagen (no reaparece al recargar)',
      vm.runInContext('state.fondoCfg.imgId', sb) === null && vm.runInContext('state.fondoCfg.nombreArchivo', sb) === null);
    t('F28 · La eliminación llama a save(true) y revoca la objectURL',
      sb._saveCalls >= 2 && vm.runInContext('window._fondoObjectURL', sb) === null);
    t('F29 · La hoja se cierra y avisa con el toast de restaurado',
      sb._byId('modoSheet') === null && sb._toasts.some(x => /restaurado/.test(x)));
  }

  console.log('\n== AplicarVisual verifica de verdad ==');
  {
    const sb = buildSandbox();
    vm.runInContext('f3FondoAbrir()', sb);
    const conUrl = vm.runInContext('f3FondoAplicarVisual("blob:fondo-9")', sb);
    t('F25 · Con imagen y alcance app devuelve true y la capa tiene la imagen',
      conUrl === true && sb._byId('ppCustomBackground').style.backgroundImage.indexOf('url(') >= 0);
    const sinUrl = vm.runInContext('f3FondoAplicarVisual(null)', sb);
    t('F26 · Sin imagen devuelve false y limpia la capa',
      sinUrl === false && !sb._byId('ppCustomBackground').style.backgroundImage);
  }

  console.log('\n===== RESULTADO: ' + passed + ' PASS / ' + failed + ' FAIL =====');
  if (failed) { console.log('Fallos:\n' + failures.map(f => '  ✗ ' + f).join('\n')); process.exit(1); }
  process.exit(0);
})();
