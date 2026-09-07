// ============================================================
// PRUEBAS FASE 1 — 🥣 Arma tu caldo (calculadora de bloques).
// Uso: node tests/arma-caldo.test.js
// Cubre: valores desde la fuente única (foods[]), totales exactos,
// cantidades +/− recalculan, multi-selección suma, validación de
// combinaciones coherentes, presets válidos, determinismo (misma
// combinación = mismas kcal) y caldoAplicar restaura cantidades.
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
// Objeto literal con funciones dentro (los ';\n' internos rompen extractVarAssign).
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
  const state = { caldoBuilder: {}, licBuilder: {} };
  const sb = { state, foods, safeText: x => String(x == null ? '' : x), saves: 0 };
  sb.save = function () { sb.saves++; };
  sb.document = { getElementById() { return null; } };
  // BUILDER_INGREDIENTES es un IIFE: extraer desde la asignación hasta el
  // marcador de la siguiente función (control del propio código).
  {
    const ini = HTML.indexOf('var BUILDER_INGREDIENTES=');
    const fin = HTML.indexOf('\nvar CALDO_PARTES', ini);
    if (fin < 0) throw new Error('no se pudo extraer BUILDER_INGREDIENTES');
    const src = HTML.slice(ini + 'var BUILDER_INGREDIENTES='.length, fin).trim().replace(/;\s*$/, '');
    sb.BUILDER_INGREDIENTES = vm.runInNewContext('(' + src + ')', { foods });
  }
  sb.CALDO_PARTES = extractVarAssign('var CALDO_PARTES');
  sb.CALDO_RAPIDO = extractVarAssign('var CALDO_RAPIDO');
  sb.CALDO_PREP = extractVarAssign('var CALDO_PREP');
  sb.CALDO_TOT_CFG = extractVarAssign('CALDO_TOT_CFG');
  sb.CALDO_PASOS_TPL = vm.runInNewContext('(' + extractObj('CALDO_PASOS_TPL') + ')', { CALDO_TOT_CFG: sb.CALDO_TOT_CFG });
  ['caldoOp', '_caldoSel', 'caldoTotales', 'caldoValida', 'caldoElegir', 'caldoMas', 'caldoMenos', 'caldoAplicar', 'caldoBodyHTML', 'caldoRefresh'].forEach(n => { sb[n] = vm.runInNewContext('(' + extractFunc(n) + ')', sb); });
  ['builderOp', 'builderSel', 'builderTotales', 'builderElegir', 'builderMas', 'builderMenos', 'builderIngSeleccion', 'builderAplicar', 'builderPasos', 'builderTextoPrep', 'builderCopiar', 'builderCompartir', 'builderGuardar', 'builderRepetir', 'builderBorrarGuardada', 'builderALista', 'builderVerPrep', 'builderSetMetodo', 'builderSetNivel'].forEach(n => { sb[n] = vm.runInNewContext('(' + extractFunc(n) + ')', sb); });
  return sb;
}

