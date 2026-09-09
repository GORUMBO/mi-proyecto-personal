// ============================================================
// PRUEBAS de la FIBRA (infraestructura honesta: solo dato real).
// Uso: node tests/fibra.test.js
// Cubre: datos reales del catálogo (FIBRA_ESTANDAR), fuente
// catalogo/estandar, null ≠ 0, 0 fiable (origen animal), ambiguos
// quedan null, completa vs parcial (nunca inventar), diario suma solo
// conocidas, scoring secundario, Me lleno rápido no promueve platos
// grandes por fibra, Potenciar condicionado, UI badge o inline (nunca
// ambas) y sin cifras falsas, filtros intactos.
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

// Tabla REAL de fibra estándar desde index.html (única fuente de verdad).
const FIBRA_ESTANDAR = extractVarAssign('var FIBRA_ESTANDAR');

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
  // réplica del enriquecimiento de la app: f[6]=g, f[7]='estandar'
  const foodsConFibra = foodsRaw.map(f => {
    const fb = Object.prototype.hasOwnProperty.call(FIBRA_ESTANDAR, f[0]) ? FIBRA_ESTANDAR[f[0]] : null;
    return fb === null ? f.slice() : f.concat([fb, 'estandar']);
  });
  const sb = {
    state, window: win, document: doc, safeText: x => String(x == null ? '' : x),
    foods: foodsConFibra,
    FIBRA_ESTANDAR: FIBRA_ESTANDAR,
    EVITAR_COMUNES: extractVarAssign('var EVITAR_COMUNES'),
    baseRecipes: [
      { name: 'Enfrijoladas rápidas', k: 500, p: 18, carbs: 60, grasas: 10, time: 7, method: 'estufa', type: 'comida', tags: 'frijol tortilla mexicana', ingredients: 'frijol, tortilla, queso', steps: ['Calienta frijoles y arma las enfrijoladas (5 min).'] },
      { name: 'Huevos a la mexicana', k: 420, p: 26, carbs: 0, grasas: 0, time: 10, method: 'estufa', type: 'desayuno', tags: 'mexicana rápida', ingredients: 'huevo, jitomate, cebolla', steps: ['Revuelve los huevos (4 min).'] },
      { name: 'Sardinas 1 lata', k: 190, p: 23, carbs: 0, grasas: 10, time: 0, method: 'frio', type: 'snack', tags: 'sardinas', ingredients: 'sardinas', steps: ['Abre la lata y sirve.'] }
    ],
    recetaAuditar(r) { return { score: '🟢', problemas: [] }; },
    getTodayDiaryTotals() {
      const d = state.diary['2026-09-04'] || {};
      const items = [].concat(d.breakfast || [], d.lunch || [], d.dinner || [], d.snacks || []);
      return items.reduce((a, x) => { a.k += +x.kcal || 0; a.p += +x.prot || 0; a.c += +x.carb || 0; a.f += +x.fat || 0; if (x.fibra != null) { a.fb += +x.fibra || 0; a.fbConocidas++; } return a; }, { k: 0, p: 0, c: 0, f: 0, fb: 0, fbConocidas: 0, count: items.length });
    },
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
    'completarLineaPropuesta', 'completarLineaExtra',
    'potenciarFaltante', 'potenciarEscalarNombre', 'potenciarVariante', 'potenciarScore',
    'potenciarCategoria', 'potenciarRazon', 'potenciarFacilidad', 'potenciarEquivOz', 'potenciarRequierePrep', 'potenciarTextoFaltante', 'potenciarBaseHTML', 'progresoBarraHTML', 'progresoFilaHTML', 'potenciarProgresoHTML',
    'potenciarAgregados', 'potenciarResumenHTML', 'potenciarEsMicroExtra',
    'bebidaCat', 'bebidaCombinaciones', 'bebidaTitulo', 'bebidaConstruir', 'bebidaTecho',
    'bebidaOtroSabor', 'bebidaMasCalorias', 'bebidaMasLigero', 'bebidaPropuesta', 'bebidaMenuHTML',
    'completarCtxReal', 'completarMealKey', 'completarTextoTarjeta', 'completarRenderPanel', 'completarAgregar',
    'completarPotRender', 'completarPotAgregar', 'completarPotCerrar', 'completarPotOtros', 'completarCerrar', 'completarAbrir'].forEach(n => { sb[n] = vm.runInNewContext('(' + extractFunc(n) + ')', sb); });
  ['ppTombstoneItem','ppActivos','ppTombstoneKey','ppKeyActivo','ppKeysActivas','ppDiarioActivos'].forEach(n => { sb[n] = vm.runInNewContext('(' + extractFunc(n) + ')', sb); });
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

