// Probe temporal: ¿las recetas tipo salsa/aderezo/especia entran como candidatos A?
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function extractFunc(name) {
  const i = HTML.indexOf('function ' + name + '(');
  if (i < 0) throw new Error(name);
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
function ev(name, ctx) { return vm.runInNewContext('(' + extractFunc(name) + ')', ctx || {}); }
function va(name, ctx) {
  const m = HTML.match(new RegExp(name + '\\s*=\\s*([\\s\\S]*?);\\n'));
  if (!m) throw new Error('no var ' + name);
  return vm.runInNewContext('(' + m[1] + ')', ctx || {});
}
// recetas reales (misma extracción que tools/auditoria-catalogo.js)
const recetas = [];
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
    const arrSrc = HTML.slice(start, mk + 1); // incluye el ']' de cierre
    const fake = (type, name, time, k, p, cost, steps, method, tags, temp, ingredients) => recetas.push({ type, name, time, k, p, cost, steps, method, tags, temp, ingredients });
    try {
      new Function('add', '(' + arrSrc + ').forEach(function(r){add(r[1],r[0],r[2],r[3],r[4],r[5],r[6],r[7],r[8],r[9],r[10]);})')(fake);
    } catch (e) { }
  });
}
const nm = HTML.match(/RECETAS FÁCILES NUEVAS \(fase contenido\)[\s\S]*?baseRecipes\.push\(\s*([\s\S]*?)\n\);/);
if (nm) new Function('return [' + nm[1] + ']')().forEach(r => recetas.push(r));
const foods = new Function('const foods=' + HTML.match(/const foods=(\[[\s\S]*?\]);/)[1] + ';' + HTML.match(/foods\.push\(([\s\S]*?)\n\);/g).map(s => s.slice(0, -1) + ';').join('') + 'return foods;')();
const sb = { foods: foods };
['COMPLETAR_PESOS', 'COMPLETAR_LIMITES', 'COMPLETAR_FRANJAS', 'COMPLETAR_VOLUMEN_TIPO', 'COMPLETAR_VOLUMEN_ALIMENTO', 'COMPLETAR_PUNTOS_VOL', 'COMPLETAR_UNIDAD_TEXTO', 'COMPLETAR_UNIDAD_CONDE', 'COMPLETAR_EQUIV_CASERA', 'COMPLETAR_GENERICOS', 'COMPLETAR_ALIMENTO', 'COMPLETAR_PLATOS', 'RECETA_AUXILIAR', 'CALORIAS_FACILES_FAMILIA', 'BEBIDA_BASE', 'BEBIDA_VARIANTE', 'BEBIDA_LIMITES'].forEach(n => { try { sb[n] = va('var ' + n, sb); } catch (e) { console.log('sin var', n); } });
['completarNorm', 'completarSinAcentos', 'completarFranja', 'completarVolumen', 'completarDensidad', 'completarKcalMomento', 'completarCatalogo', 'completarCandidatos', 'completarVolMax', 'completarSuma', 'completarFraccion', 'completarPorcion', 'completarNombreCorto', 'caloriasFacilesDe', 'completarPalabrasAlimento', 'completarFoodsBase', 'completarBaseDe', 'completarFoodNombreDe', 'completarFibraFood', 'completarFibraReceta', 'completarFibraCandidato', 'bebidaCat', 'bebidaCombinaciones', 'bebidaTitulo', 'bebidaConstruir', 'bebidaTecho', 'completarFiltrosActivos', 'completarFiltrosReset', 'completarFiltroRecetaDe', 'recetaPasaFiltros', 'recetaFaltantes', 'recetaCobertura'].forEach(n => { try { sb[n] = ev(n, sb); } catch (e) { console.log('sin fn', n, e.message.slice(0, 40)); } });
const ctx = {
  kcalObjetivo: 3000, kcalConsumidas: 1200, objetivo: 'ganar', llenado: 'normal', hora: 14,
  consumidosHoy: [], mostradas: [], restricciones: [], favoritos: [], recientes: [],
  macrosObjetivo: { p: 180, c: 400, g: 100 }, macrosConsumidos: { p: 60, c: 120, g: 40 },
  catalogo: {
    recetas: recetas.map((r, i) => ({ id: i, nombre: r.name, kcal: r.k, p: r.p || 0, c: r.carbs || 0, g: r.grasas || 0, tiempo: r.time || 0, method: r.method || '', type: r.type || '', tags: r.tags || '', ingredients: r.ingredients || '', portable: r.llevarTrabajo === 'Sí', scoreAudit: '🟢' })),
    alimentos: foods.map((f, i) => ({ id: 'f' + i, nombre: f[0], kcal: f[1], p: f[2], g: f[3], c: f[4] }))
  }
};
const cands = sb.completarCandidatos(ctx);
const aux = cands.filter(c => c.partes.some(p => /^(salsa|aderezo|especia)$/i.test(p.type || '')));
console.log('candidatos totales:', cands.length);
console.log('candidatos con tipo salsa/aderezo/especia:', aux.length);
aux.slice(0, 15).forEach(c => console.log('  -', c.partes.map(p => p.nombre + ' [' + p.type + ']').join(' + ')));
