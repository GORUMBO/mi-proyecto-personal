// ============================================================
// PRUEBAS FASE 4 — ☕ Arma tu café (mismo motor que caldo/agua/suero).
// Uso: node tests/arma-cafe.test.js
// Cubre: fuente única, kcal exactas por preset, validación, +/−,
// pasos Normal/Thermomix (leche sin hervir, cacao sin grumos, proteína
// sin líquido hirviendo, 4 min / 60°C / vel 2), consistencia,
// persistencia tipo 'cafe' y copiar/lista.
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
function extractVarAssign(name, ctx) {
  const m = HTML.match(new RegExp(name + '\\s*=\\s*([\\s\\S]*?);\\n'));
  if (!m) throw new Error('No se encontró ' + name);
  return vm.runInNewContext('(' + m[1] + ')', ctx || {});
}
function extractObj(name) {
  const i = HTML.indexOf('var ' + name + '=');
  if (i < 0) throw new Error('No se encontró var ' + name);
  let depth = 0, j = i, q = null;
  for (; j < HTML.length; j++) {
    const c = HTML[j];
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return HTML.slice(i + ('var ' + name + '=').length, j + 1); }
  }
  throw new Error('incompleta: ' + name);
}

let pasadas = 0, falladas = 0;
function t(label, ok, extra) {
  if (ok) { pasadas++; console.log('✓ ' + label + (extra ? ' · ' + extra : '')); }
  else { falladas++; console.log('✗ FALLA ' + label + (extra ? ' · ' + extra : '')); }
}

const foods = new Function('const foods=' + HTML.match(/const foods=(\[[\s\S]*?\]);/)[1] + ';' +
  HTML.match(/foods\.push\(([\s\S]*?)\n\);/g).map(s => s.slice(0, -1) + ';').join('') + 'return foods;')();

function makeSandbox() {
  const state = { caldoBuilder: {}, aguaBuilder: {}, sueroBuilder: {}, cafeBuilder: {} };
  const sb = { state, foods, safeText: x => String(x == null ? '' : x), saves: 0 };
  sb.save = function () { sb.saves++; };
  sb.document = { getElementById() { return null; } };
  {
    const ini = HTML.indexOf('var BUILDER_INGREDIENTES=');
    const fin = HTML.indexOf('\nvar CALDO_PARTES', ini);
    if (fin < 0) throw new Error('no se pudo extraer BUILDER_INGREDIENTES');
    const src = HTML.slice(ini + 'var BUILDER_INGREDIENTES='.length, fin).trim().replace(/;\s*$/, '');
    sb.BUILDER_INGREDIENTES = vm.runInNewContext('(' + src + ')', { foods });
  }
  sb.CAFE_PARTES = extractVarAssign('var CAFE_PARTES');
  sb.CAFE_RAPIDO = extractVarAssign('var CAFE_RAPIDO');
  sb.CAFE_PREP = extractVarAssign('var CAFE_PREP');
  sb.CAFE_TOT_CFG = extractVarAssign('CAFE_TOT_CFG');
  sb.CAFE_PASOS_TPL = vm.runInNewContext('(' + extractObj('CAFE_PASOS_TPL') + ')', { CAFE_TOT_CFG: sb.CAFE_TOT_CFG });
  ['_cafeSel', 'cafeTotales', 'cafeValida', 'cafeElegir', 'cafeMas', 'cafeMenos', 'cafeAplicar', 'cafeIngSeleccion', 'cafePasos', 'cafeTextoPrep', 'cafeCopiar', 'cafeCompartir', 'cafeGuardar', 'cafeRepetir', 'cafeBorrarGuardada', 'cafeALista', 'cafeBodyHTML', 'cafePrepHtml', 'cafeVerPrep', 'cafeSetMetodo', 'cafeSetNivel', 'cafeRefresh'].forEach(n => { sb[n] = vm.runInNewContext('(' + extractFunc(n) + ')', sb); });
  ['builderOp', 'builderSel', 'builderTotales', 'builderElegir', 'builderMas', 'builderMenos', 'builderIngSeleccion', 'builderAplicar', 'builderPasos', 'builderTextoPrep', 'builderCopiar', 'builderCompartir', 'builderGuardar', 'builderRepetir', 'builderBorrarGuardada', 'builderALista', 'builderVerPrep', 'builderSetMetodo', 'builderSetNivel'].forEach(n => { sb[n] = vm.runInNewContext('(' + extractFunc(n) + ')', sb); });
  return sb;
}