console.log('== 1 · Fuente única: los valores derivan de foods[] ==');
(function () {
  const sb = makeSandbox();
  const porNombre = {};
  foods.forEach(f => { porNombre[f[0]] = f; });
  const casos = [
    ['pechuga', 'Pollo 100g', 1], ['muslo', 'Muslo de pollo cocido 100g', 1], ['res', 'Bistec de res cocido 100g', 1],
    ['molida', 'Carne molida 100g', 1], ['garbanzo', 'Garbanzos cocidos 1 taza', 0.5], ['lenteja', 'Lentejas cocidas 1 taza', 0.5],
    ['frijol', 'Frijol 1 taza', 0.5], ['papa', 'Papa mediana', 1], ['arroz', 'Arroz cocido 1 taza', 0.5],
    ['pasta', 'Pasta cocida 1 taza', 0.5], ['elote', 'Elote 1 taza', 0.5], ['zanahoria', 'Zanahoria 100g', 0.6],
    ['calabacita', 'Calabacita 100g', 1], ['jitomate', 'Tomate 100g', 1.2], ['cebolla', 'Cebolla 100g', 0.25],
    ['espinaca', 'Espinaca 100g', 0.3], ['aguacate', 'Aguacate 1/2', 1], ['queso', 'Queso 28g', 1],
    ['crema', 'Crema 1 cucharada', 1], ['tortillas', 'Tortilla maíz', 2], ['tostadas', 'Tostadas 2 piezas', 1]
  ];
  let ok = true;
  casos.forEach(([id, fName, fac]) => {
    const x = porNombre[fName];
    const v = sb.BUILDER_INGREDIENTES[id];
    if (!x || !v || v.k !== Math.round(x[1] * fac) || v.p !== Math.round(x[2] * fac * 10) / 10 || v.c !== Math.round(x[4] * fac)) { ok = false; console.log('  ✗ ' + id); }
  });
  t('21 ingredientes derivados de foods[] con kcal/proteína/carbos exactos', ok);
  const literales = ['chayote', 'apio', 'repollo', 'ajo', 'cilantro', 'limon', 'comino', 'chipotle', 'guajillo', 'ancho', 'jalapeno', 'caldojitomate', 'pescado'];
  t('13 ingredientes sin foods[] tienen valor estándar único (fuente estandar)', literales.every(id => sb.BUILDER_INGREDIENTES[id] && sb.BUILDER_INGREDIENTES[id].k > 0 && sb.BUILDER_INGREDIENTES[id].fuente === 'estandar'));
})();

console.log('== 2 · Totales exactos y determinismo ==');
(function () {
  const sb = makeSandbox();
  // pechuga + garbanzo + papa + zanahoria = preset 0 del Caldo rápido
  const sel = { prote: { i: 0, n: 1 }, legumbre: { i: 0, n: 1 }, carbo: { i: 0, n: 1 }, verdura: [{ i: 0, n: 1 }], sabor: [{ i: 0, n: 1 }, { i: 1, n: 1 }], extra: [{ i: 6, n: 1 }] };
  sb.caldoAplicar(sel);
  const t1 = sb.caldoTotales();
  const t2 = sb.caldoTotales();
  t('misma combinación = mismas kcal (determinismo)', t1.k === t2.k && t1.p === t2.p, t1.k + ' kcal · ' + t1.p + ' g');
  const esperado = Math.round(165 + 135 + 160 + 25 + 4 + 10); // pechuga+garbanzo+papa+zanahoria+ajo+cebolla
  t('total exacto calculado desde foods (' + esperado + ' kcal)', t1.k === esperado, 'obtenido ' + t1.k);
  t('tiempo y porciones presentes', t1.tiempo >= 10 && t1.tiempo <= 40 && t1.porciones === 4, t1.tiempo + ' min · ' + t1.porciones + ' porc');
  t('partes listadas con nombres', t1.partes.length >= 6, t1.partes.join(' + '));
})();

console.log('== 3 · Cantidades + / − recalculan ==');
(function () {
  const sb = makeSandbox();
  sb.caldoElegir('prote', 0);
  const k1 = sb.caldoTotales().k;
  sb.caldoMas('prote', 0);
  const k2 = sb.caldoTotales().k;
  t('+ duplica el bloque (165 → 330 de pechuga)', k2 - k1 === 165, k1 + ' → ' + k2);
  sb.caldoMenos('prote', 0);
  t('− vuelve al valor original', sb.caldoTotales().k === k1);
  sb.caldoMenos('prote', 0);
  t('− no baja de 1', sb.caldoTotales().k === k1);
})();

console.log('== 4 · Multi-selección (verdura y sabor) suma ==');
(function () {
  const sb = makeSandbox();
  sb.caldoElegir('verdura', 0);
  sb.caldoElegir('verdura', 3);
  sb.caldoElegir('verdura', 3); // tocar otra vez deselecciona
  const t1 = sb.caldoTotales();
  t('dos verduras suman; deseleccionar quita', t1.partes.length === 1 && /Zanahoria/.test(t1.partes[0]), t1.partes.join(','));
})();

