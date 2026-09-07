// Auditoría estructural del catálogo (solo lectura) — genera conteos.
// Uso: node tools/auditoria-catalogo.js
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

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

// ---- foods ----
const foods = new Function('const foods=' + html.match(/const foods=(\[[\s\S]*?\]);/)[1] + ';' +
  html.match(/foods\.push\(([\s\S]*?)\n\);/g).map(s => s.slice(0, -1) + ';').join('') + 'return foods;')();
console.log('FOODS total:', foods.length);
const seen = {};
foods.forEach(f => { seen[f[0]] = (seen[f[0]] || 0) + 1; });
console.log('foods con nombre duplicado:', JSON.stringify(Object.keys(seen).filter(n => seen[n] > 1)));

// ---- recetas del bloque add(...) ----
const recetas = [];
{
  const marks = [...html.matchAll(/\n\]\.forEach\(r=>add\(/g)].map(m => m.index + 1);
  marks.forEach(mk => {
    // balance hacia atrás para hallar el '[' inicial del array
    let depth = 0, start = -1;
    for (let j = mk - 1; j >= 0; j--) {
      const c = html[j];
      if (c === ']') depth++;
      else if (c === '[') { depth--; if (depth < 0) { start = j; break; } }
    }
    if (start < 0) return;
    const arrSrc = html.slice(start, mk + 1); // incluye el ']' de cierre
    const fake = (type, name, time, k, p, cost, steps, method, tags, temp, ingredients) =>
      recetas.push({ type, name, time, k, p, cost, steps, method, tags, temp, ingredients });
    try {
      new Function('add', '(' + arrSrc + ').forEach(function(r){add(r[1],r[0],r[2],r[3],r[4],r[5],r[6],r[7],r[8],r[9],r[10]);})')(fake);
    } catch (e) { console.log('err bloque add en', mk, ':', e.message.slice(0, 90)); }
  });
}
// ---- NUEVAS (baseRecipes.push con objetos literales) ----
const nm = html.match(/RECETAS FÁCILES NUEVAS \(fase contenido\)[\s\S]*?baseRecipes\.push\(\s*([\s\S]*?)\n\);/);
if (nm) {
  const arr = new Function('return [' + nm[1] + ']')();
  console.log('NUEVAS count:', arr.length);
  arr.forEach(r => recetas.push(Object.assign({ origin: 'nuevas' }, r)));
}
// otros baseRecipes.push sueltos
const otros = [...html.matchAll(/baseRecipes\.push\(/g)].map(m => m.index);
console.log('total ocurrencias baseRecipes.push:', otros.length);
console.log('RECETAS total extraídas:', recetas.length);
const tipos = {}, metodos = {}, campos = {};
recetas.forEach(r => {
  tipos[r.type || '(sin)'] = (tipos[r.type || '(sin)'] || 0) + 1;
  metodos[r.method || '(sin)'] = (metodos[r.method || '(sin)'] || 0) + 1;
  Object.keys(r).forEach(k => { campos[k] = (campos[k] || 0) + 1; });
});
console.log('por tipo:', JSON.stringify(tipos, null, 1));
console.log('por método:', JSON.stringify(metodos, null, 1));
console.log('campos:', Object.keys(campos).map(k => k + ':' + campos[k]).join(' '));
const rseen = {};
recetas.forEach(r => { rseen[r.name] = (rseen[r.name] || 0) + 1; });
console.log('recetas con nombre duplicado:', JSON.stringify(Object.keys(rseen).filter(n => rseen[n] > 1)));
console.log('NOMBRES:');
recetas.forEach((r, i) => console.log(i + ': ' + r.name + ' [' + (r.type || '?') + '] ' + (r.time || '?') + 'min ' + (r.k || '?') + 'kcal ' + (r.method || '')));
