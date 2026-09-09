// ============================================================
// PRUEBAS de "Potenciar inteligente" (FASE 4).
// Uso: node tests/potenciar-inteligente.test.js
// Cubre: déficit real (kcal/proteína/carbos), razones derivadas,
// ranking por necesidad, escalado seguro, diversidad, recomputar
// tras agregar, no repetir, salado/licuado, catálogo pequeño,
// etiqueta única + facilidad y encabezado con datos reales.
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
    diary: {}, recipeFavorites: [], recetasRecientes: [], evitar: []
  };
  const guardados = [];
  const win = { _completarMostradas: [], _completarPropuestas: null, _completarPotBase: null, _completarExtrasVistas: [], _completarPotAgregados: [], _completarPotExtras: null };
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
      { id: 'r2', name: 'Espagueti a la crema con pollo', k: 470, p: 24, carbs: 55, grasas: 17, time: 25, method: 'estufa', type: 'pasta', tags: 'pasta crema proteina', ingredients: 'pasta, pollo, crema, leche, queso' }
    ],
    recetaAuditar(r) { return { score: '🟢', problemas: [] }; },
    // Balance dinámico: lee el diario REAL del sandbox (para recomputar tras agregar)
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
  ['ppTombstoneItem','ppActivos','ppTombstoneKey','ppKeyActivo','ppKeysActivas','ppDiarioActivos'].forEach(n => { sb[n] = vm.runInNewContext('(' + extractFunc(n) + ')', sb); });
  sb.guardados = guardados;
  sb.panels = panels;
  sb.toasts = [];
  return sb;
}
function ctxBase(sb, extra) {
  return Object.assign({
    kcalObjetivo: 3000, kcalConsumidas: 0, objetivo: 'ganar', llenado: 'normal',
    hora: 8, consumidosHoy: [], mostradas: [], restricciones: [], favoritos: [], recientes: [],
    macrosObjetivo: { p: 180, c: 400, g: 100 }, macrosConsumidos: { p: 0, c: 0, g: 0 },
    catalogo: { recetas: [], alimentos: sb.foods.map((f, i) => ({ id: 'f' + i, nombre: f[0], kcal: f[1], p: f[2], g: f[3], c: f[4] })) }
  }, extra || {});
}
const extrasDe = (sb, ctx, base) => sb.completarPotenciar(ctx, base, []);

console.log('== 1 · Faltante y encabezado derivados de datos reales ==');
(function () {
  const sb = makeSandbox();
  const f = sb.potenciarFaltante(ctxBase(sb, { kcalConsumidas: 2000, macrosConsumidos: { p: 100, c: 200, g: 50 } }));
  t('kcal restantes correctas', f.k === 1000);
  t('proteína/carbos/grasa restantes correctos', f.p === 80 && f.c === 200 && f.g === 50);
  t('macro más atrasado = carbohidratos', f.atrasado === 'c');
  t('encabezado: "Te faltan hoy: 1000 kcal · 80 g proteína"', sb.potenciarTextoFaltante(f) === 'Te faltan hoy: 1000 kcal · 80 g proteína');
  const f2 = sb.potenciarFaltante(ctxBase(sb, { kcalConsumidas: 2000, macrosConsumidos: { p: 178, c: 390, g: 95 } }));
  t('proteína casi cubierta se dice con su cifra real', sb.potenciarTextoFaltante(f2) === 'Te faltan hoy: 1000 kcal · 2 g proteína');
  t('sin macro atrasado cuando todo está casi cubierto', f2.atrasado === null);
})();

