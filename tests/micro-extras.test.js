// ============================================================
// PRUEBAS de micro-extras (⚡ Extra fácil) en Potenciar.
// Uso: node tests/micro-extras.test.js
// Cubre: cucharada, portable/0-min, aceite solo con plato, miel/granola
// no en salado, trabajo prioriza micro, Me lleno rápido garantiza micro,
// porciones/kcal registradas exactas, no repetir, encadenado, coherencia.
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
    profile: { objetivo: 'ganar peso', proteina: 180, carbos: 400, grasa: 100, llenado: 'rapido' },
    diary: {}, recipeFavorites: [], recetasRecientes: [], evitar: []
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
    // catálogo COMPLETO (109 alimentos): micro-extras como granola/miel/aceite
    // viven en los bloques foods.push, no en el arreglo inicial.
    foods: new Function('const foods=' + HTML.match(/const foods=(\[[\s\S]*?\]);/)[1] + ';' + HTML.match(/foods\.push\(([\s\S]*?)\n\);/g).map(s => s.slice(0, -1) + ';').join('') + 'return foods;')(),
    EVITAR_COMUNES: extractVarAssign('var EVITAR_COMUNES'),
    baseRecipes: [
      { id: 'r1', name: 'Chilaquiles con huevo', k: 520, p: 28, carbs: 0, grasas: 0, time: 15, method: 'estufa', type: 'desayuno', tags: 'mexicana clásica', ingredients: 'huevo, tortillas, salsa' },
      { id: 'r2', name: 'Espagueti a la crema con pollo', k: 470, p: 24, carbs: 55, grasas: 17, time: 25, method: 'estufa', type: 'pasta', tags: 'pasta crema proteina', ingredients: 'pasta, pollo, crema, leche, queso' },
      { id: 'r3', name: 'Cena: ensalada de atún', k: 300, p: 30, carbs: 0, grasas: 0, time: 8, method: 'frío', type: 'cena', tags: 'cena ligera proteína', ingredients: 'atún, ensalada' }
    ],
    recetaAuditar(r) { return { score: '🟢', problemas: [] }; },
    getTodayDiaryTotals() {
      const d = state.diary['2026-09-04'] || {};
      const items = [].concat(d.breakfast || [], d.lunch || [], d.dinner || [], d.snacks || []);
      return items.reduce((a, x) => (a.k += +x.kcal || 0, a.p += +x.prot || 0, a.c += +x.carb || 0, a.f += +x.fat || 0, a), { k: 0, p: 0, c: 0, f: 0 });
    },
    getDailyMode() {
      const food = sb.getTodayDiaryTotals();
      return { kcalGoal: 3000, proteinGoal: 180, missingKcal: Math.max(0, 3000 - food.k), missingProtein: Math.max(0, 180 - food.p), food };
    },
    todayISO() { return '2026-09-04'; },
    _guardarComida(name, kcal, prot, carb, fat, momento, src) {
      guardados.push({ name, kcal, prot, carb, fat, momento, src });
      const d = state.diary['2026-09-04'] = state.diary['2026-09-04'] || { breakfast: [], lunch: [], dinner: [], snacks: [] };
      const e = { name, kcal, prot, carb, fat };
      if (src) e.src = src;
      d[momento].push(e);
    },
    abrirReceta() {}, save() {}, quickSaved() {}, refrescarInicio() {},
    toastReg(txt) { sb.toasts.push(txt); },
    mealKeyLabel(k) { return ({ breakfast: 'desayuno', lunch: 'comida', dinner: 'cena', snacks: 'snack' })[k] || 'comida'; },
    completarFranja() { return 'noche'; }
  };
  ['COMPLETAR_PESOS', 'COMPLETAR_LIMITES', 'COMPLETAR_FRANJAS', 'COMPLETAR_ALIMENTO', 'COMPLETAR_PLATOS',
    'COMPLETAR_VOLUMEN_TIPO', 'COMPLETAR_VOLUMEN_ALIMENTO', 'COMPLETAR_PUNTOS_VOL',
    'COMPLETAR_UNIDAD_TEXTO', 'COMPLETAR_UNIDAD_CONDE', 'COMPLETAR_EQUIV_CASERA', 'COMPLETAR_GENERICOS',
    'POTENCIAR_PESOS', 'POTENCIAR_UNIDAD_ESCALABLE', 'POTENCIAR_MICRO',
    'BEBIDA_BASE', 'BEBIDA_VARIANTE', 'BEBIDA_LIMITES', 'COMPLETAR_COMBOS_FACILES', 'CALORIAS_FACILES_FAMILIA', 'RECETA_AUXILIAR', 'RECETA_AUXILIAR_TIPO', 'RECETA_COCCION', 'RECETA_RECALENTABLE'].forEach(n => { sb[n] = extractVarAssign('var ' + n); });
  ['completarNorm', 'completarSinAcentos', 'completarFranja', 'completarVolumen', 'completarDensidad', 'completarKcalMomento',
    'completarCatalogo', 'completarCandidatos', 'completarScore', 'completarVolMax', 'completarSuma', 'completarProponer', 'completarEsRapido', 'completarEsFacilParte', 'completarEsFacil', 'completarEsCandidatoFacil', 'completarEsEstructuraNatural', 'completarEtiquetaTipo', 'completarLineaMicro', 'recetaSugeridaPara', 'recetaResumenCorto', 'completarFiltrosActivos', 'completarFiltrosReset', 'completarFiltroRecetaDe', 'recetaPasaFiltros', 'recetaFaltantes', 'recetaCobertura', 'completarPalabrasAlimento', 'completarFoodsBase', 'completarBaseDe', 'completarFoodNombreDe', 'completarFibraFood', 'completarFibraReceta', 'completarFibraCandidato', 'completarFibraHoy', 'completarFiltrosUI', 'completarFiltroGet', 'completarFiltroToggle', 'completarFiltroTiempo', 'completarFiltroModoFaltante', 'completarFiltroLimpiar', 'completarFiltroTengoQuitar', 'completarFiltroTengoAgregar', 'completarFiltroTengoAgregarNombre', 'completarFiltroTengoBuscar', 'pickDiversoFacil', 'caloriasFacilesDe', 'bebidaFuncionesDe', 'completarFamiliaDe', 'completarFamiliasDe',
    'completarPotenciar', 'potenciarHayExtras', 'completarNombreCorto', 'completarCategoria', 'completarTituloUI',
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
  sb.toasts = [];
  return sb;
}
function ctxBase(sb, extra) {
  return Object.assign({
    kcalObjetivo: 3000, kcalConsumidas: 0, objetivo: 'ganar', llenado: 'rapido',
    hora: 20, consumidosHoy: [], mostradas: [], restricciones: [], favoritos: [], recientes: [],
    macrosObjetivo: { p: 180, c: 400, g: 100 }, macrosConsumidos: { p: 60, c: 120, g: 40 },
    catalogo: { recetas: sb.baseRecipes.map((r, i) => ({ id: i, nombre: r.name, kcal: r.k, p: r.p || 0, c: r.carbs || 0, g: r.grasas || 0, tiempo: r.time || 0, method: r.method || '', type: r.type || '', tags: r.tags || '', ingredients: r.ingredients || '', portable: false, scoreAudit: '🟢' })), alimentos: sb.foods.map((f, i) => ({ id: 'f' + i, nombre: f[0], kcal: f[1], p: f[2], g: f[3], c: f[4] })) }
  }, extra || {});
}
const extrasDe = (sb, ctx, base) => sb.completarPotenciar(ctx, base, []);

