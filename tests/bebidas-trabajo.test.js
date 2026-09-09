// ============================================================
// PRUEBAS de la FASE J — Bebidas para trabajo/calor.
// Uso: node tests/bebidas-trabajo.test.js
// Cubre: foods nuevos con datos reales, clasificación bebida,
// funciones hidratacion/energia_calorias/electrolitos/proteina,
// 0 kcal nunca completa calorías, sin sodio/potasio inventado,
// fibra honesta (null por marca), scoring trabajo/Me lleno rápido,
// tier D las propone, filtros las respetan.
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

const FIBRA_ESTANDAR = extractVarAssign('var FIBRA_ESTANDAR');
const BEBIDA_FUNCION = extractVarAssign('var BEBIDA_FUNCION');

function makeSandbox() {
  const state = {
    profile: { objetivo: 'ganar peso', proteina: 180, carbos: 400, grasa: 100, llenado: 'normal' },
    diary: {}, recipeFavorites: [], recetasRecientes: [], evitar: []
  };
  const win = { _completarMostradas: [], _completarPropuestas: null, _completarFamiliasVistas: [], _completarModoFacil: true };
  const panels = {};
  const panelFor = id => { if (!panels[id]) panels[id] = { innerHTML: '', scrollTop: 0, remove() {} }; return panels[id]; };
  const doc = {
    getElementById(id) { return id === 'completarPanel' ? panelFor(id) : null; },
    createElement() { return { style: {} }; },
    body: { appendChild() {} }
  };
  const foodsRaw = new Function('const foods=' + HTML.match(/const foods=(\[[\s\S]*?\]);/)[1] + ';' + HTML.match(/foods\.push\(([\s\S]*?)\n\);/g).map(s => s.slice(0, -1) + ';').join('') + 'return foods;')();
  const foodsConFibra = foodsRaw.map(f => {
    const fb = Object.prototype.hasOwnProperty.call(FIBRA_ESTANDAR, f[0]) ? FIBRA_ESTANDAR[f[0]] : null;
    return fb === null ? f.slice() : f.concat([fb, 'estandar']);
  });
  const sb = {
    state, window: win, document: doc, safeText: x => String(x == null ? '' : x),
    foods: foodsConFibra,
    FIBRA_ESTANDAR: FIBRA_ESTANDAR,
    BEBIDA_FUNCION: BEBIDA_FUNCION,
    EVITAR_COMUNES: extractVarAssign('var EVITAR_COMUNES'),
    baseRecipes: [],
    recetaAuditar(r) { return { score: '🟢', problemas: [] }; },
    getTodayDiaryTotals() { return { k: 0, p: 0, c: 0, f: 0 }; },
    getDailyMode() { return { kcalGoal: 3000, missingKcal: 1800, missingProtein: 100, food: { k: 1200, p: 60 } }; },
    todayISO() { return '2026-09-04'; },
    _guardarComida(name, kcal, prot, carb, fat, momento, src, fibra) {
      const d = state.diary['2026-09-04'] = state.diary['2026-09-04'] || { breakfast: [], lunch: [], dinner: [], snacks: [] };
      const e = { name, kcal, prot, carb, fat };
      if (src) e.src = src;
      if (fibra != null) e.fibra = +fibra || 0;
      d[momento].push(e);
    },
    abrirReceta() {}, save() {}, quickSaved() {}, refrescarInicio() {}, toastReg() {},
    mealKeyLabel(k) { return { breakfast: 'desayuno', lunch: 'comida', dinner: 'cena', snacks: 'snack' }[k] || 'comida'; },
    completarFranja() { return 'noche'; }
  };
  ['COMPLETAR_PESOS', 'COMPLETAR_LIMITES', 'COMPLETAR_FRANJAS', 'COMPLETAR_ALIMENTO', 'COMPLETAR_PLATOS',
    'COMPLETAR_VOLUMEN_TIPO', 'COMPLETAR_VOLUMEN_ALIMENTO', 'COMPLETAR_PUNTOS_VOL',
    'COMPLETAR_UNIDAD_TEXTO', 'COMPLETAR_UNIDAD_CONDE', 'COMPLETAR_EQUIV_CASERA', 'COMPLETAR_GENERICOS',
    'POTENCIAR_PESOS', 'POTENCIAR_UNIDAD_ESCALABLE', 'POTENCIAR_MICRO',
    'BEBIDA_BASE', 'BEBIDA_VARIANTE', 'BEBIDA_LIMITES', 'COMPLETAR_COMBOS_FACILES', 'CALORIAS_FACILES_FAMILIA',
    'RECETA_AUXILIAR', 'RECETA_AUXILIAR_TIPO', 'RECETA_COCCION', 'RECETA_RECALENTABLE'].forEach(n => { sb[n] = extractVarAssign('var ' + n); });
  ['completarNorm', 'completarSinAcentos', 'completarFranja', 'completarVolumen', 'completarDensidad', 'completarKcalMomento',
    'completarCatalogo', 'completarCandidatos', 'completarScore', 'completarVolMax', 'completarSuma', 'completarProponer', 'completarEsRapido', 'completarEsFacilParte', 'completarEsFacil', 'completarEsCandidatoFacil', 'completarEsEstructuraNatural', 'completarEtiquetaTipo', 'completarLineaMicro', 'recetaSugeridaPara', 'recetaResumenCorto',
    'completarFiltrosActivos', 'completarFiltrosReset', 'completarFiltroRecetaDe', 'recetaPasaFiltros', 'recetaFaltantes', 'recetaCobertura', 'completarPalabrasAlimento', 'completarFoodsBase', 'completarBaseDe', 'completarFoodNombreDe', 'completarFibraAplicar', 'completarFibraFood', 'completarFibraReceta', 'completarFibraCandidato', 'completarFibraHoy',
    'completarFiltrosUI', 'completarFiltroGet', 'completarFiltroToggle', 'completarFiltroTiempo', 'completarFiltroModoFaltante', 'completarFiltroLimpiar', 'completarFiltroTengoQuitar', 'completarFiltroTengoAgregar', 'completarFiltroTengoAgregarNombre', 'completarFiltroTengoBuscar',
    'pickDiversoFacil', 'caloriasFacilesDe', 'bebidaFuncionesDe', 'completarFamiliaDe', 'completarFamiliasDe',
    'completarPotenciar', 'potenciarHayExtras', 'completarNombreCorto', 'completarCategoria', 'completarTituloUI',
    'completarFraccion', 'completarPorcion', 'completarVolBadge', 'completarPorcionComponente', 'completarParteTexto',
    'completarLineaPropuesta', 'completarLineaExtra', 'bebidaFuncionesDe',
    'potenciarFaltante', 'potenciarEscalarNombre', 'potenciarVariante', 'potenciarScore',
    'potenciarCategoria', 'potenciarRazon', 'potenciarFacilidad', 'potenciarEquivOz', 'potenciarRequierePrep', 'potenciarTextoFaltante', 'potenciarBaseHTML', 'progresoBarraHTML', 'progresoFilaHTML', 'potenciarProgresoHTML',
    'potenciarAgregados', 'potenciarResumenHTML', 'potenciarEsMicroExtra',
    'bebidaCat', 'bebidaCombinaciones', 'bebidaTitulo', 'bebidaConstruir', 'bebidaTecho',
    'bebidaOtroSabor', 'bebidaMasCalorias', 'bebidaMasLigero', 'bebidaPropuesta', 'bebidaMenuHTML',
    'completarCtxReal', 'completarMealKey', 'completarTextoTarjeta', 'completarRenderPanel', 'completarAgregar',
    'completarPotRender', 'completarPotAgregar', 'completarPotCerrar', 'completarPotOtros', 'completarCerrar', 'completarAbrir'].forEach(n => { sb[n] = vm.runInNewContext('(' + extractFunc(n) + ')', sb); });
  ['ppTombstoneItem','ppActivos','ppTombstoneKey','ppKeyActivo','ppKeysActivas','ppDiarioActivos'].forEach(n => { sb[n] = vm.runInNewContext('(' + extractFunc(n) + ')', sb); });
['completarComidoYa','registrarComidaDiary','quitarRegistroComida','completarComiEsto'].forEach(n => { sb[n] = vm.runInNewContext('(' + extractFunc(n) + ')', sb); });
  sb.panels = panels;
  return sb;
}
function ctxBase(sb, extra) {
  return Object.assign({
    kcalObjetivo: 3000, kcalConsumidas: 1200, objetivo: 'ganar', llenado: 'normal',
    hora: 14, consumidosHoy: [], mostradas: [], restricciones: [], favoritos: [], recientes: [],
    macrosObjetivo: { p: 180, c: 400, g: 100 }, macrosConsumidos: { p: 60, c: 120, g: 40 },
    catalogo: { recetas: [], alimentos: sb.foods.map((f, i) => ({ id: 'f' + i, nombre: f[0], kcal: f[1], p: f[2], g: f[3], c: f[4] })) }
  }, extra || {});
}