console.log('== 2 · Faltan muchas kcal, proteína bien: extras kcal-first, sin razones falsas ==');
(function () {
  const sb = makeSandbox();
  const ctx = ctxBase(sb, { kcalConsumidas: 1500, hora: 20, macrosConsumidos: { p: 170, c: 370, g: 95 } });
  const r = extrasDe(sb, ctx, ['Arroz cocido 1 taza', 'Pollo 100g']);
  t('3 extras reales', r.length === 3, r.map(x => x.titulo).join(' · '));
  t('ordenados por score (el mejor primero)', r[0].score >= r[1].score && r[1].score >= r[2].score);
  t('la mejor opción aporta kcal de verdad (≥400 en déficit grande)', r[0].kcal >= 400, r[0].nombre + ' ' + r[0].kcal);
  t('sin razón falsa de proteína/carbos (están bien)', r.every(x => !/Te falta proteína|Te faltan carbohidratos/.test(x.etiqueta.texto)), r.map(x => x.etiqueta.texto).join(' · '));
  t('razones del conjunto aprobado', r.every(x => /⭐|💪|🍚|🥤|⚡/.test(x.etiqueta.icono)));
  t('cada extra con porción y kcal reales', r.every(x => x.porcion.texto.length > 0 && x.kcal > 0));
})();

console.log('== 3 · Falta mucha proteína: 💪 Te falta proteína ==');
(function () {
  const sb = makeSandbox();
  const ctx = ctxBase(sb, { kcalConsumidas: 1500, hora: 20, macrosConsumidos: { p: 70, c: 300, g: 80 } });
  const r = extrasDe(sb, ctx, ['Arroz cocido 1 taza']);
  t('el mejor extra responde a la proteína que falta', r[0].etiqueta.icono === '💪' && r[0].etiqueta.texto === 'Te falta proteína', r[0].titulo + ' · ' + r[0].etiqueta.texto);
  t('ese extra aporta proteína real (≥10 g)', r[0].p >= 10, r[0].p + ' g');
  t('el scoring premia la proteína del macro atrasado', r[0].razones.some(x => /proteina/.test(x)), r[0].razones.join(' · '));
})();

console.log('== 4 · Faltan carbos: 🍚 Te faltan carbohidratos ==');
(function () {
  const sb = makeSandbox();
  const ctx = ctxBase(sb, { kcalConsumidas: 2000, hora: 13, macrosConsumidos: { p: 150, c: 200, g: 80 } });
  const r = extrasDe(sb, ctx, ['Huevo', 'Tortilla maíz']);
  t('el mejor extra responde a los carbohidratos', r[0].etiqueta.icono === '🍚' && r[0].etiqueta.texto === 'Te faltan carbohidratos', r[0].titulo + ' · ' + r[0].etiqueta.texto);
  t('aporta carbohidratos reales (≥30 g)', r[0].c >= 30, r[0].c + ' g');
})();

console.log('== 5 · Me lleno rápido: volumen suma puntos ==');
(function () {
  const sb = makeSandbox();
  const rapido = ctxBase(sb, { kcalConsumidas: 2000, hora: 13, llenado: 'rapido' });
  const normal = ctxBase(sb, { kcalConsumidas: 2000, hora: 13, llenado: 'normal' });
  const crema = { nombre: 'Crema cacahuate cda', kcal: 94, p: 4, c: 3, g: 8, volumen: 'Poco', factor: 1, tiempo: 0 };
  const scR = sb.potenciarScore(crema, rapido, sb.potenciarFaltante(rapido), 250, []);
  const scN = sb.potenciarScore(crema, normal, sb.potenciarFaltante(normal), 250, []);
  t('llenado rápido suma puntos por densidad', scR.score > scN.score && scR.razones.some(x => /denso/.test(x)), scR.score.toFixed(1) + ' vs ' + scN.score.toFixed(1));
  const cat = sb.potenciarCategoria({ kcal: 160, p: 2, c: 8, g: 15, volumen: 'Poco' }, rapido, sb.potenciarFaltante(rapido));
  t('alimento denso (agua cate) = categoría volumen', cat === 'v', cat);
})();

