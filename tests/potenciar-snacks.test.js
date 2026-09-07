// ============================================================
// PRUEBAS de Potenciar para SNACKS (chips/totopos/crackers).
// Uso: node tests/potenciar-snacks.test.js
// Cubre: foods dip reales y su clasificación, casos obligatorios
// (fritos+guacamole, totopos+salsa, totopos+queso, crackers+queso
// crema, chips+dip), casos bloqueados (bebidas, proteínas absurdas,
// aceite solo), clase dip/topping con etiqueta, rotación de Otros
// extras y registro real con fibra escalada (nunca "Potenciar").
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
// Hora FIJA dentro del sandbox: completarCtxReal() lee new Date().getHours()
// y los tests deben ser deterministas (20:00 fijo).
function pinHour(h) {
  return class extends Date {
    constructor(...args) { super(...args); }
    getHours() { return h; }
  };
}

const FIBRA_ESTANDAR = extractVarAssign('var FIBRA_ESTANDAR');

function makeSandbox() {
  const state = {
    profile: { objetivo: 'ganar peso', proteina: 180, carbos: 400, grasa: 100, llenado: 'normal' },
    diary: {}, recipeFavorites: [], recetasRecientes: [], evitar: []
  };
  const win = { _completarMostradas: [], _completarPropuestas: null, _completarFamiliasVistas: [], _completarModoFacil: true, _completarExtrasVistas: [] };
  const panels = {};
  const panelFor = id => { if (!panels[id]) panels[id] = { innerHTML: '', scrollTop: 0, remove() {} }; return panels[id]; };
  const doc = {
    getElementById(id) { return (id === 'completarPanel' || id === 'completarPotPanel') ? panelFor(id) : null; },
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
    Date: pinHour(20), // determinista: sin reloj de pared
    foods: foodsConFibra,
    FIBRA_ESTANDAR: FIBRA_ESTANDAR,
    BEBIDA_FUNCION: extractVarAssign('var BEBIDA_FUNCION'),
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
    'RECETA_AUXILIAR', 'RECETA_AUXILIAR_TIPO', 'RECETA_COCCION', 'RECETA_RECALENTABLE'].forEach(n => { sb[n] = extractVarAssign('var ' + n, sb); });
  ['completarNorm', 'completarSinAcentos', 'completarFranja', 'completarVolumen', 'completarDensidad', 'completarKcalMomento',
    'completarCatalogo', 'completarCandidatos', 'completarScore', 'completarVolMax', 'completarSuma',
    'completarFiltrosActivos', 'completarFiltrosReset', 'completarFiltroRecetaDe', 'recetaPasaFiltros', 'recetaFaltantes', 'recetaCobertura', 'completarPalabrasAlimento', 'completarFoodsBase', 'completarBaseDe', 'completarFoodNombreDe', 'completarFibraAplicar', 'completarFibraFood', 'completarFibraReceta', 'completarFibraCandidato', 'completarFibraHoy',
    'completarFiltrosUI', 'completarFiltroGet', 'completarFiltroToggle', 'completarFiltroTiempo', 'completarFiltroModoFaltante', 'completarFiltroLimpiar', 'completarFiltroTengoQuitar', 'completarFiltroTengoAgregar', 'completarFiltroTengoAgregarNombre', 'completarFiltroTengoBuscar',
    'pickDiversoFacil', 'caloriasFacilesDe', 'bebidaFuncionesDe', 'completarFamiliaDe', 'completarFamiliasDe',
    'completarPotenciar', 'potenciarHayExtras', 'completarNombreCorto', 'completarCategoria', 'completarTituloUI',
    'completarFraccion', 'completarPorcion', 'completarVolBadge', 'completarPorcionComponente', 'completarParteTexto',
    'completarLineaPropuesta', 'completarLineaExtra',
    'potenciarFaltante', 'potenciarEscalarNombre', 'potenciarVariante', 'potenciarScore',
    'potenciarCategoria', 'potenciarRazon', 'potenciarFacilidad', 'potenciarEquivOz', 'potenciarRequierePrep', 'potenciarTextoFaltante', 'potenciarBaseHTML', 'progresoBarraHTML', 'progresoFilaHTML', 'potenciarProgresoHTML',
    'potenciarAgregados', 'potenciarResumenHTML', 'potenciarEsMicroExtra',
    'bebidaCat', 'bebidaCombinaciones', 'bebidaTitulo', 'bebidaConstruir', 'bebidaTecho',
    'bebidaOtroSabor', 'bebidaMasCalorias', 'bebidaMasLigero', 'bebidaPropuesta', 'bebidaMenuHTML',
    'completarCtxReal', 'completarMealKey', 'completarTextoTarjeta', 'completarRenderPanel', 'completarAgregar',
    'completarPotRender', 'completarPotAgregar', 'completarPotCerrar', 'completarPotOtros', 'completarCerrar', 'completarAbrir'].forEach(n => { sb[n] = vm.runInNewContext('(' + extractFunc(n) + ')', sb); });
  sb.panels = panels;
  return sb;
}
function ctxBase(sb, extra) {
  return Object.assign({
    kcalObjetivo: 3000, kcalConsumidas: 1200, objetivo: 'ganar', llenado: 'normal',
    hora: 20, consumidosHoy: [], mostradas: [], restricciones: [], favoritos: [], recientes: [],
    macrosObjetivo: { p: 180, c: 400, g: 100 }, macrosConsumidos: { p: 60, c: 120, g: 40 },
    catalogo: { recetas: [], alimentos: sb.foods.map((f, i) => ({ id: 'f' + i, nombre: f[0], kcal: f[1], p: f[2], g: f[3], c: f[4] })) }
  }, extra || {});
}
// Extras del motor para una base dada (todas las variantes del pool completo)
function poolDe(sb, baseNombre, ctx) {
  return sb.completarPotenciar(ctx, [baseNombre], []);
}
// POOL COMPLETO como lo ve el usuario: lote inicial + rotaciones de "Otros extras"
function poolCompletoDe(sb, baseNombre, ctx) {
  sb.window._completarExtrasVistas = [];
  sb.window._completarPotBase = { componentes: [{ nombre: baseNombre, tipo: 'alimento' }] };
  const vistos = {};
  const pool = [];
  for (let i = 0; i < 12; i++) {
    sb.completarPotRender();
    const lote = sb.window._completarPotExtras || [];
    if (!lote.length) break;
    lote.forEach(x => {
      if (!vistos[x.nombreBase]) { vistos[x.nombreBase] = 1; pool.push(x); }
    });
    sb.completarPotOtros();
  }
  return pool;
}