console.log('== 1 · Fuente única: leches y proteína derivadas de foods[] ==');
(function () {
  const sb = makeSandbox();
  const porNombre = {};
  foods.forEach(f => { porNombre[f[0]] = f; });
  const casos = [
    ['lecheEntera', 'Leche entera taza', 149],
    ['leche2', 'Leche 2% 1 taza', 122],
    ['lecheDescremada', 'Leche descremada 1 taza', 83],
    ['lecheAlmendra', 'Leche almendra sin azúcar 1 taza', 30],
    ['proteina', 'Proteína whey 1 scoop', 120]
  ];
  let ok = true;
  casos.forEach(([id, fName, esperado]) => {
    const v = sb.BUILDER_INGREDIENTES[id];
    if (!v || v.k !== esperado || !porNombre[fName]) { ok = false; console.log('  ✗ ' + id); }
  });
  t('5 ingredientes de café derivados de foods[] con kcal exactas', ok);
  const literales = ['cafeMolido', 'canela', 'cacao', 'vainilla', 'lecheCondensada'];
  t('5 ingredientes sin foods[] con valor estándar único', literales.every(id => sb.BUILDER_INGREDIENTES[id] && sb.BUILDER_INGREDIENTES[id].fuente === 'estandar'));
})();

console.log('== 2 · Kcal exactas por preset ==');
(function () {
  const sb = makeSandbox();
  const esperados = [
    ['Café solo (negro)', 2],
    ['Café con leche', 199],
    ['Latte casero', 154],
    ['Mocha', 211],
    ['Café con miel y canela', 69],
    ['Café con leche y proteína', 292]
  ];
  let ok = true;
  sb.CAFE_RAPIDO.forEach((p, i) => {
    sb.cafeAplicar(p.sel);
    const tt = sb.cafeTotales();
    if (tt.k !== esperados[i][1] || tt.porciones !== 1 || tt.tiempo < 5 || tt.tiempo > 40) { ok = false; console.log('  ✗ ' + p.nombre + ': ' + tt.k + ' kcal'); }
  });
  t('los 6 presets dan las kcal exactas esperadas', ok);
})();

console.log('== 3 · Validación y +/− ==');
(function () {
  const sb = makeSandbox();
  t('vacío → pide café base', sb.cafeValida().length === 1 && /café base/.test(sb.cafeValida()[0]), sb.cafeValida().join(' | '));
  sb.cafeElegir('cafe', 0);
  t('con base → sin problemas', sb.cafeValida().length === 0);
  sb.cafeElegir('dulce', 0); // azúcar
  const k1 = sb.cafeTotales().k;
  sb.cafeMas('dulce', 0);
  const k2 = sb.cafeTotales().k;
  t('+ suma una cucharada de azúcar (48 kcal)', k2 - k1 === 48, k1 + ' → ' + k2);
  sb.cafeMenos('dulce', 0);
  t('− vuelve al valor original', sb.cafeTotales().k === k1);
})();

console.log('== 4 · Pasos NORMALES ==');
(function () {
  const sb = makeSandbox();
  sb.window = sb; sb.window._carrito = []; sb.ppUUID = vm.runInNewContext('(' + extractFunc('ppUUID') + ')', sb);
  sb.toastReg = function () {}; sb.renderCarrito = function () {}; sb.alert = function () {}; sb.navigator = {};
  // Café con leche: leche caliente sin hervir
  sb.cafeAplicar(sb.CAFE_RAPIDO[1].sel);
  const txt1 = sb.cafePasos('normal').detallados.join(' | ');
  t('con leche: preparar café, calentar leche sin que hierva, disolver azúcar', /Prepara el café/.test(txt1) && /Calienta la leche sin que hierva/.test(txt1) && /Disuelve el azúcar/.test(txt1) && /sirve caliente/.test(txt1), txt1.slice(0, 160));
  // Mocha: cacao sin grumos
  sb.cafeAplicar(sb.CAFE_RAPIDO[3].sel);
  const txt2 = sb.cafePasos('normal').detallados.join(' | ');
  t('mocha: cacao mezclado con leche fría (sin grumos)', /chorrito de leche fría/.test(txt2), txt2.slice(0, 140));
  // Canela al servir
  const txt3 = sb.cafeAplicar(sb.CAFE_RAPIDO[4].sel);
  const p3 = sb.cafePasos('normal').detallados.join(' | ');
  t('canela y miel: espolvorear al final', /Espolvorea la canela al final/.test(p3) && /Disuelve la miel/.test(p3), p3.slice(0, 140));
  // Proteína: nunca con líquido hirviendo
  sb.cafeAplicar(sb.CAFE_RAPIDO[5].sel);
  const txt4 = sb.cafePasos('normal').detallados.join(' | ');
  t('proteína: con leche fría, nunca con líquido hirviendo', /nunca con líquido hirviendo/.test(txt4));
})();

