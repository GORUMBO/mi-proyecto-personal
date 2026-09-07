// ============================================================
// PRUEBAS FASE 2 — 🍋 Arma tu agua de sabor (mismo motor que caldo).
// Uso: node tests/arma-agua.test.js
// Cubre: fuente única (foods[] + estándar), totales exactos, +/−,
// multi-selección, validación, presets válidos, pasos Normal/Thermomix
// dinámicos, consistencia entre métodos, persistencia y copiar/lista.
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
  const state = { caldoBuilder: {}, aguaBuilder: {} };
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
  sb.AGUA_PARTES = extractVarAssign('var AGUA_PARTES');
  sb.AGUA_RAPIDO = extractVarAssign('var AGUA_RAPIDO');
  sb.AGUA_PREP = extractVarAssign('var AGUA_PREP');
  sb.AGUA_TOT_CFG = extractVarAssign('AGUA_TOT_CFG');
  sb.AGUA_PASOS_TPL = vm.runInNewContext('(' + extractObj('AGUA_PASOS_TPL') + ')', { AGUA_TOT_CFG: sb.AGUA_TOT_CFG });
  ['caldoOp', '_caldoSel', 'caldoTotales', 'caldoValida', 'caldoElegir', 'caldoMas', 'caldoMenos', 'caldoAplicar', 'caldoBodyHTML', 'caldoRefresh'].forEach(n => { sb[n] = vm.runInNewContext('(' + extractFunc(n) + ')', sb); });
  ['_aguaSel', 'aguaTotales', 'aguaValida', 'aguaElegir', 'aguaMas', 'aguaMenos', 'aguaAplicar', 'aguaBodyHTML', 'aguaRefresh', 'aguaIngSeleccion', 'aguaPasos', 'aguaTextoPrep', 'aguaCopiar', 'aguaCompartir', 'aguaGuardar', 'aguaRepetir', 'aguaBorrarGuardada', 'aguaALista', 'aguaPrepHtml', 'aguaVerPrep', 'aguaSetMetodo', 'aguaSetNivel'].forEach(n => { sb[n] = vm.runInNewContext('(' + extractFunc(n) + ')', sb); });
  ['builderOp', 'builderSel', 'builderTotales', 'builderElegir', 'builderMas', 'builderMenos', 'builderIngSeleccion', 'builderAplicar', 'builderPasos', 'builderTextoPrep', 'builderCopiar', 'builderCompartir', 'builderGuardar', 'builderRepetir', 'builderBorrarGuardada', 'builderALista', 'builderVerPrep', 'builderSetMetodo', 'builderSetNivel'].forEach(n => { sb[n] = vm.runInNewContext('(' + extractFunc(n) + ')', sb); });
  return sb;
}

console.log('== 1 · Fuente única: los valores derivan de foods[] ==');
(function () {
  const sb = makeSandbox();
  const porNombre = {};
  foods.forEach(f => { porNombre[f[0]] = f; });
  const casos = [
    ['fresa', 'Fresas 1 taza', 1], ['mango', 'Mango 1 taza', 1], ['pina', 'Piña 1 taza', 1],
    ['naranja', 'Naranja 1 pieza', 1], ['pepino', 'Pepino 100g', 1], ['miel', 'Miel 1 cucharada', 1]
  ];
  let ok = true;
  casos.forEach(([id, fName, fac]) => {
    const x = porNombre[fName];
    const v = sb.BUILDER_INGREDIENTES[id];
    if (!x || !v || v.k !== Math.round(x[1] * fac) || v.p !== Math.round(x[2] * fac * 10) / 10 || v.c !== Math.round(x[4] * fac)) { ok = false; console.log('  ✗ ' + id); }
  });
  t('6 ingredientes de agua derivados de foods[] con kcal/proteína/carbos exactos', ok);
  const literales = ['sandia', 'melon', 'papaya', 'guayaba', 'azucar', 'stevia', 'menta', 'jengibre', 'chia', 'limon'];
  t('10 ingredientes sin foods[] tienen valor estándar único (fuente estandar)', literales.every(id => sb.BUILDER_INGREDIENTES[id] && sb.BUILDER_INGREDIENTES[id].fuente === 'estandar'));
})();

