// ============================================================
// PRUEBAS de los ARREGLOS del catálogo (fase 0, sin foods nuevos).
// Uso: node tests/arreglos-catalogo.test.js
// Cubre: dedupe de foods (sin nombres repetidos), bug "esPINAca"
// (espinacas ya no son fruta/snack), chicharrón de cerdo → snack,
// leche de almendra → bebida, piña intacta, sugerencias de
// "Tengo esto en casa" sin duplicados, auxiliares nunca comida.
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
function extractVarAssign(name, ctx) {
  const m = HTML.match(new RegExp(name + '\\s*=\\s*([\\s\\S]*?);\\n'));
  if (!m) throw new Error('No se encontró ' + name);
  return vm.runInNewContext('(' + m[1] + ')', ctx || {});
}

let pasadas = 0, falladas = 0;
function t(label, ok, extra) {
  if (ok) { pasadas++; console.log('✓ ' + label + (extra ? ' · ' + extra : '')); }
  else { falladas++; console.log('✗ FALLA ' + label + (extra ? ' · ' + extra : '')); }
}

function makeSandbox() {
  const doc = { getElementById() { return null; } };
  const sb = {
    document: doc, safeText: x => String(x == null ? '' : x),
    foods: new Function('const foods=' + HTML.match(/const foods=(\[[\s\S]*?\]);/)[1] + ';' + HTML.match(/foods\.push\(([\s\S]*?)\n\);/g).map(s => s.slice(0, -1) + ';').join('') + 'return foods;')(),
    CALORIAS_FACILES_FAMILIA: extractVarAssign('var CALORIAS_FACILES_FAMILIA'),
    RECETA_AUXILIAR: extractVarAssign('var RECETA_AUXILIAR'),
    RECETA_AUXILIAR_TIPO: extractVarAssign('var RECETA_AUXILIAR_TIPO'),
    FIBRA_ESTANDAR: extractVarAssign('var FIBRA_ESTANDAR')
  };
  ['caloriasFacilesDe', 'completarNorm', 'completarNombreCorto', 'completarFiltroTengoBuscar', 'completarFoodsBase', 'completarBaseDe'].forEach(n => { sb[n] = vm.runInNewContext('(' + extractFunc(n) + ')', sb); });
  return sb;
}

console.log('== 1 · Dedupe: sin nombres repetidos ==');
(function () {
  const sb = makeSandbox();
  const seen = {};
  const dups = [];
  sb.foods.forEach(f => { seen[f[0]] = (seen[f[0]] || 0) + 1; });
  Object.keys(seen).forEach(n => { if (seen[n] > 1) dups.push(n); });
  t('121 foods (bebidas + snacks/dips) y 0 nombres duplicados', sb.foods.length === 121 && dups.length === 0, JSON.stringify(dups));
  t('"Granola 1/2 taza" aparece UNA vez', seen['Granola 1/2 taza'] === 1);
  t('"Leche 2% 1 taza" aparece UNA vez', seen['Leche 2% 1 taza'] === 1);
  t('"Queso cottage 1 taza" presente; "Cottage cheese 1 taza" eliminado', seen['Queso cottage 1 taza'] === 1 && seen['Cottage cheese 1 taza'] === undefined);
  // las macros de las entradas conservadas son las correctas (no las invertidas)
  const granola = sb.foods.find(f => f[0] === 'Granola 1/2 taza');
  const leche2 = sb.foods.find(f => f[0] === 'Leche 2% 1 taza');
  t('macros de las entradas conservadas son las correctas', granola && granola[3] === 9 && granola[4] === 36 && leche2 && leche2[3] === 5 && leche2[4] === 12, JSON.stringify({ granola: granola.slice(1, 5), leche2: leche2.slice(1, 5) }));
  t('la tabla de fibra ya no referencia "Cottage cheese 1 taza"', !Object.prototype.hasOwnProperty.call(sb.FIBRA_ESTANDAR, 'Cottage cheese 1 taza'));
})();

console.log('== 2 · Bug "esPINAca": espinacas son verdura/acompañamiento ==');
(function () {
  const sb = makeSandbox();
  const e1 = sb.caloriasFacilesDe('Espinaca 100g');
  const e2 = sb.caloriasFacilesDe('Espinaca congelada 1 taza');
  const pina = sb.caloriasFacilesDe('Piña 1 taza');
  t('Espinaca 100g → plato/acompañamiento (NO fruta/snack)', e1.funcion === 'acompanamiento' && e1.familia === 'plato', JSON.stringify(e1));
  t('Espinaca congelada 1 taza → acompañamiento', e2.funcion === 'acompanamiento', JSON.stringify(e2));
  t('Piña 1 taza sigue siendo fruta/snack', pina.familia === 'fruta' && pina.funcion === 'snack', JSON.stringify(pina));
})();

