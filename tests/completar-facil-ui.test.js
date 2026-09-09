// ============================================================
// PRUEBAS de integración/UI de "Completar mi día" (FASE 2).
// Uso: node tests/completar-facil-ui.test.js
// Cubre: contexto real (getDailyMode + diario + evitar + favoritos),
// Agregar con componentes REALES (nunca "Completar mi día" ficticio),
// Cocinar abre la receta real, Otras 3 acumula mostradas, textos de
// tarjeta, preferencia "Facilidad para comer" y re-render tras agregar.
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

function makeSandbox(overrides) {
  const state = {
    profile: { objetivo: 'ganar peso', proteina: 180, carbos: 400, grasa: 100, llenado: 'normal' },
    diary: {}, recipeFavorites: [], recetasRecientes: [], evitar: ['lacteos']
  };
  const guardados = []; // registro de _guardarComida
  const win = { _completarMostradas: [], _completarPropuestas: null, scrollTo() {} };
  const panelEl = { innerHTML: '', scrollTop: 0, remove() { win._panelRemoved = true; } };
  const doc = {
    getElementById(id) { return id === 'completarPanel' ? panelEl : null; },
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
    abrirReceta(idx, modo) { win._abrio = { idx, modo }; },
    save() { win._saved = (win._saved || 0) + 1; },
    quickSaved() { win._quickSaved = true; },
    toastReg() {}, refrescarInicio() { win._refresh = (win._refresh || 0) + 1; },
    mealKeyLabel(k) { return ({ breakfast: 'desayuno', lunch: 'comida', dinner: 'cena', snacks: 'snack' })[k] || 'comida'; },
    completarFranja() { return overrides.franja || 'noche'; }
  };
  ['COMPLETAR_PESOS', 'COMPLETAR_LIMITES', 'COMPLETAR_FRANJAS', 'COMPLETAR_ALIMENTO', 'COMPLETAR_PLATOS',
    'COMPLETAR_VOLUMEN_TIPO', 'COMPLETAR_VOLUMEN_ALIMENTO', 'COMPLETAR_PUNTOS_VOL',
    'COMPLETAR_UNIDAD_TEXTO', 'COMPLETAR_UNIDAD_CONDE', 'COMPLETAR_EQUIV_CASERA', 'COMPLETAR_GENERICOS',
    'POTENCIAR_PESOS', 'POTENCIAR_UNIDAD_ESCALABLE', 'POTENCIAR_MICRO',
    'BEBIDA_BASE', 'BEBIDA_VARIANTE', 'BEBIDA_LIMITES', 'COMPLETAR_COMBOS_FACILES', 'CALORIAS_FACILES_FAMILIA', 'RECETA_AUXILIAR', 'RECETA_AUXILIAR_TIPO', 'RECETA_COCCION', 'RECETA_RECALENTABLE'].forEach(n => { sb[n] = extractVarAssign('var ' + n); });
  ['completarNombreCorto', 'completarCategoria', 'completarTituloUI'].forEach(n => { sb[n] = vm.runInNewContext('(' + extractFunc(n) + ')', sb); });
  ['completarNorm', 'completarSinAcentos', 'completarVolumen', 'completarDensidad', 'completarKcalMomento', 'completarCatalogo',
    'completarCandidatos', 'completarScore', 'completarVolMax', 'completarSuma', 'completarProponer', 'completarEsRapido', 'completarEsFacilParte', 'completarEsFacil', 'completarEsCandidatoFacil', 'completarEsEstructuraNatural', 'completarEtiquetaTipo', 'completarLineaMicro', 'recetaSugeridaPara', 'recetaResumenCorto', 'completarFiltrosActivos', 'completarFiltrosReset', 'completarFiltroRecetaDe', 'recetaPasaFiltros', 'recetaFaltantes', 'recetaCobertura', 'completarPalabrasAlimento', 'completarFoodsBase', 'completarBaseDe', 'completarFoodNombreDe', 'completarFibraFood', 'completarFibraReceta', 'completarFibraCandidato', 'completarFibraHoy', 'completarFiltrosUI', 'completarFiltroGet', 'completarFiltroToggle', 'completarFiltroTiempo', 'completarFiltroModoFaltante', 'completarFiltroLimpiar', 'completarFiltroTengoQuitar', 'completarFiltroTengoAgregar', 'completarFiltroTengoAgregarNombre', 'completarFiltroTengoBuscar', 'pickDiversoFacil', 'caloriasFacilesDe', 'bebidaFuncionesDe', 'completarFamiliaDe', 'completarFamiliasDe',
    'completarTextoTarjeta', 'completarCardHTML', 'completarCtxReal', 'completarMealKey',
    'completarFraccion', 'completarPorcion', 'completarVolBadge', 'completarPorcionComponente', 'completarParteTexto',
    'completarLineaPropuesta', 'completarLineaExtra',
    'potenciarFaltante', 'potenciarEscalarNombre', 'potenciarVariante', 'potenciarScore',
    'potenciarCategoria', 'potenciarRazon', 'potenciarFacilidad', 'potenciarEquivOz', 'potenciarRequierePrep', 'potenciarTextoFaltante', 'potenciarBaseHTML', 'progresoBarraHTML', 'progresoFilaHTML', 'potenciarProgresoHTML', 'potenciarEsMicroExtra',
    'bebidaCat', 'bebidaCombinaciones', 'bebidaTitulo', 'bebidaConstruir', 'bebidaTecho',
    'bebidaOtroSabor', 'bebidaMasCalorias', 'bebidaMasLigero', 'bebidaPropuesta', 'bebidaMenuHTML',
    'completarAbrir', 'completarPotenciar', 'potenciarHayExtras', 'completarRenderPanel', 'completarCerrar', 'completarOtras3', 'completarAgregar', 'completarCocinar'].forEach(n => { sb[n] = vm.runInNewContext('(' + extractFunc(n) + ')', sb); });
  ['ppTombstoneItem','ppActivos','ppTombstoneKey','ppKeyActivo','ppKeysActivas','ppDiarioActivos'].forEach(n => { sb[n] = vm.runInNewContext('(' + extractFunc(n) + ')', sb); });
['completarComidoYa','registrarComidaDiary','quitarRegistroComida','completarComiEsto'].forEach(n => { sb[n] = vm.runInNewContext('(' + extractFunc(n) + ')', sb); });
  sb.guardados = guardados;
  sb.panelEl = panelEl;
  return sb;
}

