// ============================================================
// PRUEBAS de UX del SELECTOR de alimentos (carrito de Comer).
// Uso: node tests/carrito-ux.test.js
// Cubre: check visible (círculo vacío → ✓ verde relleno, no solo
// color), fila seleccionada (fondo + anillo 2px), seleccionar/
// deseleccionar, cantidad ✓N, resumen en vivo ("N alimentos
// seleccionados · kcal · g P · g C · g G"), CTA con cantidad y
// momento, 0 → desactivado, sin perder lógica de guardado.
// ============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extractFunc(name) {
  const i = HTML.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('No se encontró function ' + name);
  let depth = 0, j = i, q = null;
  for (; j < HTML.length; j++) {
    const c = HTML[j];
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === '/' && (HTML[j + 1] === "'" || HTML[j + 1] === '"' || HTML[j + 1] === '\\') && /[\(,=:\[!&|?;{+\-*%~^<>]\s*$/.test(HTML.slice(Math.max(0, j - 4), j))) {
      j++; while (j < HTML.length && !(HTML[j] === '/' && HTML[j - 1] !== '\\')) j++; continue;
    }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return HTML.slice(i, j + 1); }
  }
  throw new Error('incompleta ' + name);
}

let pasadas = 0, falladas = 0;
function t(label, ok, extra) {
  if (ok) { pasadas++; console.log('✓ ' + label + (extra ? ' · ' + extra : '')); }
  else { falladas++; console.log('✗ FALLA ' + label + (extra ? ' · ' + extra : '')); }
}

function makeSandbox() {
  const win = { _carrito: [] };
  const spans = {};
  const el = () => ({ style: {}, textContent: '', innerHTML: '', disabled: false, querySelector: null, getAttribute: null, setAttribute: null, onclick: null });
  const sb = {
    window: win, safeText: x => String(x == null ? '' : x),
    _currentMealKey: 'breakfast',
    document: {
      getElementById(id) { if (spans[id]) return spans[id]; spans[id] = el(); return spans[id]; },
      querySelectorAll() { return []; }
    }
  };
  ['enCarrito', 'enCarritoId', 'carritoCheckHTML', 'carritoFilaStyle', 'totalCarrito',
    'updateCartTotals', 'updateCartCTA', 'updateFoodRow', 'toggleCarrito',
    'mealKeyLabel', 'renderCarrito'].forEach(n => { sb[n] = vm.runInNewContext('(' + extractFunc(n) + ')', sb); });
  sb.renderCarrito = function () {}; // toggleCarrito solo debe alternar la selección
  return sb;
}

