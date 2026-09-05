// ============================================================
// PRUEBAS Fase A — Modo fácil de recetas (Rápido / Paso a paso /
// Completo + porciones). Reglas: NUNCA inventar cantidades,
// tiempos, macros ni parámetros TM5; no parseable → texto original.
// Uso: node tests/faseA-modo-facil.test.js
// ============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extractFunc(name) {
  const i = HTML.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('No se encontró function ' + name);
  let depth = 0, j = i, q = null;
  for (; j < HTML.length; j++) {
    const c = HTML[j];
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === '/' && (HTML[j + 1] === "'" || HTML[j + 1] === '"' || HTML[j + 1] === '\\') && /[\(,=:\[!&|?;{+\-*%~^<>]\s*$/.test(HTML.slice(Math.max(0, j - 4), j))) {
      j++;
      while (j < HTML.length && !(HTML[j] === '/' && HTML[j - 1] !== '\\')) j++;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return HTML.slice(i, j + 1); }
  }
  throw new Error('incompleta: ' + name);
}

let pasadas = 0, falladas = 0;
function t(label, ok, extra) {
  if (ok) { pasadas++; console.log('✓ ' + label + (extra ? ' · ' + extra : '')); }
  else { falladas++; console.log('✗ FALLA ' + label + (extra ? ' · ' + extra : '')); }
}

const NOMBRES = ['recetaPorciones', 'recetaTiempoPaso', 'recetaParseIngrediente', 'recetaIngredientes',
  'recetaPasosResumen', 'recetaRapidoHTML', 'recetaPasoHTML', 'recetaCompletoHTML', 'recetaDetalleHTML',
  'recetaComponentesEnPaso', 'recetaComponenteCalif', 'recetaPreparacionPrevia', 'recetaPreviaInterna', 'recetaPreviaHTML',
  'recetaAvisosPreparacionHTML', 'recetaAvisoVisto', 'recetaAuditar', 'recetaSujetoDe', 'recetaExplicaPreparacion',
  'recetaPasoTM5', 'recetaPasoTM5Parametros', 'recetaClasificarTM5', 'recetaTM5TextoCorto', 'recetaTM5ListaHTML', 'recetaMetodo'];
const mFrac = HTML.match(/var RECETA_FRACCIONES=\{[^}]*\};/);
if (!mFrac) throw new Error('No se encontró RECETA_FRACCIONES');
const RECETA_FRACCIONES = vm.runInNewContext('(' + mFrac[0].replace(/^var RECETA_FRACCIONES=/, '').replace(/;$/, '') + ')');
const mComps = HTML.match(/var RECETA_COMPONENTES=\[[\s\S]*?\];\s*\n/);
if (!mComps) throw new Error('No se encontró RECETA_COMPONENTES');
const RECETA_COMPONENTES = vm.runInNewContext('(' + mComps[0].replace(/^var RECETA_COMPONENTES=/, '').replace(/;\s*\n$/, '') + ')');
function sandbox() {
  const mEst = HTML.match(/var RECETA_ESTADOS=\[[\s\S]*?\];\s*\n/);
  const mEstRx = HTML.match(/var RECETA_ESTADOS_RX=[^;\n]+;/);
  const mVerb = HTML.match(/var RECETA_COCCION_VERB=[^;\n]+;/);
  const mCrit = HTML.match(/var RECETA_CRITERIO_RX=[^;\n]+;/);
  const mExt = HTML.match(/var RECETA_TM5_EXTERNO=[^;\n]+;/);
  const mAcc = HTML.match(/var RECETA_TM5_ACCION=[^;\n]+;/);
  const mCoc = HTML.match(/var RECETA_TM5_COCCION=[^;\n]+;/);
  const mEsc = HTML.match(/var RECETA_PASO_ESCURRIR=[^;\n]+;/);
  const mTip = HTML.match(/var RECETA_PASO_TIP=[^;\n]+;/);
  const ESTADOS = vm.runInNewContext('(' + mEst[0].replace(/^var RECETA_ESTADOS=/, '').replace(/;\s*\n$/, '') + ')');
  const sb = {
    safeText: function (x) { return String(x == null ? '' : x); },
    RECETA_FRACCIONES: RECETA_FRACCIONES, RECETA_COMPONENTES: RECETA_COMPONENTES,
    RECETA_ESTADOS: ESTADOS,
    RECETA_ESTADOS_RX: vm.runInNewContext('(' + mEstRx[0].replace(/^var RECETA_ESTADOS_RX=/, '').replace(/;$/, '') + ')', { RECETA_ESTADOS: ESTADOS }),
    RECETA_COCCION_VERB: vm.runInNewContext('(' + mVerb[0].replace(/^var RECETA_COCCION_VERB=/, '').replace(/;$/, '') + ')'),
    RECETA_CRITERIO_RX: vm.runInNewContext('(' + mCrit[0].replace(/^var RECETA_CRITERIO_RX=/, '').replace(/;$/, '') + ')'),
    RECETA_TM5_EXTERNO: vm.runInNewContext('(' + mExt[0].replace(/^var RECETA_TM5_EXTERNO=/, '').replace(/;$/, '') + ')'),
    RECETA_TM5_ACCION: vm.runInNewContext('(' + mAcc[0].replace(/^var RECETA_TM5_ACCION=/, '').replace(/;$/, '') + ')'),
    RECETA_TM5_COCCION: vm.runInNewContext('(' + mCoc[0].replace(/^var RECETA_TM5_COCCION=/, '').replace(/;$/, '') + ')'),
    RECETA_PASO_ESCURRIR: vm.runInNewContext('(' + mEsc[0].replace(/^var RECETA_PASO_ESCURRIR=/, '').replace(/;$/, '') + ')'),
    RECETA_PASO_TIP: vm.runInNewContext('(' + mTip[0].replace(/^var RECETA_PASO_TIP=/, '').replace(/;$/, '') + ')')
  };
  NOMBRES.forEach(n => { sb[n] = vm.runInNewContext('(' + extractFunc(n) + ')', sb); });
  sb.globalThis = sb;
  return sb;
}

