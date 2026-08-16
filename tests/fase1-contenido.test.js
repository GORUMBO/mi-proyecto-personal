// ============================================================
// PRUEBAS FASE 1 (calidad de contenido, sin tocar sync):
// 1) EX_MAPA corregido: renombres, músculo equivocado (cargada
//    colgante), duplicados eliminados, eq en español, conteo real.
// 2) Recetas corregidas: seguridad alimentaria (hígado 71°C,
//    pollo air fryer, costillas), macros de licuados/pescados.
// 3) methodKeyOf reconoce frio/refri como "Sin cocinar".
// 4) ex-fotos.js redundante ya no se carga.
// Uso: node tests/fase1-contenido.test.js
// ============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extractFunc(name) {
  var src = HTML;
  let i = src.indexOf('async function ' + name + '(');
  if (i < 0) i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('No se encontró function ' + name);
  let parens = 0, j = i, q = null, bodyStart = -1;
  for (; j < src.length; j++) {
    const c = src[j];
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '(') parens++;
    else if (c === ')') { parens--; if (parens === 0) { bodyStart = j + 1; break; } }
  }
  if (bodyStart < 0) throw new Error('params de ' + name);
  let depth = 0; q = null; j = bodyStart;
  for (; j < src.length; j++) {
    const c = src[j];
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return src.slice(i, j + 1); }
  }
  throw new Error('incompleta: ' + name);
}

let passed = 0, failed = 0;
const failures = [];
function t(name, cond, extra) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; failures.push(name + (extra ? ' → ' + extra : '')); console.log('  ✗ ' + name + (extra ? ' → ' + extra : '')); }
}

// ============================================================
// A) EX_MAPA: parse del mapa real de index.html
// ============================================================
console.log('\n== EX_MAPA corregido ==');
const mMap = HTML.match(/const EX_MAPA=(\{.*\});/);
t('A1 · const EX_MAPA existe en index.html', !!mMap);
let EX_MAPA = null;
try { EX_MAPA = mMap ? JSON.parse(mMap[1]) : null; }
catch (e) { EX_MAPA = null; t('A2 · EX_MAPA parsea como JSON', false, String(e)); }
t('A2 · EX_MAPA parsea como JSON', !!EX_MAPA);

if (EX_MAPA) {
  const nuevos = [
    'Cargada colgante alternada', 'Press JM', 'Estiramiento de cuádriceps de rodillas',
    'Elevación de cadera rodillas flexionadas', 'Salto de estrella', 'Remo con trineo',
    'Curl martillo alternado', 'Elevación frontal alternada', 'Sentadilla split lateral con barra',
    'Press cerrado con barra', 'Sentadilla asistida a una pierna', 'Encogimiento de piernas en banco sentado',
    'Press sentado de tríceps', 'Sit-up con barra', 'Dominada asistida con banda',
    'Lagartija amplia', 'Lagartijas alternando agarre', 'Crunch inverso',
    'Curl con barra agarre inverso', 'Hiperextensión inversa', 'Peso muerto con banda invertida',
    'Sentadilla a cajón con banda invertida', 'Peso muerto sumo con banda invertida',
    'Aperturas inversas en máquina', 'Aperturas inversas (pájaros)'
  ];
  nuevos.forEach(n => t('A3 · existe "' + n + '"', !!EX_MAPA[n]));

  const viejos = [
    'Cargada colgante alternando', 'Press', 'Estiramiento', 'Elevación', 'Salto', 'Trineo',
    'Curl martillo alternando', 'Elevación alternando', 'Sentadilla búlgara con barra lateral',
    'Press cerrado máquina', 'Sentadilla a una pierna asistida', 'Jalón sentado plano',
    'Press sentado', 'Abdominal completo', 'Dominada asistido con banda',
    'Lagartija abierto', 'Lagartijas abierto', 'Abdominal invertido', 'Curl con barra invertido',
    'Hiperextensión invertido', 'Peso muerto invertido con banda', 'Sentadilla invertido con banda',
    'Peso muerto sumo invertido con banda', 'Aperturas en máquina invertido', 'Aperturas invertido',
    'Dominadas', 'Press de banca con barra agarre medio', 'Peso muerto con barra',
    'Press con mancuernas', 'Saltos de pantorrilla', 'Patada en cable', 'Máquina glúteo'
  ];
  viejos.forEach(n => t('A4 · eliminado "' + n + '"', !EX_MAPA[n]));

  t('A5 · total 505 entradas (511 − 7 duplicados + 1 alias)', Object.keys(EX_MAPA).length === 505, 'hay ' + Object.keys(EX_MAPA).length);
  t('A6 · cargada colgante = espalda media (antes femoral)',
    EX_MAPA['Cargada colgante alternada'] && EX_MAPA['Cargada colgante alternada'].m[0] === 'espalda media',
    JSON.stringify(EX_MAPA['Cargada colgante alternada']));
  t('A7 · "Hip thrust ligero" conserva su alias y "Hip thrust con barra" es el nombre principal',
    !!EX_MAPA['Hip thrust ligero'] && !!EX_MAPA['Hip thrust con barra']
    && EX_MAPA['Hip thrust ligero'].id === 'Barbell_Hip_Thrust');
  const eqBodyOnly = Object.keys(EX_MAPA).filter(k => EX_MAPA[k].eq === 'body only').length;
  t('A8 · eq sin inglés "body only"', eqBodyOnly === 0, eqBodyOnly + ' quedan');
  t('A9 · eq usa "peso corporal"', Object.keys(EX_MAPA).some(k => EX_MAPA[k].eq === 'peso corporal'));
}

t('A10 · comentario actualizado a 511 (antes decía 873)',
  /511 ejercicios de dominio público \(free-exercise-db, selección\)/.test(HTML)
  && !/873 ejercicios de dominio público/.test(HTML));

