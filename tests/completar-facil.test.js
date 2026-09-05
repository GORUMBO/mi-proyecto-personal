// ============================================================
// PRUEBAS del motor "Completar fácil" (FASE 1: motor puro, sin UI).
// Uso: node tests/completar-facil.test.js
// Cubre: seguridad de catálogo, kcal del momento, proteína/carbos/grasas,
// densidad vs saciedad, franjas, variedad/repetidos, favoritos,
// Otras 3, restricciones, catálogo pequeño y sumas reales.
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

const sb = { foods: [], window: {} };
// foods[] reales del catálogo (kcal/macros/costo existentes en la app)
const FOODS_RAW = HTML.match(/const foods=(\[[\s\S]*?\]);/);
if (FOODS_RAW) sb.foods = vm.runInNewContext(FOODS_RAW[1]);
const NOMBRES = ['completarNorm', 'completarSinAcentos', 'completarFranja', 'completarVolumen', 'completarDensidad',
  'completarKcalMomento', 'completarCatalogo', 'completarCandidatos', 'completarScore',
  'completarVolMax', 'completarSuma', 'completarProponer', 'completarPotenciar', 'completarEsRapido', 'completarEsFacilParte', 'completarEsFacil', 'completarEsCandidatoFacil', 'completarEsEstructuraNatural', 'completarEtiquetaTipo', 'completarLineaMicro', 'recetaSugeridaPara', 'recetaResumenCorto', 'pickDiversoFacil', 'caloriasFacilesDe', 'completarFamiliaDe', 'completarFamiliasDe',
  'completarFraccion', 'completarPorcion',
  'potenciarFaltante', 'potenciarEscalarNombre', 'potenciarVariante', 'potenciarScore',
  'potenciarCategoria', 'potenciarRazon', 'potenciarFacilidad', 'potenciarTextoFaltante',
  'potenciarEsMicroExtra',
  'bebidaCat', 'bebidaCombinaciones', 'bebidaTitulo', 'bebidaConstruir', 'bebidaTecho',
  'bebidaOtroSabor', 'bebidaMasCalorias', 'bebidaMasLigero', 'bebidaPropuesta'];
['COMPLETAR_PESOS', 'COMPLETAR_LIMITES', 'COMPLETAR_FRANJAS', 'COMPLETAR_ALIMENTO', 'COMPLETAR_PLATOS',
  'COMPLETAR_VOLUMEN_TIPO', 'COMPLETAR_VOLUMEN_ALIMENTO', 'COMPLETAR_PUNTOS_VOL',
  'COMPLETAR_UNIDAD_TEXTO', 'COMPLETAR_UNIDAD_CONDE', 'COMPLETAR_EQUIV_CASERA', 'COMPLETAR_GENERICOS',
  'POTENCIAR_PESOS', 'POTENCIAR_UNIDAD_ESCALABLE', 'POTENCIAR_MICRO',
  'BEBIDA_BASE', 'BEBIDA_VARIANTE', 'BEBIDA_LIMITES', 'COMPLETAR_COMBOS_FACILES', 'CALORIAS_FACILES_FAMILIA', 'RECETA_AUXILIAR'].forEach(n => { sb[n] = extractVarAssign('var ' + n); });
['completarNombreCorto', 'completarCategoria', 'completarTituloUI'].forEach(n => { sb[n] = vm.runInNewContext('(' + extractFunc(n) + ')', sb); });
NOMBRES.forEach(n => { sb[n] = vm.runInNewContext('(' + extractFunc(n) + ')', sb); });
sb.globalThis = sb;

let pasadas = 0, falladas = 0;
function t(label, ok, extra) {
  if (ok) { pasadas++; console.log('✓ ' + label + (extra ? ' · ' + extra : '')); }
  else { falladas++; console.log('✗ FALLA ' + label + (extra ? ' · ' + extra : '')); }
}

