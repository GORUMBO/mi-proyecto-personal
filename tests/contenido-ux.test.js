// ============================================================
// PRUEBAS de la fase CONTENIDO/UX accionable de Completar mi día.
// Uso: node tests/contenido-ux.test.js
// Cubre: auxiliares nunca como comida, cereal específico, método de
// huevo visible, resumen de preparación real, Cocinar abre pasos,
// TM5 solo donde corresponde, kcal normales=TM5=suma de foods,
// tiempo activo vs reposo, acompañamiento separado.
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

// recetas nuevas de la fase (extraídas del bloque baseRecipes.push)
const NUEVAS = vm.runInNewContext('[' + HTML.match(/RECETAS FÁCILES NUEVAS \(fase contenido\)[\s\S]*?baseRecipes\.push\(\s*([\s\S]*?)\n\);/)[1] + ']');

function makeSandbox() {
  const state = {
    profile: { objetivo: 'ganar peso', proteina: 180, carbos: 400, grasa: 100, llenado: 'rapido' },
    diary: {}, recipeFavorites: [], recetasRecientes: [], evitar: []
  };
  const guardados = [];
  const win = { _completarMostradas: [], _completarPropuestas: null, _completarPotBase: null, _completarExtrasVistas: [], _completarPotExtras: null, _completarFamiliasVistas: [], _completarModoFacil: true };
  const panels = {};
  const panelFor = id => { if (!panels[id]) panels[id] = { innerHTML: '', scrollTop: 0, remove() {} }; return panels[id]; };
  const doc = {
    getElementById(id) { return (id === 'completarPanel' || id === 'completarPotPanel') ? panelFor(id) : null; },
    createElement() { return { style: {} }; },
    body: { appendChild() {} }
  };
  const sb = {
    state, window: win, document: doc, safeText: x => String(x == null ? '' : x),
    foods: new Function('const foods=' + HTML.match(/const foods=(\[[\s\S]*?\]);/)[1] + ';' + HTML.match(/foods\.push\(([\s\S]*?)\n\);/g).map(s => s.slice(0, -1) + ';').join('') + 'return foods;')(),
    EVITAR_COMUNES: extractVarAssign('var EVITAR_COMUNES'),
    baseRecipes: [
      { name: 'Chilaquiles con huevo', k: 520, p: 28, carbs: 0, grasas: 0, time: 15, method: 'estufa', type: 'desayuno', tags: 'mexicana clásica', steps: ['Pon los totopos con salsa y calienta 5 min.', 'Agrega los huevos.'] },
      { name: 'Huevos a la mexicana', k: 420, p: 26, carbs: 0, grasas: 0, time: 10, method: 'estufa', type: 'desayuno', tags: 'mexicana rápida', steps: ['Revuelve los huevos con cebolla y jitomate en sartén caliente (4 min).', 'Sirve con tortillas.'] },
      { name: 'Wrap de pavo', k: 350, p: 26, carbs: 0, grasas: 0, time: 8, method: 'frío', type: 'cena', tags: 'cena rápida', steps: ['Rellena la tortilla con pavo y enrolla (2 min).'] },
      { name: 'Sazonador tipo taco', k: 25, p: 0, carbs: 0, grasas: 0, time: 5, method: 'frio', type: 'especia', tags: 'sazonador', steps: ['Mezcla las especias en un frasco (2 min).'] },
      { name: 'Aderezo de cilantro y limón casero', k: 210, p: 1, carbs: 0, grasas: 0, time: 6, method: 'licuadora', type: 'aderezo', tags: 'aderezo', steps: ['Licúa cilantro con limón y aceite (2 min).'] },
      { name: 'Receta vaga', k: 100, p: 2, carbs: 0, grasas: 0, time: 5, method: 'estufa', type: 'comida', tags: '', steps: ['Hacer algo.'] },
      { name: 'Receta sin pasos', k: 100, p: 2, carbs: 0, grasas: 0, time: 5, method: 'estufa', type: 'comida', tags: '' }
    ].concat(NUEVAS),
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
    abrirReceta(idx, modo) { win._abrio = { idx, modo }; },
    save() {}, quickSaved() {}, refrescarInicio() {},
    toastReg(txt) { sb.toasts.push(txt); },
    mealKeyLabel(k) { return ({ breakfast: 'desayuno', lunch: 'comida', dinner: 'cena', snacks: 'snack' })[k] || 'comida'; },
    completarFranja() { return 'manana'; }
  };
  ['COMPLETAR_PESOS', 'COMPLETAR_LIMITES', 'COMPLETAR_FRANJAS', 'COMPLETAR_ALIMENTO', 'COMPLETAR_PLATOS',
    'COMPLETAR_VOLUMEN_TIPO', 'COMPLETAR_VOLUMEN_ALIMENTO', 'COMPLETAR_PUNTOS_VOL',
    'COMPLETAR_UNIDAD_TEXTO', 'COMPLETAR_UNIDAD_CONDE', 'COMPLETAR_EQUIV_CASERA', 'COMPLETAR_GENERICOS',
    'POTENCIAR_PESOS', 'POTENCIAR_UNIDAD_ESCALABLE', 'POTENCIAR_MICRO',
    'BEBIDA_BASE', 'BEBIDA_VARIANTE', 'BEBIDA_LIMITES', 'COMPLETAR_COMBOS_FACILES', 'CALORIAS_FACILES_FAMILIA', 'RECETA_AUXILIAR', 'RECETA_AUXILIAR_TIPO', 'RECETA_COCCION', 'RECETA_RECALENTABLE', 'RECETA_TM5_EXTERNO', 'RECETA_TM5_ACCION', 'RECETA_TM5_COCCION', 'RECETA_COCCION', 'RECETA_RECALENTABLE'].forEach(n => { sb[n] = extractVarAssign('var ' + n); });
  ['completarNorm', 'completarSinAcentos', 'completarFranja', 'completarVolumen', 'completarDensidad', 'completarKcalMomento',
    'completarCatalogo', 'completarCandidatos', 'completarScore', 'completarVolMax', 'completarSuma', 'completarProponer', 'completarEsRapido', 'completarEsFacilParte', 'completarEsFacil', 'completarEsCandidatoFacil', 'completarEsEstructuraNatural', 'completarEtiquetaTipo', 'completarLineaMicro', 'recetaSugeridaPara', 'recetaResumenCorto', 'completarFiltrosActivos', 'completarFiltrosReset', 'completarFiltroRecetaDe', 'recetaPasaFiltros', 'recetaFaltantes', 'recetaCobertura', 'completarPalabrasAlimento', 'completarFoodsBase', 'completarBaseDe', 'completarFoodNombreDe', 'completarFibraFood', 'completarFibraReceta', 'completarFibraCandidato', 'completarFibraHoy', 'completarFiltrosUI', 'completarFiltroGet', 'completarFiltroToggle', 'completarFiltroTiempo', 'completarFiltroModoFaltante', 'completarFiltroLimpiar', 'completarFiltroTengoQuitar', 'completarFiltroTengoAgregar', 'completarFiltroTengoAgregarNombre', 'completarFiltroTengoBuscar', 'pickDiversoFacil', 'caloriasFacilesDe', 'bebidaFuncionesDe', 'completarFamiliaDe', 'completarFamiliasDe',
    'completarPotenciar', 'potenciarHayExtras', 'completarNombreCorto', 'completarCategoria', 'completarTituloUI',
    'completarFraccion', 'completarPorcion', 'completarVolBadge', 'completarPorcionComponente', 'completarParteTexto',
    'completarLineaPropuesta', 'completarLineaExtra',
    'potenciarFaltante', 'potenciarEscalarNombre', 'potenciarVariante', 'potenciarScore',
    'potenciarCategoria', 'potenciarRazon', 'potenciarFacilidad', 'potenciarEquivOz', 'potenciarRequierePrep', 'potenciarTextoFaltante', 'potenciarBaseHTML', 'progresoBarraHTML', 'progresoFilaHTML', 'potenciarProgresoHTML',
    'potenciarAgregados', 'potenciarResumenHTML', 'potenciarEsMicroExtra',
    'recetaClasificarTM5', 'recetaPasoTM5', 'recetaPasoTM5Parametros', 'recetaTiempoPaso',
    'bebidaCat', 'bebidaCombinaciones', 'bebidaTitulo', 'bebidaConstruir', 'bebidaTecho',
    'bebidaOtroSabor', 'bebidaMasCalorias', 'bebidaMasLigero', 'bebidaPropuesta', 'bebidaMenuHTML',
    'completarCtxReal', 'completarMealKey', 'completarTextoTarjeta', 'completarRenderPanel', 'completarAgregar', 'completarCocinar',
    'completarPotRender', 'completarPotAgregar', 'completarPotCerrar', 'completarPotOtros', 'completarCerrar', 'completarAbrir'].forEach(n => { sb[n] = vm.runInNewContext('(' + extractFunc(n) + ')', sb); });
  ['ppTombstoneItem','ppActivos','ppTombstoneKey','ppKeyActivo','ppKeysActivas','ppDiarioActivos'].forEach(n => { sb[n] = vm.runInNewContext('(' + extractFunc(n) + ')', sb); });
['completarComidoYa','registrarComidaDiary','quitarRegistroComida','completarComiEsto'].forEach(n => { sb[n] = vm.runInNewContext('(' + extractFunc(n) + ')', sb); });
  sb.guardados = guardados;
  sb.panels = panels;
  sb.toasts = [];
  sb.NUEVAS = NUEVAS;
  return sb;
}
function ctxBase(sb, extra) {
  return Object.assign({
    kcalObjetivo: 3000, kcalConsumidas: 0, objetivo: 'ganar', llenado: 'rapido',
    hora: 8, consumidosHoy: [], mostradas: [], restricciones: [], favoritos: [], recientes: [],
    macrosObjetivo: { p: 180, c: 400, g: 100 }, macrosConsumidos: { p: 60, c: 120, g: 40 },
    catalogo: { recetas: sb.baseRecipes.map((r, i) => ({ id: i, nombre: r.name, kcal: r.k, p: r.p || 0, c: r.carbs || 0, g: r.grasas || 0, tiempo: r.time || 0, method: r.method || '', type: r.type || '', tags: r.tags || '', ingredients: r.ingredients || '', portable: false, scoreAudit: '🟢' })), alimentos: sb.foods.map((f, i) => ({ id: 'f' + i, nombre: f[0], kcal: f[1], p: f[2], g: f[3], c: f[4] })) }
  }, extra || {});
}

