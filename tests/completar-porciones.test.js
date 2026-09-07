// ============================================================
// PRUEBAS de la PORCIÓN REAL en "Completar mi día" + Potenciar.
// Uso: node tests/completar-porciones.test.js
// Cubre: alimento en gramos / pieza / taza / cucharada, combo
// multi-componente, cantidad visual = cantidad registrada,
// kcal visuales = kcal registradas, sin equivalencias inventadas,
// sin textos ambiguos "P 4g" / "Vol Poco" / "Vol Normal" en UI.
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
  const state = {
    profile: { objetivo: 'ganar peso', proteina: 180, carbos: 400, grasa: 100, llenado: 'normal' },
    diary: {}, recipeFavorites: [], recetasRecientes: [], evitar: ['lacteos']
  };
  const guardados = [];
  const win = { _completarMostradas: [], _completarPropuestas: null, _completarPotBase: null, _completarExtrasVistas: [], _completarPotExtras: null };
  const panels = {};
  const panelFor = id => { if (!panels[id]) panels[id] = { innerHTML: '', scrollTop: 0, remove() {} }; return panels[id]; };
  const doc = {
    getElementById(id) { return (id === 'completarPanel' || id === 'completarPotPanel') ? panelFor(id) : null; },
    createElement() { return { style: {} }; },
    body: { appendChild() {} }
  };
  const sb = {
    state, window: win, document: doc, safeText: x => String(x == null ? '' : x),
    foods: vm.runInNewContext(HTML.match(/const foods=(\[[\s\S]*?\]);/)[1]),
    EVITAR_COMUNES: extractVarAssign('var EVITAR_COMUNES'),
    baseRecipes: [
      { id: 'r1', name: 'Chilaquiles con huevo', k: 520, p: 28, carbs: 0, grasas: 0, time: 15, method: 'estufa', type: 'desayuno', tags: 'mexicana clásica', ingredients: 'huevo, tortillas, salsa' },
      { id: 'r2', name: 'Espagueti a la crema con pollo', k: 470, p: 24, carbs: 55, grasas: 17, time: 25, method: 'estufa', type: 'pasta', tags: 'pasta crema proteina', ingredients: 'pasta, pollo, crema, leche, queso' },
      { id: 'r3', name: 'Receta roja demo', k: 500, p: 20, carbs: 0, grasas: 0, time: 10, method: 'estufa', type: 'comida', tags: '', ingredients: 'x' }
    ],
    recetaAuditar(r) { return r.name === 'Receta roja demo' ? { score: '🔴', problemas: [{ tipo: 'preparacion-asumida' }] } : { score: '🟢', problemas: [] }; },
    getDailyMode() { return { kcalGoal: 3000, missingKcal: 900, missingProtein: 100, food: { k: 2100, p: 80 } }; },
    getTodayDiaryTotals() { return { k: 2100, p: 80, c: 200, f: 60 }; },
    todayISO() { return '2026-09-04'; },
    _guardarComida(name, kcal, prot, carb, fat, momento) {
      guardados.push({ name, kcal, prot, carb, fat, momento });
      const d = state.diary['2026-09-04'] = state.diary['2026-09-04'] || { breakfast: [], lunch: [], dinner: [], snacks: [] };
      d[momento].push({ name, kcal, prot, carb, fat });
    },
    abrirReceta() {}, save() {}, quickSaved() {}, toastReg() {}, refrescarInicio() {},
    mealKeyLabel(k) { return ({ breakfast: 'desayuno', lunch: 'comida', dinner: 'cena', snacks: 'snack' })[k] || 'comida'; },
    completarFranja() { return 'noche'; }
  };
  ['COMPLETAR_PESOS', 'COMPLETAR_LIMITES', 'COMPLETAR_FRANJAS', 'COMPLETAR_ALIMENTO', 'COMPLETAR_PLATOS',
    'COMPLETAR_VOLUMEN_TIPO', 'COMPLETAR_VOLUMEN_ALIMENTO', 'COMPLETAR_PUNTOS_VOL',
    'COMPLETAR_UNIDAD_TEXTO', 'COMPLETAR_UNIDAD_CONDE', 'COMPLETAR_EQUIV_CASERA', 'COMPLETAR_GENERICOS',
    'POTENCIAR_PESOS', 'POTENCIAR_UNIDAD_ESCALABLE', 'POTENCIAR_MICRO',
    'BEBIDA_BASE', 'BEBIDA_VARIANTE', 'BEBIDA_LIMITES', 'COMPLETAR_COMBOS_FACILES', 'CALORIAS_FACILES_FAMILIA', 'RECETA_AUXILIAR', 'RECETA_AUXILIAR_TIPO', 'RECETA_COCCION', 'RECETA_RECALENTABLE'].forEach(n => { sb[n] = extractVarAssign('var ' + n); });
  ['completarNorm', 'completarSinAcentos', 'completarVolumen', 'completarDensidad', 'completarKcalMomento', 'completarCatalogo',
    'completarCandidatos', 'completarScore', 'completarVolMax', 'completarSuma', 'completarProponer', 'completarPotenciar', 'potenciarHayExtras', 'completarEsRapido', 'completarEsFacilParte', 'completarEsFacil', 'completarEsCandidatoFacil', 'completarEsEstructuraNatural', 'completarEtiquetaTipo', 'completarLineaMicro', 'recetaSugeridaPara', 'recetaResumenCorto', 'completarFiltrosActivos', 'completarFiltrosReset', 'completarFiltroRecetaDe', 'recetaPasaFiltros', 'recetaFaltantes', 'recetaCobertura', 'completarPalabrasAlimento', 'completarFoodsBase', 'completarBaseDe', 'completarFoodNombreDe', 'completarFibraFood', 'completarFibraReceta', 'completarFibraCandidato', 'completarFibraHoy', 'completarFiltrosUI', 'completarFiltroGet', 'completarFiltroToggle', 'completarFiltroTiempo', 'completarFiltroModoFaltante', 'completarFiltroLimpiar', 'completarFiltroTengoQuitar', 'completarFiltroTengoAgregar', 'completarFiltroTengoAgregarNombre', 'completarFiltroTengoBuscar', 'pickDiversoFacil', 'caloriasFacilesDe', 'bebidaFuncionesDe', 'completarFamiliaDe', 'completarFamiliasDe',
    'completarNombreCorto', 'completarCategoria', 'completarTituloUI',
    'completarFraccion', 'completarPorcion', 'completarVolBadge', 'completarPorcionComponente', 'completarParteTexto',
    'completarLineaPropuesta', 'completarLineaExtra',
    'potenciarFaltante', 'potenciarEscalarNombre', 'potenciarVariante', 'potenciarScore',
    'potenciarCategoria', 'potenciarRazon', 'potenciarFacilidad', 'potenciarEquivOz', 'potenciarRequierePrep', 'potenciarTextoFaltante', 'potenciarBaseHTML', 'progresoBarraHTML', 'progresoFilaHTML', 'potenciarProgresoHTML',
    'potenciarAgregados', 'potenciarResumenHTML', 'potenciarEsMicroExtra',
    'bebidaCat', 'bebidaCombinaciones', 'bebidaTitulo', 'bebidaConstruir', 'bebidaTecho',
    'bebidaOtroSabor', 'bebidaMasCalorias', 'bebidaMasLigero', 'bebidaPropuesta', 'bebidaMenuHTML',
    'completarCtxReal', 'completarMealKey', 'completarTextoTarjeta', 'completarRenderPanel', 'completarAgregar',
    'completarPotRender', 'completarPotAgregar', 'completarPotCerrar', 'completarPotOtros', 'completarCerrar'].forEach(n => { sb[n] = vm.runInNewContext('(' + extractFunc(n) + ')', sb); });
  sb.guardados = guardados;
  sb.panels = panels;
  return sb;
}
const por = (sb, nombre, eq) => sb.completarPorcion(nombre, eq);

