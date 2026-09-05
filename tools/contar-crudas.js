// Cuenta entradas crudas de receta en TODAS las fuentes (incluye copias sombra).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function scanTopArrays() {
  const out = [];
  let depth = 0, q = null, start = -1, i = 0;
  while (i < HTML.length) {
    const c = HTML[i];
    if (q) {
      if (q === 'TQ') { if (c === '\\') { i += 2; continue; } if (c === '`') q = null; i++; continue; }
      if (c === '\\') { i += 2; continue; }
      if (c === q) q = null; i++; continue;
    }
    if (c === '/' && HTML[i + 1] === '/') { while (i < HTML.length && HTML[i] !== '\n') i++; continue; }
    if (c === '/' && HTML[i + 1] === '*') { const e = HTML.indexOf('*/', i + 2); i = e < 0 ? HTML.length : e + 2; continue; }
    if (c === '"' || c === "'") { q = c; i++; continue; }
    if (c === '`') { q = 'TQ'; i++; continue; }
    if (c === '[') { if (depth === 0) start = i; depth++; i++; continue; }
    if (c === ']') { depth--; if (depth === 0 && start >= 0) out.push({ start, end: i, text: HTML.slice(start, i + 1) }); i++; continue; }
    i++;
  }
  return out;
}
const arrs = scanTopArrays();
let total = 0, por = {};
for (const a of arrs) {
  const before = HTML.slice(Math.max(0, a.start - 120), a.start);
  const after = HTML.slice(a.end + 1, a.end + 40);
  const m = before.match(/const\s+(RECETAS_(?:V2|V3|V4|V5|NUEVAS))\s*=\s*$/);
  let k = null, n = 0;
  if (m) { k = m[1]; n = vm.runInNewContext('(' + a.text + ')').length; }
  else if (/^\s*\.forEach\(r=>add\(/.test(after)) { k = 'legacy-add'; n = vm.runInNewContext('(' + a.text + ')').length; }
  else if (/^\s*\.forEach\(addFull\)/.test(after)) { k = 'addFull'; n = vm.runInNewContext('(' + a.text + ')').length; }
  if (k) { total += n; por[k] = (por[k] || 0) + n; }
}
console.log('Entradas crudas por fuente:', JSON.stringify(por));
console.log('TOTAL crudo:', total, '· baseRecipes activo: 610 · sombras duplicadas por dedup:', total - 610);