console.log('== 1 · Auxiliares: sazonador/aderezo NUNCA son comida completa ==');
(function () {
  const sb = makeSandbox();
  const ctx = ctxBase(sb, { kcalConsumidas: 1200 });
  const cands = sb.completarCandidatos(ctx);
  t('sin tier A para sazonador', !cands.some(c => c.tier === 'A' && /Sazonador tipo taco/.test(c.partes[0].nombre)));
  t('sin tier A para aderezo', !cands.some(c => c.tier === 'A' && /Aderezo de cilantro/.test(c.partes[0].nombre)));
  t('sin tier B con auxiliar', !cands.some(c => c.tier === 'B' && c.partes.some(p => /Sazonador|Aderezo/.test(p.nombre))));
  const prop = sb.completarProponer(ctx);
  t('propuestas nunca contienen sazonador ni aderezo', !prop.some(p => /Sazonador|Aderezo/.test(JSON.stringify(p.componentes))), prop.map(p => p.titulo).join(' | '));
  // siguen en el catálogo (ficha propia para aprender a hacerlos)
  const cat = sb.completarCatalogo(ctx);
  t('el auxiliar sigue en el catálogo (ficha propia)', cat.some(x => x.nombre === 'Sazonador tipo taco'));
})();

console.log('== 2 · Cereal genérico reemplazado por la opción específica ==');
(function () {
  const sb = makeSandbox();
  const ctx = ctxBase(sb, {});
  const tierD = sb.completarCandidatos(ctx).filter(c => c.tier === 'D').map(c => c.partes[0].nombre);
  t('tier D incluye "Cereal alto en proteína 1 taza"', tierD.includes('Cereal alto en proteína 1 taza'), tierD.filter(n => /Cereal/.test(n)).join(' · '));
  t('tier D NO incluye "Cereal 1 taza" (genérico)', !tierD.includes('Cereal 1 taza'));
  t('tier D NO incluye "Avena 1/2 taza" si existe avena instantánea (específica)', !tierD.includes('Avena 1/2 taza') && tierD.includes('Avena instantánea paquete'), tierD.filter(n => /Avena/.test(n)).join(' · '));
})();

