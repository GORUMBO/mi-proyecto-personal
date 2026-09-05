// Verifica las reglas nuevas del lote 8.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function ef(n) {
  const i = HTML.indexOf('function ' + n + '(');
  if (i < 0) throw new Error(n);
  let d = 0, j = i, q = null;
  for (; j < HTML.length; j++) {
    const c = HTML[j];
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '{') d++;
    else if (c === '}') { d--; if (d === 0) return HTML.slice(i, j + 1); }
  }
  throw new Error('inc');
}
function ev(n) {
  const m = HTML.match(new RegExp('var ' + n + '=([^;\\n]+);'));
  return vm.runInNewContext('(' + m[1] + ')');
}
const sb = {};
['RECETA_COCCION_VERB', 'RECETA_CRITERIO_RX', 'RECETA_PASO_REPOSO', 'RECETA_PASO_DORAR', 'RECETA_PASO_ESCURRIR',
  'RECETA_PASO_SAZONAR', 'RECETA_PASO_HASTA', 'RECETA_PASO_TEMP', 'RECETA_PASO_TIP'].forEach(n => sb[n] = ev(n));
['recetaTiempoPaso', 'recetaClasificarPaso', 'recetaInconsistenciaTituloPasos'].forEach(n => sb[n] = vm.runInNewContext('(' + ef(n) + ')', sb));
sb.RECETA_COCCION_VERB_PROFUNDO = ev('RECETA_COCCION_VERB_PROFUNDO');

console.log('== regla criterio-hasta ==');
['Calienta sartén a fuego MUY ALTO (220°C) — hasta que humee ligeramente.',
  'Fríe el chorizo hasta que suelte grasa.',
  'Incorpora la pasta y cocina hasta que el pollo llegue a 74°C.',
  'Calienta hasta que todo esté bien caliente.'].forEach(s => {
  const c = sb.recetaClasificarPaso(s);
  console.log(c.nivel + '/' + c.tipo + ' :: ' + s.slice(0, 66));
});
console.log('== regla instrucción delegada ==');
['Calienta el burrito congelado según empaque.'].forEach(s => {
  const c = sb.recetaClasificarPaso(s);
  console.log(c.nivel + '/' + c.tipo + ' :: ' + s.slice(0, 66));
});
console.log('== tips residuales ==');
['Cómelo cuando no tienes tiempo de cocinar.', 'Al final el queso. Se derrite dentro.',
  'El calor de la papa derrite el queso.', 'Sal SOLO POR FUERA, justo antes de cocinar.',
  '480 kcal sin cocinar nada.', 'Snack rápido de proteína sin cocinar.'].forEach(s => {
  const c = sb.recetaClasificarPaso(s);
  console.log(c.nivel + '/' + c.tipo + ' :: ' + s.slice(0, 66));
});
console.log('== NO tocar (siguen pendientes) ==');
['Tuesta 2 rebanadas de pan.', 'Dora 500g de carne molida con cebolla y ajo.',
  'Cuece 100g de espagueti.'].forEach(s => {
  const c = sb.recetaClasificarPaso(s);
  console.log(c.nivel + '/' + c.tipo + ' :: ' + s.slice(0, 66));
});
console.log('== contradicciones con atribución ==');
const conAttr = { name: 'Salsa de aguacate verde', method: 'sin cocinar', ingredients: 'aguacate, tomatillos', steps: ['Hierve los 4 tomatillos 8 min hasta cambiar color y escúrrelos (preparación: Salsa verde cocida).', 'Licua todo.'] };
const sinAttr = { name: 'Ensalada de lentejas fría', method: 'sin cocinar', ingredients: 'lentejas', steps: ['Cuece 1 taza de lentejas con laurel — 22 min.'] };
console.log('con atribución → inconsistencia:', sb.recetaInconsistenciaTituloPasos(conAttr));
console.log('sin atribución → inconsistencia:', sb.recetaInconsistenciaTituloPasos(sinAttr));
