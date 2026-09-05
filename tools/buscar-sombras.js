// Encuentra nombres duplicados entre fuentes (copias sombra que el dedup elimina).
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
const vistos = {}; // nombre -> [fuente...]
let order = 0;
for (const a of arrs) {
  const before = HTML.slice(Math.max(0, a.start - 120), a.start);
  const after = HTML.slice(a.end + 1, a.end + 40);
  const m = before.match(/const\s+(RECETAS_(?:V2|V3|V4|V5|NUEVAS))\s*=\s*$/);
  let k = null, arr = null;
  if (m) { k = m[1]; arr = vm.runInNewContext('(' + a.text + ')'); }
  else if (/^\s*\.forEach\(r=>add\(/.test(after)) { k = 'legacy#' + (order++); arr = vm.runInNewContext('(' + a.text + ')').map(r => ({ name: r[0] })); }
  else if (/^\s*\.forEach\(addFull\)/.test(after)) { k = 'addFull#' + (order++); arr = vm.runInNewContext('(' + a.text + ')'); }
  if (!arr) continue;
  arr.forEach(r => {
    if (!r || !r.name) return;
    (vistos[r.name] = vistos[r.name] || []).push(k);
  });
}
Object.keys(vistos).forEach(n => {
  if (vistos[n].length > 1) console.log('DUPLICADA: "' + n + '" en ' + vistos[n].join(' y '));
});