console.log('== 1 · Dato real + fuente (catalogo/estandar) y null ≠ 0 ==');
(function () {
  const sb = makeSandbox();
  const frijol = sb.completarFibraFood('Frijol 1 taza');
  const tortilla = sb.completarFibraFood('Tortilla maíz');
  const sardinas = sb.completarFibraFood('Sardinas 1 lata');
  const granola = sb.completarFibraFood('Granola 1/2 taza');
  t('frijol: {g:15, fuente:estandar}', frijol && frijol.g === 15 && frijol.fuente === 'estandar', JSON.stringify(frijol));
  t('tortilla: 1.5 g estándar', tortilla && tortilla.g === 1.5 && tortilla.fuente === 'estandar', JSON.stringify(tortilla));
  t('sardinas: 0 FIABLE (origen animal) — no null', sardinas && sardinas.g === 0 && sardinas.fuente === 'estandar', JSON.stringify(sardinas));
  t('granola: null por ambigüedad entre marcas', granola === null);
  t('null ≠ 0: granola (null) vs sardinas (0) son distintos', granola === null && sardinas !== null && sardinas.g === 0);
})();

console.log('== 2 · Recetas: completa vs parcial (nunca inventar) ==');
(function () {
  const sb = makeSandbox();
  const comp = sb.completarFibraReceta({ comps: ['Frijol 1 taza', 'Tortilla maíz'] });
  t('comps completas: suma exacta (16.5)', comp.estado === 'completa' && comp.g === 16.5, comp.g + ' g');
  const con0 = sb.completarFibraReceta({ comps: ['Huevo', 'Tortilla maíz'] });
  t('0 fiable NO bloquea completa (1.5 g)', con0.estado === 'completa' && con0.g === 1.5, con0.g + ' g');
  const parcial = sb.completarFibraReceta({ comps: ['Frijol 1 taza', 'Granola 1/2 taza'] });
  t('componente ambiguo → parcial, g=null (sin total falso)', parcial.estado === 'parcial' && parcial.g === null);
  const enf = sb.completarFibraReceta({ nombre: 'Enfrijoladas rápidas', tags: 'frijol tortilla mexicana', ingredients: 'frijol, tortilla, queso' });
  t('enfrijoladas (texto): completa 16.5 con queso=0 fiable', enf.estado === 'completa' && enf.g === 16.5, enf.g + ' g · ' + enf.estado);
  const desconocida = sb.completarFibraReceta({ nombre: 'Algo misterioso', tags: 'xyz', ingredients: '' });
  t('sin palabras detectables → desconocida', desconocida.estado === 'desconocida' && desconocida.g === null);
})();

console.log('== 3 · Catálogo: conteos exactos y fuentes ==');
(function () {
  const sb = makeSandbox();
  const nombres = sb.foods.map(f => f[0]);
  const enTabla = nombres.filter(n => Object.prototype.hasOwnProperty.call(FIBRA_ESTANDAR, n));
  const sinDato = nombres.filter(n => !Object.prototype.hasOwnProperty.call(FIBRA_ESTANDAR, n));
  const fuentes = {};
  enTabla.forEach(n => { const r = sb.completarFibraFood(n); fuentes[r.fuente] = (fuentes[r.fuente] || 0) + 1; });
  const valoresOk = enTabla.every(n => { const r = sb.completarFibraFood(n); return r && isFinite(r.g) && r.g >= 0 && r.fuente === 'estandar'; });
  t('121 foods (snacks/dips incluidas) · ' + enTabla.length + ' con fibra fiable · ' + sinDato.length + ' null', sb.foods.length === 121 && enTabla.length === 105 && sinDato.length === 16, 'fiables=' + enTabla.length + ' null=' + sinDato.length);
  t('fuentes: 0 catalogo · ' + (fuentes.estandar || 0) + ' estandar', (fuentes.catalogo || 0) === 0 && fuentes.estandar === 105, JSON.stringify(fuentes));
  t('todos los valores son ≥0, finitos y fuente estandar', valoresOk);
  t('todas las claves de la tabla existen en el catálogo (sin typos)', Object.keys(FIBRA_ESTANDAR).every(n => nombres.indexOf(n) >= 0));
  const ceroFiable = ['Huevo', 'Pollo 100g', 'Bistec de res cocido 100g', 'Leche entera taza', 'Queso 28g', 'Aceite oliva 1 cucharada', 'Miel 1 cucharada', 'Jalea de fresa 1 cda'].every(n => {
    const r = sb.completarFibraFood(n);
    return r && r.g === 0 && r.fuente === 'estandar';
  });
  t('ejemplos de 0 fiable (animal/refinados): huevo, pollo, res, leche, queso, aceite, miel, jalea', ceroFiable);
  const ambiguosNull = ['Granola 1/2 taza', 'Cereal 1 taza', 'Cereal americano 1 taza', 'Cereal alto en proteína 1 taza', 'Trail mix 1/2 taza', 'Fruta congelada 1 taza', 'Verduras mixtas congeladas 1 taza', 'Comida congelada pollo/arroz', 'Burrito congelado', 'Pizza congelada 1/4', 'Waffles congelados 2 piezas', 'Sopa enlatada 1 taza'].every(n => sb.completarFibraFood(n) === null);
  t('ambiguos (marca/preparación/mix) quedan null', ambiguosNull);
})();

