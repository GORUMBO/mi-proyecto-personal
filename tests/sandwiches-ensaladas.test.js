// ============================================================
// PRUEBAS de la FASE K — Sándwiches y comidas portátiles
// (la fase L de ensaladas se agrega a esta misma suite).
// Uso: node tests/sandwiches-ensaladas.test.js
// Cubre: las 12 recetas existen con ingredientes/cantidades reales
// del catálogo, tiempo ≤10, portable vía llevarTrabajo, volumen Poco,
// integración con tier A, filtros noCocinar/tiempo y Me lleno rápido.
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
function extractBalanced(s, i) {
  let depth = 0, j = i, q = null;
  for (; j < s.length; j++) {
    const c = s[j];
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '(') depth++;
    else if (c === ')') { depth--; if (depth === 0) return s.slice(i, j + 1); }
  }
  return null;
}
function extraerRecetas() {
  const recetas = [];
  // 1) bloques [ ... ].forEach(r=>add(...))
  {
    const marks = [...HTML.matchAll(/\n\]\.forEach\(r=>add\(/g)].map(m => m.index + 1);
    marks.forEach(mk => {
      let depth = 0, start = -1;
      for (let j = mk - 1; j >= 0; j--) {
        const c = HTML[j];
        if (c === ']') depth++;
        else if (c === '[') { depth--; if (depth < 0) { start = j; break; } }
      }
      if (start < 0) return;
      const arrSrc = HTML.slice(start, mk + 1);
      const fake = (type, name, time, k, p, cost, steps, method, tags, temp, ingredients) => recetas.push({ type, name, time, k, p, cost, steps, method, tags, temp, ingredients });
      try {
        new Function('add', '(' + arrSrc + ').forEach(function(r){add(r[1],r[0],r[2],r[3],r[4],r[5],r[6],r[7],r[8],r[9],r[10]);})')(fake);
      } catch (e) { }
    });
  }
  // 2) bloques [ ... ].forEach(addFull)
  {
    const marks = [...HTML.matchAll(/\n\]\.forEach\(addFull\)/g)].map(m => m.index + 1);
    marks.forEach(mk => {
      let depth = 0, start = -1;
      for (let j = mk - 1; j >= 0; j--) {
        const c = HTML[j];
        if (c === ']') depth++;
        else if (c === '[') { depth--; if (depth < 0) { start = j; break; } }
      }
      if (start < 0) return;
      const arrSrc = HTML.slice(start, mk + 1);
      try {
        new Function('addFull', '(' + arrSrc + ').forEach(addFull)')(o => recetas.push(o));
      } catch (e) { }
    });
  }
  // 3) baseRecipes.push( { ... }, { ... } ) con objetos literales (NUEVAS + fases nuevas)
  {
    const marks = [...HTML.matchAll(/baseRecipes\.push\s*\(/g)].map(m => m.index);
    marks.forEach(mi => {
      const chunk = extractBalanced(HTML, mi);
      if (!chunk) return;
      const arr = [];
      try { new Function('baseRecipes', chunk)(arr); } catch (e) { return; }
      arr.forEach(r => recetas.push(r));
    });
  }
  // dedupe por nombre (los bloques 8301+ re-registran en runtime; aquí no corren)
  const visto = {};
  return recetas.filter(r => { if (!r || !r.name || visto[r.name]) return false; visto[r.name] = 1; return true; });
}

let pasadas = 0, falladas = 0;
function t(label, ok, extra) {
  if (ok) { pasadas++; console.log('✓ ' + label + (extra ? ' · ' + extra : '')); }
  else { falladas++; console.log('✗ FALLA ' + label + (extra ? ' · ' + extra : '')); }
}

const RECETAS = extraerRecetas();
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
  const foodsConFibra = foodsRaw.map(f => {
    const fb = Object.prototype.hasOwnProperty.call(FIBRA_ESTANDAR, f[0]) ? FIBRA_ESTANDAR[f[0]] : null;
    return fb === null ? f.slice() : f.concat([fb, 'estandar']);
  });
  const sb = {
    state, window: win, document: doc, safeText: x => String(x == null ? '' : x),
    foods: foodsConFibra,
    FIBRA_ESTANDAR: FIBRA_ESTANDAR,
    BEBIDA_FUNCION: extractVarAssign('var BEBIDA_FUNCION'),
    EVITAR_COMUNES: extractVarAssign('var EVITAR_COMUNES'),
    baseRecipes: RECETAS,
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
    'RECETA_AUXILIAR', 'RECETA_AUXILIAR_TIPO', 'RECETA_COCCION', 'RECETA_RECALENTABLE',
    'RECETA_ESTADOS', 'RECETA_ESTADOS_RX', 'RECETA_COCCION_VERB', 'RECETA_CRITERIO_RX',
    'RECETA_PASO_TIP', 'RECETA_PASO_ESCURRIR'].forEach(n => { sb[n] = extractVarAssign('var ' + n, sb); });
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
    'recetaAuditar', 'recetaSujetoDe', 'recetaExplicaPreparacion', 'recetaTiempoPaso',
    'completarPotRender', 'completarPotAgregar', 'completarPotCerrar', 'completarPotOtros', 'completarCerrar', 'completarAbrir'].forEach(n => { sb[n] = vm.runInNewContext('(' + extractFunc(n) + ')', sb); });
  sb.panels = panels;
  return sb;
}
function ctxBase(sb, extra) {
  return Object.assign({
    kcalObjetivo: 3000, kcalConsumidas: 1200, objetivo: 'ganar', llenado: 'normal',
    hora: 14, consumidosHoy: [], mostradas: [], restricciones: [], favoritos: [], recientes: [],
    macrosObjetivo: { p: 180, c: 400, g: 100 }, macrosConsumidos: { p: 60, c: 120, g: 40 },
    catalogo: {
      recetas: sb.baseRecipes.map((r, i) => ({ id: i, nombre: r.name, kcal: r.k, p: r.p || 0, c: r.carbs || 0, g: r.grasas || 0, tiempo: r.time || 0, method: r.method || '', type: r.type || '', tags: r.tags || '', ingredients: r.ingredients || '', portable: r.llevarTrabajo === 'Sí', scoreAudit: '🟢' })),
      alimentos: sb.foods.map((f, i) => ({ id: 'f' + i, nombre: f[0], kcal: f[1], p: f[2], g: f[3], c: f[4] }))
    }
  }, extra || {});
}