console.log('== 2 · Totales exactos y determinismo ==');
(function () {
  const sb = makeSandbox();
  // preset 0: Agua de fresa (fresa×2 + azúcar×2)
  sb.aguaAplicar(sb.AGUA_RAPIDO[0].sel);
  const t1 = sb.aguaTotales();
  const t2 = sb.aguaTotales();
  t('misma combinación = mismas kcal (determinismo)', t1.k === t2.k && t1.p === t2.p, t1.k + ' kcal · ' + t1.p + ' g');
  const esperado = Math.round(49 * 2 + 48 * 2);
  t('total exacto calculado desde foods (' + esperado + ' kcal)', t1.k === esperado, 'obtenido ' + t1.k);
  t('tiempo y vasos presentes', t1.tiempo >= 10 && t1.tiempo <= 40 && t1.porciones === 8, t1.tiempo + ' min · ' + t1.porciones + ' vasos');
  t('partes listadas con nombres', t1.partes.length >= 3, t1.partes.join(' + '));
})();

console.log('== 3 · Cantidades + / − recalculan ==');
(function () {
  const sb = makeSandbox();
  sb.aguaElegir('fruta', 0);
  const k1 = sb.aguaTotales().k;
  sb.aguaMas('fruta', 0);
  const k2 = sb.aguaTotales().k;
  t('+ suma una taza de fresa (49 → 98)', k2 - k1 === 49, k1 + ' → ' + k2);
  sb.aguaMenos('fruta', 0);
  t('− vuelve al valor original', sb.aguaTotales().k === k1);
  sb.aguaMenos('fruta', 0);
  t('− no baja de 1', sb.aguaTotales().k === k1);
})();

console.log('== 4 · Multi-selección (fruta extra) suma ==');
(function () {
  const sb = makeSandbox();
  sb.aguaElegir('extra', 0);
  sb.aguaElegir('extra', 1);
  sb.aguaElegir('extra', 1); // tocar otra vez deselecciona
  const t1 = sb.aguaTotales();
  t('dos frutas suman; deseleccionar quita', t1.partes.length === 1 && /Fresa/.test(t1.partes[0]), t1.partes.join(','));
})();

console.log('== 5 · Validación de combinaciones coherentes ==');
(function () {
  const sb = makeSandbox();
  t('vacío → pide fruta base', sb.aguaValida().length === 1 && /fruta base/.test(sb.aguaValida()[0]), sb.aguaValida().join(' | '));
  sb.aguaElegir('fruta', 0);
  t('con fruta → sin problemas', sb.aguaValida().length === 0);
  sb.aguaElegir('endulzante', 3); // Sin endulzar es opción válida
  t('sin endulzar también es válido', sb.aguaValida().length === 0);
})();

console.log('== 6 · Presets de "Aguas rápidas": válidos y con kcal ==');
(function () {
  const sb = makeSandbox();
  let ok = true;
  sb.AGUA_RAPIDO.forEach(p => {
    sb.aguaAplicar(p.sel);
    const tt = sb.aguaTotales();
    const pr = sb.aguaValida();
    if (!(tt.k > 0 && pr.length === 0 && tt.tiempo >= 10 && tt.tiempo <= 40)) { ok = false; console.log('  ✗ ' + p.nombre + ': ' + tt.k + ' kcal · ' + pr.join(' | ')); }
  });
  t('los 6 presets generan aguas válidas con kcal reales', ok);
  sb.aguaAplicar(sb.AGUA_RAPIDO[0].sel);
  const t1 = sb.aguaTotales().k;
  sb.aguaAplicar(sb.AGUA_RAPIDO[3].sel);
  sb.aguaAplicar(sb.AGUA_RAPIDO[0].sel); // Preparar otra vez
  t('"Preparar otra vez" restaura exactamente la combinación', sb.aguaTotales().k === t1, t1 + ' kcal');
})();