console.log('== 6 · Déficit pequeño: prefiere ajustado, nada excesivo ==');
(function () {
  const sb = makeSandbox();
  const ctx = ctxBase(sb, { kcalConsumidas: 2880, hora: 13, macrosConsumidos: { p: 170, c: 370, g: 95 } });
  const r = extrasDe(sb, ctx, ['Arroz cocido 1 taza', 'Pollo 100g']);
  t('nada excede 1.5× el faltante del momento (≤180)', r.every(x => x.kcal <= 180), r.map(x => x.kcal).join('/'));
  t('usa media porción escalada para acercarse (factor 0.5)', r.some(x => x.factor === 0.5), r.map(x => x.nombre + ' x' + x.factor).join(' · '));
  const mitad = r.find(x => x.factor === 0.5);
  t('porción escalada legible ("½ taza de frijol")', mitad && mitad.porcion.texto === '½ taza de frijol', mitad && mitad.porcion.texto);
  t('kcal escaladas = la mitad exacta del dato del catálogo', mitad && mitad.kcal === 120, mitad && mitad.kcal);
})();

console.log('== 7 · Noche con déficit grande: permite extras mayores ==');
(function () {
  const sb = makeSandbox();
  const ctx = ctxBase(sb, { kcalConsumidas: 1000, hora: 20, macrosConsumidos: { p: 60, c: 120, g: 40 } });
  const r = extrasDe(sb, ctx, ['Huevo', 'Tortilla maíz']);
  t('noche ofrece extras mayores (≥300 kcal)', r.some(x => x.kcal >= 300), r.map(x => x.nombre + ' ' + x.kcal).join(' · '));
  t('todos dentro del techo de la franja', r.every(x => x.kcal <= 1100));
})();

console.log('== 8 · Después de agregar: Balance refresca, recalcula y excluye ==');
(function () {
  const sb = makeSandbox();
  const combo = { componentes: [{ tipo: 'alimento', nombre: 'Arroz cocido 1 taza' }, { tipo: 'alimento', nombre: 'Pollo 100g' }], titulo: 'Arroz cocido + Pollo' };
  sb.window._completarPotBase = combo;
  sb.completarPotRender();
  const antes = sb.potenciarFaltante(sb.completarCtxReal()).k;
  const lote1 = (sb.window._completarPotExtras || []).slice();
  t('lote inicial con 3 extras', lote1.length === 3, lote1.map(x => x.nombre).join(' · '));
  const agregado = lote1[0];
  sb.completarPotAgregar(0);
  const despues = sb.potenciarFaltante(sb.completarCtxReal()).k;
  t('Balance recalculado: faltante bajó lo que aporta el extra', despues === Math.max(0, antes - agregado.kcal), antes + ' → ' + despues);
  t('diario registró exactamente lo mostrado', sb.guardados.length === 1 && sb.guardados[0].name === agregado.nombre && sb.guardados[0].kcal === agregado.kcal, sb.guardados.map(g => g.name + ' ' + g.kcal).join(' · '));
  const lote2 = (sb.window._completarPotExtras || []).slice();
  t('ofrece 3 nuevas tras agregar', lote2.length === 3, lote2.map(x => x.nombre).join(' · '));
  t('excluye el extra recién agregado (y sus variantes)', lote2.every(x => sb.completarNombreCorto(x.nombre) !== sb.completarNombreCorto(agregado.nombre)));
  t('el panel sigue abierto para seguir potenciando', sb.panels.completarPotPanel.innerHTML.includes('＋ Agregar extra'));
})();

console.log('== 9 · Combo salado no recibe bebida absurda ==');
(function () {
  const sb = makeSandbox();
  const ctx = ctxBase(sb, { kcalConsumidas: 1500, hora: 20, macrosConsumidos: { p: 70, c: 300, g: 80 } });
  const r = extrasDe(sb, ctx, ['Arroz cocido 1 taza', 'Pollo 100g']);
  t('sin leche ni yogurt de relleno en combo salado', !r.some(x => /Leche|Yogurt/.test(x.nombre)), r.map(x => x.nombre).join(' · '));
})();

