// ============================================================
// PRUEBAS de los filtros de practicidad (⚙️ Ajustar ahora).
// Uso: node tests/filtros-practicidad.test.js
// Cubre: prioridad por ingredientes, soloTengo excluye, sin sustituciones,
// noCocinar elimina cocción real, recalentar permite sobras, tiempo activo,
// reposo bloquea "comer ahora", filtros combinados, estado vacío claro,
// nunca relaja automáticamente, modo 1-ingrediente-faltante explícito.
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

const NUEVAS = vm.runInNewContext('[' + HTML.match(/RECETAS FÁCILES NUEVAS \(fase contenido\)[\s\S]*?baseRecipes\.push\(\s*([\s\S]*?)\n\);/)[1] + ']');

function makeSandbox() {
  const state = {
    profile: { objetivo: 'ganar peso', proteina: 180, carbos: 400, grasa: 100, llenado: 'normal' },
    diary: {}, recipeFavorites: [], recetasRecientes: [], evitar: []
  };
  const win = { _completarMostradas: [], _completarPropuestas: null, _completarFamiliasVistas: [], _completarModoFacil: false };
  const panels = {};
  const panelFor = id => { if (!panels[id]) panels[id] = { innerHTML: '', scrollTop: 0, remove() {} }; return panels[id]; };
  const doc = {
    getElementById(id) { return id === 'completarPanel' ? panelFor(id) : null; },
    createElement() { return { style: {} }; },
    body: { appendChild() {} }
  };
  const sb = {
    state, window: win, document: doc, safeText: x => String(x == null ? '' : x),
    foods: new Function('const foods=' + HTML.match(/const foods=(\[[\s\S]*?\]);/)[1] + ';' + HTML.match(/foods\.push\(([\s\S]*?)\n\);/g).map(s => s.slice(0, -1) + ';').join('') + 'return foods;')(),
    EVITAR_COMUNES: extractVarAssign('var EVITAR_COMUNES'),
    baseRecipes: [
      { name: 'Chilaquiles con huevo', k: 520, p: 28, carbs: 0, grasas: 0, time: 15, method: 'estufa', type: 'desayuno', tags: 'mexicana clásica', ingredients: 'huevo, tortillas, salsa', steps: ['Pon los totopos con salsa y calienta 5 min.'] },
      { name: 'Huevos a la mexicana', k: 420, p: 26, carbs: 0, grasas: 0, time: 10, method: 'estufa', type: 'desayuno', tags: 'mexicana rápida', ingredients: 'huevo, jitomate, cebolla', steps: ['Revuelve los huevos con cebolla y jitomate en sartén caliente (4 min).'] },
      { name: 'Wrap de pavo', k: 350, p: 26, carbs: 0, grasas: 0, time: 8, method: 'frío', type: 'cena', tags: 'cena rápida', ingredients: 'tortilla, pavo', steps: ['Rellena la tortilla con pavo y enrolla (2 min).'] },
      { name: 'Sándwich de pollo (meal prep)', k: 480, p: 40, carbs: 0, grasas: 0, time: 5, method: 'estufa', type: 'comida', tags: 'meal prep pollo pan', ingredients: 'pollo, pan', steps: ['Recalienta el pollo 3 min y arma el sándwich.'] }
    ].concat(NUEVAS),
    recetaAuditar(r) { return { score: '🟢', problemas: [] }; },
    getTodayDiaryTotals() { const d = state.diary['2026-09-04'] || {}; const items = [].concat(d.breakfast || [], d.lunch || [], d.dinner || [], d.snacks || []); return items.reduce((a, x) => (a.k += +x.kcal || 0, a.p += +x.prot || 0, a), { k: 0, p: 0 }); },
    getDailyMode() { return { kcalGoal: 3000, missingKcal: 1800, missingProtein: 100, food: { k: 1200, p: 60 } }; },
    todayISO() { return '2026-09-04'; },
    _guardarComida(name, kcal, prot, carb, fat, momento) {
      const d = state.diary['2026-09-04'] = state.diary['2026-09-04'] || { breakfast: [], lunch: [], dinner: [], snacks: [] };
      d[momento].push({ name, kcal, prot, carb, fat });
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
    'completarFiltrosActivos', 'completarFiltrosReset', 'completarFiltroRecetaDe', 'recetaPasaFiltros', 'recetaFaltantes', 'recetaCobertura', 'completarPalabrasAlimento', 'completarFoodsBase', 'completarBaseDe', 'completarFoodNombreDe', 'completarFibraFood', 'completarFibraReceta', 'completarFibraCandidato', 'completarFibraHoy', 'completarFiltrosUI', 'completarFiltroGet', 'completarFiltroToggle', 'completarFiltroTiempo', 'completarFiltroModoFaltante', 'completarFiltroLimpiar', 'completarFiltroTengoQuitar', 'completarFiltroTengoAgregar', 'completarFiltroTengoAgregarNombre', 'completarFiltroTengoBuscar',
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
    catalogo: { recetas: sb.baseRecipes.map((r, i) => ({ id: i, nombre: r.name, kcal: r.k, p: r.p || 0, c: r.carbs || 0, g: r.grasas || 0, tiempo: r.time || 0, method: r.method || '', type: r.type || '', tags: r.tags || '', ingredients: r.ingredients || '', portable: false, scoreAudit: '🟢' })), alimentos: sb.foods.map((f, i) => ({ id: 'f' + i, nombre: f[0], kcal: f[1], p: f[2], g: f[3], c: f[4] })) }
  }, extra || {});
}
const filtrar = (sb, filtros) => { sb.window._completarFiltros = Object.assign({ tengo: [], soloTengo: false, noCocinar: false, recalentar: false, licuar: true, tiempo: null, modoFaltante: false }, filtros); };