console.log('== 1 · Contexto real: lee getDailyMode/diario/evitar/favoritos ==');
(function () {
  const sb = makeSandbox({});
  const ctx = sb.completarCtxReal();
  t('kcal objetivo/consumidas vienen de getDailyMode', ctx.kcalObjetivo === 3000 && ctx.kcalConsumidas === 2100);
  t('macros del perfil', ctx.macrosObjetivo.p === 180 && ctx.macrosObjetivo.c === 400);
  t('evitar lácteos se expande con EVITAR_COMUNES', ctx.restricciones.includes('leche') && ctx.restricciones.includes('queso'));
  t('catalogo de recetas lleva scoreAudit real', sb.completarCatalogo(ctx).some(x => x.nombre === 'Chilaquiles con huevo' && x.scoreAudit === '🟢'));
  t('catalogo excluye la receta roja', !sb.completarCatalogo(ctx).some(x => x.nombre === 'Receta roja demo'));
  t('llenado leído del perfil', ctx.llenado === 'normal');
})();

console.log('== 2 · Agregar: componentes REALES, nunca ficticios ==');
(function () {
  const sb = makeSandbox({});
  const ctx = sb.completarCtxReal();
  const props = sb.completarProponer(ctx);
  t('hay propuestas con datos reales', props.length >= 1);
  sb.window._completarPropuestas = props;
  // elegir la primera propuesta multi-componente (o la primera)
  const idx = props.findIndex(p => p.componentes.length > 1) >= 0 ? props.findIndex(p => p.componentes.length > 1) : 0;
  const elegida = props[idx];
  sb.completarAgregar(idx);
  const nombres = sb.guardados.map(g => g.name);
  t('agrega TODOS los componentes reales', elegida.componentes.every(c => nombres.includes(c.nombre)), nombres.join(' · '));
  t('NUNCA guarda un alimento llamado "Completar mi día"', !nombres.some(n => /completar/i.test(n)));
  t('kcal sumadas coinciden con la propuesta', Math.round(sb.guardados.reduce((a, g) => a + g.kcal, 0)) === elegida.kcal);
  t('refrescarInicio se llamó (Balance se actualiza)', sb.window._refresh >= 1);
})();

