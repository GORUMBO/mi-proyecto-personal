// ============================================================
// PRUEBAS del motor de Bebidas/Licuados compuestos.
// Uso: node tests/bebidas-licuados.test.js
// Cubre: combinaciones reales desde foods[], licuado pequeño/denso,
// Otro sabor, Más calorías, Más ligero, escalado seguro, kcal/cantidad
// mostradas = registradas, sin duplicados, contexto (mañana/trabajo/noche),
// sin bebida absurda con salado, integración con Completar mi día.
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

const RECETAS = [
  { id: 0, nombre: 'Chilaquiles con huevo', kcal: 520, p: 28, c: 0, g: 0, tiempo: 15, method: 'estufa', type: 'desayuno', tags: 'mexicana clásica', scoreAudit: '🟢' },
  { id: 1, nombre: 'Espagueti a la crema con pollo', kcal: 470, p: 24, c: 55, g: 17, tiempo: 25, method: 'estufa', type: 'pasta', tags: 'pasta crema proteina', scoreAudit: '🟢' },
  { id: 2, nombre: 'Papas con chorizo', kcal: 720, p: 24, c: 0, g: 0, tiempo: 20, method: 'estufa', type: 'comida', tags: 'comida cerdo papa', scoreAudit: '🟢' },
  { id: 3, nombre: 'Huevos a la mexicana', kcal: 420, p: 26, c: 0, g: 0, tiempo: 10, method: 'estufa', type: 'desayuno', tags: 'mexicana rápida', scoreAudit: '🟢' }
];

function makeSandbox() {
  const state = {
    profile: { objetivo: 'ganar peso', proteina: 180, carbos: 400, grasa: 100, llenado: 'rapido' },
    diary: {}, recipeFavorites: [], recetasRecientes: [], evitar: []
  };
  const guardados = [];
  const win = { _completarMostradas: [], _completarPropuestas: null, _completarPotBase: null, _completarExtrasVistas: [], _completarPotExtras: null, _bebidaSaboresUsados: [] };
  const panels = {};
  const panelFor = id => { if (!panels[id]) panels[id] = { innerHTML: '', scrollTop: 0, remove() {} }; return panels[id]; };
  const doc = {
    getElementById(id) { return (id === 'completarPanel' || id === 'completarPotPanel') ? panelFor(id) : null; },
    createElement() { return { style: {} }; },
    body: { appendChild() {} }
  };
  const sb = {
    state, window: win, document: doc, safeText: x => String(x == null ? '' : x),
    // catálogo COMPLETO (109 alimentos): fresa/mango/manzana/miel/granola
    // viven en los bloques foods.push, no en el arreglo inicial.
    foods: new Function('const foods=' + HTML.match(/const foods=(\[[\s\S]*?\]);/)[1] + ';' + HTML.match(/foods\.push\(([\s\S]*?)\n\);/g).map(s => s.slice(0, -1) + ';').join('') + 'return foods;')(),
    EVITAR_COMUNES: extractVarAssign('var EVITAR_COMUNES'),
    baseRecipes: RECETAS,
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
    hora: 8, consumidosHoy: [], mostradas: [], restricciones: [], favoritos: [], recientes: [],
    macrosObjetivo: { p: 180, c: 400, g: 100 }, macrosConsumidos: { p: 0, c: 0, g: 0 },
    catalogo: { recetas: RECETAS, alimentos: sb.foods.map((f, i) => ({ id: 'f' + i, nombre: f[0], kcal: f[1], p: f[2], g: f[3], c: f[4] })) }
  }, extra || {});
}
const comboDe = (sb, ctx, b, v) => ({ compsBase: [sb.bebidaCat(ctx)[b], sb.bebidaCat(ctx)[v]], base: 0, variante: 1, factor: 1 });