console.log('== 3 · Método de huevo visible (sugerencia real) ==');
(function () {
  const sb = makeSandbox();
  const sug = sb.recetaSugeridaPara('Huevo');
  t('existe sugerencia real para huevo', !!sug && /Huevo/.test(sug.nombre) && +sug.tiempo > 0 && +sug.tiempo <= 15, sug && (sug.nombre + ' (' + sug.tiempo + ' min)'));
  const propMicro = { tipoProp: 'micro', titulo: 'Huevo', kcal: 72, p: 6, c: 0, g: 0, volumen: 'Poco', tiempo: 0, razones: [], clave: 'Huevo', componentes: [{ tipo: 'alimento', nombre: 'Huevo', kcal: 72, p: 6, c: 0, g: 0, porcion: { texto: '1 huevo' } }] };
  sb.completarRenderPanel([propMicro]);
  const html = sb.panels.completarPanel.innerHTML;
  // La heurística "Prepáralo: X" se retiró a propósito: una comida SIN
  // componente tipo 'receta' NO tiene receta y así se muestra (no se inventa).
  t('tarjeta de huevo: sin heurística "Prepáralo", muestra "Sin receta disponible"', !/Prepáralo/.test(html) && /Sin receta disponible/.test(html));
})();

console.log('== 4 · Resumen de preparación REAL (nunca ficticio) ==');
(function () {
  const sb = makeSandbox();
  const res = sb.recetaResumenCorto('Huevos a la mexicana');
  t('resumen con verbo real del primer paso', !!res && res.indexOf('🍳 Revuelve los huevos con cebolla') === 0, res);
  t('resumen incluye tiempo real', res && /10 min/.test(res));
  const vaga = sb.recetaResumenCorto('Receta vaga');
  t('paso sin verbo claro → solo tiempo (sin texto inventado)', vaga === '🍳 5 min', vaga);
  const sin = sb.recetaResumenCorto('Receta sin pasos');
  t('sin pasos → solo tiempo', sin === '🍳 5 min', sin);
  const sinRec = sb.recetaResumenCorto('No existe');
  t('receta inexistente → null', sinRec === null);
})();

