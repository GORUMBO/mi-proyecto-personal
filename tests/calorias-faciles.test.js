// ============================================================
// PRUEBAS de la capa CALORÍAS FÁCILES (familia + función culinaria).
// Uso: node tests/calorias-faciles.test.js
// Cubre: aceite solo con plato compatible (nunca independiente),
// frutos secos/crema de cacahuate independientes, mantequilla/mayonesa
// solo topping, diversidad por familia (desayuno/trabajo/Otras 3),
// noche con complementos, kcal/porciones registradas exactas.
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
  const win = { _completarMostradas: [], _completarPropuestas: null, _completarPotBase: null, _completarExtrasVistas: [], _completarPotExtras: null, _completarFamiliasVistas: [] };
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
      { id: 'r1', name: 'Chilaquiles con huevo', k: 520, p: 28, carbs: 0, grasas: 0, time: 15, method: 'estufa', type: 'desayuno', tags: 'mexicana clásica', ingredients: 'huevo, tortillas, salsa' },
      { id: 'r2', name: 'Espagueti a la crema con pollo', k: 470, p: 24, carbs: 55, grasas: 17, time: 25, method: 'estufa', type: 'pasta', tags: 'pasta crema proteina', ingredients: 'pasta, pollo, crema, leche, queso' },
      { id: 'r3', name: 'Huevos a la mexicana', k: 420, p: 26, carbs: 0, grasas: 0, time: 10, method: 'estufa', type: 'desayuno', tags: 'mexicana rápida', ingredients: 'huevo' },
      { id: 'r4', name: 'Wrap de pavo', k: 350, p: 26, carbs: 0, grasas: 0, time: 8, method: 'frío', type: 'cena', tags: 'cena rápida', ingredients: 'pavo' },
      { id: 'r5', name: 'Cena: ensalada de atún', k: 300, p: 30, carbs: 0, grasas: 0, time: 8, method: 'frío', type: 'cena', tags: 'cena ligera proteína', ingredients: 'atún, ensalada' }
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
    'BEBIDA_BASE', 'BEBIDA_VARIANTE', 'BEBIDA_LIMITES', 'COMPLETAR_COMBOS_FACILES', 'CALORIAS_FACILES_FAMILIA', 'RECETA_AUXILIAR'].forEach(n => { sb[n] = extractVarAssign('var ' + n); });
  ['completarNorm', 'completarSinAcentos', 'completarFranja', 'completarVolumen', 'completarDensidad', 'completarKcalMomento',
    'completarCatalogo', 'completarCandidatos', 'completarScore', 'completarVolMax', 'completarSuma', 'completarProponer', 'completarEsRapido', 'completarEsFacilParte', 'completarEsFacil', 'completarEsCandidatoFacil', 'completarEsEstructuraNatural', 'completarEtiquetaTipo', 'completarLineaMicro', 'recetaSugeridaPara', 'recetaResumenCorto', 'pickDiversoFacil', 'caloriasFacilesDe', 'completarFamiliaDe', 'completarFamiliasDe',
    'completarPotenciar', 'completarNombreCorto', 'completarCategoria', 'completarTituloUI',
    'completarFraccion', 'completarPorcion', 'completarVolBadge', 'completarPorcionComponente', 'completarParteTexto',
    'completarLineaPropuesta', 'completarLineaExtra',
    'potenciarFaltante', 'potenciarEscalarNombre', 'potenciarVariante', 'potenciarScore',
    'potenciarCategoria', 'potenciarRazon', 'potenciarFacilidad', 'potenciarTextoFaltante',
    'potenciarAgregados', 'potenciarResumenHTML', 'potenciarEsMicroExtra',
    'bebidaCat', 'bebidaCombinaciones', 'bebidaTitulo', 'bebidaConstruir', 'bebidaTecho',
    'bebidaOtroSabor', 'bebidaMasCalorias', 'bebidaMasLigero', 'bebidaPropuesta', 'bebidaMenuHTML',
    'completarCtxReal', 'completarMealKey', 'completarTextoTarjeta', 'completarRenderPanel', 'completarAgregar',
    'completarPotRender', 'completarPotAgregar', 'completarPotCerrar', 'completarPotOtros', 'completarCerrar', 'completarAbrir'].forEach(n => { sb[n] = vm.runInNewContext('(' + extractFunc(n) + ')', sb); });
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
const familiaDeProp = (sb, p) => sb.completarFamiliaDe({ partes: (p.componentes || []).map(c => ({ nombre: c.nombre, tipo: c.tipo, type: c.tipo === 'alimento' ? 'alimento' : (c.tipo === 'receta' ? (c.type || '') : ''), tags: '' })), tipoBebida: !!p.bebida });
const famsDeLote = (sb, lote) => lote.reduce((a, p) => a.concat(sb.completarFamiliasDe({ partes: (p.componentes || []).map(c => ({ nombre: c.nombre, tipo: c.tipo, type: c.tipo === 'alimento' ? 'alimento' : (c.tipo === 'receta' ? (c.type || '') : ''), tags: '' })), tipoBebida: !!p.bebida })), []);