console.log('== 1 · Micro-extra de cucharada (porción real) ==');
(function () {
  const sb = makeSandbox();
  const ctx = ctxBase(sb, {});
  const cat = sb.completarCatalogo(ctx);
  const crema = cat.find(x => x.nombre === 'Crema cacahuate cda');
  t('crema de cacahuate es micro-extra', sb.potenciarEsMicroExtra(crema));
  t('porción real: 1 cucharada', crema.porcion.texto === '1 cucharada de crema cacahuate', crema.porcion.texto);
  t('escalable a 2 cucharadas', sb.potenciarEscalarNombre('Crema cacahuate cda', 2) === 'Crema cacahuate 2 cucharadas');
  t('kcal reales del catálogo (94)', crema.kcal === 94);
  const queso = cat.find(x => x.nombre === 'Queso 28g');
  t('queso es micro-extra (28 g, 110 kcal)', sb.potenciarEsMicroExtra(queso) && queso.porcion.texto === '28 g');
})();

console.log('== 2 · Sin cocinar y portátil (0 min, alimentos reales) ==');
(function () {
  const sb = makeSandbox();
  const cat = sb.completarCatalogo(ctxBase(sb, {}));
  const micros = cat.filter(x => sb.potenciarEsMicroExtra(x));
  t('hay micros reales en el catálogo', micros.length >= 5, micros.length + ' micros');
  t('todos sin cocinar (0 min) y alimentos', micros.every(x => x.tipo === 'alimento' && (+x.tiempo || 0) === 0));
  t('todos poco volumen', micros.every(x => x.volumen === 'Poco'));
  const rapidos = ctxBase(sb, { kcalConsumidas: 2000, hora: 13 });
  const crema = { nombre: 'Crema cacahuate cda', kcal: 94, p: 4, c: 3, g: 8, volumen: 'Poco', factor: 1, tiempo: 0, isMicro: true };
  const sc = sb.potenciarScore(crema, rapidos, sb.potenciarFaltante(rapidos), 250, []);
  t('trabajo premia micro 0-min (momento)', sc.razones.some(r => /momento-pequeno/.test(r)), sc.razones.join(' · '));
})();

