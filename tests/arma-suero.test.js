// ============================================================
// PRUEBAS FASE 3 — 💧 Arma tu suero natural (hidratación rápida).
// Uso: node tests/arma-suero.test.js
// Cubre: fuente única, kcal exactas por preset, validación de seguridad
// por uso, textos exactos (1 litro / 24 g / 3 g), SIN afirmaciones médicas,
// aviso de atención médica en copiar, sin modo Thermomix, lista de compras
// y persistencia.
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
  const state = { caldoBuilder: {}, aguaBuilder: {}, sueroBuilder: {} };
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
  sb.SUERO_PARTES = extractVarAssign('var SUERO_PARTES');
  sb.SUERO_RAPIDO = extractVarAssign('var SUERO_RAPIDO');
  sb.SUERO_PREP = extractVarAssign('var SUERO_PREP');
  sb.SUERO_TOT_CFG = extractVarAssign('SUERO_TOT_CFG');
  sb.SUERO_PASOS_TPL = vm.runInNewContext('(' + extractObj('SUERO_PASOS_TPL') + ')', { SUERO_TOT_CFG: sb.SUERO_TOT_CFG });
  ['_sueroSel', 'sueroTotales', 'sueroValida', 'sueroElegir', 'sueroAplicar', 'sueroIngSeleccion', 'sueroPasos', 'sueroTextoPrep', 'sueroCopiar', 'sueroCompartir', 'sueroGuardar', 'sueroRepetir', 'sueroBorrarGuardada', 'sueroALista', 'sueroBodyHTML', 'sueroPrepHtml', 'sueroVerPrep', 'sueroSetMetodo', 'sueroSetNivel', 'sueroRefresh', 'sueroGuia'].forEach(n => { sb[n] = vm.runInNewContext('(' + extractFunc(n) + ')', sb); });
  ['builderOp', 'builderSel', 'builderTotales', 'builderElegir', 'builderMas', 'builderMenos', 'builderIngSeleccion', 'builderAplicar', 'builderPasos', 'builderTextoPrep', 'builderCopiar', 'builderCompartir', 'builderGuardar', 'builderRepetir', 'builderBorrarGuardada', 'builderALista', 'builderVerPrep', 'builderSetMetodo', 'builderSetNivel'].forEach(n => { sb[n] = vm.runInNewContext('(' + extractFunc(n) + ')', sb); });
  return sb;
}

console.log('== 1 · Fuente única: sal y agua de coco ==');
(function () {
  const sb = makeSandbox();
  t('sal existe con 0 kcal (fuente estandar)', sb.BUILDER_INGREDIENTES.sal && sb.BUILDER_INGREDIENTES.sal.k === 0 && sb.BUILDER_INGREDIENTES.sal.fuente === 'estandar');
  t('agua de coco: 45 kcal · 9 carbos · 0 grasa (fuente estandar)', sb.BUILDER_INGREDIENTES.aguaCoco && sb.BUILDER_INGREDIENTES.aguaCoco.k === 45 && sb.BUILDER_INGREDIENTES.aguaCoco.c === 9 && sb.BUILDER_INGREDIENTES.aguaCoco.g === 0);
})();

console.log('== 2 · Kcal exactas por preset (fórmulas fijas) ==');
(function () {
  const sb = makeSandbox();
  const esperados = [
    ['Suero ligero (diario)', 56],
    ['Suero para calor o trabajo', 149],
    ['Suero oral casero (OMS)', 96],
    ['Agua con electrolitos (sin azúcar)', 53],
    ['Agua de limón con pizca de sal', 8],
    ['Suero de naranja', 110]
  ];
  let ok = true;
  sb.SUERO_RAPIDO.forEach((p, i) => {
    sb.sueroAplicar(p.sel);
    const tt = sb.sueroTotales();
    if (tt.k !== esperados[i][1] || tt.porciones !== 4 || tt.tiempo < 5 || tt.tiempo > 40) { ok = false; console.log('  ✗ ' + p.nombre + ': ' + tt.k + ' kcal'); }
  });
  t('los 6 presets dan las kcal exactas esperadas', ok);
  sb.sueroAplicar(sb.SUERO_RAPIDO[2].sel);
  const t2 = sb.sueroTotales();
  t('ORS: 96 kcal = 2 cdas de azúcar (24 g) en 1 litro', t2.k === 96 && /Azúcar 2 cdas \(24 g\)/.test(t2.partes.join(' | ')) && /Sal \(½ cdita = 3 g\)/.test(t2.partes.join(' | ')), t2.partes.join(' + '));
})();