console.log('== 10 · Licuado recibe extras naturales ==');
(function () {
  const sb = makeSandbox();
  const ctx = ctxBase(sb, { kcalConsumidas: 2000, hora: 13, macrosConsumidos: { p: 100, c: 200, g: 60 } });
  const r = extrasDe(sb, ctx, ['Leche entera taza', 'Plátano']);
  const cortos = r.map(x => sb.completarNombreCorto(x.nombre));
  t('crema de cacahuate disponible', cortos.includes('Crema cacahuate'), r.map(x => x.nombre).join(' · '));
  t('avena disponible', cortos.includes('Avena'));
  t('yogurt disponible', cortos.includes('Yogurt griego'));
})();

console.log('== 11 · Escalado solo cuando es matemáticamente seguro ==');
(function () {
  const sb = makeSandbox();
  const v = (n, f) => sb.potenciarVariante({ nombre: n, kcal: 205, p: 4, c: 45, g: 0, volumen: 'Normal', tipo: 'alimento', tiempo: 0, metodo: '' }, f, 120, 600);
  t('Huevo nunca escala', sb.potenciarEscalarNombre('Huevo', 0.5) === null && sb.potenciarEscalarNombre('Huevo', 2) === null);
  t('Aguacate 1/2 nunca escala (fracción natural)', sb.potenciarEscalarNombre('Aguacate 1/2', 2) === null);
  t('Papa mediana nunca escala (tamaño)', sb.potenciarEscalarNombre('Papa mediana', 0.5) === null);
  t('Atún lata nunca escala (unidad natural)', sb.potenciarEscalarNombre('Atún lata', 2) === null);
  t('Plátano nunca escala (unidad natural)', sb.potenciarEscalarNombre('Plátano', 2) === null);
  t('taza SÍ escala: 1 taza → 1/2 taza', sb.potenciarEscalarNombre('Arroz cocido 1 taza', 0.5) === 'Arroz cocido 1/2 taza');
  t('taza SÍ escala: ×2 → 2 tazas', sb.potenciarEscalarNombre('Arroz cocido 1 taza', 2) === 'Arroz cocido 2 tazas');
  t('gramos SÍ escalan: 28g → 14 g / 56 g', sb.potenciarEscalarNombre('Queso 28g', 0.5) === 'Queso 14 g' && sb.potenciarEscalarNombre('Queso 28g', 2) === 'Queso 56 g');
  t('unidad sola SÍ escala: taza → 2 tazas', sb.potenciarEscalarNombre('Leche entera taza', 2) === 'Leche entera 2 tazas');
  t('piso de 60 kcal: ½ cucharada de crema NO se ofrece', v('Crema cacahuate cda', 0.5) === null || sb.potenciarVariante({ nombre: 'Crema cacahuate cda', kcal: 94, p: 4, c: 3, g: 8, volumen: 'Poco', tipo: 'alimento', tiempo: 0, metodo: '' }, 0.5, 120, 600) === null);
  const medio = sb.potenciarVariante({ nombre: 'Arroz cocido 1 taza', kcal: 205, p: 4, c: 45, g: 0, volumen: 'Normal', tipo: 'alimento', tiempo: 0, metodo: '' }, 0.5, 120, 600);
  t('variante escalada: nombre + kcal coherentes', medio && medio.nombre === 'Arroz cocido 1/2 taza' && medio.kcal === 103, medio && (medio.nombre + ' ' + medio.kcal));
  const por2 = sb.potenciarVariante({ nombre: 'Arroz cocido 1 taza', kcal: 205, p: 4, c: 45, g: 0, volumen: 'Normal', tipo: 'alimento', tiempo: 0, metodo: '' }, 2, 420, 1100);
  t('×2 en déficit grande: 2 tazas 410 kcal', por2 && por2.nombre === 'Arroz cocido 2 tazas' && por2.kcal === 410, por2 && (por2.nombre + ' ' + por2.kcal));
  t('escalado que NO mejora el faltante se descarta', sb.potenciarVariante({ nombre: 'Arroz cocido 1 taza', kcal: 205, p: 4, c: 45, g: 0, volumen: 'Normal', tipo: 'alimento', tiempo: 0, metodo: '' }, 2, 250, 600) === null);
})();