console.log('== 1 · Alimento en gramos ==');
(function () {
  const sb = makeSandbox();
  t('Pollo 100g → "100 g"', por(sb, 'Pollo 100g').texto === '100 g', por(sb, 'Pollo 100g').texto);
  t('Queso 28g → "28 g"', por(sb, 'Queso 28g').texto === '28 g');
  t('Yogurt griego light 170g → "170 g"', por(sb, 'Yogurt griego light 170g').texto === '170 g');
  t('Carne molida 100g → "100 g"', por(sb, 'Carne molida 100g').texto === '100 g');
})();

console.log('== 2 · Alimento por pieza ==');
(function () {
  const sb = makeSandbox();
  t('Bolillo 1 pieza → "1 pieza"', por(sb, 'Bolillo 1 pieza').texto === '1 pieza', por(sb, 'Bolillo 1 pieza').texto);
  t('Waffles congelados 2 piezas → "2 piezas"', por(sb, 'Waffles congelados 2 piezas').texto === '2 piezas');
  t('Manzana 1 pieza → "1 pieza"', por(sb, 'Manzana 1 pieza').texto === '1 pieza');
  t('Tostadas 2 piezas → "2 piezas"', por(sb, 'Tostadas 2 piezas').texto === '2 piezas');
})();

console.log('== 3 · Alimento por taza ==');
(function () {
  const sb = makeSandbox();
  t('Arroz cocido 1 taza → "1 taza de arroz cocido"', por(sb, 'Arroz cocido 1 taza').texto === '1 taza de arroz cocido', por(sb, 'Arroz cocido 1 taza').texto);
  t('Leche entera taza → "1 taza de leche entera"', por(sb, 'Leche entera taza').texto === '1 taza de leche entera');
  t('Avena 1/2 taza → "½ taza de avena"', por(sb, 'Avena 1/2 taza').texto === '½ taza de avena');
  t('Frijol 1 taza → "1 taza de frijol"', por(sb, 'Frijol 1 taza').texto === '1 taza de frijol');
  t('Salsa 1/2 taza → "½ taza de salsa"', por(sb, 'Salsa 1/2 taza').texto === '½ taza de salsa');
})();