console.log('== 1 · Foods dip reales y su clasificación ==');
(function () {
  const sb = makeSandbox();
  const porNombre = {};
  sb.foods.forEach(f => { porNombre[f[0]] = f; });
  const esperadas = {
    'Crackers saladas 6 piezas': [120, 2, 4, 19],
    'Guacamole 2 cucharadas': [50, 0.5, 4, 2.5],
    'Queso crema 2 cucharadas': [100, 2, 10, 1],
    'Pico de gallo 1/4 taza': [20, 0.5, 0, 4],
    'Hummus 2 cucharadas': [70, 2, 5, 4]
  };
  Object.keys(esperadas).forEach(n => {
    const f = porNombre[n];
    const ok = f && f[1] === esperadas[n][0] && f[2] === esperadas[n][1] && f[3] === esperadas[n][2] && f[4] === esperadas[n][3];
    t('food "' + n + '" con macros reales', !!ok, f ? f.slice(1, 5).join(',') : 'NO EXISTE');
  });
  t('crackers → snack (se pueden comer solos)', sb.caloriasFacilesDe('Crackers saladas 6 piezas').funcion === 'snack', JSON.stringify(sb.caloriasFacilesDe('Crackers saladas 6 piezas')));
  ['Guacamole 2 cucharadas', 'Pico de gallo 1/4 taza', 'Hummus 2 cucharadas'].forEach(n => {
    const f = sb.caloriasFacilesDe(n);
    t('"' + n + '" → topping (dip, jamás comida independiente)', f.funcion === 'topping' && f.familia === 'dips', JSON.stringify(f));
  });
  const fb = n => { const r = sb.completarFibraFood(n); return r ? r.g : null; };
  t('fibra: crackers 1 · guacamole 1.5 · queso crema 0 · pico 1 · hummus 1.5', fb('Crackers saladas 6 piezas') === 1 && fb('Guacamole 2 cucharadas') === 1.5 && fb('Queso crema 2 cucharadas') === 0 && fb('Pico de gallo 1/4 taza') === 1 && fb('Hummus 2 cucharadas') === 1.5);
})();