console.log('== 3 · Validación de seguridad por uso ==');
(function () {
  const sb = makeSandbox();
  // Deshidratación importante: exige fórmula completa
  sb.sueroElegir('uso', 2);
  sb.sueroElegir('sal', 0); // pizca (insuficiente)
  sb.sueroElegir('azucar', 0); // 1 cda (insuficiente)
  const p1 = sb.sueroValida();
  t('importante + sal pizca + 1 cda → 2 problemas (sal y azúcar completos)', p1.length === 2 && /sal completa/.test(p1.join(' ')) && /azúcar completo/.test(p1.join(' ')), p1.join(' | '));
  sb.sueroElegir('sal', 2); // ½ cdita
  sb.sueroElegir('azucar', 1); // 2 cdas
  t('fórmula completa → sin problemas', sb.sueroValida().length === 0);
  // Calor/trabajo: al menos sal o azúcar
  sb.sueroElegir('uso', 1);
  sb.sueroElegir('sal', 3); // Sin sal
  sb.sueroElegir('azucar', 3); // Sin azúcar
  t('trabajo sin sal ni azúcar → problema', sb.sueroValida().length === 1 && /al menos sal o azúcar/.test(sb.sueroValida()[0]));
  // Cotidiana: libre
  sb.sueroElegir('uso', 0);
  t('cotidiana sin sal ni azúcar → sin problemas', sb.sueroValida().length === 0);
})();

