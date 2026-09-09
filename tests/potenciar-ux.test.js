// ============================================================
// PRUEBAS de la UX del botón ⚡ Agregar extras.
// Uso: node tests/potenciar-ux.test.js
// Cubre: botón con texto (⚡ Agregar extras / ⚡ Extras), oculto sin
// extras compatibles, título "Extras para esta comida", tarjeta con
// nombre+porción+kcal+proteína+fibra fiable, "Otros extras", bebidas
// solo cuando tiene sentido.
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
    baseRecipes: [
      { name: 'Sándwich de pavo y queso', k: 460, p: 32, carbs: 0, grasas: 0, time: 5, method: 'sin cocinar', type: 'comida', tags: 'sandwich portable trabajo frio rapido', ingredients: 'pan integral, pavo cocido, queso, mayonesa', steps: ['El pavo cocido puede ser de paquete; si no, cocínalo 15 min en agua con sal.', 'Unta la mayonesa en el pan.', 'Acomoda el pavo y el queso, tapa y envuelve.'] }
    ],
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
    'completarCatalogo', 'completarCandidatos', 'completarScore', 'completarVolMax', 'completarSuma', 'recetaSugeridaPara', 'completarLineaMicro', 'completarEtiquetaTipo', 'completarEsRapido', 'completarEsFacilParte', 'completarEsFacil', 'completarEsCandidatoFacil', 'completarEsEstructuraNatural', 'recetaResumenCorto',
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
  ['ppTombstoneItem','ppActivos','ppTombstoneKey','ppKeyActivo','ppKeysActivas','ppDiarioActivos'].forEach(n => { sb[n] = vm.runInNewContext('(' + extractFunc(n) + ')', sb); });
['completarComidoYa','registrarComidaDiary','quitarRegistroComida','completarComiEsto'].forEach(n => { sb[n] = vm.runInNewContext('(' + extractFunc(n) + ')', sb); });
  sb.panels = panels;
  return sb;
}
function ctxBase(sb, extra) {
  return Object.assign({
    kcalObjetivo: 3000, kcalConsumidas: 1200, objetivo: 'ganar', llenado: 'normal',
    hora: 20, consumidosHoy: [], mostradas: [], restricciones: [], favoritos: [], recientes: [],
    macrosObjetivo: { p: 180, c: 400, g: 100 }, macrosConsumidos: { p: 60, c: 120, g: 40 },
    catalogo: {
      recetas: sb.baseRecipes.map((r, i) => ({ id: i, nombre: r.name, kcal: r.k, p: r.p || 0, c: r.carbs || 0, g: r.grasas || 0, tiempo: r.time || 0, method: r.method || '', type: r.type || '', tags: r.tags || '', ingredients: r.ingredients || '', portable: r.llevarTrabajo === 'Sí', scoreAudit: '🟢' })),
      alimentos: sb.foods.map((f, i) => ({ id: 'f' + i, nombre: f[0], kcal: f[1], p: f[2], g: f[3], c: f[4] }))
    }
  }, extra || {});
}
function propDe(nombre, tipo) {
  return { titulo: nombre, tipoProp: tipo === 'receta' ? 'comida' : 'micro', kcal: 160, p: 2, c: 16, g: 10, volumen: 'Poco', tiempo: 0, razones: [], clave: 'c' + nombre.replace(/\W/g, ''), componentes: [{ tipo: tipo, nombre: nombre, ref: null, kcal: 160, p: 2, c: 16, g: 10, tiempo: 0, porcion: { texto: '1 porción' } }] };
}

console.log('== 1 · potenciarHayExtras: botón solo cuando hay compatibles ==');
(function () {
  const sb = makeSandbox();
  const ctx = ctxBase(sb, {});
  t('Totopos 1 oz → SÍ hay extras (dips/queso/crema)', sb.potenciarHayExtras(ctx, ['Totopos 1 oz']) === true);
  t('Sándwich de pavo y queso → SÍ hay extras (queso/mayo/aguacate)', sb.potenciarHayExtras(ctx, ['Sándwich de pavo y queso']) === true);
  t('Leche entera taza → SÍ hay extras (avena/whey/miel: bebida con sentido)', sb.potenciarHayExtras(ctx, ['Leche entera taza']) === true);
  t('Bebida deportiva 1 botella → NO hay extras (sin compatibles registrados)', sb.potenciarHayExtras(ctx, ['Bebida deportiva 1 botella']) === false);
  t('Té frío sin azúcar 1 vaso → NO hay extras', sb.potenciarHayExtras(ctx, ['Té frío sin azúcar 1 vaso']) === false);
})();