console.log('== 1 · Foods de bebidas: datos reales y clasificación ==');
(function () {
  const sb = makeSandbox();
  const porNombre = {};
  sb.foods.forEach(f => { porNombre[f[0]] = f; });
  const esperadas = {
    'Agua de coco 1 vaso': [46, 0.5, 0, 9],
    'Jugo de naranja 1 vaso': [112, 1.7, 0.5, 26],
    'Jugo de manzana 1 vaso': [114, 0.3, 0.3, 28],
    'Leche con chocolate 1 vaso': [208, 8, 8.5, 26],
    'Bebida deportiva 1 botella': [150, 0, 0, 36],
    'Bebida de electrolitos sin azúcar 1 vaso': [25, 0, 0, 6],
    'Horchata 1 vaso': [160, 1, 4, 30],
    'Atole de vainilla 1 taza': [180, 4, 4, 32],
    'Té frío sin azúcar 1 vaso': [5, 0, 0, 1],
    'Kéfir natural 1 taza': [110, 11, 2, 12]
  };
  Object.keys(esperadas).forEach(n => {
    const f = porNombre[n];
    const ok = f && f[1] === esperadas[n][0] && f[2] === esperadas[n][1] && f[3] === esperadas[n][2] && f[4] === esperadas[n][3];
    t('food "' + n + '" con macros reales [kcal,prot,grasa,carbos]', !!ok, f ? f.slice(1, 5).join(',') : 'NO EXISTE');
  });
  const todasBebida = Object.keys(esperadas).every(n => sb.caloriasFacilesDe(n).funcion === 'bebida');
  t('las 10 bebidas se clasifican como bebida (tier D las propone)', todasBebida);
  t('ningún food de bebida tiene kcal 0 (0 kcal no completa calorías)', Object.keys(esperadas).every(n => porNombre[n][1] > 0));
})();