console.log('== 4 · Alimento por cucharada ==');
(function () {
  const sb = makeSandbox();
  t('Crema cacahuate cda → "1 cucharada de crema cacahuate"', por(sb, 'Crema cacahuate cda').texto === '1 cucharada de crema cacahuate', por(sb, 'Crema cacahuate cda').texto);
  t('Nutella 2 cucharadas → "2 cucharadas de nutella"', por(sb, 'Nutella 2 cucharadas').texto === '2 cucharadas de nutella');
  t('Miel 1 cucharada → "1 cucharada de miel"', por(sb, 'Miel 1 cucharada').texto === '1 cucharada de miel');
  t('Mantequilla 1 cucharada → "1 cucharada de mantequilla"', por(sb, 'Mantequilla 1 cucharada').texto === '1 cucharada de mantequilla');
})();

console.log('== 5 · Unidad natural, fracción, tamaño y genérico ==');
(function () {
  const sb = makeSandbox();
  t('Plátano → "1 plátano"', por(sb, 'Plátano').texto === '1 plátano');
  t('Aguacate 1/2 → "½ aguacate"', por(sb, 'Aguacate 1/2').texto === '½ aguacate');
  t('Tortilla maíz → "1 tortilla"', por(sb, 'Tortilla maíz').texto === '1 tortilla');
  t('Huevo → "1 huevo"', por(sb, 'Huevo').texto === '1 huevo');
  t('Papa mediana → "1 papa mediana"', por(sb, 'Papa mediana').texto === '1 papa mediana');
  t('Atún lata → "1 lata de atún"', por(sb, 'Atún lata').texto === '1 lata de atún');
  t('Comida congelada pollo/arroz → "1 porción" (sin inventar "1 comida")', por(sb, 'Comida congelada pollo/arroz').texto === '1 porción');
  t('Pizza congelada 1/4 → "¼ pizza congelada"', por(sb, 'Pizza congelada 1/4').texto === '¼ pizza congelada');
})();

console.log('== 6 · Combo multi-componente con cantidad de cada parte ==');
(function () {
  const sb = makeSandbox();
  const ctx = sb.completarCtxReal();
  const props = sb.completarProponer(ctx);
  const combo = props.find(p => p.componentes.length > 1 && p.componentes.every(c => c.tipo === 'alimento')) || props.find(p => p.componentes.length > 1);
  t('hay un combo multi-componente en las propuestas', !!combo, combo ? combo.titulo : 'ninguno');
  if (combo) {
    const linea = sb.completarLineaPropuesta(combo);
    combo.componentes.forEach(c => {
      const parte = sb.completarNombreCorto(c.nombre) + ': ' + sb.completarParteTexto(c);
      t('línea muestra "' + parte + '"', linea.includes(parte), linea);
    });
    t('línea del combo lleva kcal + proteína', linea.includes(Math.round(combo.kcal) + ' kcal') && linea.includes(Math.round(combo.p) + ' g proteína'));
  }
})();

