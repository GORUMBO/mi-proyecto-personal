// ============================================================
// PRUEBAS de las ETIQUETAS SEMÁNTICAS de Potenciar (por rol real).
// Uso: node tests/potenciar-etiquetas.test.js
// Cubre: snack denso (con equivalencia oz→g), proteína sólida sin
// "poco volumen", aceite/grasa nunca "Listo para comer", toppings,
// bebidas con etiqueta de bebida, alimentos que requieren
// preparación, y barrido exhaustivo de todos los extras registrados.
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
  const sb = {
    safeText: x => String(x == null ? '' : x),
    foods: new Function('const foods=' + HTML.match(/const foods=(\[[\s\S]*?\]);/)[1] + ';' + HTML.match(/foods\.push\(([\s\S]*?)\n\);/g).map(s => s.slice(0, -1) + ';').join('') + 'return foods;')(),
    CALORIAS_FACILES_FAMILIA: extractVarAssign('var CALORIAS_FACILES_FAMILIA'),
    BEBIDA_FUNCION: extractVarAssign('var BEBIDA_FUNCION'),
    COMPLETAR_ALIMENTO: extractVarAssign('var COMPLETAR_ALIMENTO'),
    POTENCIAR_MICRO: extractVarAssign('var POTENCIAR_MICRO')
  };
  ['completarNorm', 'caloriasFacilesDe', 'bebidaFuncionesDe', 'potenciarEquivOz', 'potenciarRequierePrep', 'potenciarRazon', 'potenciarFacilidad'].forEach(n => { sb[n] = vm.runInNewContext('(' + extractFunc(n) + ')', sb); });
  return sb;
}
function variante(sb, nombreBase, extra) {
  const f = sb.foods.find(x => x[0] === nombreBase);
  const base = {
    nombre: extra.nombre || nombreBase,
    nombreBase: nombreBase,
    kcal: extra.kcal != null ? extra.kcal : (f ? f[1] : 200),
    p: extra.p != null ? extra.p : (f ? f[2] : 10),
    c: f ? f[4] : 0,
    g: f ? f[3] : 0,
    factor: extra.factor || 1,
    volumen: extra.volumen || 'Poco',
    tipo: 'alimento',
    tiempo: extra.tiempo || 0,
    metodo: extra.metodo || '',
    isMicro: !!extra.isMicro
  };
  return base;
}

console.log('== 1 · Snack denso (totopos/frutos secos) con equivalencia oz→g ==');
(function () {
  const sb = makeSandbox();
  const tot2 = variante(sb, 'Totopos 1 oz', { nombre: 'Totopos 2 oz', kcal: 280, p: 4, factor: 2 });
  const e2 = sb.potenciarRazon('v', false, tot2, {});
  t('Totopos 2 oz → "Snack denso en calorías · 2 oz ≈ 57 g"', e2.icono === '🥜' && e2.texto === 'Snack denso en calorías · 2 oz ≈ 57 g', e2.icono + e2.texto);
  t('Totopos 2 oz ya no dice "Sube calorías con poco volumen"', !/poco volumen/.test(e2.texto));
  const f2 = sb.potenciarFacilidad(tot2);
  t('Totopos 2 oz: Listo para comer (botana sí lo está)', f2 && f2.texto === 'Listo para comer', f2 && f2.texto);
  const alm = variante(sb, 'Almendras 28g', { p: 6, isMicro: true });
  const eA = sb.potenciarRazon('v', false, alm, {});
  t('Almendras 28g → "Snack denso en calorías" (unidad g, sin equivalencia inventada)', eA.texto === 'Snack denso en calorías', eA.texto);
  const eq14 = sb.potenciarEquivOz('Totopos 1/2 oz');
  const eqSin = sb.potenciarEquivOz('Almendras 28g');
  t('equivalencia: 1/2 oz ≈ 14 g', eq14 === ' · 1/2 oz ≈ 14 g', eq14);
  t('equivalencia: sin oz no hay texto', eqSin === '');
})();