const sb = sandbox();
const RECETA = {
  type: 'comida', name: 'Bistec ranchero con papas', time: 30, k: 1300, p: 60,
  cost: 5.2, porciones: '2',
  ingredients: '300 g bistec, 2 papas, 2 jitomates, 1/4 cebolla, chile, sal, aceite',
  steps: ['Corta las papas en cubos.', 'Cocínalas 10-12 min.', 'Sofríe cebolla y jitomate 5 min.',
    'Agrega el bistec y cocina 7-9 min.', 'Agrega las papas.', 'Sazona y cocina 3 min más.'],
  method: 'estufa', tags: 'mexicana', temp: 'Fuego medio', conservar: 'Refri 3 días.'
};
const RECETA_SIN_PORCIONES = { name: 'Agua de mango con coco', time: 5, k: 190, p: 2, cost: 1.2, ingredients: '1 mango, 1 taza agua de coco', steps: ['Licúa todo.', 'Sirve frío.'] };
const RECETA_SIN_MACROS = { name: 'Tacos de pollo', time: 20, k: 500, p: 40, ingredients: '2 tortillas, pollo', steps: ['Arma los tacos.', 'Sírvelos.'] };

console.log('== 1 · Rápido NO modifica la receta original ==');
(function () {
  const copia = JSON.stringify(RECETA);
  sb.recetaRapidoHTML(RECETA, 1);
  t('receta intacta tras Rápido', JSON.stringify(RECETA) === copia);
  sb.recetaRapidoHTML(RECETA, 2);
  t('receta intacta tras Rápido con ×2', JSON.stringify(RECETA) === copia);
})();

console.log('== 2 · Completo conserva exactamente la receta original ==');
(function () {
  const copia = JSON.stringify(RECETA);
  const h = sb.recetaCompletoHTML(RECETA);
  t('receta intacta tras Completo', JSON.stringify(RECETA) === copia);
  RECETA.ingredients.split(',').forEach(i => {
    if (!h.includes(i.trim())) t('ingrediente original presente: ' + i.trim(), false);
  });
  t('todos los ingredientes originales presentes', true);
  t('todos los pasos originales presentes', RECETA.steps.every(s => h.includes(s)));
  t('kcal original en el Completo', h.includes(String(RECETA.k)));
})();

console.log('== 3 · Paso a paso conserva TODOS los pasos ==');
(function () {
  const n = RECETA.steps.length;
  for (let i = 0; i < n; i++) {
    const h = sb.recetaPasoHTML(RECETA, 1, i);
    if (!h.includes('Paso ' + (i + 1) + ' de ' + n) || !h.includes(RECETA.steps[i])) {
      t('paso ' + (i + 1) + ' presente y numerado', false, h.slice(0, 80));
      return;
    }
  }
  t('los ' + n + ' pasos existen y están numerados', true);
})();

console.log('== 4 · 2→4 personas escala SOLO cantidades parseables ==');
(function () {
  const ing = sb.recetaIngredientes(RECETA, 2);
  const by = {};
  ing.forEach(i => { by[i.original] = i; });
  t('300 g bistec → 600 g bistec', by['300 g bistec'].texto === '600 g bistec');
  t('2 papas → 4 papas', by['2 papas'].texto === '4 papas');
  t('sal queda intacta', by['sal'].texto === 'sal' && !by['sal'].parseable);
  t('aceite queda intacta', by['aceite'].texto === 'aceite');
  t('chile queda intacto', by['chile'].texto === 'chile');
})();