console.log('== 2 · Funciones por bebida (sin inventar) ==');
(function () {
  const sb = makeSandbox();
  const F = sb.bebidaFuncionesDe;
  t('Té frío: SOLO hidratación (no se vende como calorías)', F('Té frío sin azúcar 1 vaso').join() === 'hidratacion');
  t('Agua de coco: hidratación + electrolitos', F('Agua de coco 1 vaso').indexOf('hidratacion') >= 0 && F('Agua de coco 1 vaso').indexOf('electrolitos') >= 0);
  t('Bebida deportiva: hidratación + energía + electrolitos', ['hidratacion', 'energia_calorias', 'electrolitos'].every(x => F('Bebida deportiva 1 botella').indexOf(x) >= 0));
  t('Leche con chocolate: energía + proteína (no "hidratante" de fachada)', F('Leche con chocolate 1 vaso').indexOf('energia_calorias') >= 0 && F('Leche con chocolate 1 vaso').indexOf('proteina') >= 0 && F('Leche con chocolate 1 vaso').indexOf('hidratacion') < 0);
  t('Jugo de naranja: hidratación + energía', F('Jugo de naranja 1 vaso').indexOf('hidratacion') >= 0 && F('Jugo de naranja 1 vaso').indexOf('energia_calorias') >= 0);
  t('Kéfir: proteína + hidratación', F('Kéfir natural 1 taza').indexOf('proteina') >= 0 && F('Kéfir natural 1 taza').indexOf('hidratacion') >= 0);
  // sin cifras de sodio/potasio inventadas en ninguna parte de la tabla
  const crudo = JSON.stringify(BEBIDA_FUNCION);
  t('la tabla de funciones NO contiene cifras de sodio/potasio', !/sodio|potasio|mg|mEq/i.test(crudo));
  const soloFunciones = Object.keys(BEBIDA_FUNCION).every(k => BEBIDA_FUNCION[k].every(x => ['hidratacion', 'energia_calorias', 'electrolitos', 'proteina', 'licuado'].indexOf(x) >= 0));
  t('todas las entradas usan solo funciones conocidas', soloFunciones);
  t('bebida desconocida → funciones vacías (sin inventar)', F('Refresco de cola').length === 0);
})();