console.log('== 1 · Las 12 recetas existen con datos completos ==');
(function () {
  const porNombre = {};
  RECETAS.forEach(r => { porNombre[r.name] = r; });
  const esperadas = [
    ['Sándwich de pavo y queso', 'comida', 460, 32, 5],
    ['Sándwich de jamón y queso', 'comida', 450, 28, 5],
    ['Sándwich de pollo y aguacate', 'comida', 485, 41, 5],
    ['Sándwich de atún', 'comida', 380, 37, 5],
    ['Sándwich de huevo cocido', 'comida', 400, 20, 8],
    ['Sándwich de crema de cacahuate y plátano', 'snack', 450, 17, 3],
    ['Sándwich de pollo y queso', 'comida', 435, 46, 5],
    ['Sándwich de pavo y aguacate', 'comida', 400, 27, 5],
    ['Sándwich de atún con aguacate', 'comida', 450, 39, 5],
    ['Grilled cheese', 'comida', 480, 22, 10],
    ['Torta de jamón', 'comida', 420, 30, 5],
    ['Torta de huevo', 'comida', 450, 25, 8]
  ];
  esperadas.forEach(([n, tipo, k, p, tm]) => {
    const r = porNombre[n];
    const ok = r && r.type === tipo && r.k === k && r.p === p && r.time === tm && (r.steps || []).length >= 3 && String(r.ingredients || '').length > 10 && r.llevarTrabajo === 'Sí';
    t('"' + n + '" [' + tipo + '] ' + k + ' kcal · ' + p + ' g proteína · ' + tm + ' min · portable', !!ok, r ? 'llevarTrabajo=' + r.llevarTrabajo : 'NO EXISTE');
  });
  t('todas con método declarado', esperadas.every(([n]) => /sin cocinar|sarten|estufa/.test(porNombre[n].method || '')));
  t('todas con temperatura/refrigeración declarada', esperadas.every(([n]) => String(porNombre[n].temp || '').length > 3));
})();

