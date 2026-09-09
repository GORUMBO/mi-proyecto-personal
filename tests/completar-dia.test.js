// ============================================================
// PRUEBAS — "Completar mi día": botón Volver (acción + safe-area
// iPhone) y diferenciación comida CON receta vs SIN receta.
// Uso: node tests/completar-dia.test.js
// ============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extractFunc(name) {
  const src = HTML;
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('No se encontró function ' + name);
  let depth = 0, j = i, q = null, tplStack = [];
  for (; j < src.length; j++) {
    const c = src[j];
    if (q === '`') {
      if (c === '\\') { j++; continue; }
      if (c === '`') { q = null; continue; }
      if (c === '$' && src[j + 1] === '{') { j += 2; tplStack.push(depth); depth++; q = null; continue; }
      continue;
    }
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '/' && (src[j + 1] === "'" || src[j + 1] === '"' || src[j + 1] === '\\') && /[\(,=:\[!&|?;{+\-*%~^<>]\s*$/.test(src.slice(Math.max(0, j - 4), j))) {
      j++;
      while (j < src.length && !(src[j] === '/' && src[j - 1] !== '\\')) j++;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (tplStack.length && depth === tplStack[tplStack.length - 1]) { tplStack.pop(); q = '`'; }
      if (depth === 0) return src.slice(i, j + 1);
    }
  }
  throw new Error('incompleta: ' + name);
}
function extractVarAssign(name) {
  const m = HTML.match(new RegExp(name + '\\s*=\\s*([\\s\\S]*?);\\n'));
  if (!m) throw new Error('No se encontró ' + name);
  return vm.runInNewContext('(' + m[1] + ')', {});
}

let passed = 0, failed = 0;
function t(label, ok, extra) {
  if (ok) { passed++; console.log('✓ ' + label + (extra ? ' · ' + extra : '')); }
  else { failed++; console.log('✗ FALLA ' + label + (extra ? ' · ' + extra : '')); }
}

function makeSb(props) {
  const created = [];
  const panels = {};
  const sb = {
    state: { diary: {}, recipeFavorites: [] },
    safeText: function (x) { return String(x == null ? '' : x); },
    baseRecipes: [
      { name: 'Chilaquiles con huevo', time: 15, method: 'estufa', type: 'desayuno', tags: 'mexicana', steps: ['Calienta la salsa.'], ingredients: 'huevo, tortillas, salsa' }
    ],
    document: {
      getElementById: function (id) { return panels[id] || null; },
      createElement: function () {
        const el = { style: { cssText: '' }, innerHTML: '', scrollTop: 0, removed: false, remove: function () { el.removed = true; } };
        Object.defineProperty(el, 'id', {
          get: function () { return el._id; },
          set: function (v) { el._id = v; if (v) panels[v] = el; },
          configurable: true
        });
        created.push(el);
        return el;
      },
      body: { appendChild: function () {} }
    },
    window: { _completarMostradas: [], _completarPropuestas: null, _completarModoFacil: true, _completarFamiliasVistas: [] },
    completarCtxReal: function () { return { franja: 'noche', hora: 20, llenado: 'normal', kcalObjetivo: 3000, kcalConsumidas: 1200, objetivo: 'ganar', consumidosHoy: [], mostradas: [], restricciones: [], favoritos: [], recientes: [] }; },
    completarProponer: function () { return props; },
    completarFiltrosUI: function () { return ''; },
    completarFiltrosActivos: function () { return null; },
    completarFibraHoy: function () { return { ratio: 0, suma: 0 }; },
    completarFibraCandidato: function () { return { estado: 'sin', g: 0 }; },
    completarFranja: function () { return 'noche'; },
    completarTextoTarjeta: function () { return 'Te faltan hoy: X kcal'; },
    potenciarHayExtras: function () { return false; },
    bebidaMenuHTML: function () { return ''; }
  };
  vm.createContext(sb);
  ['completarAbrir', 'completarCerrar', 'completarRenderPanel', 'completarLineaPropuesta', 'completarLineaMicro',
    'completarVolBadge', 'completarEtiquetaTipo', 'recetaResumenCorto', 'completarNorm', 'completarNombreCorto',
    'completarParteTexto', 'completarPorcionComponente', 'completarPorcion', 'completarFraccion',
    'completarComidoYa', 'registrarComidaDiary', 'quitarRegistroComida', 'completarComiEsto'].forEach(function (n) {
    vm.runInContext(extractFunc(n), sb);
  });
  ['COMPLETAR_UNIDAD_TEXTO', 'COMPLETAR_UNIDAD_CONDE', 'COMPLETAR_GENERICOS', 'COMPLETAR_EQUIV_CASERA'].forEach(function (n) {
    sb[n] = extractVarAssign('var ' + n);
  });
  sb.panels = panels;
  sb.created = created;
  return sb;
}

console.log('== 1 · Botón Volver ejecuta su acción ==');
(function () {
  const sb = makeSb([]);
  sb.completarAbrir();
  t('el panel se crea y se abre', !!sb.panels.completarPanel && sb.panels.completarPanel.removed === false);
  sb.completarCerrar();
  t('Volver remueve el panel (acción correcta)', sb.panels.completarPanel.removed === true);
})();

console.log('== 2 · Safe-area de iPhone en el panel ==');
(function () {
  const sb = makeSb([]);
  sb.completarAbrir();
  const el = sb.created.find(function (x) { return x.id === 'completarPanel'; });
  t('el panel respeta safe-area-inset-top y bottom', !!el && /safe-area-inset-top/.test(el.style.cssText) && /safe-area-inset-bottom/.test(el.style.cssText));
  t('el botón Volver tiene área táctil grande (48px)', /min-height:48px/.test(sb.panels.completarPanel.innerHTML));
})();

console.log('== 3 · Comida CON receta → "Ver receta" ==');
(function () {
  const props = [{ titulo: 'Chilaquiles con huevo', kcal: 520, p: 28, tiempo: 15, tipoProp: 'normal', volumen: 'Normal', bebida: false, componentes: [{ tipo: 'receta', nombre: 'Chilaquiles con huevo', ref: 0 }] }];
  const sb = makeSb(props);
  sb.completarAbrir();
  const html = sb.panels.completarPanel.innerHTML;
  t('muestra el botón 👨‍🍳 Ver receta', /👨‍🍳 Ver receta/.test(html));
  t('NO muestra "Sin receta disponible"', !/Sin receta disponible/.test(html));
})();

console.log('== 4 · Comida SIN receta → "Sin receta disponible" (nunca "Ver receta") ==');
(function () {
  // combo de solo alimentos (tipoProp normal)
  const props = [{ titulo: 'Arroz + Pollo', kcal: 370, p: 30, tipoProp: 'normal', volumen: 'Normal', bebida: false, componentes: [{ tipo: 'alimento', nombre: 'Arroz cocido 1 taza' }, { tipo: 'alimento', nombre: 'Pollo 100g' }] }];
  const sb = makeSb(props);
  sb.completarAbrir();
  const html = sb.panels.completarPanel.innerHTML;
  t('comida sin receta: muestra "Sin receta disponible"', /Sin receta disponible/.test(html));
  t('comida sin receta: NUNCA muestra "Ver receta"', !/Ver receta/.test(html) && !/completarCocinar/.test(html));
  // micro (Extra fácil de 1 alimento): tampoco inventa receta por nombre
  const sb2 = makeSb([{ titulo: 'Aceite oliva', kcal: 119, p: 0, tipoProp: 'micro', volumen: 'Poco', bebida: false, componentes: [{ tipo: 'alimento', nombre: 'Aceite oliva 1 cucharada' }] }]);
  sb2.completarAbrir();
  const html2 = sb2.panels.completarPanel.innerHTML;
  t('micro sin receta: "Sin receta disponible" y sin "Prepáralo" heurístico', /Sin receta disponible/.test(html2) && !/Prepáralo/.test(html2) && !/Ver receta/.test(html2));
})();

console.log('\n===== RESULTADO: ' + passed + ' PASS / ' + failed + ' FAIL =====');
if (failed) process.exit(1);