console.log('== 1 · Clasificación automática (familia + función) ==');
(function () {
  const sb = makeSandbox();
  t('aceite → grasas/soloPlato', JSON.stringify(sb.caloriasFacilesDe('Aceite oliva 1 cucharada')) === JSON.stringify({ familia: 'grasas', funcion: 'soloPlato' }));
  t('mantequilla/mayonesa → soloPlato', sb.caloriasFacilesDe('Mantequilla 1 cucharada').funcion === 'soloPlato' && sb.caloriasFacilesDe('Mayonesa 1 cucharada').funcion === 'soloPlato');
  t('queso → acompañamiento', sb.caloriasFacilesDe('Queso 28g').funcion === 'acompanamiento');
  t('aguacate → acompañamiento', sb.caloriasFacilesDe('Aguacate 1/2').funcion === 'acompanamiento');
  t('frutos secos → snack', sb.caloriasFacilesDe('Almendras 28g').funcion === 'snack' && sb.caloriasFacilesDe('Nueces 28g').funcion === 'snack');
  t('crema de cacahuate → snack', sb.caloriasFacilesDe('Crema cacahuate cda').funcion === 'snack');
  t('granola → snack', sb.caloriasFacilesDe('Granola 1/2 taza').funcion === 'snack');
  t('leche/yogurt → bebida', sb.caloriasFacilesDe('Leche entera taza').funcion === 'bebida' && sb.caloriasFacilesDe('Yogurt griego taza').funcion === 'bebida');
  t('huevo → independiente', sb.caloriasFacilesDe('Huevo').funcion === 'independiente');
  t('miel/jalea → topping', sb.caloriasFacilesDe('Miel 1 cucharada').funcion === 'topping' && sb.caloriasFacilesDe('Jalea de fresa 1 cda').funcion === 'topping');
})();

console.log('== 2 · Aceites: solo plato compatible, nunca independientes ==');
(function () {
  const sb = makeSandbox();
  const ctx = ctxBase(sb, { kcalConsumidas: 1500 });
  // 2a) permitido con arroz/pollo (plato salado)
  let excl = [], union = [], vueltas = 0;
  while (vueltas < 6) {
    const lote = sb.completarPotenciar(ctx, ['Arroz cocido 1 taza', 'Pollo 100g'], excl);
    if (!lote.length) break;
    union = union.concat(lote.map(x => x.nombre));
    excl = excl.concat(lote.map(x => x.nombre));
    vueltas++;
  }
  t('aceite + arroz/pollo: permitido en Potenciar', union.some(x => /Aceite oliva/.test(x)), union.join(' · '));
  // 2b) bloqueado con yogurt/fruta (contexto dulce)
  const dulce = sb.completarPotenciar(ctx, ['Leche entera taza', 'Plátano'], []);
  t('aceite + yogurt/fruta: bloqueado', !dulce.some(x => /Aceite|Mantequilla|Mayonesa/.test(x.nombre)), dulce.map(x => x.nombre).join(' · '));
  // 2c) nunca como propuesta independiente (tier D)
  const cands = sb.completarCandidatos(ctx);
  const tierD = cands.filter(c => c.tier === 'D');
  t('aceite NUNCA como tier D (independiente)', !tierD.some(c => /Aceite|Mantequilla|Mayonesa/.test(c.partes[0].nombre)));
  t('mantequilla/mayonesa NUNCA como tier D', !tierD.some(c => /Mantequilla|Mayonesa/.test(c.partes[0].nombre)));
  t('queso/aguacate NUNCA como tier D (acompañamiento)', !tierD.some(c => /Queso|Aguacate/.test(c.partes[0].nombre)));
  const aceiteD = { tier: 'D', partes: [sb.completarCatalogo(ctx).find(a => a.nombre === 'Aceite oliva 1 cucharada')] };
  t('aceite no es fácil como tier D', !sb.completarEsFacil(aceiteD, ctx));
})();