console.log('== 2 · Casos OBLIGATORIOS: dips/toppings compatibles ==');
(function () {
  const sb = makeSandbox();
  const ctx = ctxBase(sb, {});
  const basesDe = (extras) => extras.map(x => x.nombreBase);
  // Fritos + guacamole (pool completo: lote inicial + rotaciones de Otros extras)
  const fritos = poolCompletoDe(sb, 'Fritos/chips de maíz 1 oz', ctx);
  const guac = fritos.find(x => x.nombreBase === 'Guacamole 2 cucharadas');
  t('Fritos + guacamole ✓ (dip, con porción y kcal reales)', !!guac && guac.clase === 'dip' && /2 cucharadas/.test(guac.nombre) && guac.kcal === 50, guac && (guac.nombre + ' · +' + guac.kcal + ' kcal · clase=' + guac.clase));
  t('guacamole con etiqueta "🥣 Dip para tu snack"', guac && sb.potenciarRazon(guac.categoria, false, guac, {}).texto === 'Dip para tu snack');
  t('guacamole con razón de compatibilidad "dip-natural"', guac && guac.razones.indexOf('dip-natural') >= 0, guac && guac.razones.join(','));
  // Totopos + salsa / queso (pool completo: lote inicial + rotaciones de Otros extras)
  const totopos = poolCompletoDe(sb, 'Totopos 1 oz', ctx);
  const tb = basesDe(totopos);
  t('Totopos + salsa ✓', tb.indexOf('Salsa 1/2 taza') >= 0, tb.join(','));
  t('Totopos + queso ✓', tb.indexOf('Queso 28g') >= 0, tb.join(','));
  // Crackers + queso crema / hummus
  const crackers = poolCompletoDe(sb, 'Crackers saladas 6 piezas', ctx);
  const cb = basesDe(crackers);
  t('Crackers + queso crema ✓', cb.indexOf('Queso crema 2 cucharadas') >= 0, cb.join(','));
  t('Crackers + hummus ✓', cb.indexOf('Hummus 2 cucharadas') >= 0, cb.join(','));
  // chips + dip compatible (papas fritas)
  const chips = poolCompletoDe(sb, 'Papas fritas chips 1 oz', ctx);
  const pb = basesDe(chips);
  t('chips + dip compatible ✓ (guacamole)', pb.indexOf('Guacamole 2 cucharadas') >= 0, pb.join(','));
})();