console.log('== 2 · Proteína sólida: jamás "poco volumen" ==');
(function () {
  const sb = makeSandbox();
  const pavo2 = variante(sb, 'Pavo cocido 100g', { nombre: 'Pavo cocido 200g', kcal: 270, p: 34, factor: 2 });
  const e = sb.potenciarRazon('v', false, pavo2, {});
  t('Pavo cocido 200g → "Alto en proteína"', e.icono === '💪' && /Alto en proteína/.test(e.texto), e.icono + e.texto);
  t('Pavo cocido 200g NO dice poco volumen', !/poco volumen/.test(e.texto));
  const fP = sb.potenciarFacilidad(pavo2);
  t('Pavo cocido 200g: Listo para comer (ya está cocido)', fP && fP.texto === 'Listo para comer', fP && fP.texto);
  const pavo1 = variante(sb, 'Pavo cocido 100g', { kcal: 135, p: 17, isMicro: true });
  const e1 = sb.potenciarRazon('p', false, pavo1, {});
  t('Pavo 100g (micro) → "Proteína + calorías"', e1.texto === 'Proteína + calorías', e1.texto);
  const jamon2 = variante(sb, 'Jamón 100g', { nombre: 'Jamón 200g', kcal: 290, p: 42, factor: 2 });
  const eJ = sb.potenciarRazon('v', false, jamon2, {});
  t('Jamón 200g → "Alto en proteína" (sin poco volumen)', /Alto en proteína/.test(eJ.texto) && !/poco volumen/.test(eJ.texto), eJ.texto);
})();

console.log('== 3 · Aceite/grasa: extra para agregar, nunca Listo para comer ==');
(function () {
  const sb = makeSandbox();
  const aceite = variante(sb, 'Aceite oliva 1 cucharada', { nombre: 'Aceite oliva 2 cucharadas', kcal: 238, p: 0, factor: 2, isMicro: true });
  const e = sb.potenciarRazon('v', false, aceite, {});
  t('Aceite oliva 2 cdas → "Extra para agregar a comidas"', e.icono === '🥄' && e.texto === 'Extra para agregar a comidas', e.icono + e.texto);
  const fA = sb.potenciarFacilidad(aceite);
  t('Aceite: facilidad "Muy poco volumen" (jamás Listo para comer)', fA && fA.texto === 'Muy poco volumen', fA && fA.texto);
  ['Mantequilla 1 cucharada', 'Mayonesa 1 cucharada'].forEach(n => {
    const o = variante(sb, n, { p: 0, isMicro: true });
    const e2 = sb.potenciarRazon('v', false, o, {});
    const f2 = sb.potenciarFacilidad(o);
    t(n + ' → "Extra para agregar a comidas" + "Muy poco volumen"', e2.texto === 'Extra para agregar a comidas' && f2 && f2.texto === 'Muy poco volumen', e2.texto + ' | ' + (f2 && f2.texto));
  });
})();

console.log('== 4 · Toppings y aderezos ==');
(function () {
  const sb = makeSandbox();
  const miel = variante(sb, 'Miel 1 cucharada', { kcal: 64, p: 0, isMicro: true });
  const e = sb.potenciarRazon('kcal', false, miel, {});
  const f = sb.potenciarFacilidad(miel);
  t('Miel → "Extra para agregar a comidas" + "Muy poco volumen"', e.texto === 'Extra para agregar a comidas' && f && f.texto === 'Muy poco volumen', e.texto + ' | ' + (f && f.texto));
  const whey = variante(sb, 'Proteína whey 1 scoop', { kcal: 120, p: 24, isMicro: true });
  const eW = sb.potenciarRazon('p', false, whey, {});
  t('Whey (topping pero proteína) → "Proteína + calorías"', eW.texto === 'Proteína + calorías', eW.texto);
})();