console.log('== 2 · Botón con texto y oculto sin extras (tarjetas renderizadas) ==');
(function () {
  const sb = makeSandbox();
  const ctx = ctxBase(sb, {});
  sb.completarRenderPanel([propDe('Totopos 1 oz', 'alimento')]);
  const hCon = sb.panels.completarPanel.innerHTML;
  t('tarjeta con extras muestra "⚡ Agregar extras"', /⚡\s*<span class="pot-btn-full">Agregar extras<\/span>/.test(hCon));
  t('variante corta "⚡ Extras" presente para pantallas estrechas', /pot-btn-corto">Extras</.test(hCon));
  sb.completarRenderPanel([propDe('Bebida deportiva 1 botella', 'alimento')]);
  const hSin = sb.panels.completarPanel.innerHTML;
  t('tarjeta SIN extras NO muestra el botón', !/Agregar extras/.test(hSin) && !/pot-btn-full/.test(hSin), hSin.slice(0, 120));})();

console.log('== 3 · Panel: título "Agregar extras a:" con la comida base ==');
(function () {
  const sb = makeSandbox();
  sb.window._completarPotBase = { titulo: 'Totopos', componentes: [{ nombre: 'Totopos 1 oz', tipo: 'alimento' }] };
  sb.completarPotRender();
  let html = sb.panels.completarPotPanel.innerHTML;
  t('título del panel: "Agregar extras a:"', /Agregar extras a:/.test(html) && !/Potenciar esta comida/.test(html));
  t('la mini tarjeta muestra la comida base (Totopos)', />Totopos<\/b>/.test(html));
  t('encabezado del faltante: "Te faltan hoy: X kcal · X g proteína"', /Te faltan hoy: \d+ kcal · \d+(\.\d+)? g proteína/.test(html), (html.match(/Te faltan hoy[^<]*/) || ['?'])[0]);
  t('botón de rotación: "🔄 Otros extras"', /🔄 Otros extras/.test(html));
  // rotar hasta ver el guacamole (como haría el usuario)
  for (let i = 0; i < 6 && !/Guacamole/.test(html); i++) {
    sb.completarPotOtros();
    html = sb.panels.completarPotPanel.innerHTML;
  }
  t('tarjeta del guacamole: nombre + porción + kcal + proteína + fibra', /<b[^>]*>Guacamole<\/b>/.test(html) && /2 cucharadas · \+50 kcal · \+0\.5 g proteína · \+1\.5 g fibra/.test(html), (html.match(/2 cucharadas[^<]*/) || ['(no encontrado)'])[0]);
})();

console.log('== 4 · Mini tarjeta de la comida base (snack/receta/sándwich/ensalada/bebida) ==');
(function () {
  const sb = makeSandbox();
  // snack (alimento único): porción + kcal + proteína + fibra fiable
  const snack = { titulo: 'Fritos chips de maíz', kcal: 160, p: 2, componentes: [{ tipo: 'alimento', nombre: 'Fritos/chips de maíz 1 oz', porcion: { texto: '1 oz de fritos/chips de maíz', casera: null } }] };
  const hS = sb.potenciarBaseHTML(snack);
  t('snack: "Fritos chips de maíz" + "1 oz · 160 kcal · 2 g proteína · 1.2 g fibra"', /Fritos chips de maíz/.test(hS) && /1 oz · 160 kcal · 2 g proteína · 1\.2 g fibra/.test(hS), hS.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  // receta: sin porción, solo kcal + proteína
  const receta = { titulo: 'Ensalada de atún ligera', kcal: 440, p: 36, componentes: [{ tipo: 'receta', nombre: 'Ensalada de atún ligera', porcion: { texto: '1 porción', casera: null } }] };
  const hR = sb.potenciarBaseHTML(receta);
  t('receta: sin porción redundante, "440 kcal · 36 g proteína"', /440 kcal · 36 g proteína/.test(hR) && !/1 porción/.test(hR), hR.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  // sándwich (receta): igual que receta
  const sand = { titulo: 'Sándwich de pavo y queso', kcal: 460, p: 32, componentes: [{ tipo: 'receta', nombre: 'Sándwich de pavo y queso', porcion: { texto: '1 porción', casera: null } }] };
  const hW = sb.potenciarBaseHTML(sand);
  t('sándwich: título + "460 kcal · 32 g proteína"', /Sándwich de pavo y queso/.test(hW) && /460 kcal · 32 g proteína/.test(hW), hW.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  // ensalada (receta): igual
  const ens = { titulo: 'Ensalada de pollo con aguacate', kcal: 430, p: 34, componentes: [{ tipo: 'receta', nombre: 'Ensalada de pollo con aguacate', porcion: { texto: '1 porción', casera: null } }] };
  const hE = sb.potenciarBaseHTML(ens);
  t('ensalada: título + "430 kcal · 34 g proteína"', /Ensalada de pollo con aguacate/.test(hE) && /430 kcal · 34 g proteína/.test(hE), hE.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  // bebida: porción + kcal; fibra 0 no aparece
  const beb = { titulo: 'Leche entera', kcal: 149, p: 8, componentes: [{ tipo: 'alimento', nombre: 'Leche entera taza', porcion: { texto: '1 taza de leche entera', casera: null } }] };
  const hB = sb.potenciarBaseHTML(beb);
  t('bebida: "1 taza · 149 kcal · 8 g proteína" sin fibra (0 no aporta)', /1 taza · 149 kcal · 8 g proteína/.test(hB) && !/fibra/.test(hB), hB.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  // sin base: vacío
  t('potenciarBaseHTML(null) → ""', sb.potenciarBaseHTML(null) === '');
})();

console.log('== 5 · completarLineaExtra: porción limpia y fibra solo fiable ==');
(function () {
  const sb = makeSandbox();
  const guac = { nombre: 'Guacamole 2 cucharadas', nombreBase: 'Guacamole 2 cucharadas', kcal: 50, p: 0.5, factor: 1, porcion: sb.completarPorcion('Guacamole 2 cucharadas') };
  t('guacamole: "2 cucharadas · +50 kcal · +0.5 g proteína · +1.5 g fibra"', sb.completarLineaExtra(guac) === '2 cucharadas · +50 kcal · +0.5 g proteína · +1.5 g fibra', sb.completarLineaExtra(guac));
  const salsa = { nombre: 'Salsa 1/4 taza', nombreBase: 'Salsa 1/2 taza', kcal: 20, p: 1, factor: 0.5, porcion: sb.completarPorcion('Salsa 1/4 taza') };
  t('salsa escalada: fibra escalada (2×0.5 = +1 g)', /\+1 g fibra/.test(sb.completarLineaExtra(salsa)), sb.completarLineaExtra(salsa));
  const horchata = { nombre: 'Horchata 1 vaso', nombreBase: 'Horchata 1 vaso', kcal: 160, p: 1, factor: 1, porcion: sb.completarPorcion('Horchata 1 vaso') };
  t('horchata (fibra desconocida): SIN fibra en la línea', !/fibra/.test(sb.completarLineaExtra(horchata)), sb.completarLineaExtra(horchata));
  const huevo = { nombre: 'Huevo', nombreBase: 'Huevo', kcal: 72, p: 6, factor: 1, porcion: sb.completarPorcion('Huevo') };
  t('huevo (0 fibra fiable): SIN fibra (0 no aporta)', !/fibra/.test(sb.completarLineaExtra(huevo)), sb.completarLineaExtra(huevo));
})();

console.log('== 6 · Barra de progreso: porcentajes y límites ==');
(function () {
  const sb = makeSandbox();
  t('0% cuando no llevo nada', /width:0%/.test(sb.progresoBarraHTML(0, 2000)));
  t('50% exacto', /width:50%/.test(sb.progresoBarraHTML(1000, 2000)));
  t('100% exacto', /width:100%/.test(sb.progresoBarraHTML(2000, 2000)));
  const exceso = sb.progresoBarraHTML(2500, 2000);
  t('100% sin overflow al exceder', /width:100%/.test(exceso) && !/width:1[2-9][0-9]%/.test(exceso) && !/width:2[0-9][0-9]%/.test(exceso));
  t('objetivo null/0/undefined → sin barra (null)', sb.progresoBarraHTML(100, null) === null && sb.progresoBarraHTML(100, 0) === null && sb.progresoBarraHTML(100, undefined) === null);
  t('consumido NaN/negativo no rompe (0%)', /width:0%/.test(sb.progresoBarraHTML(NaN, 2000)) && /width:0%/.test(sb.progresoBarraHTML(-50, 2000)));
  const fExceso = sb.progresoFilaHTML('🔥', 'Calorías', 4320, 4200, 'kcal');
  t('exceso: "Objetivo alcanzado · +120 kcal"', /Objetivo alcanzado · \+120 kcal/.test(fExceso), fExceso.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  const fCero = sb.progresoFilaHTML('🔥', 'Calorías', 100, 0, 'kcal');
  t('fila con objetivo 0 → vacía', fCero === '');
})();

console.log('== 7 · Bloque "Progreso de hoy": kcal/proteína independientes, fibra con regla real ==');
(function () {
  const sb = makeSandbox();
  sb.getTodayDiaryTotals = function () {
    const d = sb.state.diary['2026-09-04'] || {};
    const items = [].concat(d.breakfast || [], d.lunch || [], d.dinner || [], d.snacks || []);
    return items.reduce((a, x) => { a.k += +x.kcal || 0; a.p += +x.prot || 0; a.c += +x.carb || 0; a.f += +x.fat || 0; return a; }, { k: 0, p: 0, c: 0, f: 0 });
  };
  sb.getDailyMode = function () { const f = sb.getTodayDiaryTotals(); return { kcalGoal: 4200, missingKcal: Math.max(0, 4200 - f.k), missingProtein: Math.max(0, 150 - f.p), food: f }; };
  sb.state.profile.proteina = 150;
  sb._guardarComida('Comida de prueba', 2450, 84, 200, 80, 'dinner');
  const ctx = sb.completarCtxReal();
  const falta = sb.potenciarFaltante(ctx);
  const h = sb.potenciarProgresoHTML(ctx, falta);
  t('calorías: "2450 / 4200 kcal" + "Te faltan 1750 kcal"', /2450 \/ 4200 kcal/.test(h) && /Te faltan 1750 kcal/.test(h), h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  t('proteína independiente: "84 / 150 g" + "Te faltan 66 g"', /84 \/ 150 g/.test(h) && /Te faltan 66 g/.test(h));
  t('SIN objetivo de fibra en perfil → sin barra de fibra (no se inventa)', !/Fibra/.test(h));
  // con objetivo real y cobertura suficiente (1 de 1 con fibra) → barra
  sb.state.profile.fibra = 30;
  sb.state.diary['2026-09-04'] = { breakfast: [], lunch: [], dinner: [], snacks: [] };
  sb._guardarComida('Frijol 1 taza', 240, 15, 1, 44, 'dinner', null, 15);
  const ctx2 = sb.completarCtxReal();
  const h2 = sb.potenciarProgresoHTML(ctx2, sb.potenciarFaltante(ctx2));
  t('fibra con objetivo real + cobertura: "15 / 30 g · Te faltan 15 g"', /15 \/ 30 g/.test(h2) && /Te faltan 15 g/.test(h2), h2.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  // cobertura insuficiente (1 de 2 con fibra) → sin barra de fibra
  sb._guardarComida('Granola 1/2 taza', 240, 6, 9, 36, 'dinner');
  const ctx3 = sb.completarCtxReal();
  const h3 = sb.potenciarProgresoHTML(ctx3, sb.potenciarFaltante(ctx3));
  t('cobertura insuficiente (ratio 0.5) → sin barra de fibra', !/Fibra/.test(h3));
})();

console.log('== 8 · Agregar un extra actualiza barras y "Te faltan hoy" en vivo ==');
(function () {
  const sb = makeSandbox();
  sb.getTodayDiaryTotals = function () {
    const d = sb.state.diary['2026-09-04'] || {};
    const items = [].concat(d.breakfast || [], d.lunch || [], d.dinner || [], d.snacks || []);
    return items.reduce((a, x) => { a.k += +x.kcal || 0; a.p += +x.prot || 0; a.c += +x.carb || 0; a.f += +x.fat || 0; return a; }, { k: 0, p: 0, c: 0, f: 0 });
  };
  sb.getDailyMode = function () { const f = sb.getTodayDiaryTotals(); return { kcalGoal: 4200, missingKcal: Math.max(0, 4200 - f.k), missingProtein: Math.max(0, 150 - f.p), food: f }; };
  sb.state.profile.proteina = 150;
  sb._guardarComida('Comida de prueba', 2450, 84, 200, 80, 'dinner');
  sb.window._completarPotBase = { titulo: 'Totopos', componentes: [{ nombre: 'Totopos 1 oz', tipo: 'alimento' }] };
  sb.completarPotRender();
  const antes = sb.panels.completarPotPanel.innerHTML;
  t('antes: 2450 / 4200 kcal · Te faltan 1750 kcal · Te faltan hoy: 1750 kcal · 66 g proteína',
    /2450 \/ 4200 kcal/.test(antes) && /Te faltan 1750 kcal/.test(antes) && /Te faltan hoy: 1750 kcal · 66 g proteína/.test(antes), (antes.match(/Te faltan hoy[^<]*/) || ['?'])[0]);
  // agregar almendras +328 kcal +12 g proteína (como lo hace la tarjeta real)
  sb.window._completarPotExtras = [{ nombre: 'Almendras 56g', nombreBase: 'Almendras 28g', kcal: 328, p: 12, c: 12, g: 28, factor: 2 }];
  sb.completarPotAgregar(0);
  const despues = sb.panels.completarPotPanel.innerHTML;
  t('después: 2778 / 4200 kcal · Te faltan 1422 kcal · Te faltan hoy: 1422 kcal · 54 g proteína',
    /2778 \/ 4200 kcal/.test(despues) && /Te faltan 1422 kcal/.test(despues) && /Te faltan hoy: 1422 kcal · 54 g proteína/.test(despues), (despues.match(/Te faltan hoy[^<]*/) || ['?'])[0]);
  t('barra de kcal se actualiza en vivo sin recargar (re-render)', /width:\d+%/.test(despues));
})();

console.log('\n===== RESULTADO: ' + pasadas + ' PASS / ' + falladas + ' FAIL =====');
if (falladas) process.exit(1);