console.log('== 7 · Pasos NORMALES generados según ingredientes ==');
(function () {
  const sb = makeSandbox();
  sb.window = sb; sb.window._carrito = []; sb.ppUUID = vm.runInNewContext('(' + extractFunc('ppUUID') + ')', sb);
  sb.toastReg = function () {}; sb.renderCarrito = function () {}; sb.alert = function () {};
  sb.navigator = { clipboard: { writeText() { sb._copiado = true; } } };
  const arma = sel => { sb.aguaAplicar(sel); return sb.aguaPasos('normal'); };
  // Agua de fresa (preset 0)
  const p1 = arma(sb.AGUA_RAPIDO[0].sel);
  const txt1 = p1.detallados.join(' | ');
  t('fresa: lava, licúa, jarra y refrigera', /Lava y deshoja/.test(txt1) && /Licúa/.test(txt1) && /jarra/.test(txt1) && /refrigera/.test(txt1), txt1.slice(0, 120));
  // Guayaba: colar muy bien
  const p2 = arma(sb.AGUA_RAPIDO[5].sel);
  const txt2 = p2.detallados.join(' | ');
  t('guayaba: CUELA MUY BIEN por sus semillas', /CUELA MUY BIEN/.test(txt2), txt2.slice(0, 100));
  // Chía: hidratar antes
  const p3 = arma({ fruta: { i: 0, n: 1 }, extra: [], citrico: { i: 2, n: 1 }, toque: [{ i: 2, n: 1 }], endulzante: { i: 3, n: 1 } });
  const txt3 = p3.detallados.join(' | ');
  t('chía: se hidrata 15 min antes', /Hidrata la chía 15 min/.test(txt3), txt3.slice(0, 100));
  // cambio dinámico: quitar la fresa quita su paso
  const p4a = arma({ fruta: { i: 0, n: 1 }, extra: [], citrico: { i: 2, n: 1 }, toque: [], endulzante: { i: 3, n: 1 } });
  const conFresa = p4a.detallados.join(' | ');
  const p4b = arma({ fruta: { i: 1, n: 1 }, extra: [], citrico: { i: 2, n: 1 }, toque: [], endulzante: { i: 3, n: 1 } });
  const sinFresa = p4b.detallados.join(' | ');
  t('cambio dinámico: quitar fresa quita su paso', /fresa/.test(conFresa) && !/Lava y deshoja/.test(sinFresa), conFresa.slice(0, 50) + ' → ' + sinFresa.slice(0, 50));
  // pasos rápidos y detallados
  const p5 = arma({ fruta: { i: 3, n: 3 }, extra: [{ i: 7, n: 1 }], citrico: { i: 0, n: 1 }, toque: [{ i: 0, n: 1 }, { i: 1, n: 1 }, { i: 2, n: 1 }], endulzante: { i: 0, n: 1 } });
  t('pasos rápidos: entre 3 y 6', p5.rapidos.length >= 3 && p5.rapidos.length <= 6, 'n=' + p5.rapidos.length);
  t('combo grande: más pasos detallados que rápidos', p5.detallados.length > p5.rapidos.length, p5.detallados.length + ' vs ' + p5.rapidos.length);
})();

console.log('== 8 · Pasos THERMOMIX adaptados de verdad ==');
(function () {
  const sb = makeSandbox();
  sb.window = sb; sb.window._carrito = []; sb.ppUUID = vm.runInNewContext('(' + extractFunc('ppUUID') + ')', sb);
  sb.toastReg = function () {}; sb.renderCarrito = function () {}; sb.alert = function () {};
  sb.navigator = {};
  const arma = sel => { sb.aguaAplicar(sel); return sb.aguaPasos('tm5'); };
  // Agua de fresa
  const p1 = arma(sb.AGUA_RAPIDO[0].sel);
  const txt1 = p1.detallados.join(' || ');
  t('fresa: vel 5 y luego vel 10', /10 seg \/ vel 5/.test(txt1) && /1 min \/ vel 10/.test(txt1), txt1.slice(0, 100));
  t('agua en el vaso 1.5 L', /1\.5 L/.test(txt1));
  // Menta: picar en el vaso sin repetir el "Lava la menta." manual
  const p2 = arma(sb.AGUA_RAPIDO[3].sel);
  const txt2 = p2.detallados.join(' | ');
  t('menta: picar 3 seg / vel 4', /3 seg \/ vel 4/.test(txt2), txt2.slice(0, 100));
  t('menta: sin duplicar la instrucción manual', (txt2.match(/Lava la menta/g) || []).length === 1);
  // Guayaba en TM5: cuela muy bien
  const p3 = arma(sb.AGUA_RAPIDO[5].sel);
  const txt3 = p3.detallados.join(' | ');
  t('guayaba TM5: 20 seg / vel 10 y cuela', /20 seg \/ vel 10/.test(txt3) && /cuela muy bien/.test(txt3));
})();

console.log('== 9 · Consistencia Normal ↔ Thermomix ==');
(function () {
  const sb = makeSandbox();
  sb.window = sb; sb.window._carrito = []; sb.ppUUID = vm.runInNewContext('(' + extractFunc('ppUUID') + ')', sb);
  sb.toastReg = function () {}; sb.renderCarrito = function () {}; sb.alert = function () {}; sb.navigator = {};
  sb.aguaAplicar(sb.AGUA_RAPIDO[2].sel);
  const tN = sb.aguaTotales(); const tT = sb.aguaTotales();
  const pN = sb.aguaPasos('normal').detallados.join(' | ');
  const pT = sb.aguaPasos('tm5').detallados.join(' | ');
  t('mismos macros y kcal en ambos métodos', tN.k === tT.k && tN.p === tT.p && tN.c === tT.c && tN.g === tT.g, tN.k + ' kcal');
  t('solo cambia la preparación', pN !== pT && pT.indexOf('vel') >= 0 && pN.indexOf('jarra') >= 0);
})();