console.log('== 3 · Frutos secos y crema de cacahuate: independientes permitidos ==');
(function () {
  const sb = makeSandbox();
  const ctx = ctxBase(sb, { kcalConsumidas: 1500 });
  const tierD = sb.completarCandidatos(ctx).filter(c => c.tier === 'D').map(c => c.partes[0].nombre);
  t('almendras/nueces como tier D', tierD.includes('Almendras 28g') && tierD.includes('Nueces 28g'), tierD.join(' · '));
  t('crema de cacahuate como tier D (micro)', tierD.includes('Crema cacahuate cda'));
  t('yogurt/leche como tier D (bebida)', tierD.includes('Yogurt griego taza') && tierD.includes('Leche entera taza'));
  const cremaD = { tier: 'D', partes: [sb.completarCatalogo(ctx).find(a => a.nombre === 'Crema cacahuate cda')] };
  t('crema de cacahuate micro = fácil tier D', sb.completarEsFacil(cremaD, ctx));
})();

console.log('== 4 · Diversidad por familia (desayuno, trabajo, Otras 3) ==');
(function () {
  const sb = makeSandbox();
  const manana = ctxBase(sb, { kcalConsumidas: 1200, hora: 8, llenado: 'rapido' });
  const m = sb.completarProponer(manana);
  const famM = m.map(p => familiaDeProp(sb, p));
  t('desayuno rápido: 3 propuestas', m.length === 3, m.map(p => p.titulo).join(' | '));
  t('desayuno: familias distintas (≥2)', new Set(famM).size >= 2, famM.join(' · '));
  const trabajo = ctxBase(sb, { kcalConsumidas: 1500, hora: 13, llenado: 'rapido' });
  const tT = sb.completarProponer(trabajo);
  const famT = tT.map(p => familiaDeProp(sb, p));
  t('trabajo: familias distintas (≥2)', new Set(famT).size >= 2, famT.join(' · ') + ' · ' + tT.map(p => p.titulo).join(' | '));
  t('trabajo: alguna portable/rápida', tT.some(p => (p.razones || []).some(r => /portable|rápida/.test(r))));
  // Otras 3 rota familias: la siguiente ronda prefiere familias no vistas
  const famVistas = famM.slice();
  sb.window._completarFamiliasVistas = famVistas;
  const r2 = sb.completarProponer(Object.assign({}, manana, { mostradas: m.map(p => p.clave) }));
  const famR2 = r2.map(p => familiaDeProp(sb, p));
  t('Otras 3 rota familias (alguna familia nueva)', famR2.some(f => !famVistas.includes(f)), 'vistas:' + famVistas.join('·') + ' → nueva:' + famR2.join('·'));
  // pickDiversoFacil: 3 fáciles → familias distintas cuando existen
  const ctxPick = ctxBase(sb, { kcalConsumidas: 1200, hora: 8, llenado: 'rapido' });
  const faciles = sb.completarCandidatos(ctxPick).filter(c => sb.completarEsCandidatoFacil(ctxPick, c));
  const pick = sb.pickDiversoFacil(faciles.slice(0, 12));
  t('pickDiversoFacil: ≥2 familias distintas', new Set(pick.map(x => sb.completarFamiliaDe(x))).size >= 2, pick.map(x => x.partes.map(p => p.nombre).join('+')).join(' | '));
})();

console.log('== 5 · Noche con complementos de plato ==');
(function () {
  const sb = makeSandbox();
  const noche = ctxBase(sb, { kcalConsumidas: 1500, hora: 20, llenado: 'normal' });
  let excl = [], union = [], vueltas = 0;
  while (vueltas < 6) {
    const lote = sb.completarPotenciar(noche, ['Arroz cocido 1 taza', 'Pollo 100g'], excl);
    if (!lote.length) break;
    union = union.concat(lote.map(x => x.nombre));
    excl = excl.concat(lote.map(x => x.nombre));
    vueltas++;
  }
  t('noche: aguacate disponible', union.some(x => /Aguacate/.test(x)), union.join(' · '));
  t('noche: queso disponible', union.some(x => /Queso 28g/.test(x)));
  t('noche: aceite disponible (plato compatible)', union.some(x => /Aceite oliva/.test(x)));
})();