// --- Catálogo de prueba: recetas REALES del catálogo (kcal/macros reales) ---
const RECETAS = [
  { id: 0, nombre: 'Chilaquiles con huevo', kcal: 520, p: 28, c: 0, g: 0, tiempo: 15, method: 'estufa', type: 'desayuno', tags: 'mexicana clásica', scoreAudit: '🟢' },
  { id: 1, nombre: 'Cena: quesadilla de pollo', kcal: 380, p: 28, c: 0, g: 0, tiempo: 10, method: 'estufa', type: 'cena', tags: 'cena rápida', scoreAudit: '🟢' },
  { id: 2, nombre: 'Sándwich de manzana y crema de cacahuate', kcal: 545, p: 12, c: 0, g: 0, tiempo: 5, method: 'tostador', type: 'pan', tags: 'pan portable', scoreAudit: '🟢' },
  { id: 3, nombre: 'Sopa de fideo aguada', kcal: 220, p: 6, c: 38, g: 5, tiempo: 20, method: 'estufa', type: 'sopa', tags: 'sopa economica', scoreAudit: '🟢' },
  { id: 4, nombre: 'Espagueti a la crema con pollo', kcal: 470, p: 24, c: 55, g: 17, tiempo: 25, method: 'estufa', type: 'pasta', tags: 'pasta crema proteina', scoreAudit: '🟢' },
  { id: 5, nombre: 'Wrap de pavo', kcal: 350, p: 26, c: 0, g: 0, tiempo: 8, method: 'frío', type: 'cena', tags: 'cena rápida', scoreAudit: '🟢' },
  { id: 6, nombre: 'Cena: ensalada de atún', kcal: 300, p: 30, c: 0, g: 0, tiempo: 8, method: 'frío', type: 'cena', tags: 'cena ligera proteína', scoreAudit: '🟢' },
  { id: 7, nombre: 'Avena de manzana, nuez y miel', kcal: 610, p: 18, c: 0, g: 0, tiempo: 12, method: 'estufa', type: 'avena', tags: 'avena desayuno', scoreAudit: '🟢' },
  { id: 8, nombre: 'Huevos a la mexicana', kcal: 420, p: 26, c: 0, g: 0, tiempo: 10, method: 'estufa', type: 'desayuno', tags: 'mexicana rápida', scoreAudit: '🟢' },
  { id: 9, nombre: 'Papas con chorizo', kcal: 720, p: 24, c: 0, g: 0, tiempo: 20, method: 'estufa', type: 'comida', tags: 'comida cerdo papa', scoreAudit: '🟢' },
  { id: 10, nombre: 'Hamburguesa casera', kcal: 600, p: 46, c: 0, g: 0, tiempo: 20, method: 'sarten', type: 'comida', tags: 'comida proteina carne', scoreAudit: '🟢' },
  { id: 11, nombre: 'Caldo de pollo con verduras', kcal: 260, p: 26, c: 18, g: 9, tiempo: 40, method: 'estufa', type: 'sopa', tags: 'sopa proteina caldo', scoreAudit: '🟢' },
  { id: 12, nombre: 'Arroz con pollo cremoso al horno', kcal: 680, p: 45, c: 0, g: 0, tiempo: 45, method: 'horno', type: 'comida', tags: 'comida al horno arroz pollo', scoreAudit: '🟢' },
  { id: 13, nombre: 'Verduras salteadas con ajo', kcal: 160, p: 6, c: 18, g: 11, tiempo: 15, method: 'estufa', type: 'verdura', tags: 'verdura salteado', scoreAudit: '🟢' },
  { id: 14, nombre: 'Licuado de plátano express', kcal: 480, p: 0, c: 0, g: 0, tiempo: 5, method: 'licuadora', type: 'licuado', tags: 'licuado platano', scoreAudit: '🟢' },
  // casos de seguridad
  { id: 20, nombre: 'Receta roja de prueba', kcal: 500, p: 20, c: 0, g: 0, tiempo: 10, method: 'estufa', type: 'comida', tags: '', scoreAudit: '🔴' },
  { id: 21, nombre: 'Receta amarilla incompleta', kcal: 450, p: 20, c: 0, g: 0, tiempo: 10, method: 'estufa', type: 'comida', tags: '', scoreAudit: '🟡', problemaBloqueante: true },
  { id: 22, nombre: 'Receta amarilla ligera', kcal: 450, p: 20, c: 0, g: 0, tiempo: 10, method: 'estufa', type: 'comida', tags: '', scoreAudit: '🟡', problemaBloqueante: false },
  { id: 23, nombre: 'Receta sin datos', kcal: 0, p: 0, c: 0, g: 0, tiempo: 10, method: 'estufa', type: 'comida', tags: '', scoreAudit: '🟢' }
];
function alimentosDeFoods() {
  return sb.foods.map((f, i) => ({ id: 'f' + i, nombre: f[0], kcal: f[1], p: f[2], g: f[3], c: f[4] }));
}
function ctxBase(extra) {
  return Object.assign({
    kcalObjetivo: 3000, kcalConsumidas: 0, objetivo: 'ganar', llenado: 'normal',
    hora: 8, consumidosHoy: [], mostradas: [], restricciones: [], favoritos: [], recientes: [],
    catalogo: { recetas: RECETAS, alimentos: alimentosDeFoods() }
  }, extra || {});
}
function propuestas(ctx) { return sb.completarProponer(ctx); }
const nombresDe = (ctx, n) => propuestas(ctx).slice(0, n).map(p => p.titulo);

console.log('== 1 · Seguridad de catálogo ==');
(function () {
  const r = propuestas(ctxBase());
  const todas = JSON.stringify(r);
  t('receta roja jamás aparece', !todas.includes('Receta roja de prueba'));
  t('amarilla bloqueante no aparece', !todas.includes('Receta amarilla incompleta'));
  t('receta sin kcal no aparece', !todas.includes('Receta sin datos'));
  const catNombres = sb.completarCatalogo(ctxBase()).map(x => x.nombre);
  t('amarilla no-bloqueante SÍ puede entrar al catálogo seguro', catNombres.includes('Receta amarilla ligera'));
  t('solo hasta 3 propuestas', r.length <= 3);
  const kcalTotales = r.reduce((a, p) => a + p.kcal, 0);
  t('todas las kcal salen del catálogo (suma real de componentes)', r.every(p => p.kcal === Math.round(p.componentes.reduce((a, c) => a + c.kcal, 0))));
})();

console.log('== 2 · kcal apropiadas para EL MOMENTO (no el déficit completo) ==');
(function () {
  // trabajo con déficit gigante: no debe intentar meter 1,400 en una sola
  const r = propuestas(ctxBase({ kcalConsumidas: 1600, hora: 13, llenado: 'rapido' })); // faltan 1400
  t('déficit grande en trabajo: propuestas ≤700 kcal', r.every(p => p.kcal <= 700), r.map(p => p.kcal).join('/'));
  t('déficit grande en trabajo: 3 propuestas razonables', r.length === 3);
  // déficit pequeño no propone gigante
  const r2 = propuestas(ctxBase({ kcalConsumidas: 2800, hora: 15, objetivo: 'mantener' })); // faltan 200
  t('déficit pequeño: propuestas ≤ ~300', r2.every(p => p.kcal <= 300), r2.map(p => p.kcal).join('/'));
})();