console.log('== 3 · Fibra honesta en bebidas ==');
(function () {
  const sb = makeSandbox();
  const fibra = n => { const r = sb.completarFibraFood(n); return r ? r.g : null; };
  t('jugo de naranja: 0.5 g fiable', fibra('Jugo de naranja 1 vaso') === 0.5);
  t('bebida deportiva: 0 fiable', fibra('Bebida deportiva 1 botella') === 0);
  t('té frío: 0 fiable', fibra('Té frío sin azúcar 1 vaso') === 0);
  t('kéfir: 0 fiable (lácteo)', fibra('Kéfir natural 1 taza') === 0);
  t('leche con chocolate: null (varía por marca)', fibra('Leche con chocolate 1 vaso') === null);
  t('agua de coco: null (USDA 2.6 vs etiquetas 0 — conflicto)', fibra('Agua de coco 1 vaso') === null);
  t('horchata: null (varía por receta)', fibra('Horchata 1 vaso') === null);
})();

console.log('== 4 · Scoring: trabajo/calor y Me lleno rápido ==');
(function () {
  const sb = makeSandbox();
  const cand = n => ({ partes: [{ tipo: 'alimento', ref: null, nombre: n, kcal: 112, p: 1.7, c: 26, g: 0.5, tiempo: 0, metodo: '', type: 'alimento', tags: '', portable: false, volumen: 'Poco', porcion: { texto: '1 vaso', casera: null } }], tier: 'D' });
  const ctxT = ctxBase(sb, { hora: 14, llenado: 'normal' });
  const sTe = sb.completarScore(cand('Té frío sin azúcar 1 vaso'), ctxT);
  t('trabajo: bebida recibe bebida-facil', sTe.razones.indexOf('bebida-facil') >= 0, sTe.razones.join(' · '));
  t('trabajo: bebida solo-hidratante recibe hidratacion-ligera (menor)', sTe.razones.indexOf('hidratacion-ligera') >= 0, sTe.razones.join(' · '));
  const sJugo = sb.completarScore(cand('Jugo de naranja 1 vaso'), ctxT);
  t('trabajo: bebida con calorías NO recibe hidratacion-ligera', sJugo.razones.indexOf('hidratacion-ligera') < 0, sJugo.razones.join(' · '));
  const ctxN = ctxBase(sb, { hora: 20, llenado: 'normal' });
  const sN = sb.completarScore(cand('Jugo de naranja 1 vaso'), ctxN);
  t('noche (sin Me lleno rápido): sin bebida-facil', sN.razones.indexOf('bebida-facil') < 0, sN.razones.join(' · '));
  const ctxR = ctxBase(sb, { hora: 14, llenado: 'rapido' });
  const sR = sb.completarScore(cand('Leche con chocolate 1 vaso'), ctxR);
  t('Me lleno rápido: rapido-bebida favorece calorías líquidas', sR.razones.indexOf('rapido-bebida') >= 0, sR.razones.join(' · '));
})();

console.log('== 5 · Integración: tier D, filtros y Tengo esto en casa ==');
(function () {
  const sb = makeSandbox();
  const ctx = ctxBase(sb, {});
  const cands = sb.completarCandidatos(ctx);
  const nombres = cands.map(c => c.partes[0].nombre);
  t('tier D incluye Agua de coco', nombres.indexOf('Agua de coco 1 vaso') >= 0);
  t('tier D incluye Bebida deportiva', nombres.indexOf('Bebida deportiva 1 botella') >= 0);
  t('tier D incluye Té frío (hidratación ligera)', nombres.indexOf('Té frío sin azúcar 1 vaso') >= 0);
  const r = { nombre: 'Agua de coco 1 vaso', tags: '', ingredients: '', method: '', tiempo: 0 };
  t('No quiero cocinar: bebidas pasan sin problema', sb.recetaPasaFiltros(r, { noCocinar: true, recalentar: false, licuar: true, tiempo: null, soloTengo: false, tengo: [] }));
  t('filtro 5 min: bebidas pasan (0 min)', sb.recetaPasaFiltros(r, { noCocinar: false, recalentar: false, licuar: true, tiempo: 5, soloTengo: false, tengo: [] }));
  // Tengo esto en casa: agregar bebida y verificar cobertura sobre un texto de licuado
  sb.completarFiltroTengoAgregarNombre('Agua de coco 1 vaso');
  const f = sb.completarFiltroGet();
  t('"Agua de coco 1 vaso" se agrega a Tengo esto en casa', f.tengo.indexOf('Agua de coco 1 vaso') >= 0, f.tengo.join(','));
})();

console.log('\n===== RESULTADO: ' + pasadas + ' PASS / ' + falladas + ' FAIL =====');
if (falladas) process.exit(1);
