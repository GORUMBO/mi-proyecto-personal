// Verifica las transiciones antes/después de los ejemplos del lote 7.
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
  if (!m) throw new Error(name);
  return m[1];
}
const sb = {};
['RECETA_COCCION_VERB', 'RECETA_CRITERIO_RX', 'RECETA_PASO_REPOSO', 'RECETA_PASO_DORAR', 'RECETA_PASO_ESCURRIR',
  'RECETA_PASO_SAZONAR', 'RECETA_PASO_HASTA', 'RECETA_PASO_TEMP', 'RECETA_PASO_TIP'].forEach(n => { sb[n] = vm.runInNewContext('(' + extractVar(n) + ')'); });
['recetaTiempoPaso', 'recetaClasificarPaso'].forEach(n => { sb[n] = vm.runInNewContext('(' + extractFunc(n) + ')', sb); });

const ej = [
  // [paso, viejo, nota]
  ["Pon en licuadora: 2 tazas leche entera (480ml).", '🟡', "'dora' dentro de licuadora (substring)"],
  ["Vierte 2 tazas de leche entera fría en la licuadora.", '🟡', "'fría' adjetivo + licuadora"],
  ["Mezcla 1 taza de harina, 2 cucharadas de cacao, 1 cucharada de azúcar y 1 cucharadita de polvo para hornear.", '🟡', "'hornea' dentro de 'hornear'"],
  ["Arma: carne, queso, piña asada, cebolla morada.", '🟡', "'asa' dentro de 'asada'"],
  ["Sirve agua mineral fría en un vaso con hielo.", '🟡', "'fría' adjetivo"],
  ["Fría sabe mejor. Aguanta todo el día en la lonchera.", '🟡', "'fría' adjetivo"],
  ["Seca el pollo con papel. Si está mojado NO se dora.", '🔴', 'negación: no es instrucción de cocción'],
  ["No salpica, no ahuma la cocina, y la grasa se queda abajo.", '🔴', 'descripción'],
  ["Sal al final. Si la salas antes, la carne suelta agua y no dora.", '🔴', 'consejo con negación'],
  ["Rómpela y revuélvela. AHORA sí échale la sal (antes, la carne se hierve en su agua).", '🔴', 'explicación pasiva entre paréntesis'],
  ["Cómo usarlo: en licuados en vez de agua. Para cocer el arroz. En la masa del pan. En sopas.", '🔴', 'tip de usos'],
  ["⚠️ El pescado se cuece rapidísimo. En cuanto se desmenuce con el tenedor, ya está. Limón al servir.", '🔴', 'criterio real: desmenuce'],
  ["Escurre lata de atún, mezcla con limón y chile al gusto.", '🟡', 'escurrido = manejo válido'],
  ["Escurre en papel.", '🟡', 'escurrido = manejo válido'],
  ["Escurre exceso de grasa, deja 1 cda.", '🟡', 'escurrido = manejo válido'],
  ["Cuece y escurre los nopales.", '🟡', 'tiene verbo real (cuece) sin tiempo → ahora 🔴 honesto'],
  ["Fríe en poco aceite hasta dorar.", '🟡', "'hasta dorar' = criterio suficiente"],
  ["Fríe el arroz en aceite hasta que suene y dore ligeramente.", '🟡', "'dore' = criterio suficiente"],
  ["Sofríe arroz con tomate licuado hasta dorar.", '🟡', "'hasta dorar' = criterio suficiente"],
  ["Dora la carne molida (sin sal hasta que dore).", '🟡', "'hasta que dore' = criterio suficiente"],
  ["Calienta la leche con el azúcar (sin hervir) y disuelve la grenetina.", '🔴', "'sin hervir' = criterio válido"],
  ["Tuesta 2 rebanadas de pan.", '🔴', 'SIGUE pendiente (sin señal)'],
  ["Dora 150g de carne molida.", '🔴', 'SIGUE pendiente (sin señal)']
];
ej.forEach(([paso, viejo, nota]) => {
  const c = sb.recetaClasificarPaso(paso);
  console.log(viejo + ' → ' + c.nivel + '/' + c.tipo + ' · ' + nota + ' :: "' + paso.slice(0, 55) + '"');
});