console.log('== 1 · Combinaciones reales desde foods[] ==');
(function () {
  const sb = makeSandbox();
  const ctx = ctxBase(sb, {});
  const combos = sb.bebidaCombinaciones(ctx);
  t('hay combinaciones coherentes', combos.length >= 10, combos.length + ' combos');
  const claves = combos.map(c => sb.bebidaConstruir(c).clave);
  t('claves únicas (sin duplicados)', new Set(claves).size === claves.length);
  const titulos = combos.map(c => sb.bebidaConstruir(c).titulo);
  t('títulos únicos', new Set(titulos).size === titulos.length);
  combos.forEach(c => {
    const b = sb.bebidaConstruir(c);
    const suma = c.compsBase.reduce((a, x) => a + x.kcal, 0);
    t('kcal = suma real de foods (' + b.titulo + ')', b.kcal === Math.round(suma), b.kcal + ' vs ' + suma);
  });
  const nombres = JSON.stringify(combos.map(c => c.compsBase.map(x => x.nombre)));
  t('sin cacao/canela inventados', !/cacao|canela/i.test(nombres));
  t('todos los componentes están en foods[]', combos.every(c => c.compsBase.every(x => sb.foods.some(f => f[0] === x.nombre))));
  t('volumen Poco (bebible)', combos.every(c => sb.bebidaConstruir(c).volumen === 'Poco'));
  t('tiempo 3 min (batido)', combos.every(c => sb.bebidaConstruir(c).tiempo === 3));
})();

console.log('== 2 · Licuado pequeño (mini) y escalado seguro ==');
(function () {
  const sb = makeSandbox();
  const ctx = ctxBase(sb, {});
  const escalable = comboDe(sb, ctx, 'Leche entera taza', 'Granola 1/2 taza'); // 149+240=389
  const mini = sb.bebidaMasLigero(escalable, ctx);
  t('mini existe (todos escalables)', !!mini && mini.factor === 0.5, mini && mini.titulo);
  t('mini: kcal = la mitad exacta (195)', mini.kcal === 195, mini.kcal);
  t('mini: nombres con ½ o ¼', mini.componentes.every(c => /1\/2|1\/4/.test(c.nombre)), mini.componentes.map(c => c.nombre).join(' · '));
  t('mini: porciones legibles', mini.componentes.every(c => /½|¼/.test(sb.completarPorcion(c.nombre).texto)));
  const conPlatano = comboDe(sb, ctx, 'Leche entera taza', 'Plátano');
  t('con plátano (pieza) NO hay mini', sb.bebidaMasLigero(conPlatano, ctx) === null);
  const chico = comboDe(sb, ctx, 'Leche entera taza', 'Miel 1 cucharada'); // 213 → mini 106.5
  t('piso de 150 kcal: leche+miel no tiene mini', sb.bebidaMasLigero(chico, ctx) === null);
  const noche2 = ctxBase(sb, { hora: 20, llenado: 'normal' });
  const normal = comboDe(sb, noche2, 'Yogurt griego taza', 'Granola 1/2 taza'); // 130+240=370
  const paso1 = sb.bebidaMasCalorias(normal, noche2);
  const denso = paso1 && sb.bebidaMasCalorias(paso1, noche2);
  t('escalera: denso (×2) → Más ligero vuelve a normal', !!denso && denso.factor === 2 && sb.bebidaMasLigero(denso, noche2).factor === 1, denso && (denso.titulo + ' · x' + denso.factor + ' · ' + denso.kcal));
  t('ya denso: Más calorías no sigue a ×4', sb.bebidaMasCalorias(denso, noche2) === null);
})();