console.log('== 1 · Check visible: círculo vacío → ✓ verde relleno (no solo color) ==');
(function () {
  const sb = makeSandbox();
  const vacio = sb.carritoCheckHTML(false, 1);
  const sel1 = sb.carritoCheckHTML(true, 1);
  const sel2 = sb.carritoCheckHTML(true, 2);
  t('sin seleccionar: círculo de borde, sin relleno', /border:2px solid #b9ccc1/.test(vacio) && !/background:#15704f/.test(vacio), vacio.slice(0, 160));
  t('seleccionado: ✓ con círculo verde relleno y texto blanco', /background:#15704f;color:#fff/.test(sel1) && sel1.indexOf('✓') >= 0);
  t('cantidad >1: "✓2" sigue siendo evidente', sel2.indexOf('✓2') >= 0);
  const estilo = sb.carritoFilaStyle(true);
  t('fila seleccionada: fondo + anillo verde 2px', /#e8f8ee/.test(estilo) && /inset 0 0 0 2px #15704f/.test(estilo));
  t('fila sin seleccionar: sin estilo extra', sb.carritoFilaStyle(false) === '');
})();

console.log('== 2 · Seleccionar / deseleccionar (toggle) ==');
(function () {
  const sb = makeSandbox();
  const fid = encodeURIComponent('Huevo@72');
  sb.toggleCarrito(encodeURIComponent('Huevo'), 72, 6, 5, 0, encodeURIComponent('1 pieza'), fid);
  t('tocar → selecciona (1 item)', sb.window._carrito.length === 1 && sb.window._carrito[0].name === 'Huevo');
  sb.toggleCarrito(encodeURIComponent('Huevo'), 72, 6, 5, 0, encodeURIComponent('1 pieza'), fid);
  t('tocar otra vez → deselecciona (0 items)', sb.window._carrito.length === 0);
  sb.toggleCarrito(encodeURIComponent('Huevo'), 72, 6, 5, 0, encodeURIComponent('1 pieza'), fid);
  sb.toggleCarrito(encodeURIComponent('Arroz cocido 1 taza'), 205, 4, 0, 45, encodeURIComponent('1 taza'), encodeURIComponent('Arroz cocido 1 taza@205'));
  t('seleccionar varios (2 items distintos)', sb.window._carrito.length === 2);
})();

console.log('== 3 · Resumen en vivo: "N alimentos seleccionados · kcal · g P · g C · g G" ==');
(function () {
  const sb = makeSandbox();
  const spans = {};
  sb.document.getElementById = function (id) {
    if (id !== 'carritoResumen') return null;
    return { querySelector: sel => { if (!spans[sel]) spans[sel] = { textContent: '' }; return spans[sel]; } };
  };
  sb.window._carrito = [
    { id: 'p', name: 'Pollo 100g', kcal: 165, prot: 31, carb: 0, fat: 4, cant: 1 },
    { id: 'h', name: 'Huevo', kcal: 72, prot: 6, carb: 0, fat: 5, cant: 2 },
    { id: 'a', name: 'Arroz cocido 1 taza', kcal: 205, prot: 4, carb: 45, fat: 0, cant: 1 }
  ];
  sb.updateCartTotals();
  t('3 alimentos: "3 alimentos seleccionados"', spans['[data-r-n]'].textContent === '3 alimentos seleccionados', spans['[data-r-n]'].textContent);
  t('totales reales: 514 kcal · 47 g P · 45 g C · 14 g G', spans['[data-r-kcal]'].textContent === 514 && spans['[data-r-p]'].textContent === 47 && spans['[data-r-c]'].textContent === 45 && spans['[data-r-g]'].textContent === 14,
    [spans['[data-r-kcal]'].textContent, spans['[data-r-p]'].textContent, spans['[data-r-c]'].textContent, spans['[data-r-g]'].textContent].join(' / '));
  sb.window._carrito = [{ id: 'p', name: 'Pollo 100g', kcal: 165, prot: 31, carb: 0, fat: 4, cant: 1 }];
  sb.updateCartTotals();
  t('1 alimento: "1 alimento seleccionado" (singular)', spans['[data-r-n]'].textContent === '1 alimento seleccionado', spans['[data-r-n]'].textContent);
  sb.window._carrito = [];
  sb.updateCartTotals();
  t('0 alimentos: "0 alimentos seleccionados"', spans['[data-r-n]'].textContent === '0 alimentos seleccionados');
})();

console.log('== 4 · CTA: cantidad correcta + momento; 0 → desactivado ==');
(function () {
  const sb = makeSandbox();
  const cta = { disabled: false, textContent: '' };
  sb.document.getElementById = function (id) { return id === 'carritoCTA' ? cta : null; };
  sb.window._carrito = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  sb.updateCartCTA();
  t('3 → "Agregar 3 alimentos a desayuno" y activo', cta.textContent === 'Agregar 3 alimentos a desayuno' && cta.disabled === false, cta.textContent);
  sb.window._carrito = [{ id: 'a' }];
  sb.updateCartCTA();
  t('1 → "Agregar 1 alimento a desayuno" (singular)', cta.textContent === 'Agregar 1 alimento a desayuno', cta.textContent);
  sb.window._carrito = [];
  sb.updateCartCTA();
  t('0 → botón desactivado', cta.disabled === true);
  sb._currentMealKey = 'dinner';
  sb.window._carrito = [{ id: 'a' }, { id: 'b' }];
  sb.updateCartCTA();
  t('otro momento: "Agregar 2 alimentos a cena"', cta.textContent === 'Agregar 2 alimentos a cena', cta.textContent);
})();

console.log('== 5 · updateFoodRow: estado completo in-place (sin perder scroll) ==');
(function () {
  const sb = makeSandbox();
  const badge = { textContent: '', style: {} };
  const row = { style: {}, _attr: { 'data-foodid': 'x@1' }, getAttribute(k) { return this._attr[k]; }, setAttribute(k, v) { this._attr[k] = v; }, querySelector() { return badge; } };
  sb.document.querySelectorAll = function () { return [row]; };
  sb.window._carrito = [{ id: 'x@1', name: 'X', kcal: 10, prot: 1, carb: 1, fat: 1, cant: 2 }];
  sb.updateFoodRow('x@1');
  t('seleccionado: fondo + anillo + borde inferior oculto', row.style.background === '#e8f8ee' && row.style.boxShadow === 'inset 0 0 0 2px #15704f' && row.style.borderBottom === '0', JSON.stringify(row.style));
  t('badge "✓2" con círculo verde relleno', badge.textContent === '✓2' && badge.style.background === '#15704f' && badge.style.color === '#fff');
  t('data-sel=1 para el hover', row._attr['data-sel'] === '1');
  sb.window._carrito = [];
  sb.updateFoodRow('x@1');
  t('deseleccionado: todo vuelve a normal', row.style.background === '' && row.style.boxShadow === '' && row.style.borderBottom === '' && badge.textContent === '✓' && badge.style.background === '' && badge.style.border === '2px solid #b9ccc1');
  t('data-sel=0 para el hover', row._attr['data-sel'] === '0');
})();

console.log('\n===== RESULTADO: ' + pasadas + ' PASS / ' + falladas + ' FAIL =====');
if (falladas) process.exit(1);