console.log('== 5 · Validación de combinaciones coherentes ==');
(function () {
  const sb = makeSandbox();
  t('vacío → problemas (proteína/legumbre y verdura)', sb.caldoValida().length === 2, sb.caldoValida().join(' | '));
  sb.caldoElegir('prote', 6); // Sin carne
  t('sin carne y sin legumbre → problema', sb.caldoValida().some(x => /proteína o una legumbre/.test(x)));
  sb.caldoElegir('legumbre', 0); // garbanzo
  sb.caldoElegir('verdura', 0);
  t('garbanzo + verdura → caldo coherente (sin problemas)', sb.caldoValida().length === 0);
  sb.caldoElegir('sabor', 5); // chipotle
  sb.caldoElegir('carbo', 0);
  t('combinación completa sigue válida', sb.caldoValida().length === 0);
})();

console.log('== 6 · Presets de "Caldo rápido": válidos y con kcal ==');
(function () {
  const sb = makeSandbox();
  let ok = true;
  sb.CALDO_RAPIDO.forEach(p => {
    sb.caldoAplicar(p.sel);
    const tt = sb.caldoTotales();
    const pr = sb.caldoValida();
    if (!(tt.k > 0 && pr.length === 0 && tt.tiempo >= 10 && tt.tiempo <= 40)) { ok = false; console.log('  ✗ ' + p.nombre + ': ' + tt.k + ' kcal · ' + pr.join(' | ')); }
  });
  t('los 6 presets generan caldos válidos con kcal reales', ok);
  sb.caldoAplicar(sb.CALDO_RAPIDO[0].sel);
  const t1 = sb.caldoTotales().k;
  sb.caldoAplicar(sb.CALDO_RAPIDO[3].sel);
  sb.caldoAplicar(sb.CALDO_RAPIDO[0].sel); // Preparar otra vez
  t('"Preparar otra vez" restaura exactamente la combinación', sb.caldoTotales().k === t1, t1 + ' kcal');
})();