console.log('== 3 · Licuado denso (×2) y límite de franja ==');
(function () {
  const sb = makeSandbox();
  const noche = ctxBase(sb, { hora: 20, llenado: 'normal' });
  const trabajo = ctxBase(sb, { hora: 13, llenado: 'normal' });
  // combo 2 comps: Más calorías primero añade 1 componente compatible
  const normal = comboDe(sb, noche, 'Yogurt griego taza', 'Granola 1/2 taza'); // 370
  const paso1 = sb.bebidaMasCalorias(normal, noche);
  t('Más calorías primero añade 1 componente', !!paso1 && paso1.compsBase.length === 3 && paso1.factor === 1, paso1 && (paso1.titulo + ' · ' + paso1.kcal));
  // si el componente añadido es una pieza (plátano), ×2 NO es seguro
  if (paso1 && /Plátano/.test(paso1.titulo)) {
    t('con pieza añadida: denso ×2 NO se ofrece (escalado seguro)', sb.bebidaMasCalorias(paso1, noche) === null);
  } else {
    const paso2 = sb.bebidaMasCalorias(paso1, noche);
    t('3 componentes escalables: ×2 denso dentro del techo noche', !!paso2 && paso2.factor === 2 && paso2.kcal <= 1100, paso2 && (paso2.titulo + ' · ' + paso2.kcal));
  }
  // combo 3 comps TODOS escalables (yogurt+granola+miel = 434) → ×2 = 868 ≤ 1100
  const escalables3 = { compsBase: [sb.bebidaCat(noche)['Yogurt griego taza'], sb.bebidaCat(noche)['Granola 1/2 taza'], sb.bebidaCat(noche)['Miel 1 cucharada']], base: 0, variante: 2, factor: 1 };
  const densoN = sb.bebidaMasCalorias(escalables3, noche);
  t('noche: 3 comps escalables → ×2 denso (868 ≤ 1100)', !!densoN && densoN.factor === 2 && densoN.kcal === 868, densoN && (densoN.titulo + ' · ' + densoN.kcal));
  const densoT = sb.bebidaMasCalorias(escalables3, trabajo);
  t('trabajo: mismo combo NO se densifica (868 > techo 600)', densoT === null, densoT && densoT.kcal);
})();

console.log('== 4 · Otro sabor: cambia sin romper propósito ==');
(function () {
  const sb = makeSandbox();
  const ctx = ctxBase(sb, {});
  const orig = sb.bebidaConstruir(comboDe(sb, ctx, 'Leche entera taza', 'Plátano')); // 254
  const otro = sb.bebidaOtroSabor(comboDe(sb, ctx, 'Leche entera taza', 'Plátano'), ctx, []);
  t('otro sabor existe y cambia', !!otro && otro.titulo !== orig.titulo, otro && otro.titulo);
  t('kcal similar (±25%): ' + orig.kcal + ' vs ' + otro.kcal, Math.abs(otro.kcal - orig.kcal) <= orig.kcal * 0.25);
  t('misma base y volumen', otro.compsBase[otro.base].nombre === 'Leche entera taza' && otro.volumen === 'Poco');
  t('el sabor usado no se repite en la siguiente vuelta', (function () {
    const usado = [sb.completarNombreCorto(otro.componentes[otro.variante].nombre)];
    const otro2 = sb.bebidaOtroSabor(comboDe(sb, ctx, 'Leche entera taza', 'Plátano'), ctx, usado);
    return !otro2 || sb.completarNombreCorto(otro2.componentes[otro2.variante].nombre) !== usado[0];
  })());
})();

console.log('== 5 · Más calorías añade componente compatible (nunca incompatible) ==');
(function () {
  const sb = makeSandbox();
  const ctx = ctxBase(sb, { hora: 20, llenado: 'normal' });
  const base = comboDe(sb, ctx, 'Leche entera taza', 'Plátano'); // 254
  const mas = sb.bebidaMasCalorias(base, ctx);
  t('añade 1 componente compatible', !!mas && mas.compsBase.length === 3, mas && mas.titulo);
  t('suma kcal reales (≥ base)', mas.kcal >= 254);
  t('máximo 3 componentes', mas.compsBase.length <= 3);
  t('todos coherentes con la base (tablas BEBIDA_*)', mas.compsBase.every(c => (sb.BEBIDA_BASE[c.nombre] || sb.BEBIDA_VARIANTE[c.nombre])));
  const miniMas = sb.bebidaMasCalorias({ compsBase: base.compsBase, base: 0, variante: 1, factor: 0.5 }, ctx);
  t('escalera: de mini vuelve a normal', miniMas && miniMas.factor === 1);
})();