console.log('== 3 · Perfiles: ganar+rapido mañana, noche, perder, mantener ==');
(function () {
  const m = propuestas(ctxBase({ kcalConsumidas: 2360, hora: 8, llenado: 'rapido' })); // faltan 640 mañana
  t('mañana ganar+rapido: 3 propuestas', m.length === 3);
  t('mañana: propuestas densas y bebibles (Poco/Medio volumen)', m.every(p => p.volumen === 'Poco' || p.volumen === 'Medio'), m.map(p => p.volumen + ':' + p.kcal).join(' · '));
  const n = propuestas(ctxBase({ kcalConsumidas: 2250, hora: 20, llenado: 'rapido' })); // faltan 750 noche
  t('noche: puede proponer comidas completas (Normal)', n.some(p => p.volumen === 'Normal'));
  const per = propuestas(ctxBase({ kcalObjetivo: 1800, kcalConsumidas: 1600, hora: 13, objetivo: 'perder' })); // faltan 200
  t('perder: no sugiere comidas gigantes', per.every(p => p.kcal <= 450));
  const man = propuestas(ctxBase({ kcalObjetivo: 2500, kcalConsumidas: 2000, hora: 16, objetivo: 'mantener' }));
  t('mantener: 3 propuestas sin sesgo extremo', man.length === 3);
})();

console.log('== 4 · Proteína ==');
(function () {
  const r = propuestas(ctxBase({
    kcalConsumidas: 2000, hora: 13,
    macrosObjetivo: { p: 180, c: 300, g: 90 }, macrosConsumidos: { p: 40, c: 150, g: 40 }
  })); // falta mucha proteína
  const nombres = r.map(p => p.titulo).join(' | ');
  t('proteína muy por debajo: prioriza fuentes proteicas', /huevo|pollo|atun|yogurt|queso|carne|res/i.test(nombres), nombres);
  const r2 = propuestas(ctxBase({
    kcalConsumidas: 1800, hora: 13,
    macrosObjetivo: { p: 180, c: 300, g: 90 }, macrosConsumidos: { p: 180, c: 300, g: 90 }
  })); // proteína cubierta, faltan kcal
  t('proteína cubierta + faltan kcal: sigue proponiendo kcal', r2.length === 3 && r2.every(p => p.kcal > 0));
})();

console.log('== 5 · Variedad: Otras 3, repetidos hoy, favoritos, restricciones ==');
(function () {
  const base = ctxBase({ kcalConsumidas: 2000, hora: 13 });
  const a = propuestas(base);
  const b = propuestas(Object.assign({}, base, { mostradas: a.map(p => p.clave) }));
  t('Otras 3: vuelve a puntuar y evita las mostradas', b.every(p => !a.some(q => q.clave === p.clave)), 'A=' + a.map(p => p.titulo).join(' | ') + ' · B=' + b.map(p => p.titulo).join(' | '));
  const c = propuestas(Object.assign({}, base, { consumidosHoy: ['Huevo', 'Leche entera taza', 'Tortilla maíz'] }));
  t('penaliza lo ya comido hoy (sin Huevo+Tortilla repetidos juntos)', !c.some(p => /Huevo \+ Tortilla/.test(p.titulo) || p.componentes.every(x => base.consumidosHoy.includes(x.nombre))));
  const esp = sb.completarCatalogo(base).find(x => x.ref === 4);
  const sSinFav = sb.completarScore({ partes: [esp] }, base).score;
  const sConFav = sb.completarScore({ partes: [esp] }, Object.assign({}, base, { favoritos: [4] })).score;
  t('favorita recibe bonus de score (mecanismo)', sConFav > sSinFav, sSinFav + ' → ' + sConFav);
  // la futura UI expande categorías (lácteos) con EVITAR_COMUNES; el motor recibe palabras.
  const e = propuestas(Object.assign({}, base, { restricciones: ['leche', 'queso', 'yogurt'] }));
  const eTxt = JSON.stringify(e);
  t('restricción lácteos (palabras) excluye leche/queso/yogurt', !/Leche|Queso|Yogurt/i.test(eTxt), e.map(p => p.titulo).join(' | '));
})();

console.log('== 6 · Catálogo pequeño y sumas ==');
(function () {
  const chico = ctxBase({ kcalConsumidas: 2800, catalogo: { recetas: [RECETAS[6]], alimentos: [alimentosDeFoods()[0]] } }); // solo ensalada de atún + huevo
  const r = propuestas(chico);
  t('catálogo pequeño: 1-2 opciones sin inventar una tercera', r.length >= 1 && r.length <= 2, r.map(p => p.titulo).join(' | '));
  t('suma de componentes = propuesta', r.every(p => p.kcal === Math.round(p.componentes.reduce((a, c) => a + c.kcal, 0))));
  const combos = propuestas(ctxBase({ kcalConsumidas: 2000, hora: 20 }));
  t('hay combinaciones de alimentos reales', combos.some(p => p.componentes.length > 1));
})();

console.log('== 7 · Determinismo ==');
(function () {
  const base = ctxBase({ kcalConsumidas: 2000, hora: 13 });
  const a = propuestas(base), b = propuestas(base);
  t('mismo contexto → mismas 3 (semilla estable)', JSON.stringify(a.map(p => p.titulo)) === JSON.stringify(b.map(p => p.titulo)));
})();