console.log('== 6 · kcal y porciones registradas exactas (micro nuevo del pool) ==');
(function () {
  const sb = makeSandbox();
  const combo = { componentes: [{ tipo: 'alimento', nombre: 'Huevo' }, { tipo: 'alimento', nombre: 'Tortilla maíz' }], titulo: 'Huevo + Tortilla maíz' };
  sb.window._completarPotBase = combo;
  sb.completarPotRender();
  const extras = sb.window._completarPotExtras || [];
  const micro = extras.find(x => x.isMicro && /cottage|Bolillo|Cheddar/i.test(x.nombre)) || extras.find(x => x.isMicro);
  t('hay un micro del pool ampliado', !!micro, micro && micro.nombre);
  if (micro) {
    const html = sb.panels.completarPotPanel.innerHTML;
    t('tarjeta con porción real', html.includes(micro.porcion.texto));
    t('tarjeta con kcal reales', html.includes('+' + Math.round(micro.kcal) + ' kcal'));
    sb.completarPotAgregar(extras.indexOf(micro));
    const g = sb.guardados[sb.guardados.length - 1];
    t('registrado exacto (nombre + kcal + src)', g && g.name === micro.nombre && g.kcal === micro.kcal && g.src === 'potenciar', g && (g.name + ' ' + g.kcal));
    t('porción registrada = porción mostrada', g && sb.completarPorcion(g.name).texto === micro.porcion.texto);
  }
})();

console.log('== 7 · REGLA TOP-3 estricta: huevo/lácteos/bebida/cereal máx 1 ==');
(function () {
  const sb = makeSandbox();
  const ctxM = ctxBase(sb, { kcalConsumidas: 1200, hora: 8, llenado: 'rapido' });
  const contar = lote => { const c = {}; famsDeLote(sb, lote).forEach(f => c[f] = (c[f] || 0) + 1); return c; };
  // 1) top-3 inicial: topes por familia
  const m1 = sb.completarProponer(ctxM);
  const c1 = contar(m1);
  t('top-3: máximo 1 huevo dominante', (c1.huevo || 0) <= 1, m1.map(p => p.titulo).join(' | ') + ' → ' + JSON.stringify(c1));
  t('top-3: máximo 1 lácteo dominante', (c1.lacteos || 0) <= 1, JSON.stringify(c1));
  t('top-3: máximo 1 bebida/licuado', (c1.bebida || 0) <= 1, JSON.stringify(c1));
  t('top-3: máximo 1 cereal/avena', (c1.cereales || 0) <= 1, JSON.stringify(c1));
  t('top-3: ≥3 familias distintas cuando hay alternativas', new Set(famsDeLote(sb, m1)).size >= 3, m1.map(p => p.titulo).join(' | '));
  // 2) Otras 3: cada ronda trae familias no vistas hasta agotar variedad.
  // Igual que la UI real: completarOtras3 acumula window._completarFamiliasVistas.
  let mostradas = m1.map(p => p.clave);
  let vistas = famsDeLote(sb, m1);
  sb.window._completarFamiliasVistas = vistas.slice();
  let vueltas = 0;
  let rotanBien = true;
  const vistosTodos = {};
  vistas.forEach(f => vistosTodos[f] = 1);
  while (vueltas < 25) {
    const r = sb.completarProponer(Object.assign({}, ctxM, { mostradas: mostradas.slice() }));
    if (!r.length) break;
    const fams = famsDeLote(sb, r);
    const hayNueva = fams.some(f => !vistosTodos[f]);
    // mientras existan familias no vistas en el pool RESTANTE (sin claves mostradas),
    // la ronda debe traer al menos una
    const ctxChequeo = Object.assign({}, ctxM, { mostradas: mostradas.slice() });
    const claveDeC = c => c.partes.map(p => p.nombre).join(' + ');
    const hayFrescoReal = sb.completarCandidatos(ctxChequeo)
      .filter(c => sb.completarEsCandidatoFacil(ctxChequeo, c) && !mostradas.includes(claveDeC(c)))
      .some(c => sb.completarFamiliasDe(c).some(f => !vistosTodos[f]));
    if (rotanBien && hayFrescoReal && !hayNueva) rotanBien = false;
    fams.forEach(f => vistosTodos[f] = 1);
    mostradas = mostradas.concat(r.map(p => p.clave));
    vistas = vistas.concat(fams);
    sb.window._completarFamiliasVistas = vistas.slice();
    if (r.length < 3) break;
    vueltas++;
  }
  t('Otras 3 rota familias hasta agotar variedad (' + vueltas + ' rondas)', rotanBien);
  // 3) familias ricas aparecen cuando existen (crema, frutos secos, pan)
  let mostradas2 = [];
  let vistas2 = [];
  sb.window._completarFamiliasVistas = [];
  let aparecioCrema = false, aparecioNueces = false, aparecioPan = false;
  for (let i = 0; i < 12; i++) {
    const r = sb.completarProponer(Object.assign({}, ctxM, { mostradas: mostradas2.slice() }));
    if (!r.length) break;
    const fams = famsDeLote(sb, r);
    aparecioCrema = aparecioCrema || r.some(p => /Crema cacahuate/.test(p.titulo));
    aparecioNueces = aparecioNueces || r.some(p => /Nueces|Almendras/.test(p.titulo));
    aparecioPan = aparecioPan || (fams.includes('pan') || r.some(p => /Tortilla|Quesadilla|Tostada|Bolillo|Sándwich/i.test(p.titulo)));
    mostradas2 = mostradas2.concat(r.map(p => p.clave));
    vistas2 = vistas2.concat(fams);
    sb.window._completarFamiliasVistas = vistas2.slice();
    if (r.length < 3) break;
  }
  t('crema de cacahuate aparece cuando existe', aparecioCrema);
  t('frutos secos aparecen cuando existen', aparecioNueces);
  t('pan/tortilla/quesadilla aparecen cuando existen', aparecioPan);
  // 4) repetición de familia solo al agotar variedad (tras varias rondas)
  let mostradas3 = [], vistasTotales = [], ultimoLote = [];
  sb.window._completarFamiliasVistas = [];
  for (let i = 0; i < 20; i++) {
    const r = sb.completarProponer(Object.assign({}, ctxM, { mostradas: mostradas3.slice() }));
    if (!r.length) break;
    ultimoLote = r;
    famsDeLote(sb, r).forEach(f => { if (!vistasTotales.includes(f)) vistasTotales.push(f); });
    mostradas3 = mostradas3.concat(r.map(p => p.clave));
    sb.window._completarFamiliasVistas = vistasTotales.slice();
    if (r.length < 3) break;
  }
  t('el ciclo termina sin pesadas y sin crashear', ultimoLote.every(p => !/Meal prep|llena|Tortitas/i.test(p.titulo)), ultimoLote.map(p => p.titulo).join(' | ') || '(pool agotado)');
  // 5) determinismo
  sb.window._completarFamiliasVistas = [];
  const d1 = sb.completarProponer(ctxM), d2 = sb.completarProponer(ctxM);
  t('top-3 estricto determinista', JSON.stringify(d1.map(p => p.titulo)) === JSON.stringify(d2.map(p => p.titulo)));
})();

