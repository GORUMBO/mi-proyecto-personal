// ============================================================
// PRUEBAS — Apariencia/Identidad personalizable (v sin publicar)
// Uso: node tests/apariencia.test.js
// Cubre: nombre sin "Maui" (mayúsculas/acentos/espacios), logo
// emoji/iniciales/imagen/nada, colores efectivos (preset + ajuste +
// paleta + modo claro/oscuro), contraste, paleta adaptativa al fondo
// (rojo/negro/azul), navegación configurable con salvavidas de acceso,
// vista previa con indicadores del botón seleccionado, manifest y
// restaurar apariencia sin tocar datos personales.
// ============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extractFunc(name) {
  const src = HTML;
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('No se encontró function ' + name);
  let parens = 0, j = i, q = null, lc = false, bc = false, bodyStart = -1;
  for (; j < src.length; j++) {
    const c = src[j], n = src[j + 1];
    if (lc) { if (c === '\n') lc = false; continue; }
    if (bc) { if (c === '*' && n === '/') { bc = false; j++; } continue; }
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '/' && n === '/') { lc = true; j++; continue; }
    if (c === '/' && n === '*') { bc = true; j++; continue; }
    if (c === '(') parens++;
    else if (c === ')') { parens--; if (parens === 0) { bodyStart = j + 1; break; } }
  }
  if (bodyStart < 0) throw new Error('params de ' + name);
  let depth = 0; q = null; lc = false; bc = false; j = bodyStart;
  for (; j < src.length; j++) {
    const c = src[j], n = src[j + 1];
    if (lc) { if (c === '\n') lc = false; continue; }
    if (bc) { if (c === '*' && n === '/') { bc = false; j++; } continue; }
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '/' && n === '/') { lc = true; j++; continue; }
    if (c === '/' && n === '*') { bc = true; j++; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return src.slice(i, j + 1); }
  }
  throw new Error('incompleta: ' + name);
}
// ppBootColor + helpers viven en el IIFE del head. El script de boot
// termina justo antes de </script>: se corta desde el marcador hasta el
// último '})();' de ese bloque (sin escanear braces ni regex).
function extractPpBootColor() {
  const src = HTML;
  const marca = src.indexOf('BOOT DE APARIENCIA');
  const fin = src.indexOf('\n</script>', marca);
  if (marca < 0 || fin < 0) throw new Error('No se encontró el bloque de boot');
  const bloque = src.slice(marca, fin);
  const i = bloque.indexOf('(function(){');
  const ultimo = bloque.lastIndexOf('})();');
  if (i < 0 || ultimo < 0) throw new Error('IIFE de boot mal formado');
  return bloque.slice(i, ultimo + 5);
}

let passed = 0, failed = 0;
const failures = [];
function t(name, cond, extra) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; failures.push(name + (extra ? ' → ' + extra : '')); console.log('  ✗ ' + name + (extra ? ' → ' + extra : '')); }
}

const GROUPS_MINI = [
  { id: 'inicio', label: '🏠 Inicio', tabs: ['🏠 Inicio'] },
  { id: 'comer', label: '🍽️ Comer', tabs: ['🍱 Contador'] },
  { id: 'cuerpo', label: '💪 Fitness', tabs: ['💪 Ejercicio', '🚶 Caminata', '⚖️ Peso'] },
  { id: 'dinero', label: '💳 Dinero', tabs: ['💳 Gastos'] },
  { id: 'vida', label: '🌴 Día a día', tabs: ['🧤 Trabajo'] },
  { id: 'ajustes', label: '⚙️ Ajustes', tabs: ['👤 Perfil'] }
];
const TABS_MINI = GROUPS_MINI.reduce(function (acc, g) { return acc.concat(g.tabs); }, []);

