// Busca en TODAS las recetas quién explica de verdad una preparación.
// Uso: node tools/buscar-preparacion.js <sujeto> [verbo extra]
const fs = require('fs');
const path = require('path');
const dump = JSON.parse(fs.readFileSync(path.join(__dirname, 'recetas-dump.json'), 'utf8'));
const sujeto = String(process.argv[2] || '').toLowerCase();
const raiz = sujeto.length > 5 ? sujeto.slice(0, 5) : sujeto;
const verbos = /hierve|hiervan|hervir|cuece|cuecen|cocina|cocinar|dora|asa|tuesta|sofríe|fríe|fría|calienta|hornea|saltea|vapor|sancocha|cocer|presión|presion|remoja|hidrata/i;
const tiempo = /\d+\s*(min|minutos|horas|h|seg)\b|\b\d+\s*min\b/i;
console.log('=== Recetas que explican preparar "' + sujeto + '" (sujeto en nombre o ingredientes + paso con verbo de cocción y tiempo) ===');
let n = 0;
dump.forEach(r => {
  const base = (r.name + ' ' + (r.ingredients || '')).toLowerCase();
  const rx = new RegExp('\\b' + sujeto + '\\w*\\b|\\b' + raiz + '\\w*\\b', 'i');
  if (!rx.test(base)) return;
  const pasos = (r.steps || []).filter(s => {
    const t = String(s).toLowerCase();
    return verbos.test(t) && (tiempo.test(t) || /°c/i.test(t));
  });
  if (!pasos.length) return;
  n++;
  console.log('· [' + r.i + '] ' + r.name + ' (' + r.method + ')');
  pasos.slice(0, 3).forEach(p => console.log('    ' + String(p).slice(0, 110)));
});
console.log('TOTAL:', n);