console.log('== 7 · Cantidad visual = cantidad registrada ==');
(function () {
  const sb = makeSandbox();
  const ctx = sb.completarCtxReal();
  const props = sb.completarProponer(ctx);
  sb.window._completarPropuestas = props;
  sb.completarRenderPanel();
  const html = sb.panels.completarPanel.innerHTML;
  const combo = props.find(p => p.componentes.length > 1) || props[0];
  const idx = props.indexOf(combo);
  sb.completarAgregar(idx);
  t('se guardó algo real', sb.guardados.length === combo.componentes.length, sb.guardados.length + ' guardados');
  combo.componentes.forEach((c, i) => {
    const g = sb.guardados[i];
    t('diario registra el nombre EXACTO del componente "' + c.nombre + '"', g && g.name === c.nombre, g ? g.name : '?');
    // Misma regla de porción aplicada a lo mostrado y a lo registrado
    // (recetas = "1 porción"; alimentos = medida del nombre del catálogo).
    const visual = sb.completarParteTexto(c);
    const registrada = sb.completarParteTexto({ nombre: g.name, tipo: c.tipo, porcion: null });
    t('la porción visual "' + visual + '" ES la porción registrada', visual === registrada, registrada);
    t('la tarjeta muestra la porción "' + visual + '" (o la separación Receta/Acompañamiento)', html.includes(visual) || html.includes('Receta:</b> ' + c.nombre) || html.includes('Acompañamiento:</b> ' + c.nombre));
  });
})();

console.log('== 8 · Kcal visuales = kcal registradas (propuestas y extras) ==');
(function () {
  const sb = makeSandbox();
  const ctx = sb.completarCtxReal();
  const props = sb.completarProponer(ctx);
  sb.window._completarPropuestas = props;
  sb.completarRenderPanel();
  const html = sb.panels.completarPanel.innerHTML;
  const combo = props.find(p => p.componentes.length > 1) || props[0];
  const idx = props.indexOf(combo);
  t('tarjeta muestra las kcal de la propuesta', html.includes(combo.kcal + ' kcal'), combo.kcal + ' kcal');
  sb.completarAgregar(idx);
  const suma = Math.round(sb.guardados.reduce((a, g) => a + g.kcal, 0));
  t('kcal registradas = kcal mostradas en la tarjeta', suma === combo.kcal, suma + ' vs ' + combo.kcal);
  // Extras de Potenciar
  sb.window._completarPotBase = combo;
  sb.completarPotRender();
  const potHtml = sb.panels.completarPotPanel.innerHTML;
  const extras = sb.window._completarPotExtras || [];
  t('hay extras para potenciar', extras.length >= 1, extras.length + ' extras');
  if (extras.length) {
    const x = extras[0];
    t('tarjeta de extra muestra "+N kcal" con signo +', potHtml.includes('+' + Math.round(x.kcal) + ' kcal'), '+' + Math.round(x.kcal) + ' kcal');
    sb.completarPotAgregar(0);
    const g = sb.guardados[sb.guardados.length - 1];
    t('extra registrado con nombre y kcal EXACTOS de la tarjeta', g.name === x.nombre && Math.round(g.kcal) === Math.round(x.kcal), g.name + ' · ' + g.kcal + ' kcal');
    const visual = (x.porcion ? x.porcion.texto : sb.completarPorcion(x.nombre).texto).replace(/\s+de\s+[^·]*$/, '');
    t('extra: porción visual = porción registrada', sb.completarPorcion(g.name).texto.replace(/\s+de\s+[^·]*$/, '') === visual && potHtml.includes(visual), visual);
  }
})();