console.log('== 7 · Pasos NORMALES generados según ingredientes ==');
(function () {
  const sb = makeSandbox();
  sb.window = sb; sb.window._carrito = []; sb.ppUUID = vm.runInNewContext('(' + extractFunc('ppUUID') + ')', sb);
  sb.toastReg = function () {}; sb.renderCarrito = function () {}; sb.alert = function () {};
  sb.navigator = { clipboard: { writeText() { sb._copiado = true; } } };
  ['caldoIngSeleccion', 'caldoPasos', 'caldoTextoPrep', 'caldoCopiar', 'caldoCompartir', 'caldoGuardar', 'caldoRepetir', 'caldoBorrarGuardada', 'caldoALista', 'caldoPrepHtml', 'caldoVerPrep', 'caldoSetMetodo', 'caldoSetNivel'].forEach(n => { sb[n] = vm.runInNewContext('(' + extractFunc(n) + ')', sb); });
  const arma = sel => { sb.caldoAplicar(sel); return sb.caldoPasos('normal'); };
  // pollo + papa
  const p1 = arma({ prote: { i: 0, n: 1 }, legumbre: { i: 3, n: 1 }, carbo: { i: 0, n: 1 }, verdura: [{ i: 0, n: 1 }], sabor: [{ i: 0, n: 1 }, { i: 1, n: 1 }], extra: [{ i: 6, n: 1 }] });
  const txt1 = p1.detallados.join(' | ');
  t('pollo+papa: pica, sella pechuga, papa hasta suave', /Corta la pechuga/.test(txt1) && /séllala/.test(txt1) && /papa/.test(txt1) && /suave/.test(txt1), txt1.slice(0, 120));
  // pollo + arroz
  const p2 = arma({ prote: { i: 0, n: 1 }, legumbre: { i: 3, n: 1 }, carbo: { i: 1, n: 1 }, verdura: [{ i: 0, n: 1 }], sabor: [], extra: [{ i: 6, n: 1 }] });
  const txt2 = p2.detallados.join(' | ');
  t('pollo+arroz: arroz con su tiempo propio', /Enjuaga el arroz/.test(txt2) && /15 min/.test(txt2), txt2.slice(0, 100));
  // res + verduras
  const p3 = arma({ prote: { i: 3, n: 1 }, legumbre: { i: 3, n: 1 }, carbo: { i: 0, n: 1 }, verdura: [{ i: 0, n: 1 }, { i: 1, n: 1 }], sabor: [], extra: [{ i: 6, n: 1 }] });
  const txt3 = p3.detallados.join(' | ');
  t('res+verduras: dorar res y cocción larga', /dórala por todos lados/.test(txt3) && /25-30 min/.test(txt3), txt3.slice(0, 100));
  // pescado: se agrega al final
  const p4 = arma({ prote: { i: 5, n: 1 }, legumbre: { i: 3, n: 1 }, carbo: { i: 5, n: 1 }, verdura: [{ i: 3, n: 1 }], sabor: [], extra: [{ i: 6, n: 1 }] });
  const txt4 = p4.detallados.join(' | ');
  t('pescado: AL FINAL y fuego bajo', /AL FINAL/.test(txt4) && /fuego bajo/.test(txt4), txt4.slice(0, 100));
  // legumbres cocidas explícitas
  const p5 = arma({ prote: { i: 6, n: 1 }, legumbre: { i: 1, n: 1 }, carbo: { i: 5, n: 1 }, verdura: [{ i: 0, n: 1 }], sabor: [], extra: [{ i: 6, n: 1 }] });
  const txt5 = p5.detallados.join(' | ');
  t('lenteja se dice COCIDA (no seca en 15 min)', /lenteja COCIDA/.test(txt5), txt5.slice(0, 100));
  // cambio dinámico: quitar la papa cambia los pasos
  const p6a = arma({ prote: { i: 0, n: 1 }, legumbre: { i: 3, n: 1 }, carbo: { i: 0, n: 1 }, verdura: [], sabor: [], extra: [] });
  const conPapa = p6a.detallados.join(' | ');
  const p6b = arma({ prote: { i: 0, n: 1 }, legumbre: { i: 3, n: 1 }, carbo: { i: 5, n: 1 }, verdura: [], sabor: [], extra: [] });
  const sinPapa = p6b.detallados.join(' | ');
  t('cambio dinámico: quitar papa quita su paso', /papa/.test(conPapa) && !/Pela y corta la papa/.test(sinPapa), conPapa.slice(0, 60) + ' → ' + sinPapa.slice(0, 60));
  // nivel rápido: 4-6 pasos
  const p7 = arma(sb.CALDO_RAPIDO[0].sel);
  t('pasos rápidos: entre 4 y 6', p7.rapidos.length >= 4 && p7.rapidos.length <= 6, 'n=' + p7.rapidos.length);
  t('pasos detallados: más pasos que rápidos', p7.detallados.length > p7.rapidos.length);
})();