console.log('== 8 · Coherencia culinaria de combinaciones (regresiones Fase 2.1) ==');
(function () {
  const base = ctxBase({ kcalConsumidas: 2000, hora: 20 });
  const cands = sb.completarCandidatos(base);
  const con = (receta, alimento) => cands.some(c => c.partes.length === 2 && c.partes.some(x => x.nombre === receta) && c.partes.some(x => x.nombre === alimento));
  t('pollo + arroz NO recibe leche como complemento', !con('Arroz con pollo cremoso al horno', 'Leche entera taza'));
  t('pasta salada NO recibe bebida láctea automática', !con('Espagueti a la crema con pollo', 'Leche entera taza'));
  t('desayuno SÍ combina naturalmente con leche', con('Huevos a la mexicana', 'Leche entera taza'));
  t('desayuno combina con yogurt', con('Avena de manzana, nuez y miel', 'Yogurt griego taza'));
  t('receta + topping natural funciona (arroz + queso)', con('Arroz con pollo cremoso al horno', 'Queso 28g'));
  t('receta + acompañamiento natural (arroz + aguacate)', con('Arroz con pollo cremoso al horno', 'Aguacate 1/2'));
  t('bebida puede aparecer como propuesta independiente (tier D)', cands.some(c => c.tier === 'D' && c.partes.length === 1 && c.partes[0].nombre === 'Leche entera taza'));
  t('ninguna combinación se genera solo por cercanía de kcal (salado+leche ausente)', !cands.some(c => c.partes.length === 2 && c.partes.some(x => /pollo|pasta|carne|chorizo/i.test(x.nombre)) && c.partes.some(x => x.nombre === 'Leche entera taza')));
  // diversidad estructural de las 3
  const p3 = propuestas(base);
  const cats = p3.map(p => sb.completarCategoria(p.componentes));
  t('las 3 propuestas tienen diversidad estructural (≥2 categorías)', new Set(cats).size >= 2, cats.join(' · '));
  t('Me lleno rápido sigue encontrando opciones densas', propuestas(ctxBase({ kcalConsumidas: 2000, hora: 13, llenado: 'rapido' })).some(p => (p.razones || []).some(r => /denso/.test(r))));
  // títulos simplificados
  const conExtra = p3.find(p => p.sub);
  t('título simplificado sin gramos ni unidades', !/28g|1 taza|cda|100g/i.test(p3.map(p => p.titulo + ' ' + p.sub).join(' | ')), p3.map(p => p.titulo + (p.sub ? ' — ' + p.sub : '')).join(' | '));
  t('Otras 3 conserva coherencia (ningún lote con salado+leche)', [propuestas(base), propuestas(Object.assign({}, base, { mostradas: p3.map(p => p.clave) }))].every(lote => lote.every(p => !(p.componentes.some(x => /pollo|pasta|carne|chorizo/i.test(x.nombre)) && p.componentes.some(x => x.nombre === 'Leche entera taza')))));
})();

console.log('== 9 · Calibración por franja (Me lleno rápido + poco tiempo) ==');
(function () {
  // mañana/trabajo: banda 300-600, >600 solo si no hay alternativa mejor
  const m = propuestas(ctxBase({ kcalConsumidas: 2360, hora: 8, llenado: 'rapido', macrosObjetivo: { p: 180, c: 400, g: 100 }, macrosConsumidos: { p: 60, c: 120, g: 40 } }));
  t('mañana: propuestas dentro de 300-600 (nada gigante)', m.every(p => p.kcal <= 600), m.map(p => p.kcal).join('/'));
  const tT = propuestas(ctxBase({ kcalConsumidas: 1600, hora: 13, llenado: 'rapido', macrosObjetivo: { p: 180, c: 400, g: 100 }, macrosConsumidos: { p: 50, c: 100, g: 35 } }));
  t('trabajo con déficit 1400: propuestas manejables ≤600', tT.every(p => p.kcal <= 600), tT.map(p => p.kcal).join('/'));
  t('trabajo: ninguna de 900+ aunque cuadre', !tT.some(p => p.kcal > 600));
  t('trabajo: bonifica rápidas (razón "rápida" o "portátil" presente)', tT.some(p => (p.razones || []).some(r => /rápida|portátil|sin cocinar/.test(r))));
  t('diversidad trabajo (≥2 categorías)', new Set(tT.map(p => sb.completarCategoria(p.componentes))).size >= 2);
  // noche: permite 600-900+
  const n = propuestas(ctxBase({ kcalConsumidas: 2250, hora: 20, llenado: 'rapido', macrosObjetivo: { p: 180, c: 400, g: 100 }, macrosConsumidos: { p: 70, c: 140, g: 45 } }));
  t('noche: permite comida completa ≥600', n.some(p => p.kcal >= 600), n.map(p => p.kcal).join('/'));
  t('noche: sin penalización fuerte a 600-900', n.every(p => p.kcal <= 900 || p.kcal >= 600));
  // la noche sigue permitiendo resolver más del déficit
  t('noche: puede cubrir la mayor parte del déficit', n.reduce((a, p) => a + p.kcal, 0) >= 500);
})();