console.log('== 3 · Cocinar abre la receta real ==');
(function () {
  const sb = makeSandbox({});
  const ctx = sb.completarCtxReal();
  const props = sb.completarProponer(ctx);
  sb.window._completarPropuestas = props;
  const idx = props.findIndex(p => p.componentes.some(c => c.tipo === 'receta'));
  if (idx >= 0) {
    sb.completarCocinar(idx);
    const ref = props[idx].componentes.find(c => c.tipo === 'receta').ref;
    t('abre la receta real en paso a paso', sb.window._abrio && sb.window._abrio.modo === 'pasoapaso' && (sb.window._abrio.idx === ref));
    t('cierra el panel antes de abrir', sb.window._panelRemoved === true);
  } else {
    t('(sin receta en propuestas en este contexto)', true);
  }
})();

console.log('== 4 · Otras 3 acumula mostradas (motor re-puntúa) ==');
(function () {
  const sb = makeSandbox({});
  const ctx = sb.completarCtxReal();
  const a = sb.completarProponer(ctx);
  sb.window._completarPropuestas = a;
  sb.completarOtras3();
  t('mostradas acumuladas', sb.window._completarMostradas.length === a.length);
  const b = sb.completarProponer(sb.completarCtxReal());
  t('siguiente lote evita las mostradas', b.every(p => !sb.window._completarMostradas.includes(p.titulo)));
})();

console.log('== 5 · Textos de la tarjeta ==');
(function () {
  const mk = (missing, franja, llenado) => {
    const sb = makeSandbox({ franja });
    sb.state.profile.llenado = llenado;
    sb.getDailyMode = () => ({ missingKcal: missing, food: { k: 0 } });
    return sb.completarTextoTarjeta();
  };
  t('mañana + llenado rápido → "algo ligero"', mk(640, 'manana', 'rapido') === 'Te conviene algo ligero');
  t('déficit grande → "vamos poco a poco"', mk(1400, 'trabajo', 'rapido') === 'Todavía te faltan bastantes calorías; vamos poco a poco');
  t('cerca → "Estás cerca de tu objetivo"', mk(150, 'noche', 'normal') === 'Estás cerca de tu objetivo');
  t('normal → "Te faltan N kcal"', mk(620, 'trabajo', 'normal') === 'Te faltan 620 kcal');
})();

console.log('== 6 · Preferencia "Facilidad para comer" (Ajustes → Alimentación) ==');
(function () {
  const sb = makeSandbox({});
  sb.f3AlimentacionSectionHTML = vm.runInNewContext('(' + extractFunc('f3AlimentacionSectionHTML') + ')', sb);
  const html = sb.f3AlimentacionSectionHTML();
  t('select con Normal y Me lleno rápido', html.includes('Me lleno rápido') && html.includes('cfgLlenado'));
  sb.state.profile.llenado = 'rapido';
  t('cambiar preferencia cambia el contexto del motor', sb.completarCtxReal().llenado === 'rapido');
  t('persiste vía state.profile (quickSaved en onchange)', /onchange="state\.profile\.llenado=this\.value;quickSaved\(\)"/.test(html));
})();

console.log('== 7 · Estado vacío: nunca inventar una tercera ==');
(function () {
  const sb = makeSandbox({});
  const ctx = sb.completarCtxReal();
  ctx.catalogo = { recetas: [], alimentos: [{ id: 'f0', nombre: 'Huevo', kcal: 72, p: 6, g: 5, c: 0 }] };
  const props = sb.completarProponer(ctx);
  t('catálogo casi vacío: 1-2 reales', props.length >= 1 && props.length <= 2, props.map(p => p.titulo).join(' | '));
})();

console.log('\n===== RESULTADO: ' + pasadas + ' PASS / ' + falladas + ' FAIL =====');
if (falladas) process.exit(1);