console.log('== 3 · Coherencia: aceite solo con plato compatible ==');
(function () {
  const sb = makeSandbox();
  const pasta = ctxBase(sb, { kcalConsumidas: 1500, macrosConsumidos: { p: 60, c: 200, g: 40 } });
  // rotar lotes hasta agotar: el aceite debe estar disponible con pasta
  let excluidos = [], pastaUnion = [], pastaVueltas = 0;
  while (pastaVueltas < 6) {
    const lote = sb.completarPotenciar(pasta, ['Espagueti a la crema con pollo'], excluidos);
    if (!lote.length) break;
    pastaUnion = pastaUnion.concat(lote.map(x => x.nombre));
    excluidos = excluidos.concat(lote.map(x => x.nombre));
    pastaVueltas++;
  }
  t('aceite de oliva disponible con pasta (en las rotaciones)', pastaUnion.some(x => /Aceite oliva/.test(x)), pastaUnion.join(' · '));
  const licuado = ctxBase(sb, { kcalConsumidas: 1500, macrosConsumidos: { p: 60, c: 200, g: 40 } });
  const rLic = extrasDe(sb, licuado, ['Leche entera taza', 'Plátano']);
  t('aceite/mantequilla/mayonesa NUNCA con base líquida', !rLic.some(x => /Aceite|Mantequilla|Mayonesa/.test(x.nombre)), rLic.map(x => x.nombre).join(' · '));
  const huevo = ctxBase(sb, { kcalConsumidas: 1500, macrosConsumidos: { p: 60, c: 200, g: 40 } });
  const rHuevo = extrasDe(sb, huevo, ['Huevo', 'Tortilla maíz']);
  t('aceite NO con huevos+tortilla (sin estructura de plato)', !rHuevo.some(x => /Aceite|Mantequilla|Mayonesa/.test(x.nombre)), rHuevo.map(x => x.nombre).join(' · '));
})();

console.log('== 4 · Miel/granola nunca con salado ==');
(function () {
  const sb = makeSandbox();
  const salado = ctxBase(sb, { kcalConsumidas: 1500, macrosConsumidos: { p: 60, c: 200, g: 40 } });
  const rSalado = extrasDe(sb, salado, ['Arroz cocido 1 taza', 'Pollo 100g']);
  t('miel y granola fuera del plato salado', !rSalado.some(x => /Miel|Granola/.test(x.nombre)), rSalado.map(x => x.nombre).join(' · '));
  const dulce = ctxBase(sb, { kcalConsumidas: 1500, macrosConsumidos: { p: 60, c: 200, g: 40 } });
  let dExcluidos = [], dulceUnion = [], dVueltas = 0;
  while (dVueltas < 6) {
    const lote = sb.completarPotenciar(dulce, ['Leche entera taza', 'Plátano'], dExcluidos);
    if (!lote.length) break;
    dulceUnion = dulceUnion.concat(lote.map(x => x.nombre));
    dExcluidos = dExcluidos.concat(lote.map(x => x.nombre));
    dVueltas++;
  }
  t('miel SÍ con base líquida/dulce (en las rotaciones)', dulceUnion.some(x => /Miel/.test(x)), dulceUnion.join(' · '));
})();