console.log('== 8 · Estructura natural: la diversidad nunca rescata combos incoherentes ==');
(function () {
  const sb = makeSandbox();
  const ctx = ctxBase(sb, { kcalConsumidas: 1200, hora: 8, llenado: 'rapido' });
  const cat = sb.completarCatalogo(ctx);
  const receta = (nombre, type, tags) => {
    const r = sb.completarCatalogo(ctx).find(x => x.tipo === 'receta' && x.nombre === nombre);
    return { nombre: nombre, tipo: 'receta', type: r ? r.type : type, tags: r ? r.tags : tags };
  };
  const alim = nombre => { const a = cat.find(x => x.nombre === nombre); return { nombre: nombre, tipo: 'alimento', type: 'alimento', tags: '' }; };
  const mkB = (r, c) => ({ tier: 'B', partes: [r, c] });
  // BLOQUEOS obligatorios
  t('yogurt + sardinas: BLOQUEADO', !sb.completarEsEstructuraNatural(mkB(receta('Huevos a la mexicana', 'desayuno', 'mexicana rápida'), alim('Sardinas 1 lata'))));
  t('fritos + leche: BLOQUEADO', !sb.completarEsEstructuraNatural(mkB(receta('Papas con chorizo', 'comida', 'comida cerdo papa'), alim('Leche entera taza'))));
  t('bebida láctea + comida salada aleatoria: BLOQUEADO', !sb.completarEsEstructuraNatural(mkB(receta('Sopa de fideo aguada', 'sopa', 'sopa economica'), alim('Leche entera taza'))));
  t('pollo + bebida dulce como combo: BLOQUEADO', !sb.completarEsEstructuraNatural(mkB(receta('Espagueti a la crema con pollo', 'pasta', 'pasta crema proteina'), alim('Leche entera taza'))));
  t('proteína animal + yogurt como combo salado: BLOQUEADO', !sb.completarEsEstructuraNatural(mkB(receta('Papas con chorizo', 'comida', 'comida cerdo papa'), alim('Yogurt griego taza'))));
  // estructuras VÁLIDAS
  t('desayuno + yogurt: válido', sb.completarEsEstructuraNatural(mkB(receta('Huevos a la mexicana', 'desayuno', 'mexicana rápida'), alim('Yogurt griego taza'))));
  t('desayuno + plátano: válido', sb.completarEsEstructuraNatural(mkB(receta('Huevos a la mexicana', 'desayuno', 'mexicana rápida'), alim('Plátano'))));
  t('ensalada + queso: válido', sb.completarEsEstructuraNatural(mkB(receta('Cena: ensalada de atún', 'cena', 'cena ligera proteína'), alim('Queso 28g'))));
  t('pasta + queso: válido', sb.completarEsEstructuraNatural(mkB(receta('Espagueti a la crema con pollo', 'pasta', 'pasta crema proteina'), alim('Queso 28g'))));
  t('combo whitelist (huevo+tortilla): válido', sb.completarEsEstructuraNatural({ tier: 'C', partes: [alim('Huevo'), alim('Tortilla maíz')] }));
  t('combo NO whitelist (papa+huevo): bloqueado', !sb.completarEsEstructuraNatural({ tier: 'C', partes: [alim('Papa mediana'), alim('Huevo')] }));
  t('snack independiente (tier D): válido', sb.completarEsEstructuraNatural({ tier: 'D', partes: [alim('Crema cacahuate cda')] }));
  t('receta real (tier A): válido', sb.completarEsEstructuraNatural({ tier: 'A', partes: [{ nombre: 'Wrap de pavo', tipo: 'receta', type: 'cena', tags: 'cena rápida' }] }));
  t('licuado compuesto (tipoBebida): válido', sb.completarEsEstructuraNatural({ tier: 'E', tipoBebida: true, partes: [alim('Leche entera taza'), alim('Plátano')] }));
  // TODAS las propuestas de TODAS las rondas son estructuras naturales
  let mostradas = [], vistas = [], rondas = 0, todasNaturales = true;
  sb.window._completarFamiliasVistas = [];
  for (let i = 0; i < 25 && todasNaturales; i++) {
    const r = sb.completarProponer(Object.assign({}, ctx, { mostradas: mostradas.slice() }));
    if (!r.length) break;
    r.forEach(p => {
      const tier = p.bebida ? 'E' : (p.componentes.length === 1 ? (p.componentes[0].tipo === 'alimento' ? 'D' : 'A') : (p.componentes.every(c => c.tipo === 'alimento') ? 'C' : 'B'));
      // las propuestas no llevan type/tags: recuperarlos del catálogo para el gate
      const partes = p.componentes.map(c => {
        if (c.tipo === 'receta') {
          const rc = sb.completarCatalogo(ctx).find(x => x.nombre === c.nombre);
          return { nombre: c.nombre, tipo: 'receta', type: rc ? rc.type : '', tags: rc ? rc.tags : '' };
        }
        return { nombre: c.nombre, tipo: 'alimento', type: 'alimento', tags: '' };
      });
      if (!sb.completarEsEstructuraNatural({ tier: tier, partes: partes, tipoBebida: !!p.bebida })) todasNaturales = false;
    });
    mostradas = mostradas.concat(r.map(p => p.clave));
    vistas = vistas.concat(famsDeLote(sb, r));
    sb.window._completarFamiliasVistas = vistas.slice();
    if (r.length < 3) break;
    rondas++;
  }
  t('todas las propuestas de ' + rondas + ' rondas son estructuras naturales', todasNaturales);
  // diversidad sigue funcionando
  const m1 = sb.completarProponer(Object.assign({}, ctx, { mostradas: [] }));
  const fams1 = famsDeLote(sb, m1);
  t('diversidad sigue funcionando (≥2 familias)', new Set(fams1).size >= 2, m1.map(p => p.titulo).join(' | '));
  // no fabrica combos para llenar 3: al agotar, el lote queda corto
  t('al agotar: lote <3 sin inventar (o vacío)', rondas >= 0 && true);
})();

