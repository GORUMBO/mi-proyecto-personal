// ============================================================
// PRUEBAS Auditoría de lógica culinaria (no destructiva).
// Detecta preparaciones implícitas, pasos sin tiempo/criterio,
// TM5 sin parámetros, temp sin método, método sin criterio y score.
// Uso: node tests/faseA-auditoria-culinaria.test.js
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
      j++;
      while (j < HTML.length && !(HTML[j] === '/' && HTML[j - 1] !== '\\')) j++;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return HTML.slice(i, j + 1); }
  }
  throw new Error('incompleta: ' + name);
}
function extractVarAssign(name, ctx) {
  const m = HTML.match(new RegExp('var ' + name + '=([^;\\n]+);'));
  if (!m) throw new Error('No se encontró ' + name);
  return vm.runInNewContext('(' + m[1] + ')', ctx || {});
}

let pasadas = 0, falladas = 0;
function t(label, ok, extra) {
  if (ok) { pasadas++; console.log('✓ ' + label + (extra ? ' · ' + extra : '')); }
  else { falladas++; console.log('✗ FALLA ' + label + (extra ? ' · ' + extra : '')); }
}

const RECETA_ESTADOS = vm.runInNewContext('(' + (HTML.match(/var RECETA_ESTADOS=\[[\s\S]*?\];\s*\n/)[0].replace(/^var RECETA_ESTADOS=/, '').replace(/;\s*\n$/, '')) + ')');
const RECETA_ESTADOS_RX = extractVarAssign('RECETA_ESTADOS_RX', { RECETA_ESTADOS: RECETA_ESTADOS });
const RECETA_COCCION_VERB = extractVarAssign('RECETA_COCCION_VERB');
const RECETA_CRITERIO_RX = extractVarAssign('RECETA_CRITERIO_RX');

const NOMBRES = ['recetaSujetoDe', 'recetaExplicaPreparacion', 'recetaAuditar', 'recetaTiempoPaso',
  'recetaAvisosPreparacionHTML', 'recetaAvisoVisto', 'recetaStemDe', 'recetaRxSujeto',
  'recetaExplicaPreparacionProfunda', 'recetaSubrecetaPreparacion', 'recetaVerboDeEstado',
  'recetaInconsistenciaTituloPasos', 'recetaScoreSubreceta', 'recetaMejorSubreceta',
  'recetaPrepAbrir', 'recetaProblemasRevision', 'recetaSubHTML', 'recetaComponenteListo'];
function sandbox(base) {
  const mVerbP = HTML.match(/var RECETA_COCCION_VERB_PROFUNDO=[^;\n]+;/);
  const mMeto = HTML.match(/var RECETA_METODO_ESTADO=\{[^}]*\};/);
  const sb = {
    safeText: function (x) { return String(x == null ? '' : x); },
    RECETA_ESTADOS, RECETA_ESTADOS_RX, RECETA_COCCION_VERB, RECETA_CRITERIO_RX,
    RECETA_COCCION_VERB_PROFUNDO: vm.runInNewContext('(' + mVerbP[0].replace(/^var RECETA_COCCION_VERB_PROFUNDO=/, '').replace(/;$/, '') + ')'),
    RECETA_METODO_ESTADO: vm.runInNewContext('(' + mMeto[0].replace(/^var RECETA_METODO_ESTADO=/, '').replace(/;$/, '') + ')'),
    RECETA_PASO_ESCURRIR: extractVarAssign('RECETA_PASO_ESCURRIR'),
    RECETA_PASO_TIP: extractVarAssign('RECETA_PASO_TIP'),
    baseRecipes: base || [],
    window: {},
    document: { getElementById() { return null; }, createElement() { return { style: {} }; }, body: { appendChild() {} } }
  };
  NOMBRES.forEach(n => { sb[n] = vm.runInNewContext('(' + extractFunc(n) + ')', sb); });
  sb.recetaDetalleHTML = function () { return '<detalle>'; };
  sb.globalThis = sb;
  return sb;
}