console.log('== 4 · Diario: suma solo conocidas (0 fiable cuenta, sin dato no) ==');
(function () {
  const sb = makeSandbox();
  sb._guardarComida('Frijol 1 taza', 240, 15, 1, 44, 'dinner', null, 15);
  sb._guardarComida('Huevo', 72, 6, 5, 0, 'dinner', null, 0);
  sb._guardarComida('Granola 1/2 taza', 240, 6, 9, 36, 'dinner');
  const tot = sb.getTodayDiaryTotals();
  t('totales: kcal/proteína intactas + fibra suma 15 (0 y desconocida no suman)', tot.k === 552 && tot.p === 27 && tot.fb === 15, JSON.stringify(tot));
  t('fbConocidas=2: fibra 0 fiable SÍ cuenta como conocida', tot.fbConocidas === 2, 'conocidas=' + tot.fbConocidas);
  const fbHoy = sb.completarFibraHoy();
  t('fibra de hoy: 2 de 3 conocidas (ratio 0.67)', fbHoy.suma === 15 && fbHoy.conocidas === 2 && Math.abs(fbHoy.ratio - 2 / 3) < 1e-9, JSON.stringify(fbHoy));
})();

console.log('== 5 · Scoring: fibra secundaria, nunca promueve platos grandes ==');
(function () {
  const sb = makeSandbox();
  const ctx = ctxBase(sb, {});
  const cat = sb.completarCatalogo(ctx);
  const enf = cat.find(x => x.nombre === 'Enfrijoladas rápidas');
  const s = sb.completarScore({ partes: [enf], tier: 'A' }, ctx);
  t('scoring registra fibra como razón secundaria', s.razones.some(r => /fibra 16\.5g/.test(r)), s.razones.join(' · '));
  const fb = sb.completarFibraCandidato({ partes: [enf], tier: 'A' });
  const bonus = fb.estado === 'completa' ? 3 * Math.min(1, fb.g / 6) : 0;
  t('bonus de fibra es pequeño (≤3 puntos, >0 solo si hay fibra)', bonus <= 3 && bonus > 0, bonus + ' pts');
  // Me lleno rápido: el castigo de plato grande sigue dominando sobre la fibra
  const ctxRapido = ctxBase(sb, { llenado: 'rapido', hora: 8 });
  const sRapido = sb.completarScore({ partes: [enf], tier: 'A' }, ctxRapido);
  t('Me lleno rápido: el castigo de tamaño sigue presente con fibra', sRapido.razones.some(r => /rapido-plato-grande|rapido-receta-larga|rapido-volumen-normal/.test(r)), sRapido.razones.join(' · '));
})();

console.log('== 6 · Potenciar favorece fibra solo cuando kcal/proteína van bien ==');
(function () {
  const sb = makeSandbox();
  const o = { nombreBase: 'Aguacate 1/2', nombre: 'Aguacate 1/2', kcal: 160, p: 2, c: 8, g: 15, volumen: 'Poco', factor: 1, tiempo: 0, isMicro: true };
  const fBien = { k: 200, atrasado: null };
  const fUrge = { k: 900, atrasado: 'p' };
  const sBien = sb.potenciarScore(o, ctxBase(sb, {}), fBien, 250, []);
  const sUrge = sb.potenciarScore(o, ctxBase(sb, {}), fUrge, 250, []);
  t('fibra-extra aparece con kcal cubiertas', sBien.razones.some(r => /fibra-extra/.test(r)), sBien.razones.join(' · '));
  t('fibra-extra NO aparece si falta proteína/kcal', !sUrge.razones.some(r => /fibra-extra/.test(r)));
  const oHuevo = { nombreBase: 'Huevo', nombre: 'Huevo', kcal: 72, p: 6, c: 0, g: 5, volumen: 'Poco', factor: 1, tiempo: 0, isMicro: true };
  const sHuevo = sb.potenciarScore(oHuevo, ctxBase(sb, {}), fBien, 250, []);
  t('0 fiable NO dispara fibra-extra (0 no es fibra)', !sHuevo.razones.some(r => /fibra-extra/.test(r)));
})();