console.log('== 6 · kcal/cantidad mostradas = registradas (licuado compuesto) ==');
(function () {
  const sb = makeSandbox();
  const ctx = ctxBase(sb, { hora: 8 });
  const combo = sb.bebidaConstruir(comboDe(sb, ctx, 'Leche entera taza', 'Avena 1/2 taza')); // 305
  const pr = sb.bebidaPropuesta(combo, ctx);
  t('propuesta con bebida', !!pr.bebida && pr.titulo.includes('Licuado de'));
  t('kcal y proteína de la tarjeta son datos reales', pr.kcal === 305 && pr.p === 15, pr.kcal + ' kcal · ' + pr.p + ' g');
  const menu = sb.bebidaMenuHTML(0, pr, ctx);
  t('menú discreto con Otro sabor', menu.includes('Otro sabor') && menu.includes('Ajustar licuado') && menu.includes('details'), menu.slice(0, 80));
  t('porciones reales legibles', pr.componentes.every(c => c.porcion && c.porcion.texto.length > 0), pr.componentes.map(c => c.porcion.texto).join(' · '));
  sb.window._completarPropuestas = [pr];
  sb.completarAgregar(0);
  const suma = Math.round(sb.guardados.reduce((a, g) => a + g.kcal, 0));
  t('diario registra componentes exactos (kcal = tarjeta)', sb.guardados.length === 2 && suma === pr.kcal, sb.guardados.map(g => g.name + ' ' + g.kcal).join(' · '));
  t('diario registra las MISMAS cantidades (nombres con medida)', pr.componentes.every(c => sb.guardados.some(g => g.name === c.nombre)));
  // mini: también registra exacto
  const mini = sb.bebidaMasLigero(comboDe(sb, ctx, 'Leche entera taza', 'Avena 1/2 taza'), ctx); // 305×0.5 = 152.5 → 153
  if (mini) {
    const prMini = sb.bebidaPropuesta(mini, ctx);
    sb.window._completarPropuestas = [prMini];
    sb.completarAgregar(0);
    const gMini = sb.guardados.slice(-2);
    t('mini registrado con ½ taza exacto', gMini.every(g => prMini.componentes.some(c => c.nombre === g.name)) && gMini.every(g => /1\/2|1\/4/.test(g.name)), gMini.map(g => g.name).join(' · '));
  } else {
    t('(mini no disponible para este combo)', true);
  }
})();

console.log('== 7 · Contexto: mañana/trabajo bonifican bebida; noche permite denso ==');
(function () {
  const sb = makeSandbox();
  const manana = ctxBase(sb, { hora: 8, kcalConsumidas: 2360, llenado: 'rapido' });
  const trabajo = ctxBase(sb, { hora: 13, kcalConsumidas: 1600, llenado: 'rapido' });
  const noche = ctxBase(sb, { hora: 20, kcalConsumidas: 1000, llenado: 'normal' });
  const candsManana = sb.completarCandidatos(manana);
  t('candidatos tier E (licuados compuestos) existen', candsManana.some(c => c.tipoBebida && c.tier === 'E'));
  const bebCand = candsManana.find(c => c.tipoBebida);
  const scManana = sb.completarScore(bebCand, manana);
  const scNoche = sb.completarScore(bebCand, noche);
  t('mañana bonifica bebida ("bebida-facil")', scManana.razones.some(r => /bebida-facil/.test(r)), scManana.razones.join(' · '));
  t('trabajo bonifica portable', sb.completarScore(bebCand, trabajo).razones.some(r => /portable/.test(r)));
  t('noche sin bonus bebida (no aplica)', !scNoche.razones.some(r => /bebida-facil/.test(r)));
  const props = sb.completarProponer(manana);
  t('un licuado compuesto aparece entre las 3 en mañana', props.some(p => p.bebida), props.map(p => p.titulo).join(' | '));
})();

console.log('== 8 · Sin bebida absurda con plato salado (regresión) ==');
(function () {
  const sb = makeSandbox();
  const ctx = ctxBase(sb, { hora: 20, kcalConsumidas: 1500, macrosConsumidos: { p: 60, c: 200, g: 40 } });
  const r = sb.completarPotenciar(ctx, ['Arroz cocido 1 taza', 'Pollo 100g'], []);
  t('leche nunca rellena el salado', !r.some(x => /Leche/.test(x.nombre)), r.map(x => x.nombre).join(' · '));
})();

console.log('\n===== RESULTADO: ' + pasadas + ' PASS / ' + falladas + ' FAIL =====');
if (falladas) process.exit(1);