console.log('== 3 · Reclasificaciones de rol ==');
(function () {
  const sb = makeSandbox();
  const chich = sb.caloriasFacilesDe('Chicharrón de cerdo 1 oz');
  const chipsH = sb.caloriasFacilesDe('Chicharrones/chips de harina 1 oz');
  const almen = sb.caloriasFacilesDe('Leche almendra sin azúcar 1 taza');
  const leche = sb.caloriasFacilesDe('Leche entera taza');
  t('Chicharrón de cerdo → snack (ya no acompañamiento de proteína)', chich.funcion === 'snack' && chich.familia === 'snacksSalados', JSON.stringify(chich));
  t('Chips de harina siguen siendo snack', chipsH.funcion === 'snack', JSON.stringify(chipsH));
  t('Leche de almendra → bebida', almen.funcion === 'bebida' && almen.familia === 'lacteos', JSON.stringify(almen));
  t('Leche entera sigue siendo bebida', leche.funcion === 'bebida', JSON.stringify(leche));
})();

console.log('== 4 · Matcher "Tengo esto en casa": sin duplicados en sugerencias ==');
(function () {
  const sb = makeSandbox();
  // completarFiltroTengoBuscar escribe en #filtroTengoSug; capturamos el innerHTML
  const box = { innerHTML: '' };
  sb.document.getElementById = id => (id === 'filtroTengoSug' ? box : null);
  sb.completarFiltroTengoBuscar('granola');
  const apariciones = (box.innerHTML.match(/TengoAgregarNombre\('Granola 1\/2 taza'\)/g) || []).length;
  t('buscar "granola" muestra UNA sola sugerencia', apariciones === 1, 'botones=' + apariciones);
  sb.completarFiltroTengoBuscar('leche');
  const leches = (box.innerHTML.match(/TengoAgregarNombre\('Leche 2% 1 taza'\)/g) || []).length;
  t('buscar "leche" no repite "Leche 2% 1 taza"', leches === 1, 'botones=' + leches);
  // base de palabras: espinaca ya no se confunde con piña
  const bEsp = sb.completarBaseDe('espinaca');
  t('completarBaseDe("espinaca") no devuelve "piña"', bEsp !== 'piña' && bEsp !== 'pina', String(bEsp));
})();

console.log('== 5 · Auxiliares nunca son comida completa ==');
(function () {
  const sb = makeSandbox();
  const porNombre = ['Aderezo ranch casero', 'Sazonador tipo taco', 'Electrolitos caseros sin azúcar'];
  const excluidosN = porNombre.every(n => sb.RECETA_AUXILIAR.test(sb.completarNorm(n)));
  t('aderezos/sazonadores/electrolitos excluidos por nombre (RECETA_AUXILIAR)', excluidosN);
  // salsas NO las cubre el regex de nombre: se excluyen por TIPO (fix de esta fase)
  t('tipo salsa → auxiliar (RECETA_AUXILIAR_TIPO)', sb.RECETA_AUXILIAR_TIPO.test('salsa') && sb.RECETA_AUXILIAR_TIPO.test('Salsa') && sb.RECETA_AUXILIAR_TIPO.test('aderezo') && sb.RECETA_AUXILIAR_TIPO.test('especia'));
  t('tipos de comida real NO son auxiliares', !sb.RECETA_AUXILIAR_TIPO.test('comida') && !sb.RECETA_AUXILIAR_TIPO.test('snack') && !sb.RECETA_AUXILIAR_TIPO.test('bebida') && !sb.RECETA_AUXILIAR_TIPO.test('licuado') && !sb.RECETA_AUXILIAR_TIPO.test('ensalada') && !sb.RECETA_AUXILIAR_TIPO.test('pan'));
  // nombres de las nuevas familias NO deben caer en el regex de auxiliares
  const nuevos = ['Sándwich de pavo y queso', 'Ensalada César rápida con pollo', 'Agua de coco 1 vaso', 'Bebida deportiva 1 botella'];
  const noAux = nuevos.every(n => !sb.RECETA_AUXILIAR.test(sb.completarNorm(n)));
  t('nombres de sándwiches/ensaladas/bebidas NO son auxiliares', noAux);
})();

console.log('\n===== RESULTADO: ' + pasadas + ' PASS / ' + falladas + ' FAIL =====');
if (falladas) process.exit(1);
