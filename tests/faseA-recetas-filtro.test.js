// ============================================================
// PRUEBAS Recetas — filtro atascado (bug "25 recetas").
// El modo agrupado solo puede mostrar el catálogo COMPLETO;
// "Todas" resetea los filtros ocultos (_recMethod/_portableFormat);
// abrir una receta enlazada no deja filtros fijados.
// Uso: node tests/faseA-recetas-filtro.test.js
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
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return HTML.slice(i, j + 1); }
  }
  throw new Error('incompleta: ' + name);
}

let pasadas = 0, falladas = 0;
function t(label, ok, extra) {
  if (ok) { pasadas++; console.log('✓ ' + label + (extra ? ' · ' + extra : '')); }
  else { falladas++; console.log('✗ FALLA ' + label + (extra ? ' · ' + extra : '')); }
}

const sb = {
  _recipePage: 1,
  refrescos: 0,
  renderRecipesCalls: 0,
  window: {},
  baseRecipes: [1, 2, 3],
  document: {
    getElementById() { return null; },
    querySelectorAll() { return []; },
    querySelector() { return null; }
  },
  setTimeout() { return 1; }
};
sb.globalThis = sb;
sb.recetaModoAgrupado = vm.runInNewContext('(' + extractFunc('recetaModoAgrupado') + ')', sb);
sb.recetaFiltroDesc = vm.runInNewContext('(' + extractFunc('recetaFiltroDesc') + ')', sb);
sb.recSetTab = vm.runInNewContext('(' + extractFunc('recSetTab') + ')', sb);
sb.openLinkedRecipe = vm.runInNewContext('(' + extractFunc('openLinkedRecipe') + ')', sb);
sb.refreshRecetasTab = function () { sb.refrescos++; };
sb.renderRecipes = function () { sb.renderRecipesCalls++; };

console.log('== 1 · El modo agrupado solo con catálogo COMPLETO ==');
(function () {
  t('limpio → agrupado', sb.recetaModoAgrupado('todas', '', '', 'none', 'todas', 'todas') === true);
  t('m="salsa" → NO agrupado (el bug)', sb.recetaModoAgrupado('todas', '', '', 'none', 'salsa', 'todas') === false);
  t('pf="favoritas" → NO agrupado', sb.recetaModoAgrupado('todas', '', '', 'none', 'todas', 'favoritas') === false);
  t('búsqueda activa → NO agrupado', sb.recetaModoAgrupado('todas', '', 'pollo', 'none', 'todas', 'todas') === false);
  t('orden activo → NO agrupado', sb.recetaModoAgrupado('todas', '', '', 'kcalDesc', 'todas', 'todas') === false);
  t('chip activo → NO agrupado', sb.recetaModoAgrupado('todas', 'salsa', '', 'none', 'todas', 'todas') === false);
})();

console.log('== 2 · "Todas" resetea los filtros ocultos ==');
(function () {
  sb.window._recMethod = 'salsa';
  sb.window._portableFormat = 'favoritas';
  sb.window._recSearchText = 'salsa verde';
  sb.window._recTab = 'tipo';
  sb.window._recChip = 'salsa';
  sb.recSetTab('todas');
  t('_recMethod vuelve a "todas"', sb.window._recMethod === 'todas');
  t('_portableFormat vuelve a "todas"', sb.window._portableFormat === 'todas');
  t('_recSearchText limpio', sb.window._recSearchText === '');
  t('_recChip limpio', sb.window._recChip === '');
  t('refresca la pestaña', sb.refrescos >= 1);
})();

console.log('== 3 · Abrir receta enlazada NO fija filtros ocultos ==');
(function () {
  sb.window._recMethod = 'todas';
  sb.window._portableFormat = 'todas';
  sb.openLinkedRecipe('Salsa verde cruda');
  t('_recMethod queda en "todas"', sb.window._recMethod === 'todas');
  t('_portableFormat queda en "todas"', sb.window._portableFormat === 'todas');
  t('la búsqueda persiste en _recSearchText', sb.window._recSearchText === 'Salsa verde cruda');
  t('vuelve a renderizar la lista', sb.renderRecipesCalls >= 1);
})();

console.log('== 4 · Descripción del filtro activo (indicador) ==');
(function () {
  t('sin filtro → "" (Todas las recetas: 945)', sb.recetaFiltroDesc('todas', 'todas', 'todas', '', 'todas', '') === '');
  t('método salsa → "salsa"', sb.recetaFiltroDesc('todas', 'salsa', 'todas', '', 'todas', '') === 'salsa');
  t('thermomix → "Thermomix"', sb.recetaFiltroDesc('todas', 'thermomix', 'todas', '', 'todas', '') === 'Thermomix');
  t('favoritas → "Favoritas"', sb.recetaFiltroDesc('todas', 'todas', 'favoritas', '', 'todas', '') === 'Favoritas');
  t('chip salsa → "salsa"', sb.recetaFiltroDesc('todas', 'todas', 'todas', '', 'tipo', 'salsa') === 'salsa');
  t('búsqueda → "búsqueda"', sb.recetaFiltroDesc('todas', 'todas', 'todas', 'pollo', 'todas', '') === 'búsqueda');
})();

console.log('===== RESULTADO: ' + pasadas + ' PASS / ' + falladas + ' FAIL =====');
if (falladas) process.exit(1);