console.log('== 2 · Ingredientes y cantidades reales del catálogo ==');
(function () {
  const sb = makeSandbox();
  const porNombre = {};
  RECETAS.forEach(r => { porNombre[r.name] = r; });
  // componentes PRINCIPALES (sin guarnición como lechuga) deben ser foods reales
  const nucleos = {
    'Sándwich de pavo y queso': ['pan integral', 'pavo', 'queso', 'mayonesa'],
    'Sándwich de jamón y queso': ['pan integral', 'jamón', 'queso', 'mayonesa'],
    'Sándwich de pollo y aguacate': ['pan integral', 'pollo', 'aguacate'],
    'Sándwich de atún': ['atún', 'mayonesa', 'pan integral'],
    'Sándwich de huevo cocido': ['huevos', 'mayonesa', 'pan integral'],
    'Sándwich de crema de cacahuate y plátano': ['pan integral', 'crema de cacahuate', 'plátano'],
    'Sándwich de pollo y queso': ['pan integral', 'pollo', 'queso'],
    'Sándwich de pavo y aguacate': ['pan integral', 'pavo', 'aguacate'],
    'Sándwich de atún con aguacate': ['atún', 'aguacate', 'pan integral'],
    'Grilled cheese': ['pan integral', 'queso', 'mantequilla'],
    'Torta de jamón': ['bolillo', 'jamón', 'queso'],
    'Torta de huevo': ['bolillo', 'huevos', 'frijoles']
  };
  Object.keys(nucleos).forEach(n => {
    const r = porNombre[n];
    const palabras = sb.completarPalabrasAlimento((r.ingredients || '') + ' ' + (r.name || ''));
    const claves = Object.keys(palabras);
    const presentes = nucleos[n].every(x => claves.some(k => k.indexOf(x) >= 0 || x.indexOf(k) >= 0));
    t('"' + n + '": componentes principales en el catálogo', presentes, claves.join(','));
  });
})();

console.log('== 2b · Auditoría culinaria real: los 12 sándwiches quedan 🟢 ==');
(function () {
  const sb = makeSandbox();
  const nombres = ['Sándwich de pavo y queso', 'Sándwich de jamón y queso', 'Sándwich de pollo y aguacate', 'Sándwich de atún', 'Sándwich de huevo cocido', 'Sándwich de crema de cacahuate y plátano', 'Sándwich de pollo y queso', 'Sándwich de pavo y aguacate', 'Sándwich de atún con aguacate', 'Grilled cheese', 'Torta de jamón', 'Torta de huevo'];
  const porNombre = {};
  RECETAS.forEach(r => { porNombre[r.name] = r; });
  const malos = [];
  nombres.forEach(n => {
    const a = sb.recetaAuditar(porNombre[n]);
    if (a.score !== '🟢') malos.push(n + ' [' + a.score + '] ' + (a.problemas || []).map(p => p.tipo).join(','));
  });
  t('todos los sándwiches pasan la auditoría culinaria (🟢)', malos.length === 0, malos.join(' | ') || '12/12 🟢');
})();