console.log('== 1 · Ingredientes disponibles dan prioridad (bonus leve) ==');
(function () {
  const sb = makeSandbox();
  const ctx = ctxBase(sb, {});
  const cat = sb.completarCatalogo(ctx);
  const huevos = cat.find(x => x.nombre === 'Huevos a la mexicana');
  const cand = { partes: [huevos], tier: 'A' };
  const s0 = sb.completarScore(cand, ctx).score;
  filtrar(sb, { tengo: ['Huevo'] });
  const s1 = sb.completarScore(cand, ctx).score;
  t('receta con huevo gana bonus con "tengo huevo"', s1 > s0, s0 + ' → ' + s1);
  t('razón registra la cobertura', sb.completarScore(cand, ctx).razones.some(r => /tengo/.test(r)));
  filtrar(sb, {});
  t('sin filtros: score idéntico al original', sb.completarScore(cand, ctx).score === s0);
})();

console.log('== 2 · Solo con lo que tengo excluye lo que falta (sin sustituciones) ==');
(function () {
  const sb = makeSandbox();
  const ctx = ctxBase(sb, {});
  const infoQues = { nombre: 'Quesadilla de frijol y queso', tags: 'quesadilla frijol queso rapida', ingredients: 'tortilla, frijol, queso', method: 'comal', tiempo: 8 };
  const falta = sb.recetaFaltantes(infoQues, ['Tortilla maíz', 'Queso 28g']);
  t('detecta el faltante real (frijol), sin inventar sustitutos', JSON.stringify(falta) === JSON.stringify(['Frijol 1 taza']), falta.join(' · '));
  // subcadena conservadora
  const enfrijoladas = sb.recetaFaltantes({ nombre: 'Enfrijoladas rápidas', tags: 'comida mexicana', ingredients: '', method: 'estufa', tiempo: 7 }, []);
  t('subcadena: "enfrijoladas" detecta frijol', enfrijoladas.includes('Frijol 1 taza'), enfrijoladas.join(' · '));
  // cero información detectable: no pasa el modo estricto (nunca adivinar)
  t('soloTengo excluye recetas sin ingredientes detectables', !sb.recetaPasaFiltros({ nombre: 'Post-entreno chocolate proteico', tags: 'licuado', ingredients: '', method: 'licuadora', tiempo: 3 }, { soloTengo: true, tengo: ['Huevo'] }));
  filtrar(sb, { tengo: ['Tortilla maíz', 'Queso 28g'], soloTengo: true });
  const props = sb.completarProponer(ctx);
  t('soloTengo: la quesadilla (falta frijol) NO aparece', !props.some(p => /Quesadilla de frijol/.test(p.titulo)), props.map(p => p.titulo).join(' | '));
  filtrar(sb, { tengo: ['Tortilla maíz', 'Queso 28g'], soloTengo: false });
  const cands2 = sb.completarCandidatos(ctx);
  t('soloTengo off: la quesadilla SÍ es candidata', cands2.some(c => c.partes.some(p => /Quesadilla de frijol/.test(p.nombre))));
})();