function buildSandbox(estadoExtra) {
  const sb = {
    console,
    state: Object.assign({ apariencia: { v: 1 }, uiSettings: { theme: 'maui', hiddenTabs: [] } }, estadoExtra || {}),
    GROUPS: GROUPS_MINI,
    tabs: TABS_MINI,
    _saveCalls: 0,
    _toasts: [],
    _idbMedia: {},
    _elements: []
  };
  sb.save = function () { sb._saveCalls++; };
  sb.confirm = function () { return true; };
  sb.toastReg = function (m) { sb._toasts.push(m); };
  sb.safeText = function (x) { return String(x == null ? '' : x); };
  sb.f3TemaPreset = function () {
    const k = (sb.state.uiSettings && sb.state.uiSettings.theme) || 'maui';
    return sb.window.PP_THEMES_PRESETS[k] || sb.window.PP_THEMES_PRESETS.maui;
  };
  sb.f3FondoCfg = function () { return { imgId: null }; };
  sb.f3AparienciaAplicarColores = function () { sb._coloresAplicados = (sb._coloresAplicados || 0) + 1; };
  sb.f3IdentidadAplicar = function () { sb._identidadAplicada = (sb._identidadAplicada || 0) + 1; };
  sb.f3IdentidadNavApply = function () { sb._navAplicada = (sb._navAplicada || 0) + 1; };
  sb.openPersonalDB = function () {
    return Promise.resolve({
      transaction: function () {
        const tx = { oncomplete: null, objectStore: function () { return { put: function (v, k) { sb._idbMedia[k] = v; }, delete: function (k) { delete sb._idbMedia[k]; } }; } };
        setTimeout(function () { if (tx.oncomplete) tx.oncomplete(); }, 0);
        return tx;
      }
    });
  };
  sb.document = {
    getElementById: function () { return null; },
    createElement: function () { return { style: {}, classList: { toggle: function () {} }, appendChild: function () {}, setAttribute: function () {} }; },
    body: { classList: { toggle: function () {} }, appendChild: function () {} },
    head: { appendChild: function () {} },
    documentElement: { style: { setProperty: function () {} } },
    querySelector: function () { return null; }
  };
  sb.URL = { createObjectURL: function () { return 'blob:x'; }, revokeObjectURL: function () {} };
  sb.Blob = Blob; sb.Uint8Array = Uint8Array; sb.atob = atob;
  sb.window = sb;
  sb.matchMedia = function () { return { matches: false }; };
  sb.PP_THEMES_PRESETS = {
    maui: { primary: '#15704f', secondary: '#1a9660', accent: '#0f8a76', button: '#15704f', buttonSelected: '#0d6043', text: '#17231e', surface: '#ffffff' },
    oceano: { primary: '#12659e', secondary: '#2a8fd4', accent: '#0a4d8c', button: '#12659e', buttonSelected: '#0a4d8c', text: '#17231e', surface: '#ffffff' },
    carbon: { primary: '#2f3a44', secondary: '#4a5b68', accent: '#465563', button: '#2f3a44', buttonSelected: '#465563', text: '#17231e', surface: '#ffffff' }
  };
  vm.createContext(sb);
  vm.runInContext(extractPpBootColor(), sb);
  vm.runInContext(extractVarData('F3_NAV_DEFAULTS'), sb);
  vm.runInContext(extractVarData('F3_TIPO_SLOTS'), sb);
  ['f3Apariencia', 'f3AparienciaCfg', 'f3AparienciaV2', 'f3ColoresV2Default', 'f3TipoDefault',
    'f3HeaderCfgDefault', 'f3LayoutDefault', 'f3SubbotonesDefault',
    'f3AparienciaColores', 'f3InicialesDe', 'f3LogoHTML',
    'f3NavCfg', 'f3NavAccesoSalvavidas', 'f3RgbHsl', 'f3HslHex', 'f3MezclarHex', 'f3Contraste',
    'f3PaletaDesdeImagen', 'f3AparienciaPreviewHTML', 'f3ManifestActualizar', 'f3AparienciaRestaurar',
    'f3AparienciaRespaldar'
  ].forEach(function (n) { vm.runInContext(extractFunc(n), sb); });
  return sb;
}
// Extrae 'var NOMBRE=<valor>;' (arrays/objetos anidados; strings opacas)
function extractVarData(name) {
  const src = HTML;
  const i = src.indexOf('var ' + name + '=');
  if (i < 0) throw new Error('No se encontró var ' + name);
  let j = src.indexOf('=', i) + 1;
  while (j < src.length && /\s/.test(src[j])) j++;
  if (src[j] !== '[' && src[j] !== '{') throw new Error('valor raro de ' + name);
  let depth = 0, q = null;
  for (; j < src.length; j++) {
    const c = src[j];
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') { depth--; if (depth === 0) return src.slice(i, j + 1) + ';'; }
  }
  throw new Error('incompleta: ' + name);
}