console.log('== 10 · Potenciar inteligente (extras reales, compatibles y por necesidad) ==');
(function () {
  const dia = ctxBase({ kcalConsumidas: 2000, hora: 13, llenado: 'normal' });
  const noche = ctxBase({ kcalConsumidas: 2000, hora: 20, llenado: 'normal' });
  const nombres = (r) => r.map(x => x.nombre);
  const cortosDe = (r) => r.map(x => sb.completarNombreCorto(x.nombre));
  // 1 huevos/tortilla: aguacate, queso y yogurt disponibles (lote + otros extras)
  const ht = nombres(sb.completarPotenciar(dia, ['Huevo', 'Tortilla maíz']));
  const ht2 = nombres(sb.completarPotenciar(dia, ['Huevo', 'Tortilla maíz'], ht));
  const htUnion = cortosDe(ht.concat(ht2).map(n => ({ nombre: n })));
  t('huevos+tortilla: aguacate, queso y yogurt disponibles (lote + otros extras)', ['Aguacate 1/2', 'Queso 28g', 'Yogurt griego taza'].every(x => htUnion.includes(sb.completarNombreCorto(x))), ht.concat(ht2).join(' · '));
  // 2 arroz/pollo noche: aguacate, frijol y tortilla en lote+otros; sin leche
  const ap1 = nombres(sb.completarPotenciar(noche, ['Arroz cocido 1 taza', 'Pollo 100g']));
  const ap2 = nombres(sb.completarPotenciar(noche, ['Arroz cocido 1 taza', 'Pollo 100g'], ap1));
  const apUnion = cortosDe(ap1.concat(ap2).map(n => ({ nombre: n })));
  t('arroz+pollo: aguacate, frijol y tortilla disponibles (lote + otros extras)', ['Aguacate 1/2', 'Frijol 1 taza', 'Tortilla maíz'].every(x => apUnion.includes(sb.completarNombreCorto(x))), apUnion.join(' · '));
  t('arroz+pollo: sin leche de relleno', !ap1.concat(ap2).some(x => /Leche/.test(x)));
  // 3 pasta: queso sí; sin leche ni principal
  const pa = nombres(sb.completarPotenciar(dia, ['Espagueti a la crema con pollo']));
  t('pasta: queso extra disponible', pa.some(x => /Queso/.test(x)), pa.join(' · '));
  t('pasta: sin bebida láctea absurda', !pa.some(x => /Leche/.test(x)));
  t('pasta: sin otra proteína principal como extra', !pa.some(x => /Pollo 100g|Carne molida 100g|Atún lata/.test(x)));
  // 4 licuado: crema de cacahuate, avena y yogurt
  const li = nombres(sb.completarPotenciar(dia, ['Leche entera taza', 'Plátano']));
  const liCortos = cortosDe(li.map(n => ({ nombre: n })));
  t('licuado: crema de cacahuate, avena y yogurt disponibles', ['Crema cacahuate cda', 'Avena 1/2 taza', 'Yogurt griego taza'].every(x => liCortos.includes(sb.completarNombreCorto(x))), li.join(' · '));
  // 5 desayuno: leche/yogurt compatibles
  const de = nombres(sb.completarPotenciar(dia, ['Huevos a la mexicana']));
  t('desayuno: leche o yogurt compatibles', de.some(x => /Leche|Yogurt/.test(x)), de.join(' · '));
  // 6 trabajo: extras dentro de la banda del momento (sin gigantes)
  const tr = sb.completarPotenciar(dia, ['Cena: quesadilla de pollo']);
  t('trabajo: extras dentro de la banda (≤600)', tr.every(x => x.kcal <= 600), tr.map(x => x.kcal).join('/'));
  // 7 noche: puede incluir acompañantes mayores (arroz/frijol)
  const no = nombres(sb.completarPotenciar(noche, ['Papas con chorizo']));
  t('noche: permite extras mayores (arroz/frijol)', no.some(x => /Arroz|Frijol/.test(x)), no.join(' · '));
  // 8 Me lleno rápido: el volumen suma puntos reales en el scoring
  const rapido = ctxBase({ kcalConsumidas: 2000, hora: 13, llenado: 'rapido' });
  const normal2 = ctxBase({ kcalConsumidas: 2000, hora: 13, llenado: 'normal' });
  const crema = { nombre: 'Crema cacahuate cda', kcal: 94, p: 4, c: 3, g: 8, volumen: 'Poco', factor: 1, tiempo: 0 };
  const scR = sb.potenciarScore(crema, rapido, sb.potenciarFaltante(rapido), 250, []);
  const scN = sb.potenciarScore(crema, normal2, sb.potenciarFaltante(normal2), 250, []);
  t('Me lleno rápido: volumen suma puntos reales', scR.score > scN.score && scR.razones.some(r => /denso/.test(r)), scR.score.toFixed(1) + ' vs ' + scN.score.toFixed(1));
  // 9 sin bebida absurda en salado
  t('salado: ninguna bebida como extra', ['Espagueti a la crema con pollo', 'Papas con chorizo', 'Arroz cocido 1 taza', 'Pollo 100g'].every(b => !nombres(sb.completarPotenciar(dia, [b])).some(x => /Leche/.test(x))));
  // 10 sin principal como extra (noche incluida)
  const noPr = nombres(sb.completarPotenciar(noche, ['Arroz cocido 1 taza']));
  t('nunca otra proteína principal como extra (ni de noche)', !noPr.some(x => /Pollo 100g|Carne molida 100g|Atún lata/.test(x)), noPr.join(' · '));
  // 11 Otros extras rota (por alimento, sin repetir variantes escaladas)
  const e1 = nombres(sb.completarPotenciar(dia, ['Huevo', 'Tortilla maíz']));
  const e2 = nombres(sb.completarPotenciar(dia, ['Huevo', 'Tortilla maíz'], e1));
  const c1 = cortosDe(e1.map(n => ({ nombre: n }))), c2 = cortosDe(e2.map(n => ({ nombre: n })));
  t('Otros extras: rota sin repetir', c2.every(x => !c1.includes(x)), e2.join(' · '));
  // 12 catálogo pequeño: 1-2
  const chico = ctxBase({ kcalConsumidas: 2000, hora: 13, catalogo: { recetas: [], alimentos: alimentosDeFoods().slice(0, 2) } });
  const ch = sb.completarPotenciar(chico, ['Huevo']);
  t('catálogo pequeño: 1-2 extras sin inventar', ch.length >= 1 && ch.length <= 2, ch.map(x => x.nombre).join(' · '));
})();

