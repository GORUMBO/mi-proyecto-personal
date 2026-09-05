// Prueba los candidatos del lote 3 con el clasificador real antes de editar.
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
function extractVar(name) {
  const m = HTML.match(new RegExp('var ' + name + '=([^;\\n]+);'));
  return m ? m[1] : null;
}
const sb = {
  RECETA_ESTADOS: vm.runInNewContext('(' + extractVar('RECETA_ESTADOS') + ')'),
};
sb.RECETA_ESTADOS_RX = vm.runInNewContext('(' + extractVar('RECETA_ESTADOS_RX') + ')', sb);
sb.RECETA_COCCION_VERB = vm.runInNewContext('(' + extractVar('RECETA_COCCION_VERB') + ')');
sb.RECETA_CRITERIO_RX = vm.runInNewContext('(' + extractVar('RECETA_CRITERIO_RX') + ')');
sb.RECETA_COCCION_VERB_PROFUNDO = vm.runInNewContext('(' + extractVar('RECETA_COCCION_VERB_PROFUNDO') + ')');
sb.RECETA_PASO_REPOSO = vm.runInNewContext('(' + extractVar('RECETA_PASO_REPOSO') + ')');
sb.RECETA_PASO_DORAR = vm.runInNewContext('(' + extractVar('RECETA_PASO_DORAR') + ')');
sb.RECETA_PASO_ESCURRIR = vm.runInNewContext('(' + extractVar('RECETA_PASO_ESCURRIR') + ')');
sb.RECETA_PASO_SAZONAR = vm.runInNewContext('(' + extractVar('RECETA_PASO_SAZONAR') + ')');
sb.RECETA_PASO_HASTA = vm.runInNewContext('(' + extractVar('RECETA_PASO_HASTA') + ')');
sb.RECETA_PASO_TEMP = vm.runInNewContext('(' + extractVar('RECETA_PASO_TEMP') + ')');
['recetaTiempoPaso', 'recetaClasificarPaso'].forEach(n => { sb[n] = vm.runInNewContext('(' + extractFunc(n) + ')', sb); });

const pares = [
  // [antes, después, nota]
  ['Calienta frijoles en microondas.', 'Calienta frijoles en microondas 1-2 min.', '[361] Totopos'],
  ['Fríe en poco aceite hasta dorar ambos lados.', 'Fríe en poco aceite a fuego medio; dora de ambos lados.', '[413] Milanesa pollo'],
  ['Fríe hasta dorar.', 'Fríe a fuego medio; dora por ambos lados.', '[414] Milanesa res'],
  ['Agrega 150g de pollo cocido y calienta.', 'Agrega 150g de pollo cocido y calienta a fuego bajo.', '[422] Mole rápido'],
  ['Sofríe cebolla, jitomate y chile.', 'Sofríe cebolla, jitomate y chile a fuego medio.', '[503] Huevos machaca'],
  ['Derrite la mantequilla y mézclala con la salsa búfalo.', 'Derrite la mantequilla a fuego bajo y mézclala con la salsa búfalo.', '[513] Huevos búfalo'],
  ['Calienta aceite con ajo.', 'Calienta aceite con ajo a fuego medio-alto.', '[522] Arroz verduras'],
  ['Estrella los huevos EN LA GRASA DEL TOCINO. La yema debe quedar líquida.', 'Estrella los huevos a 160°C EN LA GRASA DEL TOCINO. La yema debe quedar líquida.', '[574] Hamburguesa huevo'],
  ['Baña con la mantequilla de ajo mientras se cocinan.', 'Baña con la mantequilla de ajo mientras se cocinan — 3 min por lado.', '[588] Tilapia mojo'],
  ['Calienta 1 cucharada de aceite en sartén grande.', 'Calienta 1 cucharada de aceite en sartén grande a 180°C.', '[191] Arroz frito'],
  ['Calienta 180g de pollo cocido con 1 cucharadita de aceite.', 'Calienta 180g de pollo cocido con 1 cucharadita de aceite a 74°C.', '[192] Pasta cremosa'],
  ['Calienta 4 tortillas y agrega carne y ½ taza de queso.', 'Calienta 4 tortillas en el comal a 180°C y agrega carne y ½ taza de queso.', '[193] Quesadillas'],
  ['Pasa tortillas por salsa caliente y dobla.', 'Pasa tortillas por la salsa caliente a 160°C y dobla.', '[11] Enfrijoladas'],
  ['Pasa tortillas por salsa y rellena con queso.', 'Pasa tortillas por la salsa a 160°C y rellena con queso.', '[20] Enchiladas'],
  // para diagnóstico: por qué están marcados
  ['Pon en licuadora: 2 tazas leche entera (480ml).', null, '[31] diag'],
  ['Vierte 2 tazas de leche entera fría en la licuadora.', null, '[374] diag'],
  ['Pasa tortillas por salsa caliente y dobla.', null, '[11] diag'],
  ['Corta el pescado en cubos CHICOS. Entre más chicos, más rápido se "cuecen".', null, '[592] diag'],
];
pares.forEach(([antes, despues, nota]) => {
  const a = sb.recetaClasificarPaso(antes);
  const line = 'ANTES [' + nota + '] ' + a.nivel + '/' + a.tipo + ' · esCoccion=' + sb.RECETA_COCCION_VERB.test(antes) + ' :: "' + antes.slice(0, 60) + '"';
  console.log(line);
  if (despues) {
    const d = sb.recetaClasificarPaso(despues);
    console.log('   DESPUÉS ' + d.nivel + '/' + d.tipo + ' :: "' + despues.slice(0, 80) + '"');
  }
});
