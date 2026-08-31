// ============================================================
// PRUEBAS v1.191.0-Balance — ⚖️ Balance de hoy en Comer (Fase 2).
// Cubre: modo fijo, ajustar 50/75/100%, sin caminata, caminata hoy,
// exceso, cambiar preferencia, persistencia y no-doble-conteo con fitAdj.
// Uso: node tests/balance.test.js
// ============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extractFunc(name) {
  const i = HTML.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('No se encontró function ' + name);
  let depth = 0, j = i, q = null, tplStack = [];
  for (; j < HTML.length; j++) {
    const c = HTML[j];
    if (q === '`') {
      if (c === '\\') { j++; continue; }
      if (c === '`') { q = null; continue; }
      if (c === '$' && HTML[j + 1] === '{') { j += 2; tplStack.push(depth); depth++; q = null; continue; }
      continue;
    }
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (tplStack.length && depth === tplStack[tplStack.length - 1]) { tplStack.pop(); q = '`'; }
      if (depth === 0) return HTML.slice(i, j + 1);
    }
  }
  throw new Error('incompleta: ' + name);
}

function makeSandbox(initialState) {
  const sb = {
    console,
    todayISO: function () { return '2026-08-23'; },
    state: JSON.parse(JSON.stringify(initialState)),
    getTodayDiaryTotals: function () {
      const d = sb.state.diary && sb.state.diary['2026-08-23'];
      const items = d ? [].concat(d.breakfast || [], d.lunch || [], d.dinner || [], d.snacks || []) : [];
      return items.reduce((a, x) => { a.k += +x.kcal || 0; return a; }, { k: 0 });
    }
  };
  sb.globalThis = sb;
  for (const fn of ['balanceHoy', 'balanceHoyHTML']) {
    sb[fn] = vm.runInNewContext('(' + extractFunc(fn) + ')', sb, { filename: fn });
  }
  return sb;
}

let passed = 0, failed = 0;
function t(name, cond, extra) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.log('  ✗ ' + name + (extra ? ' → ' + extra : '')); }
}

const BASE = { profile: { calorias: 3400 }, walks: [], diary: { '2026-08-23': { breakfast: [{ kcal: 2000 }] } } };
const CAMINATA_HOY = [{ d: '2026-08-23', cal: 540 }, { d: '2026-08-22', cal: 1000 }]; // ayer NO debe contar

console.log('== 1 · Modo fijo ==');
(function () {
  const sb = makeSandbox({ profile: { calorias: 3400, modoActividad: 'fijo' }, walks: CAMINATA_HOY.slice(), diary: BASE.diary });
  const b = sb.balanceHoy();
  t('extra = 0 en modo fijo', b.extra === 0);
  t('ajustado = base (3400)', b.ajustado === 3400);
  t('restantes = 3400 − 2000 = 1400', b.restantes === 1400);
  t('HTML dice "Objetivo fijo"', sb.balanceHoyHTML().indexOf('Objetivo fijo') >= 0);
})();

console.log('== 2 · Ajustar por actividad 50/75/100% ==');
(function () {
  const pct50 = makeSandbox({ profile: { calorias: 3400, modoActividad: 'ajustar', pctActividad: 50 }, walks: CAMINATA_HOY.slice(), diary: BASE.diary }).balanceHoy();
  t('50%: extra = 270', pct50.extra === 270);
  const pct75 = makeSandbox({ profile: { calorias: 3400, modoActividad: 'ajustar', pctActividad: 75 }, walks: CAMINATA_HOY.slice(), diary: BASE.diary }).balanceHoy();
  t('75%: extra = 405 (ejemplo del plan)', pct75.extra === 405);
  t('75%: ajustado = 3805', pct75.ajustado === 3805);
  t('75%: restantes = 3805 − 2000 = 1805', pct75.restantes === 1805);
  const pct100 = makeSandbox({ profile: { calorias: 3400, modoActividad: 'ajustar', pctActividad: 100 }, walks: CAMINATA_HOY.slice(), diary: BASE.diary }).balanceHoy();
  t('100%: extra = 540', pct100.extra === 540);
})();

console.log('== 3 · Sin caminata / solo caminata de hoy ==');
(function () {
  const sin = makeSandbox({ profile: { calorias: 3400, modoActividad: 'ajustar', pctActividad: 75 }, walks: [], diary: BASE.diary }).balanceHoy();
  t('sin caminata: actividad = 0 y extra = 0', sin.actividad === 0 && sin.extra === 0);
  const hoy = makeSandbox({ profile: { calorias: 3400, modoActividad: 'ajustar', pctActividad: 75 }, walks: CAMINATA_HOY.slice(), diary: BASE.diary }).balanceHoy();
  t('solo cuenta HOY: actividad = 540 (ayer no cuenta)', hoy.actividad === 540);
})();

console.log('== 4 · Exceso ==');
(function () {
  const sb = makeSandbox({ profile: { calorias: 3400, modoActividad: 'ajustar', pctActividad: 75 }, walks: CAMINATA_HOY.slice(), diary: { '2026-08-23': { lunch: [{ kcal: 4000 }] } } });
  const b = sb.balanceHoy();
  t('restantes negativo (−195)', b.restantes === 3805 - 4000);
  t('HTML muestra "exceso"', sb.balanceHoyHTML().indexOf('<span>exceso</span>') >= 0);
})();

console.log('== 5 · Cambiar preferencia ==');
(function () {
  const sb = makeSandbox({ profile: { calorias: 3400, modoActividad: 'fijo' }, walks: CAMINATA_HOY.slice(), diary: BASE.diary });
  t('empieza fijo: extra 0', sb.balanceHoy().extra === 0);
  sb.state.profile.modoActividad = 'ajustar';
  sb.state.profile.pctActividad = 50;
  t('al cambiar a ajustar 50%: extra 270', sb.balanceHoy().extra === 270);
  sb.state.profile.pctActividad = 100;
  t('al cambiar a 100%: extra 540', sb.balanceHoy().extra === 540);
})();

console.log('== 6 · Recarga / persistencia ==');
(function () {
  const sb = makeSandbox({ profile: { calorias: 3400, modoActividad: 'ajustar', pctActividad: 100 }, walks: CAMINATA_HOY.slice(), diary: BASE.diary });
  const antes = sb.balanceHoy();
  const copia = JSON.parse(JSON.stringify(sb.state));
  const sb2 = makeSandbox(copia);
  const despues = sb2.balanceHoy();
  t('tras recarga: modo/pct conservados y balance idéntico', despues.extra === antes.extra && despues.ajustado === antes.ajustado && despues.pct === 100 && despues.modo === 'ajustar');
})();

console.log('== 7 · No doble conteo con fitAdj (getDailyMode) ==');
(function () {
  // getDailyMode() podría dar 3400×1.10=3740 con día fuerte; el balance usa SIEMPRE profile.calorias.
  const sb = makeSandbox({ profile: { calorias: 3400, modoActividad: 'ajustar', pctActividad: 75 }, walks: CAMINATA_HOY.slice(), diary: BASE.diary });
  const b = sb.balanceHoy();
  t('base = profile.calorias fijo (3400), sin fitAdj', b.base === 3400);
  t('ajustado = 3400 + 405 (nada del +10% de fitness)', b.ajustado === 3805);
})();

console.log('==========================================');
console.log('Resultado: ' + passed + ' pasaron · ' + failed + ' fallaron');
console.log('==========================================');
process.exit(failed ? 1 : 0);