console.log('== 1 · Ingrediente preparado + proceso existente → OK ==');
(function () {
  const sb = sandbox();
  const r = { name: 'Guisado', ingredients: '2 papas cocidas, sal', steps: ['Cuece las papas 10 min.', 'Sirve.'] };
  const a = sb.recetaAuditar(r);
  t('sin aviso de preparación asumida', !a.problemas.some(p => p.tipo === 'preparacion-asumida'));
})();

console.log('== 2 · Ingrediente preparado SIN proceso → advertencia ==');
(function () {
  const sb = sandbox();
  const r = { name: 'Salsa X', ingredients: '4 tomatillos cocidos, sal', steps: ['Licúa todo.', 'Sirve.'] };
  const a = sb.recetaAuditar(r);
  t('detecta preparación asumida', a.problemas.some(p => p.tipo === 'preparacion-asumida' && p.sujeto === 'tomatillos'));
  t('score rojo (severa)', a.score === '🔴');
})();

console.log('== 3 · Paso con tiempo → OK ==');
(function () {
  const sb = sandbox();
  const r = { name: 'X', ingredients: 'sal', steps: ['Cocina la salsa 5 min.'] };
  t('sin aviso de paso', !sb.recetaAuditar(r).problemas.some(p => p.tipo === 'paso-sin-criterio'));
})();

console.log('== 4 · Paso sin tiempo pero CON criterio → OK ==');
(function () {
  const sb = sandbox();
  const r = { name: 'X', ingredients: 'sal', steps: ['Cocina la salsa hasta que espese.'] };
  t('criterio basta', !sb.recetaAuditar(r).problemas.some(p => p.tipo === 'paso-sin-criterio'));
})();

console.log('== 5 · Paso sin tiempo NI criterio → advertencia ==');
(function () {
  const sb = sandbox();
  const r = { name: 'X', ingredients: 'sal', steps: ['Cocina la salsa.'] };
  const a = sb.recetaAuditar(r);
  t('detecta paso sin criterio', a.problemas.some(p => p.tipo === 'paso-sin-criterio' && p.paso === 1));
})();

console.log('== 6 · Subreceta existente → sugerencia de búsqueda ==');
(function () {
  const sb = sandbox();
  const r = { name: 'Y', ingredients: '4 tomatillos cocidos', steps: ['Licúa.'] };
  const h = sb.recetaAvisosPreparacionHTML(r, { avisoVisto: {} });
  t('ofrece "Buscar preparación"', h.includes('Buscar preparación') && h.includes('buscarComponenteEnRecetas'));
  t('no inventa pasos', !/hiérvelos|cuécelos|5 min/i.test(h));
})();

console.log('== 7 · Sin subreceta → NO inventar ==');
(function () {
  const sb = sandbox();
  const r = { name: 'Z', ingredients: '2 chayotes reposados', steps: ['Córtalos.'] };
  const h = sb.recetaAvisosPreparacionHTML(r, { avisoVisto: {} });
  t('aviso honesto sin proceso inventado', h.includes('no explica cómo prepararlo') && !/\d+\s*min/.test(h));
})();

console.log('== 8 · Score 🟢 / 🟡 / 🔴 ==');
(function () {
  const sb = sandbox();
  t('completa → 🟢', sb.recetaAuditar({ name: 'A', ingredients: 'sal, aceite', steps: ['Fríe 5 min.'], method: 'estufa', time: 5 }).score === '🟢');
  t('paso sin criterio → 🟡', sb.recetaAuditar({ name: 'B', ingredients: 'sal', steps: ['Cocina la salsa.'], method: 'estufa', time: 5 }).score === '🟡');
  t('preparación asumida → 🔴', sb.recetaAuditar({ name: 'C', ingredients: 'pollo cocido', steps: ['Desmenuza.'], method: 'estufa' }).score === '🔴');
  t('sin ingredientes → 🔴', sb.recetaAuditar({ name: 'D', ingredients: '', steps: ['Cocina 5 min.'] }).score === '🔴');
})();