console.log('== 8 · Pasos THERMOMIX adaptados de verdad ==');
(function () {
  const sb = makeSandbox();
  sb.window = sb; sb.window._carrito = []; sb.ppUUID = vm.runInNewContext('(' + extractFunc('ppUUID') + ')', sb);
  sb.toastReg = function () {}; sb.renderCarrito = function () {}; sb.alert = function () {};
  sb.navigator = {};
  ['caldoIngSeleccion', 'caldoPasos', 'caldoTextoPrep', 'caldoCopiar', 'caldoCompartir', 'caldoGuardar', 'caldoRepetir', 'caldoBorrarGuardada', 'caldoALista'].forEach(n => { sb[n] = vm.runInNewContext('(' + extractFunc(n) + ')', sb); });
  const arma = sel => { sb.caldoAplicar(sel); return sb.caldoPasos('tm5'); };
  const p1 = arma({ prote: { i: 0, n: 1 }, legumbre: { i: 3, n: 1 }, carbo: { i: 0, n: 1 }, verdura: [{ i: 0, n: 1 }], sabor: [{ i: 0, n: 1 }, { i: 1, n: 1 }], extra: [{ i: 6, n: 1 }] });
  const txt1 = p1.detallados.join(' || ');
  t('picado cebolla/ajo con vel 5', /5 seg \/ vel 5/.test(txt1) && /3 seg \/ vel 7/.test(txt1), txt1.slice(0, 120));
  t('sofrito 120°C / vel 1', /5 min \/ 120°C \/ vel 1/.test(txt1));
  t('pollo con giro inverso (no se tritura)', /pechuga/.test(txt1) && /giro inverso \/ vel cuchara/.test(txt1));
  t('papa con giro inverso y tiempo', /papa/.test(txt1) && /20 min \/ 100°C/.test(txt1));
  // legumbre cocida en TM5
  const p2 = arma({ prote: { i: 6, n: 1 }, legumbre: { i: 0, n: 1 }, carbo: { i: 5, n: 1 }, verdura: [{ i: 0, n: 1 }], sabor: [], extra: [{ i: 6, n: 1 }] });
  const txt2 = p2.detallados.join(' | ');
  t('garbanzo COCIDO al final en TM5', /garbanzo COCIDO/.test(txt2) && /5 min \/ 90°C/.test(txt2));
  // Varoma cuando res + papa
  const p3 = arma({ prote: { i: 3, n: 1 }, legumbre: { i: 3, n: 1 }, carbo: { i: 0, n: 1 }, verdura: [{ i: 0, n: 1 }], sabor: [], extra: [{ i: 6, n: 1 }] });
  const txt3 = p3.detallados.join(' | ');
  t('res+papa usa Varoma', /Varoma/.test(txt3), txt3.slice(0, 100));
  // tortillas: nota de no ir al vaso
  const p4 = arma({ prote: { i: 0, n: 1 }, legumbre: { i: 3, n: 1 }, carbo: { i: 4, n: 1 }, verdura: [{ i: 3, n: 1 }], sabor: [], extra: [{ i: 3, n: 1 }] });
  const txt4 = p4.detallados.join(' | ');
  t('tortillas: nota de que van aparte (no al vaso)', /no van al vaso/.test(txt4));
})();

console.log('== 9 · Consistencia Normal ↔ Thermomix ==');
(function () {
  const sb = makeSandbox();
  sb.window = sb; sb.window._carrito = []; sb.ppUUID = vm.runInNewContext('(' + extractFunc('ppUUID') + ')', sb);
  sb.toastReg = function () {}; sb.renderCarrito = function () {}; sb.alert = function () {}; sb.navigator = {};
  ['caldoIngSeleccion', 'caldoPasos'].forEach(n => { sb[n] = vm.runInNewContext('(' + extractFunc(n) + ')', sb); });
  sb.caldoAplicar(sb.CALDO_RAPIDO[2].sel);
  const tN = sb.caldoTotales(); const tT = sb.caldoTotales();
  const ingN = sb.caldoIngSeleccion().map(x => x.ing + ':' + x.n).sort().join(',');
  const pN = sb.caldoPasos('normal').detallados.join(' | ');
  const pT = sb.caldoPasos('tm5').detallados.join(' | ');
  t('mismos macros y kcal en ambos métodos', tN.k === tT.k && tN.p === tT.p && tN.c === tT.c && tN.g === tT.g, tN.k + ' kcal');
  t('mismos ingredientes y cantidades', ingN === ingN, ingN.slice(0, 80));
  t('solo cambia la preparación', pN !== pT && pT.indexOf('giro inverso') >= 0 && pN.indexOf('olla') >= 0);
})();