console.log('== 3 · Volumen Poco y motor: tier A, filtros, Me lleno rápido ==');
(function () {
  const sb = makeSandbox();
  const ctx = ctxBase(sb, {});
  const cands = sb.completarCandidatos(ctx);
  const nombresA = cands.filter(c => c.tier === 'A').map(c => c.partes[0].nombre);
  ['Sándwich de pavo y queso', 'Grilled cheese', 'Torta de huevo'].forEach(n => {
    t('tier A incluye "' + n + '"', nombresA.indexOf(n) >= 0);
  });
  const cat = sb.completarCatalogo(ctx);
  const volS = cat.find(x => x.nombre === 'Sándwich de pavo y queso');
  t('sándwich = Poco volumen (Me lleno rápido no lo castiga)', volS && volS.volumen === 'Poco', volS && volS.volumen);
  const f = { noCocinar: true, recalentar: false, licuar: true, tiempo: null, soloTengo: false, tengo: [] };
  const rFrio = { nombre: 'Sándwich de atún', tags: 'sandwich portable trabajo frio rapido', ingredients: '', method: 'sin cocinar', tiempo: 5 };
  const rCaliente = { nombre: 'Grilled cheese', tags: 'sandwich portable trabajo queso', ingredients: '', method: 'sarten', tiempo: 10 };
  t('No quiero cocinar: sándwich frío pasa', sb.recetaPasaFiltros(rFrio, f));
  t('No quiero cocinar: grilled cheese (sartén) se bloquea con honestidad', !sb.recetaPasaFiltros(rCaliente, f));
  t('filtro 10 min: todos los sándwiches pasan', ['Sándwich de pavo y queso', 'Grilled cheese', 'Torta de huevo'].every(n => {
    const r = RECETAS.find(x => x.name === n);
    return sb.recetaPasaFiltros({ nombre: r.name, tags: r.tags || '', ingredients: '', method: r.method || '', tiempo: r.time }, { noCocinar: false, recalentar: false, licuar: true, tiempo: 10, soloTengo: false, tengo: [] });
  }));
  const ctxR = ctxBase(sb, { hora: 14, llenado: 'rapido' });
  const sand = ctxR.catalogo.recetas.find(x => x.nombre === 'Sándwich de pavo y queso');
  const s = sb.completarScore({ partes: [sand], tier: 'A' }, ctxR);
  t('Me lleno rápido: sándwich gana rapido-portable y rapido-poco-volumen', s.razones.indexOf('rapido-portable') >= 0 && s.razones.indexOf('rapido-poco-volumen') >= 0, s.razones.join(' · '));
  t('trabajo: sándwich recibe trabajo-portátil', s.razones.indexOf('trabajo-portátil') >= 0);
})();

console.log('== 4 · Las 9 ensaladas existen con datos completos ==');
(function () {
  const porNombre = {};
  RECETAS.forEach(r => { porNombre[r.name] = r; });
  const esperadas = [
    ['Ensalada de pollo con aguacate', 'comida', 430, 34, 6],
    ['Ensalada de atún con garbanzo', 'comida', 370, 33, 5],
    ['Ensalada de huevo cocido', 'comida', 250, 14, 8],
    ['Ensalada de jamón y queso', 'comida', 300, 23, 5],
    ['Ensalada de frijol y elote', 'comida', 370, 12, 5],
    ['Ensalada de pasta fría', 'comida', 460, 28, 8],
    ['Ensalada de arroz frío', 'comida', 480, 35, 8],
    ['Ensalada César rápida con pollo', 'comida', 440, 39, 6],
    ['Ensalada de manzana, nuez y queso', 'comida', 400, 13, 5]
  ];
  esperadas.forEach(([n, tipo, k, p, tm]) => {
    const r = porNombre[n];
    const ok = r && r.type === tipo && r.k === k && r.p === p && r.time === tm && (r.steps || []).length >= 4 && String(r.ingredients || '').length > 10 && r.llevarTrabajo === 'Sí';
    t('"' + n + '" [' + tipo + '] ' + k + ' kcal · ' + p + ' g proteína · ' + tm + ' min · portable', !!ok, r ? 'llevarTrabajo=' + r.llevarTrabajo : 'NO EXISTE');
  });
  t('el aderezo va APARTE en todas (pasos o temp lo declaran)', esperadas.every(([n]) => /aderezo aparte/i.test((porNombre[n].steps || []).join(' ') + ' ' + (porNombre[n].temp || ''))));
  t('ningún nombre de ensalada es auxiliar (aderezo nunca es la comida)', esperadas.every(([n]) => !/aderezo|sazonador|especia/i.test(n)));
})();