// ============================================================
// B) exBuscar sigue resolviendo los nombres que usa la app
// ============================================================
console.log('\n== Búsqueda de ejercicios (exBuscar) ==');
if (EX_MAPA) {
  const sandbox = { console, EX_MAPA, EX_FOTOS: {} };
  vm.runInNewContext(extractFunc('exNormal') + '\n' + extractFunc('exBuscar'), sandbox);
  t('B1 · "Hip thrust ligero" (banco) → Barbell_Hip_Thrust',
    !!(sandbox.exBuscar('Hip thrust ligero')) && sandbox.exBuscar('Hip thrust ligero').id === 'Barbell_Hip_Thrust');
  t('B2 · "Elevación de pantorrilla de pie" (banco) → Standing_Calf_Raises',
    !!(sandbox.exBuscar('Elevación de pantorrilla de pie')) && sandbox.exBuscar('Elevación de pantorrilla de pie').id === 'Standing_Calf_Raises');
  t('B3 · "Press JM" (corregido) → JM_Press',
    !!(sandbox.exBuscar('Press JM')) && sandbox.exBuscar('Press JM').id === 'JM_Press');
  t('B4 · "Prensa ligera" (picker intacto) → Leg_Press',
    !!(sandbox.exBuscar('Prensa ligera')) && sandbox.exBuscar('Prensa ligera').id === 'Leg_Press');
}

// ============================================================
// C) Recetas corregidas
// ============================================================
console.log('\n== Recetas corregidas ==');
const recetas = [
  ['C1 · hígado: 71°C mínimo USDA (antes 63°C máximo)',
    /Hígado 71°C mínimo \(USDA\)/.test(HTML) && !/Hígado 63°C máximo/.test(HTML)],
  ['C2 · pollo entero air fryer: 60 min · 1200 kcal · 105 g P (antes 35/780/68)',
    HTML.includes("['Pollo entero en air fryer','comida',60,1200,105,4.50,")],
  ['C3 · pollo air fryer: 25 min boca abajo y 20-25 min tras voltear',
    HTML.includes("'Ponlo con la PECHUGA HACIA ABAJO. 200°C, 25 min.'")
    && HTML.includes("'Voltéalo. 200°C, 20-25 min más.'")],
  ['C4 · costillas BBQ: 150 min · 2 h tapadas a 150°C (antes 60 min / 45 min a 160°C)',
    HTML.includes("['Costillas BBQ al horno','comida',150,740,39,3.20,")
    && HTML.includes("'Hornea a 150°C (300°F) tapadas 2 h.'")],
  ['C5 · licuado noche ganancia: 35 g P (antes 49, imposible)',
    HTML.includes("['Licuado noche ganancia muscular','licuado',5,860,35,1.6,")],
  ['C6 · licuado tofu: 11 g P y paso coherente (antes 20)',
    HTML.includes("name:'Licuado de tofu, fresa y almendra', time:6, k:480, p:11,")
    && HTML.includes('proteína (11g)')],
  ['C7 · licuado crema cacahuate: 30 g P (antes 41)',
    HTML.includes("['Licuado crema cacahuate + yogurt','licuado',5,760,30,1.8,")],
  ['C8 · café con leche y plátano: 10 g P (antes 14)',
    HTML.includes("['Café con leche y plátano (para subir peso)','cafe',6,420,10,1.2,")],
  ['C9 · ceviche: 540 kcal / 90 g P por tanda, 4 porciones (antes 280/36)',
    HTML.includes("name:'Ceviche de tilapia', time:30, k:540, p:90, cost:4.60, porciones:'4',")],
  ['C10 · tilapia empanizada: 1560 kcal / 110 g P por tanda, 4 porciones (antes 480/42)',
    HTML.includes("name:'Tilapia empanizada', time:20, k:1560, p:110, cost:3.60, porciones:'4',")],
  ['C11 · ensalada de camarón: 600 kcal / 82 g P, 2 porciones (antes 480/42)',
    HTML.includes("name:'Ensalada de camarón con aguacate', time:20, k:600, p:82, cost:6.80, porciones:'2',")],
  ['C12 · poke bowl: 46 g P (antes 42, menos que el atún solo)',
    HTML.includes("'Poke bowl de atún (estilo Maui)',12,620,46,4.50,")]
];
recetas.forEach(r => t(r[0], r[1]));

// ============================================================
// D) methodKeyOf: frio/refri = Sin cocinar
// ============================================================
console.log('\n== Método de cocción (methodKeyOf) ==');
const sandboxMk = { console };
vm.runInNewContext(extractFunc('methodKeyOf'), sandboxMk);
const mk = sandboxMk.methodKeyOf;
t('D1 · "frio" → sincocinar', mk('frio') === 'sincocinar');
t('D2 · "refri" → sincocinar', mk('refri') === 'sincocinar');
t('D3 · "horno" sigue → horno', mk('horno') === 'horno');
t('D4 · "comal" sigue → estufa', mk('comal') === 'estufa');
t('D5 · "estufa" sigue → estufa', mk('estufa') === 'estufa');

// ============================================================
// E) ex-fotos.js redundante ya no se carga
// ============================================================
console.log('\n== ex-fotos.js ==');
t('E1 · index.html ya no carga ex-fotos.js', !/<script defer src="ex-fotos\.js"><\/script>/.test(HTML));

console.log('\n==========================================');
console.log('Resultado: ' + passed + ' pasaron · ' + failed + ' fallaron');
console.log('==========================================');
if (failed) {
  console.log('\nFallos:\n' + failures.map(function (f) { return '  ✗ ' + f; }).join('\n'));
  process.exit(1);
}
process.exit(0);