console.log('== 5 · Pasos THERMOMIX (sí aporta: calentar leche) ==');
(function () {
  const sb = makeSandbox();
  sb.window = sb; sb.window._carrito = []; sb.ppUUID = vm.runInNewContext('(' + extractFunc('ppUUID') + ')', sb);
  sb.toastReg = function () {}; sb.renderCarrito = function () {}; sb.alert = function () {}; sb.navigator = {};
  sb.cafeAplicar(sb.CAFE_RAPIDO[1].sel);
  const txt = sb.cafePasos('tm5').detallados.join(' || ');
  t('leche en el vaso: 4 min / 60°C / vel 2', /4 min \/ 60°C \/ vel 2/.test(txt));
  t('azúcar: 5 seg / vel 2', /5 seg \/ vel 2/.test(txt));
  t('sin instrucciones de olla/fuego en TM5', !/olla|fuego|tapado/.test(txt));
  // Crema y canela: nota de que van al servir
  sb.cafeAplicar({ cafe: { i: 0, n: 1 }, leche: { i: 0, n: 1 }, dulce: [{ i: 4, n: 1 }], extra: [{ i: 0, n: 1 }] });
  const txt2 = sb.cafePasos('tm5').detallados.join(' | ');
  t('crema y canela: nota "no va al vaso"', /La canela se espolvorea al final \(no va al vaso\)/.test(txt2) && /La crema se agrega al final \(no va al vaso\)/.test(txt2));
  // Consistencia
  sb.cafeAplicar(sb.CAFE_RAPIDO[1].sel);
  const tN = sb.cafeTotales(); const tT = sb.cafeTotales();
  const pN = sb.cafePasos('normal').detallados.join(' | ');
  const pT = sb.cafePasos('tm5').detallados.join(' | ');
  t('mismos macros y kcal en ambos métodos', tN.k === tT.k && tN.p === tT.p && tN.c === tT.c && tN.g === tT.g, tN.k + ' kcal');
  t('solo cambia la preparación', pN !== pT && pT.indexOf('vel 2') >= 0 && pN.indexOf('taza') >= 0);
})();

console.log('== 6 · Persistencia: guardar y Preparar otra vez ==');
(function () {
  const sb = makeSandbox();
  sb.window = sb; sb.window._carrito = []; sb.ppUUID = vm.runInNewContext('(' + extractFunc('ppUUID') + ')', sb);
  sb.toastReg = function () {}; sb.renderCarrito = function () {}; sb.alert = function () {}; sb.navigator = {};
  sb.cafeAplicar(sb.CAFE_RAPIDO[3].sel);
  sb.cafeSetMetodo('tm5');
  sb.cafeGuardar();
  t('guardado en state.recetasBuilder con tipo cafe y método tm5', sb.state.recetasBuilder && sb.state.recetasBuilder.length === 1 && sb.state.recetasBuilder[0].tipo === 'cafe' && sb.state.recetasBuilder[0].sel.metodo === 'tm5' && sb.state.recetasBuilder[0].k === 211);
  const st = JSON.parse(JSON.stringify(sb.state));
  sb.cafeAplicar({});
  sb.cafeSetMetodo('normal');
  sb.cafeRepetir(st.recetasBuilder[0].id);
  t('Preparar otra vez restaura el mocha y el MÉTODO tm5', sb.cafeTotales().k === st.recetasBuilder[0].k && sb._cafeSel().metodo === 'tm5');
})();

console.log('== 7 · Copiar/Compartir y lista de compras ==');
(function () {
  const sb = makeSandbox();
  sb.window = sb; sb.window._carrito = []; sb.ppUUID = vm.runInNewContext('(' + extractFunc('ppUUID') + ')', sb);
  sb.toastReg = function () {}; sb.renderCarrito = function () {}; sb.alert = function () {}; sb.navigator = { clipboard: { writeText(t) { sb._copiado = t; } } };
  sb.cafeAplicar(sb.CAFE_RAPIDO[1].sel);
  const tN = sb.cafeTextoPrep('normal', false);
  t('copiar normal: nombre + método ☕ + ingredientes + info + pasos', /Método: ☕ Normal/.test(tN) && /Ingredientes:/.test(tN) && /kcal/.test(tN) && /Preparación:/.test(tN) && /1\./.test(tN));
  const tT = sb.cafeTextoPrep('tm5', false);
  t('copiar tm5: método 🤖 + pasos Thermomix', /Método: 🤖 Thermomix/.test(tT) && /vel 2/.test(tT) && !/\bolla\b/.test(tT));
  sb.cafeCopiar();
  t('cafeCopiar escribe el texto del método actual', sb._copiado && sb._copiado.indexOf('Método: ☕ Normal') >= 0);
  sb.cafeALista();
  const nombres = sb.window._carrito.map(c => c.name);
  t('lista: café molido, leche y azúcar sí', nombres.some(n => /Café molido/.test(n)) && nombres.some(n => /Leche entera/.test(n)) && nombres.some(n => /Azúcar/.test(n)), nombres.join(','));
  const antes = sb.window._carrito.map(c => c.cant);
  sb.cafeALista();
  t('segunda pasada suma cantidades sin duplicar filas', sb.window._carrito.length === antes.length && sb.window._carrito.every((c, i) => c.cant === antes[i] * 2), sb.window._carrito.map(c => c.name + '×' + c.cant).join(','));
})();

console.log('\n===== RESULTADO: ' + pasadas + ' PASS / ' + falladas + ' FAIL =====');
if (falladas) process.exit(1);