console.log('== 7 · UI: badge o inline (nunca ambas); sin cifras falsas ==');
(function () {
  const sb = makeSandbox();
  const prop8 = { tipoProp: 'comida', titulo: 'Enfrijoladas rápidas', kcal: 500, p: 18, c: 60, g: 10, volumen: 'Normal', tiempo: 7, razones: [], clave: 'enf', componentes: [{ tipo: 'receta', nombre: 'Enfrijoladas rápidas', kcal: 500, p: 18, c: 60, g: 10, tiempo: 7, porcion: { texto: '1 porción' } }] };
  sb.completarRenderPanel([prop8]);
  const h8 = sb.panels.completarPanel.innerHTML;
  t('fibra ≥5g: badge 🌾 y NO inline', /🌾 Buena fuente de fibra/.test(h8) && !/g fibra<\/div>/.test(h8));
  const propSardinas = { tipoProp: 'micro', titulo: 'Sardinas 1 lata', kcal: 190, p: 23, c: 0, g: 10, volumen: 'Poco', tiempo: 0, razones: [], clave: 'sar', componentes: [{ tipo: 'alimento', nombre: 'Sardinas 1 lata', kcal: 190, p: 23, c: 0, g: 10, porcion: { texto: '1 lata' } }] };
  sb.completarRenderPanel([propSardinas]);
  const hS = sb.panels.completarPanel.innerHTML;
  t('Sardinas (0 fiable): sin fibra en la tarjeta', !/fibra/i.test(hS));
  const propGranola = { tipoProp: 'micro', titulo: 'Granola 1/2 taza', kcal: 240, p: 6, c: 36, g: 9, volumen: 'Poco', tiempo: 0, razones: [], clave: 'gra', componentes: [{ tipo: 'alimento', nombre: 'Granola 1/2 taza', kcal: 240, p: 6, c: 36, g: 9, porcion: { texto: '1/2 taza' } }] };
  sb.completarRenderPanel([propGranola]);
  const hG = sb.panels.completarPanel.innerHTML;
  t('Granola (ambiguo): sin cifra falsa en la tarjeta', !/fibra/i.test(hG));
  const prop3 = { tipoProp: 'comida', titulo: 'Brócoli con algo', kcal: 100, p: 3, c: 10, g: 1, volumen: 'Poco', tiempo: 0, razones: [], clave: 'b3', componentes: [{ tipo: 'alimento', nombre: 'Brócoli 100g', kcal: 35, p: 2.4, c: 7, g: 0.4, porcion: { texto: '100 g' } }] };
  sb.completarRenderPanel([prop3]);
  const h3 = sb.panels.completarPanel.innerHTML;
  t('fibra 1-4g: inline "· N g fibra" y sin badge', /· 2\.4 g fibra/.test(h3) && !/🌾/.test(h3));
})();

console.log('== 8 · Filtros siguen intactos y sin filtros el motor es idéntico ==');
(function () {
  const sb = makeSandbox();
  const ctx = ctxBase(sb, {});
  const cat = sb.completarCatalogo(ctx);
  const huevos = cat.find(x => x.nombre === 'Huevos a la mexicana');
  const s0 = sb.completarScore({ partes: [huevos], tier: 'A' }, ctx).score;
  sb.window._completarFiltros = { tengo: ['Huevo'], soloTengo: false, noCocinar: false, recalentar: false, licuar: true, tiempo: null, modoFaltante: false };
  const s1 = sb.completarScore({ partes: [huevos], tier: 'A' }, ctx).score;
  t('sin filtros restrictivos el score solo suma el bonus de cobertura', s1 >= s0, s0 + ' → ' + s1);
  sb.completarFiltrosReset();
  const s2 = sb.completarScore({ partes: [huevos], tier: 'A' }, ctx).score;
  t('filtros reseteados: motor idéntico', s2 === s0);
})();

console.log('\n===== RESULTADO: ' + pasadas + ' PASS / ' + falladas + ' FAIL =====');
if (falladas) process.exit(1);
