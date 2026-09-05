// Uso: node tools/ver-receta.js <fragmento de nombre>
const fs = require('fs');
const path = require('path');
const dump = JSON.parse(fs.readFileSync(path.join(__dirname, 'recetas-dump.json'), 'utf8'));
const frag = String(process.argv[2] || '').toLowerCase();
dump.filter(r => !frag || r.name.toLowerCase().includes(frag)).forEach(r => {
  console.log('=== [' + r.i + '] ' + r.name + ' | method=' + r.method + ' | temp=' + (r.temp || '-'));
  console.log('  ING: ' + (r.ingredients || '-'));
  (r.steps || []).forEach((s, j) => console.log('  ' + (j + 1) + '. ' + s));
});