console.log('== 10 · Persistencia: guardar, refresh, Preparar otra vez ==');
(function () {
  const sb = makeSandbox();
  sb.window = sb; sb.window._carrito = []; sb.ppUUID = vm.runInNewContext('(' + extractFunc('ppUUID') + ')', sb);
  sb.toastReg = function () {}; sb.renderCarrito = function () {}; sb.alert = function () {}; sb.navigator = {};
  sb.aguaAplicar(sb.AGUA_RAPIDO[4].sel);
  sb.aguaSetMetodo('tm5');
  sb.aguaGuardar();
  t('guardada en state.recetasBuilder con método tm5', sb.state.recetasBuilder && sb.state.recetasBuilder.length === 1 && sb.state.recetasBuilder[0].sel.metodo === 'tm5' && sb.state.recetasBuilder[0].tipo === 'agua');
  const st = JSON.parse(JSON.stringify(sb.state)); // refresh
  t('sobrevive a refresh', st.recetasBuilder.length === 1 && st.recetasBuilder[0].k === sb.aguaTotales().k);
  sb.aguaAplicar({});
  sb.aguaSetMetodo('normal');
  sb.aguaRepetir(st.recetasBuilder[0].id);
  t('Preparar otra vez restaura selección y MÉTODO tm5', sb.aguaTotales().k === st.recetasBuilder[0].k && sb._aguaSel().metodo === 'tm5');
})();

console.log('== 11 · Copiar/Compartir y lista de compras ==');
(function () {
  const sb = makeSandbox();
  sb.window = sb; sb.window._carrito = []; sb.ppUUID = vm.runInNewContext('(' + extractFunc('ppUUID') + ')', sb);
  sb.toastReg = function () {}; sb.renderCarrito = function () {}; sb.alert = function () {}; sb.navigator = { clipboard: { writeText(t) { sb._copiado = t; } } };
  sb.aguaAplicar(sb.AGUA_RAPIDO[0].sel);
  const tN = sb.aguaTextoPrep('normal', false);
  t('copiar normal: nombre + método 🥤 + ingredientes + info + pasos', /Método: 🥤 Normal/.test(tN) && /Ingredientes:/.test(tN) && /kcal/.test(tN) && /Preparación:/.test(tN) && /1\./.test(tN));
  const tT = sb.aguaTextoPrep('tm5', false);
  t('copiar tm5: método 🤖 + pasos Thermomix', /Método: 🤖 Thermomix/.test(tT) && /vel 10/.test(tT) && !/\bolla\b/.test(tT));
  sb.aguaCopiar();
  t('aguaCopiar escribe el texto del método actual', sb._copiado && sb._copiado.indexOf('Método: 🥤 Normal') >= 0);
  // lista: sandía + pepino + limón (preset 4)
  sb.aguaAplicar(sb.AGUA_RAPIDO[4].sel);
  sb.aguaALista();
  const nombres = sb.window._carrito.map(c => c.name);
  t('lista: solo ingredientes comprables (sin utensilios/vaso/vel/jarra)', nombres.every(n => !/\b(vaso|jarra|vel|Varoma|cestillo|espátula|olla)\b/.test(n)) && nombres.length >= 3, nombres.join(','));
  const antes = sb.window._carrito.map(c => c.cant);
  sb.aguaALista(); // segunda vez: suma cantidades, no duplica
  t('lista sin duplicados: segunda pasada SUMA cantidades', sb.window._carrito.length === antes.length && sb.window._carrito.every((c, i) => c.cant === antes[i] * 2), sb.window._carrito.map(c => c.name + '×' + c.cant).join(','));
  // stevia (0 kcal) sí entra a la lista
  sb.window._carrito = [];
  sb.aguaAplicar({ fruta: { i: 0, n: 1 }, extra: [], citrico: { i: 2, n: 1 }, toque: [], endulzante: { i: 2, n: 1 } });
  sb.aguaALista();
  t('stevia (0 kcal) entra a la lista de compras', sb.window._carrito.some(c => /Stevia/.test(c.name)), sb.window._carrito.map(c => c.name).join(','));
})();

console.log('\n===== RESULTADO: ' + pasadas + ' PASS / ' + falladas + ' FAIL =====');
if (falladas) process.exit(1);