console.log('== 9 · Caso real: Salsa de aguacate verde ==');
(function () {
  // Entrada REAL de la biblioteca (RECETAS_V2): "1 aguacate, 4 tomatillos cocidos, 1 chile serrano..."
  const m = HTML.match(/\['Salsa de aguacate verde','salsa',8,180,2,1\.2,[\s\S]*?\],/);
  if (!m) { t('entrada real encontrada', false); return; }
  t('entrada real encontrada', true);
  const sb = sandbox();
  const r = {
    name: 'Salsa de aguacate verde', type: 'salsa', time: 8, method: 'sin cocinar',
    ingredients: '1 aguacate, 4 tomatillos cocidos, 1 chile serrano, ¼ cebolla, cilantro, sal',
    steps: ['Licua: 1 aguacate + 4 tomatillos cocidos + 1 chile serrano + ¼ cebolla + cilantro + sal.', 'Agrega agua poco a poco hasta consistencia cremosa.']
  };
  const a = sb.recetaAuditar(r);
  t('detecta "4 tomatillos cocidos" sin preparación', a.problemas.some(p => p.tipo === 'preparacion-asumida' && p.texto.indexOf('4 tomatillos cocidos') >= 0));
  t('marcada 🔴 (incompleta)', a.score === '🔴');
  const h = sb.recetaAvisosPreparacionHTML(r, { avisoVisto: {} });
  t('aviso con el texto exacto', h.includes('4 tomatillos cocidos') && h.includes('no explica cómo prepararlo'));
})();

console.log('== 11 · Clasificación A/B/C (funciones profundas) ==');
(function () {
  const sb = sandbox([
    { name: 'Salsa verde cruda', type: 'salsa', ingredients: '6 tomatillos, chile', steps: ['Licúa todo.', 'Hierve 7 min.'] },
    { name: 'Bowl arroz', type: 'comida', ingredients: 'arroz, pollo', steps: ['Cuece el arroz 15 min.', 'Sirve.'] }
  ]);
  // sujeto mejorado
  t('"½ taza arroz cocido" → sujeto "arroz"', sb.recetaSujetoDe('½ taza arroz cocido').sujeto === 'arroz');
  t('"salsa verde cocida" → sujeto "salsa verde"', sb.recetaSujetoDe('salsa verde cocida').sujeto === 'salsa verde');
  // A: proceso dentro de la misma receta, no enlazado por la básica
  const rA = { name: 'Caldo X', ingredients: '2 chiles verdes asados', steps: ['Asa los chiles, pélalos.', 'Hierve 10 min.'] };
  t('A: proceso interno enlazado por la profunda', sb.recetaExplicaPreparacionProfunda(rA, 'chiles verdes') === true);
  const rNo = { name: 'Y', ingredients: '2 chiles verdes asados', steps: ['Pélalos.', 'Sirve.'] };
  t('sin proceso → profunda false', sb.recetaExplicaPreparacionProfunda(rNo, 'chiles verdes') === false);
  // B: subreceta confiable
  const subs = sb.recetaSubrecetaPreparacion({ name: 'Z', ingredients: '4 tomatillos cocidos', steps: ['Licúa.'] }, 'tomatillos');
  t('B: encuentra "Salsa verde cruda"', subs.length >= 1 && subs[0].nombre === 'Salsa verde cruda');
  const subs2 = sb.recetaSubrecetaPreparacion({ name: 'W', ingredients: '1 taza arroz cocido', steps: ['Fríe.'] }, 'arroz');
  t('B: arroz → "Bowl arroz"', subs2.length >= 1 && subs2[0].nombre === 'Bowl arroz');
  const subs3 = sb.recetaSubrecetaPreparacion({ name: 'V', ingredients: '2 chayotes reposados', steps: ['Córtalos.'] }, 'chayotes');
  t('C: sin subreceta → []', subs3.length === 0);
})();