console.log('== Identidad: nombre sin Maui, con mayúsculas/acentos/espacios ==');
{
  const sb = buildSandbox();
  const cfg = vm.runInContext('f3AparienciaCfg()', sb);
  t('A1 · El nombre por defecto es "Mi Proyecto Personal" (sin Maui)',
    cfg.nombre === 'Mi Proyecto Personal' && cfg.nombre.indexOf('Maui') < 0);
  vm.runInContext('state.apariencia.nombre="Rubén Fit  Élite"', sb);
  t('A2 · El nombre conserva mayúsculas, acentos y espacios', vm.runInContext('f3AparienciaCfg().nombre', sb) === 'Rubén Fit  Élite');
  t('A3 · El logo por defecto es emoji 🌺 (no fijado en el HTML)',
    vm.runInContext('f3AparienciaCfg().logo.tipo', sb) === 'emoji' && vm.runInContext('f3AparienciaCfg().logo.emoji', sb) === '🌺');
  t('A4 · Subtítulo opcional y oculto por defecto',
    cfg.subtitulo === '' && cfg.mostrarSubtitulo === false);
}

console.log('\n== Logo: emoji / iniciales / imagen / nada ==');
{
  const sb = buildSandbox();
  vm.runInContext('state.apariencia.logo={tipo:"emoji",emoji:"⚡"}', sb);
  t('A5 · Logo emoji', /⚡/.test(vm.runInContext('f3LogoHTML(f3AparienciaCfg())', sb)));
  vm.runInContext('state.apariencia.logo={tipo:"iniciales"}', sb);
  t('A6 · Logo iniciales usa las iniciales del nombre', /appLogoIniciales/.test(vm.runInContext('f3LogoHTML(f3AparienciaCfg())', sb)));
  vm.runInContext('state.apariencia.logo={tipo:"imagen"};window._logoObjectURL="blob:logo1"', sb);
  t('A7 · Logo imagen usa la objectURL de IndexedDB (nunca base64 en localStorage)',
    /blob:logo1/.test(vm.runInContext('f3LogoHTML(f3AparienciaCfg())', sb)));
  vm.runInContext('state.apariencia.logo={tipo:"nada"};window._logoObjectURL=null', sb);
  t('A8 · Sin logo devuelve vacío', vm.runInContext('f3LogoHTML(f3AparienciaCfg())', sb) === '');
  t('A9 · Iniciales de "Rubén Fit" → "RF"', vm.runInContext('f3InicialesDe("Rubén Fit")', sb) === 'RF');
  t('A10 · Iniciales de "Mi Vida" → "MV"', vm.runInContext('f3InicialesDe("Mi Vida")', sb) === 'MV');
}