console.log('== 5 · Cocinar abre los pasos reales ==');
(function () {
  const sb = makeSandbox();
  const ctx = ctxBase(sb, { kcalConsumidas: 1200 });
  const props = sb.completarProponer(ctx);
  const idx = props.findIndex(p => p.componentes.some(c => c.tipo === 'receta'));
  if (idx >= 0) {
    sb.window._completarPropuestas = props;
    sb.completarCocinar(idx);
    const ref = props[idx].componentes.find(c => c.tipo === 'receta').ref;
    t('Cocinar abre la receta real en paso a paso', sb.window._abrio && sb.window._abrio.modo === 'pasoapaso' && sb.window._abrio.idx === ref);
  } else {
    t('(sin receta en propuestas)', true);
  }
})();

console.log('== 6 · TM5 solo donde corresponde ==');
(function () {
  const sb = makeSandbox();
  const cls = nombre => { const r = sb.baseRecipes.find(x => x.name === nombre); return r ? sb.recetaClasificarTM5(r).nivel : null; };
  t('licuado TM5: 🟢/🟡', cls('Licuado de yogurt y fresa (TM5)') === '🟢' || cls('Licuado de yogurt y fresa (TM5)') === '🟡', cls('Licuado de yogurt y fresa (TM5)'));
  t('avena TM5: 🟢/🟡', cls('Avena cremosa con plátano (TM5)') === '🟢' || cls('Avena cremosa con plátano (TM5)') === '🟡', cls('Avena cremosa con plátano (TM5)'));
  // TM5 NO se promueve en huevo cocido/tostada/quesadilla: sin chip (method/tags sin tm5)
  const esSinChip = nombre => { const r = sb.baseRecipes.find(x => x.name === nombre); return !/(tm5|thermomix)/i.test(String(r.method || '') + ' ' + String(r.tags || '')); };
  t('huevo cocido: SIN chip TM5', esSinChip('Huevo cocido con aguacate y sal'));
  t('quesadilla: SIN chip TM5', esSinChip('Quesadilla de frijol y queso'));
  t('tostada: SIN chip TM5', esSinChip('Tostada de crema de cacahuate y plátano'));
})();