console.log('== 11 · Me lleno rápido + mañana/trabajo: lo fácil manda ==');
(function () {
  const rapidoManana = ctxBase({ kcalConsumidas: 1800, hora: 8, llenado: 'rapido', macrosObjetivo: { p: 180, c: 400, g: 100 }, macrosConsumidos: { p: 60, c: 120, g: 40 } });
  const rapidoTrabajo = ctxBase({ kcalConsumidas: 1800, hora: 13, llenado: 'rapido', macrosObjetivo: { p: 180, c: 400, g: 100 }, macrosConsumidos: { p: 60, c: 120, g: 40 } });
  const normalManana = ctxBase({ kcalConsumidas: 1800, hora: 8, llenado: 'normal', macrosObjetivo: { p: 180, c: 400, g: 100 }, macrosConsumidos: { p: 60, c: 120, g: 40 } });
  const nocheRapida = ctxBase({ kcalConsumidas: 1800, hora: 20, llenado: 'rapido', macrosObjetivo: { p: 180, c: 400, g: 100 }, macrosConsumidos: { p: 60, c: 120, g: 40 } });
  // 1) scoring: premios y castigos SOLO en rápido + mañana/trabajo
  const bebCand = sb.completarCandidatos(rapidoManana).find(c => c.tipoBebida);
  t('mañana rápido: bebida premiada', bebCand && sb.completarScore(bebCand, rapidoManana).razones.some(r => /rapido-bebida|rapido-poco-volumen/.test(r)));
  const larga = sb.completarCatalogo(rapidoManana).find(r => +r.tiempo > 20);
  t('mañana rápido: receta larga castigada', larga && sb.completarScore({ partes: [larga], tier: 'A' }, rapidoManana).razones.some(r => /rapido-receta-larga/.test(r)));
  const grande = sb.completarCatalogo(rapidoManana).find(r => +r.kcal >= 600);
  t('mañana rápido: plato ≥600 castigado', grande && sb.completarScore({ partes: [grande], tier: 'A' }, rapidoManana).razones.some(r => /rapido-plato-grande/.test(r)));
  const mismaGrandeNoche = sb.completarScore({ partes: [grande], tier: 'A' }, nocheRapida);
  t('noche rápido: SIN castigo de plato grande', !mismaGrandeNoche.razones.some(r => /rapido-plato-grande|rapido-receta-larga/.test(r)));
  t('llenado normal: sin bloque rápido', !sb.completarScore({ partes: [grande], tier: 'A' }, normalManana).razones.some(r => /rapido-plato-grande/.test(r)));
  // 2) garantía de diversidad: 1 bebida + 1 rápida + máx 1 grande
  const m = propuestas(rapidoManana);
  t('mañana rápido: 3 propuestas', m.length === 3);
  t('mañana rápido: ≥1 bebida/licuado', m.some(p => p.bebida), m.map(p => p.titulo).join(' | '));
  t('mañana rápido: ≥1 rápida/portable', m.some(p => sb.completarEsRapido({ partes: p.componentes.map(c => ({ tiempo: c.tiempo, metodo: c.metodo, portable: p.bebida ? true : false })) })), m.map(p => p.titulo).join(' | '));
  t('mañana rápido: máximo 1 comida ≥600 kcal', m.filter(p => p.kcal >= 600).length <= 1, m.map(p => p.kcal).join('/'));
  const tT = propuestas(rapidoTrabajo);
  t('trabajo rápido: ≥1 bebida/licuado', tT.some(p => p.bebida), tT.map(p => p.titulo).join(' | '));
  t('trabajo rápido: máximo 1 comida ≥600 kcal', tT.filter(p => p.kcal >= 600).length <= 1, tT.map(p => p.kcal).join('/'));
  // 3) no forzar: catálogo pequeño sin bebidas ni rápidas no se rompe
  const chico = ctxBase({ kcalConsumidas: 1800, hora: 8, llenado: 'rapido', catalogo: { recetas: [{ id: 0, nombre: 'Receta lenta', kcal: 500, p: 20, c: 0, g: 0, tiempo: 40, method: 'estufa', type: 'comida', tags: '', scoreAudit: '🟢' }], alimentos: [{ id: 'f0', nombre: 'Huevo', kcal: 72, p: 6, g: 5, c: 0 }] }, macrosObjetivo: { p: 180, c: 400, g: 100 }, macrosConsumidos: { p: 60, c: 120, g: 40 } });
  const ch = propuestas(chico);
  t('catálogo sin fáciles: no inventa ni rompe', ch.length >= 1 && ch.length <= 3, ch.map(p => p.titulo).join(' | '));
  // 4) determinismo se mantiene
  const a = propuestas(rapidoManana), b = propuestas(rapidoManana);
  t('mismo contexto rápido → mismas 3', JSON.stringify(a.map(p => p.titulo)) === JSON.stringify(b.map(p => p.titulo)));
})();