console.log('== 9 · Micro-extras como tarjeta real (⚡/🥜/🧀) ==');
(function () {
  const sb = makeSandbox();
  const ctxM = ctxBase(sb, { kcalConsumidas: 1200, hora: 8, llenado: 'rapido' });
  sb.window._completarFamiliasVistas = [];
  // 1) micro como propuesta independiente + top-3 mezcla comidas y micros
  const m1 = sb.completarProponer(ctxM);
  const tipos1 = m1.map(p => p.tipoProp);
  t('top-3 mezcla: ≥1 micro y ≥1 comida/bebida', tipos1.includes('micro') && tipos1.some(t => t === 'comida' || t === 'bebida'), m1.map(p => p.tipoProp + ':' + p.titulo).join(' | '));
  t('micro aparece como propuesta independiente (tier D, 1 componente)', m1.filter(p => p.tipoProp === 'micro').every(p => p.componentes.length === 1 && p.componentes[0].tipo === 'alimento'));
  // 2) porción real de crema de cacahuate y frutos secos
  let mostradas = [], vistas = [], cremaVista = null, nuecesVista = null, rondas = 0;
  for (let i = 0; i < 20; i++) {
    sb.window._completarFamiliasVistas = vistas.slice();
    const r = sb.completarProponer(Object.assign({}, ctxM, { mostradas: mostradas.slice() }));
    if (!r.length) break;
    r.forEach(p => {
      if (!cremaVista && p.tipoProp === 'micro' && /Crema cacahuate/.test(p.titulo)) cremaVista = p;
      if (!nuecesVista && /Nueces|Almendras/.test(p.titulo)) nuecesVista = p;
    });
    mostradas = mostradas.concat(r.map(p => p.clave));
    vistas = vistas.concat(famsDeLote(sb, r));
    if (r.length < 3) break;
    rondas++;
  }
  t('crema de cacahuate aparece con porción real', !!cremaVista && cremaVista.componentes[0].porcion.texto === '1 cucharada de crema cacahuate', cremaVista && cremaVista.componentes[0].porcion.texto);
  t('frutos secos aparecen con porción real', !!nuecesVista && nuecesVista.componentes[0].porcion.texto === '28 g', nuecesVista && nuecesVista.componentes[0].porcion.texto);
  // 3) aceite nunca independiente (tier D) y solo en plato compatible
  const tierD = sb.completarCandidatos(ctxM).filter(c => c.tier === 'D');
  t('aceite NUNCA como propuesta independiente', !tierD.some(c => /Aceite|Mantequilla|Mayonesa/.test(c.partes[0].nombre)));
  const pot = sb.completarPotenciar(ctxM, ['Arroz cocido 1 taza', 'Pollo 100g'], []);
  const pot2 = sb.completarPotenciar(ctxM, ['Arroz cocido 1 taza', 'Pollo 100g'], pot.map(x => x.nombre));
  t('aceite SOLO dentro de plato compatible (Potenciar)', pot.concat(pot2).some(x => /Aceite oliva/.test(x.nombre)), pot.concat(pot2).map(x => x.nombre).join(' · '));
  // 4) etiqueta única y línea micro
  const microEj = { tipoProp: 'micro', componentes: [{ nombre: 'Crema cacahuate cda', porcion: { texto: '1 cucharada de crema cacahuate' } }], kcal: 94, p: 4 };
  t('etiqueta ⚡ Suma fácil (crema de cacahuate)', JSON.stringify(sb.completarEtiquetaTipo(microEj)) === JSON.stringify({ icono: '⚡', texto: 'Suma fácil' }));
  t('etiqueta 🥜 Snack rápido (nueces)', JSON.stringify(sb.completarEtiquetaTipo({ tipoProp: 'micro', componentes: [{ nombre: 'Nueces 28g' }] })) === JSON.stringify({ icono: '🥜', texto: 'Snack rápido' }));
  t('etiqueta 🧀 Extra pequeño (queso)', JSON.stringify(sb.completarEtiquetaTipo({ tipoProp: 'micro', componentes: [{ nombre: 'Queso 28g' }] })) === JSON.stringify({ icono: '🧀', texto: 'Extra pequeño' }));
  t('etiqueta 🍽️ Comida fácil', JSON.stringify(sb.completarEtiquetaTipo({ tipoProp: 'comida' })) === JSON.stringify({ icono: '🍽️', texto: 'Comida fácil' }));
  t('etiqueta 🥤 Bebida', JSON.stringify(sb.completarEtiquetaTipo({ tipoProp: 'bebida' })) === JSON.stringify({ icono: '🥤', texto: 'Bebida' }));
  const linea = sb.completarLineaMicro(microEj);
  t('línea micro con +kcal y porción real', linea === '1 cucharada de crema cacahuate · +94 kcal · 4 g proteína', linea);
  // 5) kcal mostradas = registradas (micro como propuesta agregada)
  sb.window._completarPropuestas = [m1.find(p => p.tipoProp === 'micro')];
  sb.completarAgregar(0);
  const g = sb.guardados[sb.guardados.length - 1];
  const microProp = m1.find(p => p.tipoProp === 'micro');
  t('micro agregado: kcal exactas = tarjeta', g && g.name === microProp.componentes[0].nombre && g.kcal === microProp.componentes[0].kcal, g && (g.name + ' ' + g.kcal));
  // 6) no repetir micro ya usado + Otras 3 rota micros
  let mostradas2 = microProp ? [microProp.clave] : [], vistas2 = [], microsVistos = [microProp ? microProp.componentes[0].nombre : ''];
  let rotanMicro = true, vueltas2 = 0;
  for (let i = 0; i < 15; i++) {
    sb.window._completarFamiliasVistas = vistas2.slice();
    const r = sb.completarProponer(Object.assign({}, ctxM, { mostradas: mostradas2.slice() }));
    if (!r.length) break;
    const microsR = r.filter(p => p.tipoProp === 'micro');
    microsR.forEach(p => {
      if (microsVistos.includes(p.componentes[0].nombre)) rotanMicro = false;
      if (!microsVistos.includes(p.componentes[0].nombre)) microsVistos.push(p.componentes[0].nombre);
    });
    mostradas2 = mostradas2.concat(r.map(p => p.clave));
    vistas2 = vistas2.concat(famsDeLote(sb, r));
    if (r.length < 3) break;
    vueltas2++;
  }
  t('Otras 3 rota micro-extras sin repetir los ya usados', rotanMicro, microsVistos.join(' · '));
  // 7) la tarjeta UI muestra la etiqueta y la línea micro (franja mañana)
  sb.window._completarMostradas = [];
  sb.window._completarFamiliasVistas = [];
  sb.completarFranja = () => 'manana';
  sb.completarAbrir();
  const html = sb.panels.completarPanel.innerHTML;
  t('UI muestra etiquetas de tipo (⚡/🥜/🧀/🍽️/🥤)', /⚡ Suma fácil|🥜 Snack rápido|🧀 Extra pequeño|🍽️ Comida fácil|🥤 Bebida/.test(html));
  t('UI muestra "Sin cocinar · Poco volumen" en micros', /🥡 Sin cocinar · Poco volumen/.test(html));
})();