console.log('== 4 · Textos exactos y sin absurdos ==');
(function () {
  const sb = makeSandbox();
  sb.window = sb; sb.window._carrito = []; sb.ppUUID = vm.runInNewContext('(' + extractFunc('ppUUID') + ')', sb);
  sb.toastReg = function () {}; sb.renderCarrito = function () {}; sb.alert = function () {}; sb.navigator = {};
  sb.sueroAplicar(sb.SUERO_RAPIDO[2].sel);
  const pasos = sb.sueroPasos('normal').detallados.join(' | ');
  t('pasos dicen 1 litro, disolver azúcar y sal', /1 litro/.test(pasos) && /cristales/.test(pasos) && /disuélvela/.test(pasos), pasos.slice(0, 150));
  t('resumen dice 4 vasos de 250 ml', /250 ml/.test(sb.sueroBodyHTML()));
  // Sin controles +/− (medidas fijas seguras)
  const html = sb.sueroBodyHTML();
  t('sin botones +/− en sal/azúcar (medidas fijas)', !/sueroMas\(/.test(html) && !/sueroMenos\(/.test(html));
  // Líquidos EXACTOS y sin ambigüedad (preset calor/trabajo)
  sb.sueroAplicar(sb.SUERO_RAPIDO[1].sel);
  const pasosT = sb.sueroPasos('normal').detallados.join(' | ');
  t('trabajo: 760 ml agua + 240 ml coco + 15 ml limón = 1 litro, sin "completar el litro"', /760 ml/.test(pasosT) && /240 ml/.test(pasosT) && /≈15 ml/.test(pasosT) && /= 1 litro/.test(pasosT) && !/completa con agua/.test(pasosT), pasosT.slice(0, 220));
  const tT = sb.sueroTotales();
  t('trabajo: sal en gramos clara', /⅓ cdita ≈ 2 g/.test(tT.partes.join('|')), tT.partes.join(' + '));
  t('trabajo: kcal por vaso ×4 ≈ total', Math.abs(Math.round(tT.k / tT.porciones) * 4 - tT.k) <= 2, Math.round(tT.k / tT.porciones) + '×4 vs ' + tT.k);
  t('trabajo: azúcar por vaso ×4 ≈ total', Math.abs(Math.round(tT.c / tT.porciones * 10) / 10 * 4 - tT.c) <= 1, tT.c + ' g total');
  // ORS sin coco: agua completa
  sb.sueroAplicar(sb.SUERO_RAPIDO[2].sel);
  t('ORS: 1000 ml de agua sin ambigüedad', /1000 ml/.test(sb.sueroPasos('normal').detallados.join(' ')));
})();

console.log('== 4b · Información por vaso y guías que distinguen usos ==');
(function () {
  const sb = makeSandbox();
  sb.window = sb; sb.window._carrito = [];
  sb.sueroAplicar(sb.SUERO_RAPIDO[1].sel); // calor o trabajo: 149 kcal, 24 g azúcar
  const html = sb.sueroBodyHTML();
  t('resumen muestra kcal y azúcares POR VASO', /Por vaso \(250 ml\): ~37 kcal · 9 g de azúcares/.test(html), html.match(/Por vaso[^<]*/)[0]);
  const g1 = sb.sueroGuia(1);
  t('guía trabajo aclara que NO es fórmula médica y apunta a la importante', /No es una fórmula de rehidratación médica/.test(g1) && /Deshidratación importante/.test(g1) && /atención médica/.test(g1));
  const g0 = sb.sueroGuia(0);
  t('guía cotidiana apunta a la opción importante', /Deshidratación importante/.test(g0));
  const g2 = sb.sueroGuia(2);
  t('guía importante da la fórmula OMS exacta', /6 cucharaditas rasas de azúcar/.test(g2) && /½ cucharadita de sal \(3 g\)/.test(g2));
})();

console.log('== 5 · Sin afirmaciones médicas; aviso presente ==');
(function () {
  const sb = makeSandbox();
  const prohibidas = ['cura', 'remedio', 'medicamento', 'alivia', 'tratamiento', 'previene'];
  const g0 = sb.sueroGuia(0), g1 = sb.sueroGuia(1), g2 = sb.sueroGuia(2);
  t('guías sin afirmaciones médicas', prohibidas.every(w => !new RegExp(w, 'i').test(g0 + ' ' + g1 + ' ' + g2)), 'revisadas: ' + prohibidas.join(','));
  t('guía importante menciona la medida OMS y atención médica', /OMS/.test(g2) && /atención médica/.test(g2));
  sb.window = sb; sb.window._carrito = []; sb.ppUUID = vm.runInNewContext('(' + extractFunc('ppUUID') + ')', sb);
  sb.toastReg = function () {}; sb.renderCarrito = function () {}; sb.alert = function () {}; sb.navigator = { clipboard: { writeText(t) { sb._copiado = t; } } };
  sb.sueroAplicar(sb.SUERO_RAPIDO[2].sel);
  sb.sueroCopiar();
  t('el texto copiado incluye el aviso de atención médica', sb._copiado && /atención médica/.test(sb._copiado));
})();

console.log('== 6 · Sin Thermomix (no aporta a un suero) ==');
(function () {
  const sb = makeSandbox();
  sb.window = sb; sb.window._carrito = [];
  sb.sueroAplicar(sb.SUERO_RAPIDO[2].sel);
  sb._sueroSel().verPrep = true;
  const html = sb.sueroPrepHtml();
  t('preparación sin botón Thermomix', !/🤖 Thermomix/.test(html) && !/sueroSetMetodo/.test(html));
  t('los pasos son los normales', /1 litro/.test(sb.sueroPasos('normal').detallados.join(' ')));
})();

console.log('== 7 · Lista de compras ==');
(function () {
  const sb = makeSandbox();
  sb.window = sb; sb.window._carrito = []; sb.ppUUID = vm.runInNewContext('(' + extractFunc('ppUUID') + ')', sb);
  sb.toastReg = function () {}; sb.renderCarrito = function () {}; sb.alert = function () {}; sb.navigator = {};
  sb.sueroAplicar(sb.SUERO_RAPIDO[2].sel);
  sb.sueroALista();
  const nombres = sb.window._carrito.map(c => c.name);
  t('lista: sal y azúcar sí; agua no (no se compra)', nombres.some(n => /Sal/.test(n)) && nombres.some(n => /Azúcar/.test(n)) && !nombres.some(n => /Agua/.test(n)), nombres.join(','));
  sb.sueroALista();
  t('segunda pasada suma cantidades sin duplicar filas', sb.window._carrito.length === 2 && sb.window._carrito.every(c => c.cant === 2), sb.window._carrito.map(c => c.name + '×' + c.cant).join(','));
})();

console.log('== 8 · Persistencia: guardar y Preparar otra vez ==');
(function () {
  const sb = makeSandbox();
  sb.window = sb; sb.window._carrito = []; sb.ppUUID = vm.runInNewContext('(' + extractFunc('ppUUID') + ')', sb);
  sb.toastReg = function () {}; sb.renderCarrito = function () {}; sb.alert = function () {}; sb.navigator = {};
  sb.sueroAplicar(sb.SUERO_RAPIDO[1].sel);
  sb.sueroGuardar();
  t('guardado en state.recetasBuilder con tipo suero', sb.state.recetasBuilder && sb.state.recetasBuilder.length === 1 && sb.state.recetasBuilder[0].tipo === 'suero' && sb.state.recetasBuilder[0].k === 149);
  const st = JSON.parse(JSON.stringify(sb.state));
  sb.sueroAplicar({});
  sb.sueroRepetir(st.recetasBuilder[0].id);
  t('Preparar otra vez restaura la fórmula exacta', sb.sueroTotales().k === st.recetasBuilder[0].k, sb.sueroTotales().k + ' kcal');
})();

console.log('== 9 · Copiar con método y aviso ==');
(function () {
  const sb = makeSandbox();
  sb.window = sb; sb.window._carrito = []; sb.ppUUID = vm.runInNewContext('(' + extractFunc('ppUUID') + ')', sb);
  sb.toastReg = function () {}; sb.renderCarrito = function () {}; sb.alert = function () {}; sb.navigator = { clipboard: { writeText(t) { sb._copiado = t; } } };
  sb.sueroAplicar(sb.SUERO_RAPIDO[0].sel);
  const txt = sb.sueroTextoPrep('normal', false);
  t('copiar: nombre + método 💧 + ingredientes + info + pasos + aviso', /Método: 💧 Normal/.test(txt) && /Ingredientes:/.test(txt) && /kcal/.test(txt) && /Preparación:/.test(txt) && /1\./.test(txt) && /atención médica/.test(txt));
  sb.sueroCopiar();
  t('sueroCopiar escribe el texto', sb._copiado && sb._copiado.indexOf('Método: 💧 Normal') >= 0);
})();

console.log('\n===== RESULTADO: ' + pasadas + ' PASS / ' + falladas + ' FAIL =====');
if (falladas) process.exit(1);