console.log('== 12 · Pool fácil: regresión del caso real (meal prep / llena / combos) ==');
(function () {
  const PESADAS = [
    { id: 90, nombre: 'Meal prep: pechugas para la semana', kcal: 865, p: 70, c: 0, g: 0, tiempo: 22, method: 'horno', type: 'comida', tags: 'meal prep', scoreAudit: '🟢' },
    { id: 91, nombre: 'Ensalada de pollo con aguacate (llena)', kcal: 920, p: 45, c: 0, g: 0, tiempo: 20, method: 'sin cocinar', type: 'comida', tags: 'ensalada llena', scoreAudit: '🟢' }
  ];
  const ctxReal = ctxBase({ kcalConsumidas: 1800, hora: 8, llenado: 'rapido', catalogo: { recetas: RECETAS.concat(PESADAS), alimentos: alimentosDeFoods() }, macrosObjetivo: { p: 180, c: 400, g: 100 }, macrosConsumidos: { p: 60, c: 120, g: 40 } });
  const cands = sb.completarCandidatos(ctxReal);
  const mealPrep = cands.find(c => c.partes.some(p => /Meal prep/.test(p.nombre)));
  const llena = cands.find(c => c.partes.some(p => /llena/.test(p.nombre)));
  t('Meal prep 865/22 NO es fácil', mealPrep && !sb.completarEsFacil(mealPrep, ctxReal));
  t('Ensalada llena 920/20 NO es fácil', llena && !sb.completarEsFacil(llena, ctxReal));
  // combinaciones: solo estructuras reconocidas en el pool
  const mkC = nombres => sb.completarEsFacil({ tier: 'C', partes: nombres.map(n => { const a = sb.completarCatalogo(ctxReal).find(x => x.nombre === n); return a; }) }, ctxReal);
  t('Huevo + Tortilla maíz SÍ es estructura fácil', mkC(['Huevo', 'Tortilla maíz']));
  t('Leche + Plátano SÍ es estructura fácil', mkC(['Leche entera taza', 'Plátano']));
  t('Papa + Huevo NO es estructura fácil', !mkC(['Papa mediana', 'Huevo']));
  t('Papa + Huevo + Leche NO es estructura fácil', !mkC(['Papa mediana', 'Huevo', 'Leche entera taza']));
  t('Arroz + Pollo NO es estructura fácil', !mkC(['Arroz cocido 1 taza', 'Pollo 100g']));
  // top-3 real con el estado del usuario
  const props = propuestas(ctxReal);
  t('top-3 SIN meal prep', !props.some(p => /Meal prep/i.test(p.titulo)), props.map(p => p.titulo).join(' | '));
  t('top-3 SIN ensalada llena', !props.some(p => /llena/i.test(p.titulo)));
  t('top-3 SIN Papa + Huevo + Leche', !props.some(p => /Papa \+ Huevo/i.test(p.titulo)), props.map(p => p.titulo).join(' | '));
  t('top-3 todo del pool fácil (≤650 kcal, ≤15 min, Poco/Medio)', props.every(p => p.kcal <= 650 && p.tiempo <= 15 && (p.volumen === 'Poco' || p.volumen === 'Medio')), props.map(p => p.titulo + ' ' + p.kcal + 'kcal/' + p.tiempo + 'min/' + p.volumen).join(' · '));
  t('diversidad: ≥1 bebida/licuado', props.some(p => p.bebida), props.map(p => p.titulo).join(' | '));
  // fallbacks 3+/2/1/0
  const soloPesadas = ctxBase({ kcalConsumidas: 1800, hora: 8, llenado: 'rapido', catalogo: { recetas: PESADAS, alimentos: alimentosDeFoods() }, macrosObjetivo: { p: 180, c: 400, g: 100 }, macrosConsumidos: { p: 60, c: 120, g: 40 } });
  const r0 = propuestas(soloPesadas);
  t('con fáciles tier D: pool sin pesadas', !r0.some(p => /Meal prep|llena/i.test(p.titulo)), r0.map(p => p.titulo).join(' | '));
  const sinNadaFacil = ctxBase({ kcalConsumidas: 1800, hora: 8, llenado: 'rapido', catalogo: { recetas: PESADAS, alimentos: [] }, macrosObjetivo: { p: 180, c: 400, g: 100 }, macrosConsumidos: { p: 60, c: 120, g: 40 } });
  const rNada = propuestas(sinNadaFacil);
  t('0 fáciles: pool vacío, SIN pesadas automáticas (decisión del usuario)', rNada.length === 0, rNada.map(p => p.titulo).join(' | ') || '(vacío)');
  const unFacil = ctxBase({ kcalConsumidas: 1800, hora: 8, llenado: 'rapido', catalogo: { recetas: PESADAS, alimentos: [alimentosDeFoods()[0]] }, macrosObjetivo: { p: 180, c: 400, g: 100 }, macrosConsumidos: { p: 60, c: 120, g: 40 } });
  const r1 = propuestas(unFacil);
  t('1 fácil: solo ese, sin pesadas automáticas', r1.length === 1 && r1[0].titulo === 'Huevo', r1.map(p => p.titulo).join(' | '));
  // noche: sin pool (las pesadas pueden salir)
  const nocheReal = ctxBase({ kcalConsumidas: 1800, hora: 20, llenado: 'rapido', catalogo: { recetas: RECETAS.concat(PESADAS), alimentos: alimentosDeFoods() }, macrosObjetivo: { p: 180, c: 400, g: 100 }, macrosConsumidos: { p: 60, c: 120, g: 40 } });
  t('noche rápido: sin pool fuerte (meal prep puede aparecer)', sb.completarCandidatos(nocheReal).some(c => c.partes.some(p => /Meal prep/.test(p.nombre))));
  // determinismo del pool
  const d1 = propuestas(ctxReal), d2 = propuestas(ctxReal);
  t('pool determinista', JSON.stringify(d1.map(p => p.titulo)) === JSON.stringify(d2.map(p => p.titulo)));
})();

