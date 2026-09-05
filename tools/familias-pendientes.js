// Clasifica los pendientes de la auditoría en familias (sin modificar nada).
// Uso: node tools/familias-pendientes.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const rep = JSON.parse(fs.readFileSync(path.join(__dirname, 'auditoria-report.json'), 'utf8'));
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
function extractVar(name) {
  const m = HTML.match(new RegExp('var ' + name + '=([^;\\n]+);'));
  if (!m) throw new Error(name);
  return m[1];
}
const sb = { baseRecipes: [], safeText: x => String(x == null ? '' : x) };
sb.RECETA_ESTADOS = vm.runInNewContext('(' + extractVar('RECETA_ESTADOS') + ')');
sb.RECETA_ESTADOS_RX = vm.runInNewContext('(' + extractVar('RECETA_ESTADOS_RX') + ')', sb);
sb.RECETA_COCCION_VERB = vm.runInNewContext('(' + extractVar('RECETA_COCCION_VERB') + ')');
sb.RECETA_CRITERIO_RX = vm.runInNewContext('(' + extractVar('RECETA_CRITERIO_RX') + ')');
sb.RECETA_COCCION_VERB_PROFUNDO = vm.runInNewContext('(' + extractVar('RECETA_COCCION_VERB_PROFUNDO') + ')');
sb.RECETA_METODO_ESTADO = vm.runInNewContext('(' + extractVar('RECETA_METODO_ESTADO') + ')');
['recetaTiempoPaso', 'recetaInconsistenciaTituloPasos', 'recetaClasificarPaso'].forEach(n => { sb[n] = vm.runInNewContext('(' + extractFunc(n) + ')', sb); });

// --- reconstruye baseRecipes (mini: solo necesita los objetos para inconsistencia) ---
const dump = JSON.parse(fs.readFileSync(path.join(__dirname, 'recetas-dump.json'), 'utf8'));
sb.baseRecipes = dump.map(r => ({ name: r.name, method: r.method, ingredients: r.ingredients, steps: r.steps }));

const TIP_RX = /no se dora|no ahuma|se hierve en su agua|no dora\.|cómo usarlo|rapidísimo|en cuanto se desmenuce|sal al final|⚠️ el pescado|el chiste|buena para|no diario|más sabor|queda seca|queda como|no amases|solo por fuera|la 80\/20|al final el queso|sírvelo|divide|come|toma|úsa|usa|guarda|ideal|excelente|aguanta|rinde|económic|barat|llena|calorías|proteína del queso/i;
const FAM = {
  'cocción sin tiempo': [],
  'cocción sin criterio': [],
  'tostado/dorado': [],
  'reposo': [],
  'escurrido': [],
  'preparación previa asumida': [],
  'enlaces circulares': [],
  'datos contradictorios': [],
  'no culinarios / falsos positivos': [],
};
const ej = f => FAM[f].slice(0, 3).map(x => '    · ' + x).join('\n');

// pasos rojos
rep.pasosRojos.forEach(x => {
  const t = x.texto.toLowerCase();
  if (/\btm5\b/.test(x.receta.toLowerCase())) { FAM['no culinarios / falsos positivos'].push('(TM5, no se toca) [' + x.receta + '] p' + x.paso + ': ' + x.texto.slice(0, 70)); return; }
  if (TIP_RX.test(t) && !/\btuesta\b/.test(t)) { FAM['no culinarios / falsos positivos'].push('[' + x.receta + '] p' + x.paso + ': ' + x.texto.slice(0, 70)); return; }
  if (/\btuesta\b|tuéstal|\basa\b|asá|\bdora\b|doren|\bseca\b/.test(t) && /pan|tostad|salchich|fideo|pepitas|chiles|molletes/.test(t)) { FAM['tostado/dorado'].push('[' + x.receta + '] p' + x.paso + ': ' + x.texto.slice(0, 70)); return; }
  if (/pan|rebanada|tostad|molletes/.test(t)) { FAM['tostado/dorado'].push('[' + x.receta + '] p' + x.paso + ': ' + x.texto.slice(0, 70)); return; }
  FAM['cocción sin tiempo'].push('[' + x.receta + '] p' + x.paso + ': ' + x.texto.slice(0, 70));
});
// pasos amarillos por tipo
rep.pasosAmarillos.forEach(x => {
  const t = x.texto.toLowerCase();
  if (x.tipo === 'dorar-sin-senal') return FAM['tostado/dorado'].push('[' + x.receta + '] p' + x.paso + ': ' + x.texto.slice(0, 70));
  if (x.tipo === 'reposar-sin-tiempo') return FAM['reposo'].push('[' + x.receta + '] p' + x.paso + ': ' + x.texto.slice(0, 70));
  if (x.tipo === 'escurrir-sin-contexto') return FAM['escurrido'].push('[' + x.receta + '] p' + x.paso + ': ' + x.texto.slice(0, 70));
  if (x.tipo === 'temperatura-sin-tiempo') return FAM['cocción sin tiempo'].push('[' + x.receta + '] p' + x.paso + ': ' + x.texto.slice(0, 70));
  // sin-criterio-claro y hasta-criterio-vago: separar falsos positivos
  if (TIP_RX.test(t) || /polvo para hornear|entera \(|leche fría|fría en|fría\.|tortillas y|harina \+|harina, |masa gruesos|licuadora|mezcla 1 taza|mezcla ¾|mezcla 2 tazas|agrega 4-5|exprime|agrega elote|enfría|integral|amasas|tazón|vaso|tazas de|sírvelo|divide|reparte/.test(t)) {
    FAM['no culinarios / falsos positivos'].push('[' + x.receta + '] p' + x.paso + ' (' + x.tipo + '): ' + x.texto.slice(0, 70));
  } else {
    FAM['cocción sin criterio'].push('[' + x.receta + '] p' + x.paso + ' (' + x.tipo + '): ' + x.texto.slice(0, 70));
  }
});
// preparación asumida
rep.rojas.forEach(x => x.det.forEach(d => {
  if (d.tipo !== 'preparacion-asumida') return;
  if (d.grupoB) FAM['enlaces circulares'].push('[' + x.name + '] ' + d.texto + ' → enlaza a "' + d.grupoB.nombre + '" (consumidora, no explica)');
  else FAM['preparación previa asumida'].push('[' + x.name + '] ' + d.texto);
}));
// datos contradictorios (título crudo + pasos cocinan)
dump.forEach(r => { if (sb.recetaInconsistenciaTituloPasos(r)) FAM['datos contradictorios'].push('[' + r.name + '] ' + sb.recetaInconsistenciaTituloPasos(r)); });

console.log('=== FAMILIAS DE PENDIENTES ===');
Object.keys(FAM).forEach(f => {
  console.log('\n## ' + f + ': ' + FAM[f].length);
  console.log(ej(f));
});
console.log('\nTOTAL clasificados:', Object.values(FAM).reduce((a, b) => a + b.length, 0));
// volcado completo para revisión manual
let full = '';
Object.keys(FAM).forEach(f => {
  full += '\n## ' + f + ' (' + FAM[f].length + ')\n';
  FAM[f].forEach(x => { full += x + '\n'; });
});
fs.writeFileSync(path.join(__dirname, 'familias-full.txt'), full, 'utf8');
console.log('Volcado completo: tools/familias-full.txt');
console.log('Pasos 🔴 totales:', rep.pasosRojos.length, '· 🟡 totales:', rep.pasosAmarillos.length, '· prep-asumida:', rep.rojas.reduce((a, x) => a + x.det.filter(d => d.tipo === 'preparacion-asumida').length, 0));