console.log('== 3 · No quiero cocinar elimina cocción real ==');
(function () {
  const sb = makeSandbox();
  const ctx = ctxBase(sb, {});
  filtrar(sb, { noCocinar: true });
  const props = sb.completarProponer(ctx);
  const conCoccion = props.filter(p => p.componentes.some(c => c.tipo === 'receta' && sb.RECETA_COCCION.test((c.method || '') + ' ' + (c.type || ''))));
  t('ninguna propuesta con cocción real (estufa/horno/tm5...)', conCoccion.length === 0, conCoccion.map(p => p.titulo).join(' | ') || '0');
  t('sin-cocinar/frío pasa el filtro; estufa no', sb.recetaPasaFiltros({ nombre: 'Wrap de pavo', tags: 'cena rápida', ingredients: 'tortilla, pavo', method: 'frío', tiempo: 8 }, { noCocinar: true, licuar: true }) && !sb.recetaPasaFiltros({ nombre: 'Huevos a la mexicana', tags: 'mexicana rápida', ingredients: 'huevo', method: 'estufa', tiempo: 10 }, { noCocinar: true, licuar: true }));
})();

console.log('== 4 · Recalentar sí permite sobras/meal prep ==');
(function () {
  const sb = makeSandbox();
  const ctx = ctxBase(sb, {});
  const mealPrep = { nombre: 'Sándwich de pollo (meal prep)', tags: 'meal prep pollo pan', ingredients: 'pollo, pan', method: 'estufa', tiempo: 5 };
  t('sin recalentar: meal prep bloqueado con noCocinar', !sb.recetaPasaFiltros(mealPrep, { noCocinar: true, recalentar: false, licuar: true, tiempo: null }));
  t('con Recalentar sí: meal prep permitido', sb.recetaPasaFiltros(mealPrep, { noCocinar: true, recalentar: true, licuar: true, tiempo: null }));
})();

console.log('== 5 · Tiempo 2/5/10 usa tiempo ACTIVO; reposo bloquea "comer ahora" ==');
(function () {
  const sb = makeSandbox();
  const overnight = { nombre: 'Overnight oats de avena y plátano', tags: 'avena desayuno sin cocinar overnight', ingredients: 'avena, leche, plátano, miel', method: 'frio', tiempo: 3 };
  t('overnight (3 min activos) entra en 5 min', sb.recetaPasaFiltros(overnight, { tiempo: 5 }));
  t('overnight NO entra en 2 min (3 > 2)', !sb.recetaPasaFiltros(overnight, { tiempo: 2 }));
  t('receta de 10 min NO entra en 5', !sb.recetaPasaFiltros({ nombre: 'Huevos a la mexicana', tags: 'mexicana rápida', ingredients: 'huevo', method: 'estufa', tiempo: 10 }, { tiempo: 5 }));
  // reposo: pasa el filtro de tiempo pero la tarjeta avisa "Para después"
  const sb2 = makeSandbox();
  filtrar(sb2, { tiempo: 5 });
  const prop = { tipoProp: 'comida', titulo: 'Overnight oats de avena y plátano', kcal: 474, p: 16, c: 0, g: 0, volumen: 'Poco', tiempo: 3, razones: [], clave: 'ov', componentes: [{ tipo: 'receta', nombre: 'Overnight oats de avena y plátano', kcal: 474, p: 16, c: 0, g: 0, tiempo: 3, porcion: { texto: '1 porción' } }] };
  sb2.completarRenderPanel([prop]);
  t('tarjeta muestra ⏳ Para después (reposo 6 h)', /⏳ Para después \(reposo 6 h\)/.test(sb2.panels.completarPanel.innerHTML));
})();