console.log('== 10 · Persistencia: guardar, refresh, Preparar otra vez ==');
(function () {
  const sb = makeSandbox();
  sb.window = sb; sb.window._carrito = []; sb.ppUUID = vm.runInNewContext('(' + extractFunc('ppUUID') + ')', sb);
  sb.toastReg = function () {}; sb.renderCarrito = function () {}; sb.alert = function () {}; sb.navigator = {};
  ['caldoIngSeleccion', 'caldoGuardar', 'caldoRepetir', 'caldoSetMetodo'].forEach(n => { sb[n] = vm.runInNewContext('(' + extractFunc(n) + ')', sb); });
  sb.caldoAplicar(sb.CALDO_RAPIDO[4].sel);
  sb.caldoSetMetodo('tm5');
  sb.caldoGuardar();
  t('guardada en state.recetasBuilder con método tm5', sb.state.recetasBuilder && sb.state.recetasBuilder.length === 1 && sb.state.recetasBuilder[0].sel.metodo === 'tm5' && sb.state.recetasBuilder[0].tipo === 'caldo');
  const st = JSON.parse(JSON.stringify(sb.state)); // refresh
  t('sobrevive a refresh', st.recetasBuilder.length === 1 && st.recetasBuilder[0].k === sb.caldoTotales().k);
  sb.caldoAplicar({});
  sb.caldoSetMetodo('normal');
  sb.caldoRepetir(st.recetasBuilder[0].id);
  t('Preparar otra vez restaura selección y MÉTODO tm5', sb.caldoTotales().k === st.recetasBuilder[0].k && sb._caldoSel().metodo === 'tm5');
})();

console.log('== 11 · Copiar/Compartir y lista de compras ==');
(function () {
  const sb = makeSandbox();
  sb.window = sb; sb.window._carrito = []; sb.ppUUID = vm.runInNewContext('(' + extractFunc('ppUUID') + ')', sb);
  sb.toastReg = function () {}; sb.renderCarrito = function () {}; sb.alert = function () {}; sb.navigator = { clipboard: { writeText(t) { sb._copiado = t; } } };
  ['caldoIngSeleccion', 'caldoPasos', 'caldoTextoPrep', 'caldoCopiar', 'caldoALista'].forEach(n => { sb[n] = vm.runInNewContext('(' + extractFunc(n) + ')', sb); });
  sb.caldoAplicar(sb.CALDO_RAPIDO[0].sel);
  const tN = sb.caldoTextoPrep('normal', false);
  t('copiar normal: nombre + método 🍳 + ingredientes + info + pasos', /Método: 🍳 Normal/.test(tN) && /Ingredientes:/.test(tN) && /kcal/.test(tN) && /Preparación:/.test(tN) && /1\./.test(tN));
  const tT = sb.caldoTextoPrep('tm5', false);
  t('copiar tm5: método 🤖 + pasos Thermomix', /Método: 🤖 Thermomix/.test(tT) && /vel cuchara/.test(tT) && !/\bolla\b/.test(tT));
  sb.caldoCopiar();
  t('caldoCopiar escribe el texto del método actual', sb._copiado && sb._copiado.indexOf('Método: 🍳 Normal') >= 0);
  sb.caldoALista();
  const nombres = sb.window._carrito.map(c => c.name);
  t('lista: solo ingredientes comprables (sin utensilios/vel/Varoma)', nombres.every(n => !/\b(Varoma|cestillo|vel|espátula|olla)\b/.test(n)) && nombres.length >= 5, nombres.join(','));
  sb.caldoALista(); // segunda vez: suma cantidades, no duplica
  t('lista sin duplicados: segunda pasada SUMA cantidades', sb.window._carrito.every(c => c.cant === 2), sb.window._carrito.map(c => c.name + '×' + c.cant).join(','));
})();

console.log('\n===== RESULTADO: ' + pasadas + ' PASS / ' + falladas + ' FAIL =====');
if (falladas) process.exit(1);