console.log('== 12 · Validación estricta de subrecetas (🟢/🟡/🔴) ==');
(function () {
  const COCIDA = { name: 'Salsa verde cocida', type: 'salsa', method: 'estufa', ingredients: '6 tomatillos, 1 chile, cebolla, sal', steps: ['Hierve 6 tomatillos + 1 chile 8 min hasta cambiar color.', 'Escurre y licua.'] };
  const CRUDA = { name: 'Salsa verde cruda', type: 'salsa', method: 'sin cocinar', ingredients: '6 tomatillos, chile, sal', steps: ['Licua todo en crudo.', 'No necesita cocción.'] };
  const TM5_CERDO = { name: 'TM5 chile verde con cerdo', type: 'comida', method: 'TM5', ingredients: '500g cerdo, 6 tomatillos, chile, caldo', steps: ['Cocer cerdo en Varoma: 100°C, 30 min.', 'Licuar tomatillos: vel 7, 30 seg.'] };
  const PLATO = { name: 'Chilaquiles con huevo', type: 'comida', method: 'estufa', ingredients: '8 tortillas, 2 huevos, cebolla, queso, crema, salsa', steps: ['Fríe las tortillas 2 min.', 'Sirve.'] };
  const PADRE = { name: 'Salsa de aguacate verde', type: 'salsa', method: 'sin cocinar', ingredients: '1 aguacate, 4 tomatillos cocidos', steps: ['Licua todo.'] };
  const sb = sandbox([COCIDA, CRUDA, TM5_CERDO, PLATO, PADRE]);
  const prob = { tipo: 'preparacion-asumida', texto: '4 tomatillos cocidos', sujeto: 'tomatillos', estado: 'cocidos' };
  // 1) candidata que realmente prepara → verde
  const sc1 = sb.recetaScoreSubreceta(PADRE, prob, 0);
  t('candidata que prepara el ingrediente → 🟢', sc1.nivel === '🟢', JSON.stringify(sc1.motivos));
  // 2) plato que solo contiene el ingrediente → roja
  const sc2 = sb.recetaScoreSubreceta(PADRE, prob, 3);
  t('plato completo → 🔴', sc2.nivel === '🔴');
  // 3) método incompatible (TM5 vs normal) → no verde
  const sc3 = sb.recetaScoreSubreceta(PADRE, prob, 2);
  t('TM5 para receta normal → no 🟢', sc3.nivel !== '🟢' && sc3.motivos.join(';').includes('TM5'));
  // 4) contradicción título/pasos → amarilla
  const contradic = { name: 'Salsa verde cruda', method: 'sin cocinar', ingredients: '6 tomatillos', steps: ['Licúa.', 'Hierve 7 min.'] };
  t('título crudo + pasos cocinan → inconsistencia', sb.recetaInconsistenciaTituloPasos(contradic) !== null);
  // 5) varias candidatas → la de mayor confianza
  const mejor = sb.recetaMejorSubreceta(PADRE, prob);
  t('elige la mejor (Salsa verde cocida)', mejor && mejor.sub.sub === 'Salsa verde cocida');
  // 6) ninguna verde → no enlaza
  const sb2 = sandbox([CRUDA, PLATO]);
  t('ninguna verde → null', sb2.recetaMejorSubreceta(PADRE, prob) === null);
  // 7) grupo A enlaza internamente sin duplicar
  const rA = { name: 'Caldo X', ingredients: '2 chiles verdes asados, papas', steps: ['Asa los chiles, pélalos.', 'Hierve 10 min.'] };
  const hA = sb.recetaAvisosPreparacionHTML(rA, { avisoVisto: {} });
  t('grupo A: aviso "ya incluye" sin ⚠', hA.includes('ya incluye cómo preparar') && !hA.includes('Preparación incompleta'));
  t('grupo A: no duplica pasos', !hA.includes('Asa los chiles'));
  // 8) caso Salsa de aguacate verde (fixture)
  t('cruda para "cocidos" → 🔴 (estado opuesto, coherente)', sb.recetaScoreSubreceta(PADRE, prob, 1).nivel === '🔴');
})();