console.log('== 12 · Catálogo pequeño: menos de 3 sin inventar ==');
(function () {
  const sb = makeSandbox();
  const ctx = ctxBase(sb, { kcalConsumidas: 2000, hora: 13, catalogo: { recetas: [], alimentos: sb.foods.slice(0, 2).map((f, i) => ({ id: 'f' + i, nombre: f[0], kcal: f[1], p: f[2], g: f[3], c: f[4] })) } });
  const r = extrasDe(sb, ctx, ['Huevo']);
  t('1-2 extras reales, nunca inventados', r.length >= 1 && r.length <= 2, r.map(x => x.nombre).join(' · '));
})();

console.log('== 13 · Etiqueta única + facilidad + máximo 3 tarjetas ==');
(function () {
  const sb = makeSandbox();
  const ctx = ctxBase(sb, { kcalConsumidas: 1500, hora: 20, macrosConsumidos: { p: 70, c: 300, g: 80 } });
  const r = extrasDe(sb, ctx, ['Arroz cocido 1 taza', 'Pollo 100g']);
  t('máximo 3 tarjetas', r.length <= 3);
  t('una razón principal por extra', r.every(x => x.etiqueta && x.etiqueta.icono && x.etiqueta.texto));
  t('una facilidad real por extra (🥡 para alimentos)', r.every(x => x.facilidad && x.facilidad.texto === 'Listo para comer'));
  const recalentar = sb.potenciarFacilidad({ tipo: 'receta', tiempo: 0, metodo: 'recalentar' });
  const rapido = sb.potenciarFacilidad({ tipo: 'receta', tiempo: 5, metodo: '' });
  t('facilidad con dato real: 🔥 Recalentar / ⚡ 5 min', recalentar.icono === '🔥' && rapido.texto === '5 min');
  // equivalencia exacta: lo mostrado ES lo registrado
  const x = r[0];
  t('porción mostrada = porción del nombre registrado', x.porcion.texto === sb.completarPorcion(x.nombre).texto);
  const cat = sb.completarCatalogo(ctx).find(a => a.nombre === x.nombreBase);
  t('kcal mostradas = dato del catálogo × factor', cat && x.kcal === Math.round(cat.kcal * x.factor), cat && (x.kcal + ' vs ' + cat.kcal + 'x' + x.factor));
})();