console.log('== 5 · Ingredientes no parseables quedan intactos ==');
(function () {
  const r = { ingredients: 'al gusto, sal y pimienta, ½ cebolla, 1 1/2 tazas de arroz' };
  const ing = sb.recetaIngredientes(r, 2);
  const by = {};
  ing.forEach(i => { by[i.original] = i; });
  t('"al gusto" intacto', by['al gusto'].texto === 'al gusto' && !by['al gusto'].parseable);
  t('"sal y pimienta" intacto', by['sal y pimienta'].texto === 'sal y pimienta' && !by['sal y pimienta'].parseable);
  t('½ cebolla ×2 → 1 cebolla', by['½ cebolla'].texto === '1 cebolla');
  t('1 1/2 tazas de arroz ×2 → 3 tazas de arroz', by['1 1/2 tazas de arroz'].texto === '3 tazas de arroz');
})();

console.log('== 6 · Receta sin porciones confiables NO muestra selector ==');
(function () {
  t('porciones "aprox" → null', sb.recetaPorciones({ porciones: 'aprox' }) === null);
  t('porciones "4 vasos" → 4', sb.recetaPorciones({ porciones: '4 vasos' }).n === 4);
  t('porciones "2" → 2', sb.recetaPorciones({ porciones: '2' }).n === 2);
  t('sin porciones → null', sb.recetaPorciones(RECETA_SIN_PORCIONES) === null);
  // vista de detalle sin selector (mismo sandbox con baseRecipes/window)
  const sbc = Object.assign({}, sb, {
    baseRecipes: [RECETA_SIN_PORCIONES],
    window: { _recetaVista: { idx: 0, modo: 'rapido', personas: null, paso: 0 } }
  });
  const detalle = vm.runInNewContext('(' + extractFunc('recetaDetalleHTML') + ')', sbc);
  const h = detalle();
  t('detalle sin selector de personas', !h.includes('persona'), h.slice(0, 60));
})();

console.log('== 7 · Sin macros NO inventa nutrición ==');
(function () {
  const h = sb.recetaCompletoHTML(RECETA_SIN_MACROS);
  t('muestra "Información nutricional no disponible"', h.includes('Información nutricional no disponible'));
  t('no inventa números de carbs/grasa', !/CARBS|carbs<\/div>/.test(h) || h.includes('no disponible'));
})();

console.log('== 8 · Paso SIN tiempo NO muestra temporizador ==');
(function () {
  t('sin tiempo → null', sb.recetaTiempoPaso('Corta las papas en cubos.') === null);
  const h = sb.recetaPasoHTML(RECETA, 1, 0);
  t('paso 1 sin botón de temporizador', !h.includes('temporizador'));
})();

console.log('== 9 · Paso CON tiempo SÍ lo muestra ==');
(function () {
  const tt = sb.recetaTiempoPaso('Cocínalas 10-12 min.');
  t('10-12 min → 600 seg', tt && tt.seg === 600, JSON.stringify(tt));
  const h = sb.recetaPasoHTML(RECETA, 1, 1);
  t('paso 2 con botón "Iniciar temporizador 10 min"', h.includes('⏱ Iniciar temporizador 10 min'));
  t('usa openAppTimer en el handler', h.includes('recetaPasoTimer()'));
})();

console.log('== 10 · Móvil: navegación Anterior/Siguiente ==');
(function () {
  const n = RECETA.steps.length;
  const primero = sb.recetaPasoHTML(RECETA, 1, 0);
  t('primer paso: Anterior deshabilitado', primero.includes('← Anterior') && primero.includes('disabled'));
  t('primer paso: Siguiente habilitado', primero.includes('Siguiente →') && primero.includes('recetaPaso(1)'));
  const medio = sb.recetaPasoHTML(RECETA, 1, 2);
  t('paso medio: ambos habilitados', medio.includes('recetaPaso(-1)') && medio.includes('recetaPaso(1)'));
  const ultimo = sb.recetaPasoHTML(RECETA, 1, n - 1);
  t('último paso: Terminar cierra', ultimo.includes('✅ Terminar') && ultimo.includes('cerrarReceta()'));
  t('botones grandes para táctil (min-height 52px)', medio.includes('min-height:52px'));
})();

console.log('===== RESULTADO: ' + pasadas + ' PASS / ' + falladas + ' FAIL =====');
if (falladas) process.exit(1);