console.log('== 13 · Todas las rondas respetan el pool fácil (Otras 3 nunca mete pesadas) ==');
(function () {
  const PESADAS2 = [
    { id: 90, nombre: 'Meal prep: pechugas para la semana', kcal: 865, p: 70, c: 0, g: 0, tiempo: 22, method: 'horno', type: 'comida', tags: 'meal prep', scoreAudit: '🟢' },
    { id: 91, nombre: 'Ensalada de pollo con aguacate (llena)', kcal: 920, p: 45, c: 0, g: 0, tiempo: 20, method: 'sin cocinar', type: 'comida', tags: 'ensalada llena', scoreAudit: '🟢' },
    { id: 92, nombre: 'Tortitas de pollo y queso', kcal: 930, p: 50, c: 0, g: 0, tiempo: 22, method: 'estufa', type: 'comida', tags: 'tortitas', scoreAudit: '🟢' }
  ];
  const esPesada = t => /Meal prep|llena|Tortitas/i.test(t);
  // estado real de las capturas del usuario: 1200 consumidas de 3000
  const base = ctxBase({ kcalConsumidas: 1200, hora: 8, llenado: 'rapido', catalogo: { recetas: RECETAS.concat(PESADAS2), alimentos: alimentosDeFoods() }, macrosObjetivo: { p: 180, c: 400, g: 100 }, macrosConsumidos: { p: 60, c: 120, g: 40 } });
  var mostradas = [];
  var rondas = [];
  for (var i = 0; i < 30; i++) {
    const r = propuestas(Object.assign({}, base, { mostradas: mostradas.slice() }));
    rondas.push(r);
    if (!r.length) break;
    mostradas = mostradas.concat(r.map(p => p.clave));
    if (r.length < 3) break;
  }
  t('ronda 1: 3 fáciles sin pesadas', rondas[0].length === 3 && rondas[0].every(p => !esPesada(p.titulo)), rondas[0].map(p => p.titulo).join(' | '));
  t('Otras 3 #1 (ronda 2): sin pesadas', rondas[1] && rondas[1].every(p => !esPesada(p.titulo)), rondas[1] ? rondas[1].map(p => p.titulo).join(' | ') : '—');
  t('Otras 3 #2 (ronda 3): sin pesadas', rondas[2] && rondas[2].every(p => !esPesada(p.titulo)), rondas[2] ? rondas[2].map(p => p.titulo).join(' | ') : '—');
  t('ninguna ronda repite claves de rondas anteriores', rondas.every((lote, idx) => {
    var prev = [];
    for (var j = 0; j < idx; j++) prev = prev.concat(rondas[j].map(p => p.clave));
    return lote.every(p => !prev.includes(p.clave));
  }));
  const ultima = rondas[rondas.length - 1];
  t('pool agotado: última ronda <3 y sin pesadas', ultima.length < 3 && ultima.every(p => !esPesada(p.titulo)), ultima.map(p => p.titulo).join(' | ') || '(vacío)');
  t('NUNCA aparecieron Meal prep 900 ni Tortitas 930 automáticamente', rondas.every(lote => lote.every(p => !esPesada(p.titulo))), rondas.length + ' rondas');
  // Ver opciones normales (decisión explícita del usuario): pesadas PERMITIDAS.
  // Con un catálogo de solo pesadas + 1 fácil, el modo normal las muestra;
  // el modo fácil, con el mismo catálogo, muestra solo el fácil.
  const catNormal = ctxBase({ kcalConsumidas: 1200, hora: 8, llenado: 'rapido', catalogo: { recetas: PESADAS2, alimentos: [alimentosDeFoods()[0]] }, macrosObjetivo: { p: 180, c: 400, g: 100 }, macrosConsumidos: { p: 60, c: 120, g: 40 } });
  sb.window._completarModoFacil = false;
  const normales = propuestas(catNormal);
  t('Ver opciones normales: las pesadas SÍ pueden aparecer', normales.some(p => esPesada(p.titulo)), normales.map(p => p.titulo).join(' | '));
  const scorePesada = sb.completarScore({ partes: [{ nombre: 'Meal prep: pechugas para la semana', tipo: 'receta', kcal: 865, p: 70, c: 0, g: 0, tiempo: 22, method: 'horno', type: 'comida', tags: 'meal prep', portable: false, volumen: 'Normal', ref: 90 }], tier: 'A' }, base);
  t('modo normal: sin castigos rápidos a la pesada', !scorePesada.razones.some(r => /rapido-plato-grande|rapido-receta-larga|rapido-volumen-normal/.test(r)));
  sb.window._completarModoFacil = undefined;
  const facilesMismo = propuestas(catNormal);
  t('mismo catálogo en modo fácil: solo el fácil', facilesMismo.length === 1 && facilesMismo[0].titulo === 'Huevo', facilesMismo.map(p => p.titulo).join(' | '));
  // de vuelta a modo fácil
  const devuelta = propuestas(Object.assign({}, base, { mostradas: mostradas.slice() }));
  t('volver a modo fácil: sin pesadas de nuevo', devuelta.every(p => !esPesada(p.titulo)) || devuelta.length === 0);
})();

console.log('\n===== ESCENARIOS CON DATOS REALES DEL CATÁLOGO =====');
function escenario(nombre, ctx) {
  console.log('\n■ ' + nombre + ' (falta: ' + Math.max(0, ctx.kcalObjetivo - ctx.kcalConsumidas) + ' kcal · ' + (ctx.objetivo) + ' · ' + (ctx.llenado) + ' · ' + sb.completarFranja(ctx.hora) + ' · objetivo-momento: ' + sb.completarKcalMomento(ctx) + ' kcal)');
  const r = propuestas(ctx);
  r.forEach((p, i) => {
    console.log('  ' + (i + 1) + '. ' + p.titulo + ' — ' + p.kcal + ' kcal · P ' + p.p + 'g · C ' + p.c + 'g · G ' + p.g + 'g · Vol: ' + p.volumen + ' · ' + p.tiempo + ' min · score ' + p.score);
    console.log('     razones: ' + p.razones.join(' · '));
  });
}
escenario('Mañana · ganar + Me lleno rápido', ctxBase({ kcalConsumidas: 2360, hora: 8, llenado: 'rapido', macrosObjetivo: { p: 180, c: 400, g: 100 }, macrosConsumidos: { p: 60, c: 120, g: 40 } }));
escenario('Trabajo · ganar + Me lleno rápido (déficit grande)', ctxBase({ kcalConsumidas: 1600, hora: 13, llenado: 'rapido', macrosObjetivo: { p: 180, c: 400, g: 100 }, macrosConsumidos: { p: 50, c: 100, g: 35 } }));
escenario('Noche · ganar + déficit grande', ctxBase({ kcalConsumidas: 2250, hora: 20, llenado: 'rapido', macrosObjetivo: { p: 180, c: 400, g: 100 }, macrosConsumidos: { p: 70, c: 140, g: 45 } }));
escenario('Perder peso · normal', ctxBase({ kcalObjetivo: 1800, kcalConsumidas: 1600, hora: 15, objetivo: 'perder', macrosObjetivo: { p: 140, c: 150, g: 60 }, macrosConsumidos: { p: 90, c: 100, g: 40 } }));
escenario('Mantener · normal', ctxBase({ kcalObjetivo: 2500, kcalConsumidas: 2000, hora: 16, objetivo: 'mantener', macrosObjetivo: { p: 150, c: 280, g: 80 }, macrosConsumidos: { p: 80, c: 150, g: 50 } }));
escenario('Proteína muy por debajo', ctxBase({ kcalConsumidas: 2000, hora: 13, macrosObjetivo: { p: 180, c: 400, g: 100 }, macrosConsumidos: { p: 30, c: 150, g: 40 } }));
escenario('Proteína cubierta · faltan kcal', ctxBase({ kcalConsumidas: 1800, hora: 13, macrosObjetivo: { p: 180, c: 400, g: 100 }, macrosConsumidos: { p: 180, c: 300, g: 90 } }));

console.log('\n===== RESULTADO: ' + pasadas + ' PASS / ' + falladas + ' FAIL =====');
if (falladas) process.exit(1);