console.log('== 9 · Sin equivalencias inventadas ==');
(function () {
  const sb = makeSandbox();
  let inventadas = [];
  sb.foods.forEach(f => { const p = por(sb, f[0]); if (p.casera || p.texto.includes('aprox.')) inventadas.push(f[0]); });
  t('ningún alimento real muestra equivalencia inventada', inventadas.length === 0, inventadas.join(' | ') || '0 inventadas');
  t('sin medida → "1 porción" o unidad natural, nunca vacío', sb.foods.every(f => por(sb, f[0]).texto.length > 0));
  // El mecanismo SOLO aparece cuando hay dato real verificado
  t('con dato real verificable SÍ se muestra', por(sb, 'Pollo 100g', '¾ taza').casera === '¾ taza');
  const linea = sb.completarLineaExtra({ nombre: 'Pollo 100g', kcal: 165, p: 31, porcion: por(sb, 'Pollo 100g', '¾ taza') });
  t('línea del extra usa "aprox." solo con dato real', linea.includes('100 g · aprox. ¾ taza · +165 kcal'), linea);
  const cat = sb.completarCatalogo({ catalogo: { recetas: [], alimentos: [{ id: 'f9', nombre: 'Pollo 100g', kcal: 165, p: 31, g: 4, c: 0, equivalencia: '¾ taza' }] }, restricciones: [] });
  t('equivalencia fluye por el catálogo', cat[0].porcion.casera === '¾ taza');
  sb.window._completarPropuestas = sb.completarProponer(sb.completarCtxReal());
  sb.completarRenderPanel();
  const UI = sb.panels.completarPanel.innerHTML;
  t('UI sin "aprox." con el catálogo real', !UI.includes('aprox.'));
})();

console.log('== 10 · Sin textos ambiguos P/Vol en la UI ==');
(function () {
  const sb = makeSandbox();
  const ctx = sb.completarCtxReal();
  const props = sb.completarProponer(ctx);
  sb.window._completarPropuestas = props;
  sb.completarRenderPanel();
  const html = sb.panels.completarPanel.innerHTML;
  t('sin "P 4g" ni "P N g"', !/\bP \d/.test(html));
  t('sin "Vol Poco" ni "Vol Normal"', !/Vol Poco|Vol Normal/.test(html));
  t('sin "Volumen: "', !/Volumen:/.test(html));
  t('usa "g proteína" completo', /g proteína/.test(html));
  t('badge de volumen con emoji (🥤 o 🍽)', /🥤 Poco volumen|🍽 Volumen normal/.test(html));
  t('completarVolBadge Poco → 🥤', sb.completarVolBadge('Poco') === '🥤 Poco volumen');
  t('completarVolBadge Normal → 🍽', sb.completarVolBadge('Normal') === '🍽 Volumen normal');
  t('completarVolBadge Medio → 🍽 (no "Vol Medio" crudo)', sb.completarVolBadge('Medio') === '🍽 Volumen normal');
  const combo = props.find(p => p.componentes.length > 1) || props[0];
  sb.window._completarPotBase = combo;
  sb.completarPotRender();
  const potHtml = sb.panels.completarPotPanel.innerHTML;
  t('Potenciar sin "P 4g" ni "Vol" crudos', !/\bP \d/.test(potHtml) && !/Vol Poco|Vol Normal|Volumen:/.test(potHtml));
  t('Potenciar usa "g proteína"', /g proteína/.test(potHtml));
  t('Potenciar muestra razón principal (⭐/💪/🍚/🥤/⚡)', /⭐ Mejor ajuste para lo que te falta|💪 Te falta proteína|🍚 Te faltan carbohidratos|🥤 Sube calorías con poco volumen|⚡ Rápido de agregar/.test(potHtml));
  t('Potenciar muestra facilidad real (🥡/🔥/⚡)', /🥡 Listo para comer|🔥 Recalentar|⚡ \d+ min/.test(potHtml));
  t('orden de la tarjeta: título → porción·kcal → razón → facilidad → botón', /<b[^>]*>[^<]*<\/b>[\s\S]*?g proteína[\s\S]*?(⭐|💪|🍚|🥤|⚡)[\s\S]*?🥡[\s\S]*?＋ Agregar extra/.test(potHtml));
})();

console.log('\n===== RESULTADO: ' + pasadas + ' PASS / ' + falladas + ' FAIL =====');
if (falladas) process.exit(1);