console.log('== 3 · Casos BLOQUEADOS: sin bebidas ni proteínas absurdas ==');
(function () {
  const sb = makeSandbox();
  const ctx = ctxBase(sb, {});
  const prohibidas = ['Yogurt bebible proteína', 'Leche entera taza', 'Bebida deportiva 1 botella', 'Sardinas 1 lata', 'Pavo cocido 100g', 'Jamón 100g', 'Pollo 100g', 'Proteína whey 1 scoop', 'Aceite oliva 1 cucharada', 'Huevo', 'Mantequilla 1 cucharada'];
  ['Fritos/chips de maíz 1 oz', 'Totopos 1 oz', 'Papas fritas chips 1 oz', 'Crackers saladas 6 piezas', 'Chicharrones/chips de harina 1 oz'].forEach(base => {
    const extras = poolCompletoDe(sb, base, ctx);
    const bases = extras.map(x => x.nombreBase);
    const violadas = prohibidas.filter(p => bases.indexOf(p) >= 0);
    t('base "' + base + '": 0 bebidas/proteínas/aceite ofrecidos', violadas.length === 0, 'extras=' + bases.join(',') + (violadas.length ? ' · VIOLADAS=' + violadas.join(',') : ''));
  });
  const fritos = poolCompletoDe(sb, 'Fritos/chips de maíz 1 oz', ctx);
  const conBebida = fritos.filter(x => sb.caloriasFacilesDe(x.nombreBase).funcion === 'bebida').map(x => x.nombreBase);
  t('Fritos: ninguna extra es bebida (regla de familia, no solo regex)', conBebida.length === 0, conBebida.join(','));
})();

console.log('== 4 · Rotación de "Otros extras" sin repetir ==');
(function () {
  const sb = makeSandbox();
  sb.window._completarPotBase = { componentes: [{ nombre: 'Totopos 1 oz', tipo: 'alimento' }] };
  sb.completarPotRender();
  const lote1 = (sb.window._completarPotExtras || []).map(x => x.nombre);
  sb.completarPotOtros();
  const lote2 = (sb.window._completarPotExtras || []).map(x => x.nombre);
  t('"Otros extras" rota a opciones distintas (sin repetir nombres)', lote2.length > 0 && lote2.every(n => lote1.indexOf(n) < 0), 'lote1=' + lote1.join(',') + ' → lote2=' + lote2.join(','));
})();

console.log('== 5 · Registro real del extra (nunca "Potenciar") con fibra escalada ==');
(function () {
  const sb = makeSandbox();
  const agrega = x => {
    sb.window._completarPotExtras = [x];
    sb.completarPotAgregar(0);
  };
  const todas = () => {
    const d = sb.state.diary['2026-09-04'] || {};
    return [].concat(d.breakfast || [], d.lunch || [], d.dinner || [], d.snacks || []);
  };
  const ultima = () => { const a = todas(); return a[a.length - 1]; };
  agrega({ nombre: 'Guacamole 2 cucharadas', nombreBase: 'Guacamole 2 cucharadas', kcal: 50, p: 0.5, c: 2.5, g: 4, factor: 1 });
  const e1 = ultima();
  t('guacamole registrado con su nombre REAL y src potenciar', e1.name === 'Guacamole 2 cucharadas' && e1.src === 'potenciar', JSON.stringify(e1));
  t('guacamole registra su fibra real (1.5 g)', e1.fibra === 1.5, 'fibra=' + e1.fibra);
  t('NO existe ningún registro llamado "Potenciar"', todas().every(x => x.name !== 'Potenciar'));
  agrega({ nombre: 'Salsa 1/4 taza', nombreBase: 'Salsa 1/2 taza', kcal: 20, p: 1, c: 4, g: 0.25, factor: 0.5 });
  const e2 = ultima();
  t('salsa escalada registra su porción real (1/4 taza) y fibra escalada (1 g)', e2.name === 'Salsa 1/4 taza' && e2.fibra === 1, JSON.stringify(e2));
  agrega({ nombre: 'Horchata 1 vaso', nombreBase: 'Horchata 1 vaso', kcal: 160, p: 1, c: 30, g: 4, factor: 1 });
  const e3 = ultima();
  t('extra sin fibra fiable NO inventa fibra (campo ausente)', !('fibra' in e3), JSON.stringify(e3));
})();

console.log('\n===== RESULTADO: ' + pasadas + ' PASS / ' + falladas + ' FAIL =====');
if (falladas) process.exit(1);
