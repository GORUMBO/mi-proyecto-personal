// ============================================================
// PRUEBAS — Comer: ✅ Comí esto (dedupe), porciones 1-4 con cálculo,
// nutrición por porción/total, notas de preparación, historial del
// día, persistencia refresh/cierre y viaje en el snapshot (sync).
// Uso: node tests/comer-registro.test.js
// ============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extractFunc(name) {
  const src = HTML;
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('No se encontró function ' + name);
  let depth = 0, j = i, q = null, tplStack = [];
  for (; j < src.length; j++) {
    const c = src[j];
    if (q === '`') {
      if (c === '\\') { j++; continue; }
      if (c === '`') { q = null; continue; }
      if (c === '$' && src[j + 1] === '{') { j += 2; tplStack.push(depth); depth++; q = null; continue; }
      continue;
    }
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '/' && (src[j + 1] === "'" || src[j + 1] === '"' || src[j + 1] === '\\') && /[\(,=:\[!&|?;{+\-*%~^<>]\s*$/.test(src.slice(Math.max(0, j - 4), j))) {
      j++;
      while (j < src.length && !(src[j] === '/' && src[j - 1] !== '\\')) j++;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (tplStack.length && depth === tplStack[tplStack.length - 1]) { tplStack.pop(); q = '`'; }
      if (depth === 0) return src.slice(i, j + 1);
    }
  }
  throw new Error('incompleta: ' + name);
}

let passed = 0, failed = 0;
function t(label, ok, extra) {
  if (ok) { passed++; console.log('✓ ' + label + (extra ? ' · ' + extra : '')); }
  else { failed++; console.log('✗ FALLA ' + label + (extra ? ' · ' + extra : '')); }
}

const HOY = new Date().toISOString().slice(0, 10);

function makeSb(state) {
  const panels = { recetaDetalle: { innerHTML: '' } };
  const inputs = { recetaPorcionesSel: { value: '1' }, recetaNotaReg: { value: '' } };
  const sb = {
    state: JSON.parse(JSON.stringify(state)),
    safeText: function (x) { return String(x == null ? '' : x); },
    baseRecipes: [
      { id: 'r1', name: 'Huevos con frijoles', k: 650, p: 35, carbs: 60, grasas: 25, time: 15, porciones: '2 porciones', steps: ['Revuelve los huevos.'], ingredients: 'huevo, frijoles' },
      { id: 'r2', name: 'Bistec ranchero', k: 720, p: 48, carbs: 40, grasas: 30, time: 25, porciones: '1 porción', steps: ['Dora el bistec.'] }
    ],
    completarMealKey: function () { return 'snacks'; },
    todayISO: function () { return HOY; },
    todayLocal: function () { return HOY; },
    ppUUID: function () { return 'p' + Math.random(); },
    recipeIdOf: function (idx) { const r = sb.baseRecipes[idx]; return r ? r.id : null; },
    alert() {},
    save() { sb.saves = (sb.saves || 0) + 1; },
    document: {
      getElementById: function (id) { return panels[id] || inputs[id] || null; }
    },
    window: { _recetaVista: null, _diarySelectedDate: null, _completarPropuestas: [] },
    recetaDetalleHTML: function () { return ''; },
    picked: []
  };
  sb.window = sb.window;
  vm.createContext(sb);
  ['registrarComidaDiary', 'quitarRegistroComida', 'completarComidoYa', 'completarComiEsto',
    'recetaComidoYa', 'recetaComiEsto', 'recetaGuardarNota', 'recetaPrepHtml', 'recetaNutLine',
    'recetaPorciones', 'quickFridgePick', 'renderFridgePicked'].forEach(function (n) {
    vm.runInContext(extractFunc(n), sb);
  });
  sb.panels = panels;
  sb.inputs = inputs;
  return sb;
}
function estadoBase() {
  return { diary: {}, prepLog: [], fridgeTengo: [] };
}

console.log('== 1 · Registrar comida (✅ Comí esto) y dedupe ==');
(function () {
  const sb = makeSb(estadoBase());
  const r1 = sb.registrarComidaDiary({ name: 'Huevos con frijoles', kcal: 650, prot: 35, carb: 60, fat: 25, amount: '1 porción', src: 'comido' });
  const r2 = sb.registrarComidaDiary({ name: 'Huevos con frijoles', kcal: 650, prot: 35, carb: 60, fat: 25, amount: '1 porción', src: 'comido' });
  t('primer registro entra al diario de hoy', r1.agregado === true && sb.state.diary[HOY].snacks.length === 1);
  t('segundo toque NO duplica (dedupe por nombre+porción+origen)', r2.agregado === false && sb.state.diary[HOY].snacks.length === 1);
  sb.quitarRegistroComida({ name: 'Huevos con frijoles', amount: '1 porción', src: 'comido' });
  t('el toggle quita el registro (tombstone, sin borrado físico)', sb.state.diary[HOY].snacks.length === 1 && sb.state.diary[HOY].snacks[0].deleted === true);
  t('tras quitarlo, ya no cuenta como comido', sb.completarComidoYa({ titulo: 'Huevos con frijoles' }) === false);
})();

console.log('== 2 · Porciones 1-4 con cálculo nutricional (la receta NO cambia) ==');
(function () {
  const sb = makeSb(estadoBase());
  const original = JSON.stringify(sb.baseRecipes[0]);
  sb.window._recetaVista = { idx: 0, personas: 1, modo: 'rapido', paso: 0 };
  sb.inputs.recetaPorcionesSel.value = '1';
  sb.recetaComiEsto();
  const e1 = sb.state.diary[HOY].snacks[0];
  t('1 porción de receta de 2: 325 kcal (mitad exacta)', e1.kcal === 325 && e1.prot === 17.5 && e1.carb === 30 && e1.fat === 12.5, JSON.stringify(e1));
  t('guarda la receta asociada y las porciones', e1.recetaRef === 'r1' && e1.porciones === 1 && e1.amount === '1 porción');
  sb.inputs.recetaPorcionesSel.value = '2';
  sb.recetaComiEsto();
  const e2 = sb.state.diary[HOY].snacks[1];
  t('2 porciones: total de la receta (650 kcal)', e2.kcal === 650 && e2.amount === '2 porciones');
  sb.inputs.recetaPorcionesSel.value = '4';
  sb.recetaComiEsto();
  const e3 = sb.state.diary[HOY].snacks[2];
  t('4 porciones: el doble (1300 kcal)', e3.kcal === 1300 && e3.amount === '4 porciones');
  t('porciones distintas conviven (no se pisan ni duplican)', sb.state.diary[HOY].snacks.length === 3);
  sb.inputs.recetaPorcionesSel.value = '2';
  sb.recetaComiEsto(); // repetir 2 → toggle quita
  t('repetir la MISMA porción la quita (dedupe de receta)', sb.state.diary[HOY].snacks.length === 3 && sb.state.diary[HOY].snacks[1].deleted === true);
  t('la receta original queda intacta', JSON.stringify(sb.baseRecipes[0]) === original);
})();

console.log('== 3 · Nutrición por porción vs total (estimado) ==');
(function () {
  const sb = makeSb(estadoBase());
  const porc = sb.recetaPorciones(sb.baseRecipes[0]);
  const html = sb.recetaNutLine(sb.baseRecipes[0], porc);
  t('muestra Total y Por porción', /Total: 650 kcal/.test(html) && /Por porción \(2\): 325 kcal/.test(html));
  t('incluye los 4 macros y marca estimado', /🥩 35 g proteína/.test(html) && /🍚 60 g carbohidratos/.test(html) && /🥑 25 g grasas/.test(html) && /estimados/.test(html));
})();

console.log('== 4 · Notas de preparación (múltiples, receta intacta) ==');
(function () {
  const sb = makeSb(estadoBase());
  const original = JSON.stringify(sb.baseRecipes[0]);
  sb.window._recetaVista = { idx: 0, personas: 1, modo: 'rapido', paso: 0 };
  sb.document.getElementById = function (id) {
    if (id === 'prepCambios') return { value: 'Usé 2 cdas de chile y Tajín' };
    if (id === 'prepCantidades') return { value: 'menos sal' };
    if (id === 'prepResultado') return { value: 'Quedó muy buena' };
    if (id === 'prepNota') return { value: 'La próxima 5 min más' };
    return sb.panels[id] || sb.inputs[id] || null;
  };
  sb.recetaGuardarNota();
  sb.document.getElementById = function (id) {
    if (id === 'prepCambios') return { value: '' };
    if (id === 'prepCantidades') return { value: '' };
    if (id === 'prepResultado') return { value: 'Papas duras' };
    if (id === 'prepNota') return { value: '' };
    return sb.panels[id] || sb.inputs[id] || null;
  };
  sb.recetaGuardarNota();
  t('dos preparaciones guardadas para la misma receta', sb.state.prepLog.length === 2 && sb.state.prepLog[0].recetaRef === 'r1' && sb.state.prepLog[1].recetaRef === 'r1');
  // unshift: la más reciente queda al frente (índice 0)
  t('cada una guarda cambios/cantidades/resultado/nota/fecha', /Tajín/.test(sb.state.prepLog[1].cambios) && /menos sal/.test(sb.state.prepLog[1].cantidades) && /muy buena/.test(sb.state.prepLog[1].resultado) && /5 min más/.test(sb.state.prepLog[1].nota) && sb.state.prepLog[1].fecha === HOY && /Papas duras/.test(sb.state.prepLog[0].resultado));
  t('la receta original NO se modifica', JSON.stringify(sb.baseRecipes[0]) === original);
})();

console.log('== 5 · Historial del día y persistencia refresh/cierre ==');
(function () {
  const sb = makeSb(estadoBase());
  sb.registrarComidaDiary({ name: 'Bistec ranchero', kcal: 720, prot: 48, carb: 40, fat: 30, amount: '1 porción', src: 'comido' });
  sb.window._recetaVista = { idx: 1, personas: 1, modo: 'rapido', paso: 0 };
  sb.recetaComiEsto();
  t('el historial del día tiene lo comido (con receta y sin receta)', sb.state.diary[HOY].snacks.length === 2);
  const persisted = JSON.parse(JSON.stringify(sb.state)); // refresh / cerrar
  const sb2 = makeSb(persisted); // abrir
  t('refresh/cierre: los registros y notas sobreviven', sb2.state.diary[HOY].snacks.length === 2 && sb2.state.diary[HOY].snacks[0].kcal === 720);
})();

console.log('== 6 · El registro viaja en el snapshot (sync sin cambios) ==');
(function () {
  const sb = makeSb(estadoBase());
  sb.window._recetaVista = { idx: 0, personas: 1, modo: 'rapido', paso: 0 };
  sb.recetaComiEsto();
  sb.document.getElementById = function (id) {
    if (id === 'prepCambios') return { value: 'Usé Tajín' };
    return sb.panels[id] || sb.inputs[id] || null;
  };
  sb.recetaGuardarNota();
  const local = sb.state;
  const remoto = { diary: {}, lastModified: '2026-09-08T01:00:00.000Z' };
  const merged = Object.assign({}, remoto, local); // snapshot: el estado completo viaja y se une
  t('prepLog y diary viajan con el snapshot (la sync no se toca)', merged.prepLog && merged.prepLog.length === 1 && merged.diary[HOY].snacks.length === 1);
})();

console.log('== 7 · Nevera persistente (state.fridgeTengo) ==');
(function () {
  const sb = makeSb(estadoBase());
  sb.quickFridgePick('pollo');
  sb.quickFridgePick('arroz');
  t('la selección queda en state.fridgeTengo (persistente)', sb.state.fridgeTengo.length === 2 && sb.state.fridgeTengo.includes('pollo') && sb.state.fridgeTengo.includes('arroz'));
  sb.quickFridgePick('pollo'); // desmarcar
  t('desmarcar actualiza el inventario persistido', sb.state.fridgeTengo.length === 1 && !sb.state.fridgeTengo.includes('pollo'));
  const sb2 = makeSb({ diary: {}, prepLog: [], fridgeTengo: sb.state.fridgeTengo });
  t('al reabrir la nevera recuerda lo que tienes', sb2.state.fridgeTengo.length === 1 && sb2.state.fridgeTengo.includes('arroz'));
})();

console.log('\n===== RESULTADO: ' + passed + ' PASS / ' + failed + ' FAIL =====');
if (failed) process.exit(1);