console.log('== 5 · Bebidas: etiqueta de bebida, nunca de sólido ==');
(function () {
  const sb = makeSandbox();
  const leche = variante(sb, 'Leche entera taza', { kcal: 149, p: 8, isMicro: true });
  const e = sb.potenciarRazon('kcal', false, leche, {});
  t('Leche entera → "Bebida con energía y proteína"', e.texto === 'Bebida con energía y proteína', e.texto);
  const f = sb.potenciarFacilidad(leche);
  t('Leche entera → "Lista para beber" (no Listo para comer)', f && f.texto === 'Lista para beber', f && f.texto);
  const alm = variante(sb, 'Leche almendra sin azúcar 1 taza', { kcal: 30, p: 1, isMicro: true });
  const eA = sb.potenciarRazon('kcal', false, alm, {});
  t('Leche de almendra → "Bebida hidratante"', eA.texto === 'Bebida hidratante', eA.texto);
  const yb = variante(sb, 'Yogurt bebible proteína', { kcal: 170, p: 20, isMicro: true });
  const eY = sb.potenciarRazon('kcal', false, yb, {});
  t('Yogurt bebible → "Bebida con energía y proteína"', eY.texto === 'Bebida con energía y proteína', eY.texto);
})();

console.log('== 6 · Requiere preparación: nunca Listo para comer ==');
(function () {
  const sb = makeSandbox();
  const frutaC = variante(sb, 'Fruta congelada 1 taza', { kcal: 80, p: 1, isMicro: true });
  const fF = sb.potenciarFacilidad(frutaC);
  t('Fruta congelada → "Requiere preparación o licuado"', fF && fF.texto === 'Requiere preparación o licuado', fF && fF.texto);
  const avena = variante(sb, 'Avena 1/2 taza', { kcal: 156, p: 7, isMicro: true });
  const fA = sb.potenciarFacilidad(avena);
  t('Avena seca → "Requiere preparación o licuado"', fA && fA.texto === 'Requiere preparación o licuado', fA && fA.texto);
})();

console.log('== 7 · Barrido exhaustivo de TODOS los extras registrados ==');
(function () {
  const sb = makeSandbox();
  const registrados = {};
  Object.keys(sb.COMPLETAR_ALIMENTO).forEach(n => { registrados[n] = 1; });
  Object.keys(sb.POTENCIAR_MICRO).forEach(n => { registrados[n] = 1; });
  const nombres = Object.keys(registrados);
  const fallas = [];
  nombres.forEach(n => {
    const fam = sb.caloriasFacilesDe(n);
    const o = variante(sb, n, { isMicro: false, p: 20 });
    const e = sb.potenciarRazon('v', false, o, {});
    const f = sb.potenciarFacilidad(o);
    // grasas/toppings: etiqueta de extra y jamás "Listo para comer"
    if (fam.funcion === 'soloPlato' || fam.funcion === 'topping') {
      if (e.texto !== 'Extra para agregar a comidas') fallas.push(n + ' → etiqueta ' + e.texto);
      if (f && f.texto === 'Listo para comer') fallas.push(n + ' → ¡Listo para comer!');
    }
    // bebidas con función: etiqueta de bebida
    if (fam.funcion === 'bebida' && sb.bebidaFuncionesDe(n).length && !/^Bebida/.test(e.texto)) fallas.push(n + ' → ' + e.texto);
    if (fam.funcion === 'bebida' && f && f.texto !== 'Lista para beber' && f.texto !== 'Muy poco volumen') fallas.push(n + ' → facilidad ' + f.texto);
    // proteína sólida: jamás "poco volumen"
    if (fam.familia === 'proteina' && /poco volumen/.test(e.texto)) fallas.push(n + ' → poco volumen en proteína');
    // snack denso: etiqueta de snack
    if ((fam.familia === 'snacksSalados' || fam.familia === 'frutosSecos') && !/^Snack denso/.test(e.texto)) fallas.push(n + ' → ' + e.texto);
    // congelados/crudos/avena: jamás "Listo para comer"
    if (/congelad|crud/.test(sb.completarNorm(n)) && f && f.texto === 'Listo para comer') fallas.push(n + ' → ¡Listo para comer (congelado)!');
  });
  t('barrido de ' + nombres.length + ' extras registrados sin violaciones de rol', fallas.length === 0, fallas.slice(0, 6).join(' | '));
})();

console.log('\n===== RESULTADO: ' + pasadas + ' PASS / ' + falladas + ' FAIL =====');
if (falladas) process.exit(1);