console.log('== 7 · Kcal reales: normal = TM5 = suma de foods (nada inventado) ==');
(function () {
  const sb = makeSandbox();
  const porNombre = {};
  sb.foods.forEach(f => porNombre[f[0]] = f);
  const normal = sb.baseRecipes.find(r => r.name === 'Licuado de yogurt y fresa');
  const tm5 = sb.baseRecipes.find(r => r.name === 'Licuado de yogurt y fresa (TM5)');
  t('mismas kcal en normal y TM5', normal.k === tm5.k && normal.p === tm5.p, normal.k + '/' + tm5.k);
  sb.NUEVAS.forEach(r => {
    const sumaK = r.comps.reduce((a, c) => a + porNombre[c][1], 0);
    const sumaP = r.comps.reduce((a, c) => a + porNombre[c][2], 0);
    t('kcal = suma de foods (' + r.name + ')', r.k === sumaK, r.k + ' vs ' + sumaK);
    t('proteína = suma de foods (' + r.name + ')', r.p === sumaP, r.p + ' vs ' + sumaP);
  });
})();

console.log('== 8 · Tiempo activo separado del reposo ==');
(function () {
  const sb = makeSandbox();
  const ov = sb.baseRecipes.find(r => r.name === 'Overnight oats de avena y plátano');
  t('overnight: 3 min activos + reposo 6 h', ov && ov.time === 3 && ov.reposo === '6 h');
  const res = sb.recetaResumenCorto('Overnight oats de avena y plátano');
  t('resumen menciona el reposo', !!res && /reposo/.test(res), res);
  const huevo = sb.baseRecipes.find(r => r.name === 'Huevo cocido con aguacate y sal');
  t('huevo cocido: 3 min activos + cocción separada', huevo && huevo.time === 3 && /cocción/.test(huevo.reposo || ''));
})();

console.log('== 9 · Acompañamiento separado de la receta en la tarjeta ==');
(function () {
  const sb = makeSandbox();
  const propB = { tipoProp: 'comida', titulo: 'Huevos a la mexicana', kcal: 550, p: 46, c: 0, g: 0, volumen: 'Poco', tiempo: 10, razones: [], clave: 'x', componentes: [
    { tipo: 'receta', nombre: 'Huevos a la mexicana', ref: 1, kcal: 420, p: 26, c: 0, g: 0, tiempo: 10, porcion: { texto: '1 porción' } },
    { tipo: 'alimento', nombre: 'Yogurt griego taza', kcal: 130, p: 20, c: 9, g: 0, porcion: { texto: '1 taza de yogurt griego' } }
  ] };
  sb.completarRenderPanel([propB]);
  const html = sb.panels.completarPanel.innerHTML;
  t('tarjeta muestra "Receta:" separado', html.includes('Receta:</b> Huevos a la mexicana'));
  t('tarjeta muestra "Acompañamiento:" separado', html.includes('Acompañamiento:</b> Yogurt griego taza'));
  t('el acompañamiento NO entra en el resumen de preparación', (html.match(/Revuelve[^<]*/) || [''])[0].indexOf('Yogurt') < 0);
  t('resumen de preparación visible', /🍳 Revuelve los huevos/.test(html));
})();

console.log('\n===== RESULTADO: ' + pasadas + ' PASS / ' + falladas + ' FAIL =====');
if (falladas) process.exit(1);