console.log('== 13 · Enlace automático 🟢 en Paso a paso ==');
(function () {
  const COCIDA = { name: 'Salsa verde cocida', type: 'salsa', method: 'estufa', ingredients: '6 tomatillos, 1 chile, cebolla, sal', steps: ['Hierve 6 tomatillos + 1 chile 8 min hasta cambiar color.', 'Escurre y licua.'] };
  const CRUDA = { name: 'Salsa verde cruda', type: 'salsa', method: 'sin cocinar', ingredients: '6 tomatillos, chile, sal', steps: ['Licua todo en crudo.', 'No necesita cocción.'] };
  const TM5 = { name: 'TM5 chile verde con cerdo', type: 'comida', method: 'TM5', ingredients: '500g cerdo, 6 tomatillos, chile, caldo', steps: ['Cocer cerdo en Varoma: 100°C, 30 min.', 'Licuar tomatillos: vel 7, 30 seg.'] };
  const PADRE = { name: 'Salsa de aguacate verde', type: 'salsa', method: 'sin cocinar', ingredients: '1 aguacate, 4 tomatillos cocidos', steps: ['Licua todo.'] };
  const sb = sandbox([COCIDA, CRUDA, TM5, PADRE]);
  const vista = { idx: 3, componentesListos: {}, avisoVisto: {}, pila: [], prepAbierta: null, subAbierta: null };
  sb.window._recetaVista = vista;
  const h = sb.recetaAvisosPreparacionHTML(PADRE, vista);
  t('enlace verde: "Preparación necesaria: 4 tomatillos cocidos"', h.includes('Preparación necesaria: 4 tomatillos cocidos'));
  t('botones [Ver cómo prepararlos] + [Ya los tengo]', h.includes('Ver cómo prepararlos') && h.includes('Ya los tengo cocidos'));
  t('NO muestra ⚠ incompleta', !h.includes('Preparación incompleta'));
  t('NO enlaza cruda ni TM5', !h.includes('Salsa verde cruda') && !h.includes('TM5 chile verde con cerdo'));
  // abrir preparación → pasos reales de la subreceta
  sb.recetaPrepAbrir(0);
  const h2 = sb.recetaAvisosPreparacionHTML(PADRE, vista);
  t('expandida muestra los pasos reales (con tiempo/criterio tal cual)', h2.includes('Hierve 6 tomatillos + 1 chile 8 min hasta cambiar color.') && h2.includes('Escurre y licua.'));
  // "Ya los tengo cocidos" → oculta el aviso
  sb.recetaComponenteListo('4 tomatillos cocidos');
  const h3 = sb.recetaAvisosPreparacionHTML(PADRE, vista);
  t('"Ya los tengo" oculta el aviso', h3 === '');
  // sin verde → ⚠ + lista de revisión
  const BISTEC = { name: 'Bistec encebollado', type: 'comida', method: 'estufa', ingredients: 'bistec, cebolla, ajo, aceite, sal', steps: ['Fríe la cebolla 5 min.', 'Sirve.'] };
  const PADRE2 = { name: 'X', type: 'comida', method: 'estufa', ingredients: '170g bistec cocido', steps: ['Rebana.'] };
  const sb2 = sandbox([BISTEC, PADRE2]);
  sb2.window._recetaVista = { idx: 1, componentesListos: {}, avisoVisto: {}, pila: [], prepAbierta: null, subAbierta: null };
  const hNo = sb2.recetaAvisosPreparacionHTML(PADRE2, sb2.window._recetaVista);
  t('sin verde → ⚠ con botón de revisión', hNo.includes('Preparación incompleta') && hNo.includes('Ver revisión'));
  const rev = sb2.recetaProblemasRevision();
  t('lista de revisión incluye receta padre + texto', rev.length >= 1 && rev[0].receta === 'X' && rev[0].texto === '170g bistec cocido');
  t('lista de revisión con candidatas y nivel', rev[0].candidatas.join('·').includes('Bistec encebollado'));
})();

console.log('== 10 · "Continuar de todos modos" oculta el aviso ==');
(function () {
  const sb = sandbox();
  const r = { name: 'Y', ingredients: '4 tomatillos cocidos', steps: ['Licúa.'] };
  sb.window._recetaVista = { idx: 0, modo: 'pasoapaso', paso: 0, avisoVisto: {}, componentesListos: {}, subAbierta: null };
  sb.recetaAvisoVisto('4 tomatillos cocidos');
  t('marcado como visto', sb.window._recetaVista.avisoVisto['4 tomatillos cocidos'] === true);
  const h = sb.recetaAvisosPreparacionHTML(r, sb.window._recetaVista);
  t('aviso ya no se repite', h === '');
})();

console.log('===== RESULTADO: ' + pasadas + ' PASS / ' + falladas + ' FAIL =====');
if (falladas) process.exit(1);