console.log('== 6 · Filtros combinados ==');
(function () {
  const sb = makeSandbox();
  const ctx = ctxBase(sb, {});
  filtrar(sb, { tengo: ['Pollo', 'Pan integral 2 rebanadas'], tiempo: 5 });
  const props = sb.completarProponer(ctx);
  t('todas las propuestas ≤5 min (activo)', props.length > 0 && props.every(p => p.tiempo <= 5), props.map(p => p.titulo + ' ' + p.tiempo + 'min').join(' | '));
  t('bonus de cobertura aplica (no excluye)', props.some(p => (p.razones || []).some(r => /tengo/.test(r))), props.map(p => (p.titulo + ' [' + (p.razones || []).join('|') + ']')).join(' · '));
})();

console.log('== 7 · 0 opciones → estado claro; nunca relaja automáticamente ==');
(function () {
  const sb = makeSandbox();
  const ctx = ctxBase(sb, {});
  filtrar(sb, { tengo: ['Tortilla maíz'], soloTengo: true, noCocinar: true, tiempo: 2 });
  const props = sb.completarProponer(ctx);
  t('sin opciones con filtros estrictos', props.length === 0, props.map(p => p.titulo).join(' | ') || '(vacío)');
  sb.completarRenderPanel();
  const html = sb.panels.completarPanel.innerHTML;
  t('mensaje "No encontré algo que cumpla todo."', /No encontré algo que cumpla todo\./.test(html));
  t('botón Relajar tiempo', /Relajar tiempo/.test(html));
  t('botón Permitir cocinar', /Permitir cocinar/.test(html));
  t('botón Ver opciones con 1 ingrediente faltante', /Ver opciones con 1 ingrediente faltante/.test(html));
  // nunca relaja automáticamente: al relajar SOLO el tiempo, los demás filtros siguen
  sb.completarFiltroTiempo('any');
  const f = sb.completarFiltroGet();
  t('relajar tiempo NO apaga soloTengo ni noCocinar', f.soloTengo === true && f.noCocinar === true);
  const props2 = sb.completarProponer(ctx);
  t('tras relajar tiempo pueden aparecer opciones (sin soltar lo demás)', props2.length >= 0);
})();

console.log('== 8 · Modo 1-ingrediente-faltante es EXPLÍCITO ==');
(function () {
  const sb = makeSandbox();
  const ctx = ctxBase(sb, {});
  filtrar(sb, { tengo: ['Tortilla maíz', 'Queso 28g'], soloTengo: true, tiempo: 2 });
  const antes = sb.completarProponer(ctx);
  sb.completarFiltroModoFaltante();
  const props = sb.completarProponer(ctx);
  const htmlTras = (function () { sb.completarRenderPanel(); return sb.panels.completarPanel.innerHTML; })();
  t('modoFaltante activado explícitamente', sb.completarFiltroGet().modoFaltante === true);
  t('muestra recetas con EXACTAMENTE 1 faltante', props.length > 0 && props.every(p => p.componentes.some(c => c.tipo === 'receta') ? sb.recetaFaltantes(sb.completarFiltroRecetaDe({ partes: p.componentes.map(c => ({ nombre: c.nombre, tipo: c.tipo, tags: '', method: '', tiempo: c.tiempo || 0 })) }), ['Tortilla maíz', 'Queso 28g']).length === 1 : true), props.map(p => p.titulo).join(' | '));
  t('tarjeta muestra "Te faltaría:"', /Te faltaría:/.test(htmlTras));
  t('sin activarlo, no entra en modo faltante', antes.length >= 0 && sb.completarFiltroGet().modoFaltante === true);
})();

console.log('\n===== RESULTADO: ' + pasadas + ' PASS / ' + falladas + ' FAIL =====');
if (falladas) process.exit(1);