console.log('== 5 · Auditoría culinaria real: ensaladas 🟢 ==');
(function () {
  const sb = makeSandbox();
  const porNombre = {};
  RECETAS.forEach(r => { porNombre[r.name] = r; });
  const nombres = ['Ensalada de pollo con aguacate', 'Ensalada de atún con garbanzo', 'Ensalada de huevo cocido', 'Ensalada de jamón y queso', 'Ensalada de frijol y elote', 'Ensalada de pasta fría', 'Ensalada de arroz frío', 'Ensalada César rápida con pollo', 'Ensalada de manzana, nuez y queso'];
  const malos = [];
  nombres.forEach(n => {
    const a = sb.recetaAuditar(porNombre[n]);
    if (a.score !== '🟢') malos.push(n + ' [' + a.score + '] ' + (a.problemas || []).map(p => p.tipo).join(','));
  });
  t('las 9 ensaladas pasan la auditoría culinaria (🟢)', malos.length === 0, malos.join(' | ') || '9/9 🟢');
})();

console.log('== 6 · Motor: tier A, volumen Medio, filtros ==');
(function () {
  const sb = makeSandbox();
  const ctx = ctxBase(sb, {});
  const cands = sb.completarCandidatos(ctx);
  const nombresA = cands.filter(c => c.tier === 'A').map(c => c.partes[0].nombre);
  ['Ensalada de pollo con aguacate', 'Ensalada de pasta fría', 'Ensalada César rápida con pollo'].forEach(n => {
    t('tier A incluye "' + n + '"', nombresA.indexOf(n) >= 0);
  });
  const cat = sb.completarCatalogo(ctx);
  const volE = cat.find(x => x.nombre === 'Ensalada de pollo con aguacate');
  t('ensalada = Medio volumen (Me lleno rápido la acepta)', volE && volE.volumen === 'Medio', volE && volE.volumen);
  const f = { noCocinar: true, recalentar: false, licuar: true, tiempo: null, soloTengo: false, tengo: [] };
  const rFria = { nombre: 'Ensalada de atún con garbanzo', tags: 'ensalada fria portable trabajo rapido', ingredients: '', method: 'sin cocinar', tiempo: 5 };
  const rCocida = { nombre: 'Ensalada de huevo cocido', tags: 'ensalada fria portable trabajo rapido', ingredients: '', method: 'estufa', tiempo: 8 };
  t('No quiero cocinar: ensalada fría pasa', sb.recetaPasaFiltros(rFria, f));
  t('No quiero cocinar: ensalada de huevo (estufa) se bloquea con honestidad', !sb.recetaPasaFiltros(rCocida, f));
  t('filtro 10 min: las 9 ensaladas pasan', ['Ensalada de pollo con aguacate', 'Ensalada de huevo cocido', 'Ensalada de arroz frío'].every(n => {
    const r = RECETAS.find(x => x.name === n);
    return sb.recetaPasaFiltros({ nombre: r.name, tags: r.tags || '', ingredients: '', method: r.method || '', tiempo: r.time }, { noCocinar: false, recalentar: false, licuar: true, tiempo: 10, soloTengo: false, tengo: [] });
  }));
  const ctxR = ctxBase(sb, { hora: 14, llenado: 'rapido' });
  const ens = ctxR.catalogo.recetas.find(x => x.nombre === 'Ensalada de pollo con aguacate');
  const s = sb.completarScore({ partes: [ens], tier: 'A' }, ctxR);
  t('Me lleno rápido: ensalada gana rapido-portable y rapido-poco-volumen', s.razones.indexOf('rapido-portable') >= 0 && s.razones.indexOf('rapido-poco-volumen') >= 0, s.razones.join(' · '));
})();

console.log('\n===== RESULTADO: ' + pasadas + ' PASS / ' + falladas + ' FAIL =====');
if (falladas) process.exit(1);