console.log('== 5 · Me lleno rápido recibe micro si existe (y no inventa) ==');
(function () {
  const sb = makeSandbox();
  const ctx = ctxBase(sb, { kcalConsumidas: 1500, llenado: 'rapido', macrosConsumidos: { p: 60, c: 200, g: 40 } });
  const r = extrasDe(sb, ctx, ['Arroz cocido 1 taza', 'Pollo 100g']);
  t('3 opciones', r.length === 3, r.map(x => x.titulo).join(' · '));
  t('al menos un ⚡ Extra fácil entre las 3', r.some(x => x.isMicro && x.etiqueta.icono === '⚡'), r.map(x => x.etiqueta.icono + x.etiqueta.texto).join(' | '));
  t('etiqueta micro: ⚡ o 💪 (proteína ≥7g)', r.filter(x => x.isMicro).every(x => (x.p >= 7 ? x.etiqueta.icono === '💪' : x.etiqueta.icono === '⚡')));
  t('sin miel/granola (contexto salado)', !r.some(x => /Miel|Granola/.test(x.nombre)));
  t('sin bebida absurda (leche)', !r.some(x => /Leche/.test(x.nombre)));
  // sin llenado rápido: la garantía no se dispara (solo scoring normal)
  const normal = ctxBase(sb, { kcalConsumidas: 1500, llenado: 'normal', macrosConsumidos: { p: 60, c: 200, g: 40 } });
  const rN = extrasDe(sb, normal, ['Arroz cocido 1 taza', 'Pollo 100g']);
  t('llenado normal: 3 opciones válidas (sin regla forzada)', rN.length === 3);
})();

console.log('== 6 · kcal/cantidad mostradas = registradas (micro) ==');
(function () {
  const sb = makeSandbox();
  const combo = { componentes: [{ tipo: 'alimento', nombre: 'Arroz cocido 1 taza' }, { tipo: 'alimento', nombre: 'Pollo 100g' }], titulo: 'Arroz cocido + Pollo' };
  sb.window._completarPotBase = combo;
  sb.completarPotRender();
  const html = sb.panels.completarPotPanel.innerHTML;
  // el micro se elige del lote RENDERIZADO (lo que el usuario ve y toca)
  const micro = (sb.window._completarPotExtras || []).find(x => x.isMicro);
  t('hay micro en el lote visible', !!micro, micro && micro.nombre);
  t('la tarjeta muestra la porción real', html.includes(micro.porcion.texto));
  t('la tarjeta muestra las kcal reales', html.includes('+' + Math.round(micro.kcal) + ' kcal'));
  const idx = (sb.window._completarPotExtras || []).indexOf(micro);
  sb.completarPotAgregar(idx);
  const g = sb.guardados[sb.guardados.length - 1];
  t('registrado con nombre y kcal EXACTOS', g && g.name === micro.nombre && g.kcal === micro.kcal, g && (g.name + ' ' + g.kcal));
  t('marcado con src=potenciar', g && g.src === 'potenciar');
  const lote2 = (sb.window._completarPotExtras || []).map(x => sb.completarNombreCorto(x.nombre));
  t('no se repite el micro agregado', !lote2.includes(sb.completarNombreCorto(micro.nombre)));
})();

console.log('== 7 · Encadenado: dos micros seguidos, faltante baja dos veces ==');
(function () {
  const sb = makeSandbox();
  const combo = { componentes: [{ tipo: 'alimento', nombre: 'Arroz cocido 1 taza' }, { tipo: 'alimento', nombre: 'Pollo 100g' }], titulo: 'Arroz cocido + Pollo' };
  sb.window._completarPotBase = combo;
  sb.completarPotRender();
  const f0 = sb.potenciarFaltante(sb.completarCtxReal()).k;
  const micro1 = (sb.window._completarPotExtras || []).find(x => x.isMicro);
  sb.completarPotAgregar((sb.window._completarPotExtras || []).indexOf(micro1));
  const f1 = sb.potenciarFaltante(sb.completarCtxReal()).k;
  t('primer micro: faltante bajó lo justo', f1 === Math.max(0, f0 - micro1.kcal), f0 + ' → ' + f1);
  const micro2 = (sb.window._completarPotExtras || []).find(x => x.isMicro);
  t('segundo micro disponible (encadenado)', !!micro2 && micro2.nombre !== micro1.nombre, micro2 && micro2.nombre);
  if (micro2) {
    sb.completarPotAgregar((sb.window._completarPotExtras || []).indexOf(micro2));
    const f2 = sb.potenciarFaltante(sb.completarCtxReal()).k;
    t('segundo micro: faltante bajó otra vez', f2 === Math.max(0, f1 - micro2.kcal), f1 + ' → ' + f2);
    t('resumen acumula 2 filas ✅', (sb.panels.completarPotPanel.innerHTML.match(/✅ /g) || []).length >= 2);
    t('sin repetir entre los dos micros', sb.completarNombreCorto(micro2.nombre) !== sb.completarNombreCorto(micro1.nombre));
  }
})();

console.log('\n===== RESULTADO: ' + pasadas + ' PASS / ' + falladas + ' FAIL =====');
if (falladas) process.exit(1);