console.log('\n== Colores efectivos: preset + ajustes + paleta + modo ==');
{
  const sb = buildSandbox();
  const base = vm.runInContext('f3AparienciaColores()', sb);
  t('A11 · Sin configuración usa el preset verde y texto oscuro', base.primary === '#15704f' && base.text === '#17231e');
  vm.runInContext('state.uiSettings.theme="oceano"', sb);
  t('A12 · El preset océano cambia el principal', vm.runInContext('f3AparienciaColores().primary', sb) === '#12659e');
  vm.runInContext('state.apariencia.colores={primary:"#123456",modo:"light"}', sb);
  t('A13 · El color manual gana al preset', vm.runInContext('f3AparienciaColores().primary', sb) === '#123456');
  vm.runInContext('state.apariencia.colores={modo:"light",adaptarFondo:true,paleta:{primary:"#8a2b2b",secondary:"#b56a6a",accent:"#2b8a8a",button:"#8a2b2b",buttonSelected:"#6e2222",text:"#f2f4f6",surface:"#1b2126"}}', sb);
  const adapt = vm.runInContext('f3AparienciaColores()', sb);
  t('A14 · La paleta adaptada manda en cabecera/botones y las superficies del contenido se conservan', adapt.primary === '#8a2b2b' && adapt.surface === '#ffffff' && adapt.text === '#17231e');
  vm.runInContext('state.apariencia.colores={modo:"dark"}', sb);
  const osc = vm.runInContext('f3AparienciaColores()', sb);
  t('A15 · Modo oscuro: superficie y texto oscuros con el acento elegido', osc.surface === '#223029' && osc.text === '#edf5f0');
  vm.runInContext('state.apariencia.colores={modo:"light",surfaceAlpha:50}', sb);
  t('A16 · Transparencia de tarjetas genera surface rgba', /^rgba\(/.test(vm.runInContext('f3AparienciaColores().surfaceCSS', sb)));
}

console.log('\n== Paleta adaptativa al fondo (color dominante + luminosidad) ==');
function imagenCon(color) {
  return function () {
    const sb = this;
    const datos = new Array(36 * 36 * 4).fill(255);
    for (let i = 0; i < datos.length; i += 4) { datos[i] = color[0]; datos[i + 1] = color[1]; datos[i + 2] = color[2]; }
    const img = { width: 36, height: 36 };
    img.src = '';
    setTimeout(function () { if (img.onload) img.onload(); }, 0);
    const canvas = document.createElement('canvas');
    return {
      Image: function () { return img; },
      document: {
        createElement: function (tag) {
          if (tag === 'canvas') return {
            width: 0, height: 0,
            getContext: function () { return { drawImage: function () {}, getImageData: function () { return { data: datos }; } }; }
          };
          return { style: {} };
        }
      }
    };
  };
}
{
  function canvasConDatos(sb) {
    return function (tag) {
      if (tag === 'canvas') return {
        width: 0, height: 0,
        getContext: function () { return { drawImage: function () {}, getImageData: function () { return { data: sb._datos }; } }; }
      };
      return { style: {} };
    };
  }
  function imagenFalsa(sb) {
    sb.Image = function () {
      const img = {};
      Object.defineProperty(img, 'src', { set: function () { setTimeout(function () { if (img.onload) img.onload(); }, 0); }, get: function () { return ''; } });
      return img;
    };
  }
  function datosDe(r, g, b) {
    const datos = new Array(36 * 36 * 4).fill(255);
    for (let i = 0; i < datos.length; i += 4) { datos[i] = r; datos[i + 1] = g; datos[i + 2] = b; }
    return datos;
  }
  // Negro → botones/cabeceras más claros, textos claros
  const sb = buildSandbox();
  imagenFalsa(sb);
  sb._datos = datosDe(20, 20, 22);
  sb.document.createElement = canvasConDatos(sb);
  vm.runInContext('(function(){f3PaletaDesdeImagen("blob:x",function(p){window._paletaNegro=p;});})()', sb);
  setTimeout(function () {
    const p = sb.window._paletaNegro;
    t('A17 · Fondo negro → botones claros y textos claros', !!p && p.fuente.oscuro === true && p.text === '#f2f4f6', JSON.stringify(p && p.fuente));
    t('A18 · Contraste texto/superficie ≥ 4.5', p ? f3ContrasteReal(p.text, p.surface) >= 4.5 : false);

    // Rojo → variantes rojas (tono conservado)
    const sb2 = buildSandbox();
    imagenFalsa(sb2);
    sb2._datos = datosDe(178, 34, 34);
    sb2.document.createElement = canvasConDatos(sb2);
    vm.runInContext('(function(){f3PaletaDesdeImagen("blob:x",function(p){window._paletaRoja=p;});})()', sb2);
    setTimeout(function () {
      const pr = sb2.window._paletaRoja;
      const hsl = pr ? sb2.f3RgbHsl(parseInt(pr.primary.slice(1, 3), 16), parseInt(pr.primary.slice(3, 5), 16), parseInt(pr.primary.slice(5, 7), 16)) : null;
      t('A19 · Fondo rojo → variante roja (tono 0±0.1)', !!pr && !!hsl && (hsl.h < 0.05 || hsl.h > 0.95), pr ? pr.primary : 'sin paleta');

      // Azul → variantes azules
      const sb3 = buildSandbox();
      imagenFalsa(sb3);
      sb3._datos = datosDe(30, 60, 180);
      sb3.document.createElement = canvasConDatos(sb3);
      vm.runInContext('(function(){f3PaletaDesdeImagen("blob:x",function(p){window._paletaAzul=p;});})()', sb3);
      setTimeout(function () {
        const pb = sb3.window._paletaAzul;
        const hslB = pb ? sb3.f3RgbHsl(parseInt(pb.primary.slice(1, 3), 16), parseInt(pb.primary.slice(3, 5), 16), parseInt(pb.primary.slice(5, 7), 16)) : null;
        t('A20 · Fondo azul → variantes azules (tono ~0.6)', !!pb && !!hslB && hslB.h > 0.5 && hslB.h < 0.72, pb ? pb.primary : 'sin paleta');
        terminar();
      }, 30);
    }, 30);
  }, 30);
}
function f3ContrasteReal(a, b) {
  const l = function (h) { const r = parseInt(h.slice(1, 3), 16) / 255, g = parseInt(h.slice(3, 5), 16) / 255, bb = parseInt(h.slice(5, 7), 16) / 255; const f = function (c) { return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(bb); };
  const l1 = l(a), l2 = l(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
let _pendientes = 1;
function terminar() {
  _pendientes--;
  if (_pendientes > 0) return;
  // ---- navegación, vista previa, manifest y restaurar ----
  console.log('\n== Navegación: configuración + salvavidas de acceso ==');
  {
    const sb = buildSandbox();
    const nav = vm.runInContext('f3NavCfg()', sb);
    t('A21 · Órdenes por defecto completos', nav.ordenGrupos.length === 6 && nav.ordenTabs.length === TABS_MINI.length);
    t('A22 · Botón Más por defecto', nav.mas.nombre === 'Más' && nav.mas.emoji === '☰');
    t('A23 · Con todo visible hay acceso', vm.runInContext('f3NavAccesoSalvavidas()', sb) === true);
    vm.runInContext('state.apariencia.nav.grupos.inicio.visible=false;state.apariencia.nav.grupos.ajustes.visible=false;state.apariencia.nav.mas.visible=false', sb);
    t('A24 · Ocultar Inicio+Ajustes+Más bloquea (no hay acceso)', vm.runInContext('f3NavAccesoSalvavidas()', sb) === false);
    vm.runInContext('state.apariencia.nav.grupos.ajustes.visible=true', sb);
    t('A25 · Volver a mostrar Ajustes restaura el acceso', vm.runInContext('f3NavAccesoSalvavidas()', sb) === true);
  }

  console.log('\n== Vista previa: indicadores del botón seleccionado ==');
  {
    const sb = buildSandbox();
    vm.runInContext('state.apariencia.nombre="Rubén Fit";state.apariencia.logo={tipo:"emoji",emoji:"⚡"};state.apariencia.colores={modo:"light",primary:"#c2562b",secondary:"#e07b3f",accent:"#a8431f",button:"#c2562b",buttonSelected:"#a8431f"}', sb);
    const prev = vm.runInContext('f3AparienciaPreviewHTML(f3AparienciaCfg())', sb);
    t('A26 · La vista previa muestra nombre y logo elegidos', prev.indexOf('Rubén Fit') >= 0 && prev.indexOf('⚡') >= 0);
    t('A27 · El botón seleccionado usa aria-current + borde único con elevación (no doble anillo)', /apPrevBtnSel/.test(prev) && /aria-current="page"/.test(prev) && /border:1.5px solid/.test(prev));
    t('A28 · La vista previa incluye tarjeta y aviso de actualización', /Tarjeta de ejemplo/.test(prev) && /Nueva versión disponible/.test(prev) && /Actualizar ahora/.test(prev));
  }

  console.log('\n== Modos de color: fondo / claro / oscuro / personalizado ==');
  {
    const sb = buildSandbox();
    // Automático según el fondo: la paleta manda SOLO en cabecera/botones/acento
    vm.runInContext('state.apariencia.colores={modo:"fondo",paleta:{primary:"#6b1e1e",secondary:"#a05555",accent:"#d9822b",button:"#6b1e1e",buttonSelected:"#541616",text:"#f2f4f6",surface:"#1b2126"}}', sb);
    const cFondo = vm.runInContext('f3AparienciaColores()', sb);
    t('A36 · Modo "Automático según el fondo": cabecera/botones siguen a la imagen y las superficies del contenido se conservan',
      cFondo.primary === '#6b1e1e' && cFondo.text === '#17231e' && cFondo.surface === '#ffffff');
    // Claro: superficies y textos claros forzados (aunque el sistema sea oscuro)
    vm.runInContext('state.apariencia.colores={modo:"claro"}', sb);
    const cClaro = vm.runInContext('f3AparienciaColores()', sb);
    t('A37 · Modo Claro: texto oscuro y superficie clara forzados', cClaro.text === '#17231e' && cClaro.surface === '#ffffff');
    // Personalizado: solo los campos manuales
    vm.runInContext('state.apariencia.colores={modo:"personalizado",primary:"#123456"}', sb);
    const cPers = vm.runInContext('f3AparienciaColores()', sb);
    t('A38 · Modo Personalizado: usa el color manual y superficies neutrales', cPers.primary === '#123456' && cPers.text === '#17231e');
    // Tarjetas 92-96% de opacidad por defecto
    vm.runInContext('state.apariencia.colores={modo:"claro",surfaceAlpha:100}', sb);
    const cCard = vm.runInContext('f3AparienciaColores()', sb);
    t('A39 · Las tarjetas principales usan 94% de opacidad (superficie legible)',
      cCard.cardCSS === 'rgba(255,255,255,0.94)');
  }

  console.log('\n== Emojis: recientes con dedup y límite ==');
  {
    const sb = buildSandbox();
    vm.runInContext(extractVarData('F3_EMOJIS_CATS'), sb);
    ['f3EmojiRecientes', 'f3EmojiRecienteAdd'].forEach(function (n) { vm.runInContext(extractFunc(n), sb); });
    t('A33 · La categoría de respaldo (Caras) tiene emojis para cuando no hay recientes',
      vm.runInContext('F3_EMOJIS_CATS[1].list.length', sb) > 10);
    vm.runInContext('f3EmojiRecienteAdd("⚡");f3EmojiRecienteAdd("💪");f3EmojiRecienteAdd("⚡")', sb);
    t('A34 · Los recientes no duplican y el último va primero',
      vm.runInContext('f3EmojiRecientes().join(",")', sb) === '⚡,💪');
    const muchos = Array.from({ length: 30 }, function (_, i) { return 'e' + i; });
    vm.runInContext('state.apariencia.emojisRecientes=' + JSON.stringify(muchos), sb);
    vm.runInContext('f3EmojiRecienteAdd("⚡")', sb);
    t('A35 · Los recientes se limitan a 20', vm.runInContext('f3EmojiRecientes().length', sb) === 20);
  }

  console.log('\n== Manifest y restaurar apariencia ==');
  {
    const sb = buildSandbox();
    const man = { getAttribute: function () { return 'data:application/manifest+json;charset=utf-8,{}'; }, setAttribute: function (k, v) { this.href = v; } };
    sb.document.querySelector = function (sel) { return sel.indexOf('manifest') >= 0 ? man : null; };
    vm.runInContext('state.apariencia.nombre="Ruben Fit"', sb);
    vm.runInContext('f3ManifestActualizar()', sb);
    t('A29 · El manifest se regenera con el nombre elegido', man.href.indexOf('Ruben%20Fit') >= 0 && man.href.indexOf('Maui') < 0);
    // restaurar: solo apariencia
    vm.runInContext('state.workoutLog=[{id:"w1",exercise:"Press"}];state.meals=[{id:"m1"}]', sb);
    vm.runInContext('f3AparienciaRestaurar()', sb);
    t('A30 · Restaurar apariencia deja nombre y logo por defecto', vm.runInContext('state.apariencia.nombre', sb) === 'Mi Proyecto Personal' && vm.runInContext('state.apariencia.logo.tipo', sb) === 'emoji');
    t('A31 · Restaurar apariencia NO toca workoutLog ni comidas',
      vm.runInContext('state.workoutLog.length', sb) === 1 && vm.runInContext('state.meals.length', sb) === 1);
    t('A32 · Restaurar guarda y reaplica identidad, colores y navegación', sb._saveCalls >= 1 && sb._coloresAplicados >= 1 && sb._identidadAplicada >= 1 && sb._navAplicada >= 1);
  }

  console.log('\n===== RESULTADO: ' + passed + ' PASS / ' + failed + ' FAIL =====');
  if (failed) { console.log('Fallos:\n' + failures.map(f => '  ✗ ' + f).join('\n')); process.exit(1); }
  process.exit(0);
}