console.log('== 14 · UX tras agregar: confirmación, resumen, encabezado y estado vacío ==');
(function () {
  const sb = makeSandbox();
  const combo = { componentes: [{ tipo: 'alimento', nombre: 'Arroz cocido 1 taza' }, { tipo: 'alimento', nombre: 'Pollo 100g' }], titulo: 'Arroz cocido + Pollo' };
  sb.window._completarPotBase = combo;
  sb.completarPotRender();
  const htmlAntes = sb.panels.completarPotPanel.innerHTML;
  t('encabezado antes: faltante real', htmlAntes.includes('Te faltan hoy: 3000 kcal'), (htmlAntes.match(/Te faltan hoy: \d+ kcal[^<]*/) || ['?'])[0]);
  t('sin resumen antes de agregar nada', !htmlAntes.includes('Agregado a esta comida'));
  const x = sb.window._completarPotExtras[0];
  sb.completarPotAgregar(0);
  const htmlDespues = sb.panels.completarPotPanel.innerHTML;
  const faltaDespues = sb.potenciarFaltante(sb.completarCtxReal()).k;
  const esperado = Math.max(0, 3000 - x.kcal);
  // 1) toast con datos REALES registrados
  const msg = sb.toasts[sb.toasts.length - 1] || '';
  t('toast confirma con el nombre exacto registrado', msg.includes('Se agregó ' + x.nombre), msg);
  t('toast muestra kcal reales del extra', msg.includes('+' + Math.round(x.kcal) + ' kcal'), msg);
  t('toast muestra proteína real del extra', msg.includes('+' + Math.round(x.p * 10) / 10 + ' g proteína'), msg);
  t('toast muestra el faltante nuevo real', msg.includes('Ahora te faltan ' + Math.round(faltaDespues) + ' kcal') && faltaDespues === esperado, msg);
  // 2) tarjeta agregada pasa al resumen con ✅
  t('resumen visible tras agregar', htmlDespues.includes('Agregado a esta comida'));
  t('la tarjeta agregada aparece marcada ✅', htmlDespues.includes('✅ ' + x.nombre), (htmlDespues.match(/✅ [^<]*/) || ['?'])[0]);
  t('total añadido real (+kcal · +proteína)', htmlDespues.includes('Total añadido aquí: +' + Math.round(x.kcal) + ' kcal · +' + (Math.round(x.p * 10) / 10) + ' g proteína'));
  // 3) encabezado recalculado al instante
  t('encabezado después: faltante nuevo', htmlDespues.includes('Te faltan hoy: ' + Math.round(faltaDespues) + ' kcal'), (htmlDespues.match(/Te faltan hoy: \d+ kcal[^<]*/) || ['?'])[0]);
  // 4) coherencia al reabrir: el resumen viene del diario real
  sb.window._completarPotBase = combo; // simula reapertura con la misma base
  sb.completarPotRender();
  const htmlReabre = sb.panels.completarPotPanel.innerHTML;
  t('al reabrir, el resumen sigue (estado real del diario)', htmlReabre.includes('✅ ' + x.nombre) && htmlReabre.includes('Total añadido aquí'));
  const lotReabre = (sb.window._completarPotExtras || []).map(e => sb.completarNombreCorto(e.nombre));
  t('al reabrir, no re-ofrece lo ya agregado', !lotReabre.includes(sb.completarNombreCorto(x.nombre)));
  // 5) estado vacío claro cuando no queda nada
  const sb2 = makeSandbox();
  const combo2 = { componentes: [{ tipo: 'alimento', nombre: 'Huevo' }], titulo: 'Huevo' };
  sb2.window._completarPotBase = combo2;
  const ctxPequeno = { kcalObjetivo: 3000, kcalConsumidas: 2000, objetivo: 'ganar', llenado: 'normal', hora: 13, consumidosHoy: [], mostradas: [], restricciones: [], favoritos: [], recientes: [], macrosObjetivo: { p: 180, c: 400, g: 100 }, macrosConsumidos: { p: 100, c: 200, g: 60 }, catalogo: { recetas: [], alimentos: sb2.foods.slice(0, 2).map((f, i) => ({ id: 'f' + i, nombre: f[0], kcal: f[1], p: f[2], g: f[3], c: f[4] })) } };
  sb2.completarCtxReal = function () { return ctxPequeno; };
  sb2.completarPotRender();
  const lotPeq = (sb2.window._completarPotExtras || []).slice();
  t('catálogo pequeño: 1 extra disponible', lotPeq.length === 1, lotPeq.map(e => e.nombre).join(' · '));
  sb2.completarPotAgregar(0);
  const htmlVacio = sb2.panels.completarPotPanel.innerHTML;
  t('estado vacío: explica qué pasó', htmlVacio.includes('Ya agregaste un extra o no hay más extras compatibles'));
  t('estado vacío: comida completa con lo disponible', htmlVacio.includes('Esta comida ya está completa con lo disponible'));
  t('estado vacío: sugiere volver al contador', htmlVacio.includes('Vuelve al contador'));
})();

console.log('\n===== RESULTADO: ' + pasadas + ' PASS / ' + falladas + ' FAIL =====');
if (falladas) process.exit(1);