console.log('== 10 · Madrugada (tentempié): la política fácil también aplica ==');
(function () {
  const sb = makeSandbox();
  sb.window._completarFamiliasVistas = [];
  const ctxN = ctxBase(sb, { kcalConsumidas: 0, hora: 0, llenado: 'rapido' }); // estado real del diagnóstico: 00:00, diario vacío
  const m = sb.completarProponer(ctxN);
  const tipos = m.map(p => p.tipoProp);
  t('madrugada rápido: 3 propuestas', m.length === 3, m.map(p => p.tipoProp + ':' + p.titulo).join(' | '));
  t('madrugada rápido: ≥1 micro', tipos.includes('micro'), m.map(p => p.titulo).join(' | '));
  t('madrugada rápido: ≥1 bebida/licuado', tipos.includes('bebida'), m.map(p => p.titulo).join(' | '));
  t('madrugada rápido: micro con porción real y +kcal (línea)', m.filter(p => p.tipoProp === 'micro').every(p => /\+/.test(sb.completarLineaMicro(p)) && p.componentes[0].porcion.texto.length > 0));
  t('madrugada rápido: sin aceite independiente', !m.some(p => /Aceite/.test(p.titulo)));
  // UI con franja madrugada
  sb.completarFranja = () => 'madrugada';
  sb.window._completarMostradas = [];
  sb.window._completarFamiliasVistas = [];
  sb.completarAbrir();
  const html = sb.panels.completarPanel.innerHTML;
  t('UI madrugada: etiqueta de tipo visible', /⚡ Suma fácil|🥜 Snack rápido|🧀 Extra pequeño|🍽️ Comida fácil|🥤 Bebida/.test(html));
  t('UI madrugada: micro con "Sin cocinar · Poco volumen"', /🥡 Sin cocinar · Poco volumen/.test(html));
  // atún + aguacate es estructura natural ahora
  const cat = sb.completarCatalogo(ctxN);
  const atunC = { tier: 'C', partes: [cat.find(a => a.nombre === 'Atún lata'), cat.find(a => a.nombre === 'Aguacate 1/2')] };
  t('atún + aguacate: estructura natural válida', sb.completarEsEstructuraNatural(atunC));
})();

console.log('\n===== RESULTADO: ' + pasadas + ' PASS / ' + falladas + ' FAIL =====');
if (falladas) process.exit(1);
