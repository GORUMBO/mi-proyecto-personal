// ============================================================
// PRUEBAS v1.190.0-Caminata — sección Caminata diaria (rediseño).
// Cubre: estado vacío, registro de hoy, upsert por fecha, borrado,
// resumen de 7 días, racha y persistencia tras recarga.
// Uso: node tests/caminata.test.js
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
    // Regex literal con comillas: saltarlo para no desbalancear q.
    if (c === '/' && (HTML[j + 1] === "'" || HTML[j + 1] === '"' || HTML[j + 1] === '\\') && /[\(,=:\[!&|?;{+\-*%~^<>]\s*$/.test(HTML.slice(Math.max(0, j - 4), j))) {
      j++;
      while (j < HTML.length && !(HTML[j] === '/' && HTML[j - 1] !== '\\')) j++;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (tplStack.length && depth === tplStack[tplStack.length - 1]) { tplStack.pop(); q = '`'; }
      if (depth === 0) return HTML.slice(i, j + 1);
    }
  }
  throw new Error('incompleta: ' + name);
}

// Fecha fija y determinista: 2026-08-22T12:00:00Z (mismo dominio que todayISO).
const RealDate = Date;
function FixedDate() {
  if (!arguments.length) return new RealDate('2026-08-22T12:00:00Z');
  return new (Function.prototype.bind.apply(RealDate, [null].concat(Array.prototype.slice.call(arguments))))();
}
FixedDate.now = function () { return new RealDate('2026-08-22T12:00:00Z').getTime(); };
FixedDate.parse = RealDate.parse;
FixedDate.UTC = RealDate.UTC;
FixedDate.prototype = RealDate.prototype;

function makeSandbox(initialState) {
  const inputs = { walkDate: { value: '' }, steps: { value: '' }, mins: { value: '' } };
  const els = {
    walkDate: inputs.walkDate, steps: inputs.steps, mins: inputs.mins,
    walkOut: { innerHTML: '' },
    walkFormCard: { style: {}, scrollIntoView: function () {} }
  };
  const sandbox = {
    console,
    Date: FixedDate,
    todayISO: function () { return '2026-08-22'; },
    state: JSON.parse(JSON.stringify(initialState)),
    save: function () { sandbox.saves = (sandbox.saves || 0) + 1; },
    confirm: function () { return true; },
    alert: function () {},
    drawGrafica: function () {},
    ppUUID: function () { sandbox._u = (sandbox._u || 0) + 1; return 'id-' + sandbox._u; },
    $: function (sel) { return els[String(sel).slice(1)] || null; },
    document: {
      getElementById: function (id) { return els[id] || null; },
      querySelector: function () { return null; },
      querySelectorAll: function () { return []; },
      createElement: function () { return { style: {} }; }
    },
    setTimeout: function (fn) { try { fn(); } catch (e) {} }
  };
  sandbox.globalThis = sandbox;
  for (const fn of ['secCaminata', 'addWalk', 'renderWalks', 'delWalk']) {
    sandbox[fn] = vm.runInNewContext('(' + extractFunc(fn) + ')', sandbox, { filename: fn });
  }
  return sandbox;
}

let passed = 0, failed = 0;
function t(name, cond, extra) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.log('  ✗ ' + name + (extra ? ' → ' + extra : '')); }
}
function bigSteps(h) { var m = /font-size:30px;font-weight:950;line-height:1">([^<]+)/.exec(h); return m ? m[1] : null; }
function statB(h, label) { var m = new RegExp('fitw-stat"><b>([^<]+)<\\/b><span>' + label).exec(h); return m ? m[1] : null; }

console.log('== 1 · Estado vacío ==');
(function () {
  const sb = makeSandbox({ profile: { pasosDia: 22000 }, walks: [] });
  const h = sb.secCaminata();
  t('chip dice "Sin registro hoy"', h.indexOf('Sin registro hoy') >= 0);
  t('pasos grandes = 0', bigSteps(h) === '0');
  t('0 de 22,000 pasos objetivo · 0%', h.indexOf('0 de 22,000 pasos objetivo · 0%') >= 0);
  t('CTA "Registrar caminata"', h.indexOf('✏️ Registrar caminata') >= 0 && h.indexOf('Editar caminata de hoy') < 0);
  t('barra de progreso 0%', /fit5-hero-fill" style="width:0%/.test(h));
  t('no inventa mi/km/min/kcal: 4 guiones', (h.match(/fit5-hero-stat"><b>—<\/b>/g) || []).length === 4);
  t('stats semanales con — (sin datos)', statB(h, 'promedio 7 días') === '—' && statB(h, 'récord personal') === '—' && statB(h, 'total semana') === '—');
})();

console.log('== 2 · Registro de hoy ==');
(function () {
  const sb = makeSandbox({ profile: { pasosDia: 22000 }, walks: [{ d: '2026-08-22', steps: 14500, mi: 6.9, cal: 653, mins: 85, id: 'a' }] });
  const h = sb.secCaminata();
  t('chip dice "Registrada hoy"', h.indexOf('Registrada hoy') >= 0);
  t('pasos grandes reales 14,500', bigSteps(h) === (14500).toLocaleString());
  t('progreso 66% contra objetivo', h.indexOf((14500).toLocaleString() + ' de 22,000 pasos objetivo · 66%') >= 0);
  t('CTA cambia a "Editar caminata de hoy"', h.indexOf('✏️ Editar caminata de hoy') >= 0);
  t('millas 6.9', /fit5-hero-stat"><b>6\.9<\/b>millas/.test(h));
  t('km 11.1 (mi×1.60934)', /fit5-hero-stat"><b>11\.1<\/b>distancia km/.test(h));
  t('tiempo 85 min', /fit5-hero-stat"><b>85 min<\/b>tiempo/.test(h));
  t('kcal 653', /fit5-hero-stat"><b>653<\/b>kcal aprox\./.test(h));
})();

console.log('== 3 · Upsert por fecha ==');
(function () {
  const sb = makeSandbox({ profile: { pasosDia: 22000 }, walks: [{ d: '2026-08-22', steps: 14500, mi: 6.9, cal: 653, mins: 85, id: 'a' }] });
  sb.document.getElementById('steps').value = '12000';
  sb.document.getElementById('walkDate').value = '2026-08-22';
  sb.document.getElementById('mins').value = '60';
  sb.addWalk();
  const hoy = sb.state.walks.filter(function (x) { return x.d === '2026-08-22'; });
  t('editar hoy deja UNA sola fila', hoy.length === 1);
  t('pasos actualizados a 12000', hoy[0].steps === 12000);
  t('mins actualizados a 60', hoy[0].mins === 60);
  t('mi recalculada con la fórmula existente', Math.abs(hoy[0].mi - 12000 * 2.5 / 5280) < 1e-9);
  t('kcal recalculada (12000×0.045 = 540)', Math.abs(hoy[0].cal - 12000 * 0.045) < 1e-9);
  sb.renderWalks();
  t('historial sin duplicados de la fecha', (sb.$('#walkOut').innerHTML.match(/2026-08-22 · HOY/g) || []).length === 1);
  sb.document.getElementById('walkDate').value = '2026-08-21';
  sb.document.getElementById('steps').value = '8000';
  sb.addWalk();
  t('día nuevo crea su fila (total 2)', sb.state.walks.length === 2);
  sb.addWalk(); // re-guardar el 21
  t('re-guardar otro día no duplica (sigue 2)', sb.state.walks.length === 2);
})();

console.log('== 4 · Borrado ==');
(function () {
  const sb = makeSandbox({ profile: { pasosDia: 22000 }, walks: [
    { d: '2026-08-21', steps: 10000, mi: 4.7, cal: 450, id: 'x' },
    { d: '2026-08-22', steps: 14500, mi: 6.9, cal: 653, mins: 85, id: 'y' }
  ] });
  sb.delWalk('y');
  t('registro de hoy eliminado del estado', !sb.state.walks.some(function (x) { return x.d === '2026-08-22'; }));
  sb.renderWalks();
  t('desaparece del historial', sb.$('#walkOut').innerHTML.indexOf('2026-08-22') < 0);
  const h = sb.secCaminata();
  t('hero vuelve al estado vacío', h.indexOf('Sin registro hoy') >= 0 && h.indexOf('0 de 22,000') >= 0 && h.indexOf('✏️ Registrar caminata') >= 0);
  t('récord se recalcula a 10,000', statB(h, 'récord personal') === (10000).toLocaleString());
  t('total semanal se recalcula a 10,000', statB(h, 'total semana') === (10000).toLocaleString());
  t('promedio se recalcula a 10,000', statB(h, 'promedio 7 días') === (10000).toLocaleString());
  t('mini-gráfica: el día borrado muestra —', /fitw-bar hoy"><b>—/.test(h));
})();

console.log('== 5 · Resumen de 7 días y racha ==');
(function () {
  const sb = makeSandbox({ profile: { pasosDia: 22000 }, walks: [
    { d: '2026-08-17', steps: 9000, mi: 0, cal: 0, id: '1' },
    { d: '2026-08-18', steps: 12000, mi: 0, cal: 0, id: '2' },
    { d: '2026-08-20', steps: 15000, mi: 0, cal: 0, id: '3' },
    { d: '2026-08-21', steps: 18000, mi: 0, cal: 0, id: '4' },
    { d: '2026-08-22', steps: 24000, mi: 0, cal: 0, id: '5' }
  ] });
  const h = sb.secCaminata();
  t('promedio correcto (5 días con registro): 15,600', statB(h, 'promedio 7 días') === (15600).toLocaleString());
  t('récord correcto: 24,000', statB(h, 'récord personal') === (24000).toLocaleString());
  t('total semanal correcto: 78,000', statB(h, 'total semana') === (78000).toLocaleString());
  var barVals = (h.match(/fitw-bar[^"]*"><b>([^<]*)/g) || []).map(function (s) { return /"><b>([^<]*)$/.exec(s)[1]; });
  t('días sin registro (16 y 19) muestran —, el resto valores reales',
    barVals[0] === '—' && barVals[3] === '—'
    && barVals[1] === (9000).toLocaleString() && barVals[2] === (12000).toLocaleString()
    && barVals[4] === (15000).toLocaleString() && barVals[5] === (18000).toLocaleString()
    && barVals[6] === (24000).toLocaleString());
  t('racha fiable: 3 días consecutivos (20-22) se muestra', /racha: 3 días/.test(h));
  const sb1 = makeSandbox({ profile: { pasosDia: 22000 }, walks: [{ d: '2026-08-22', steps: 5000, mi: 0, cal: 0, id: 'z' }] });
  t('racha de 1 solo día NO se muestra', !/racha:/.test(sb1.secCaminata()));
})();

console.log('== 6 · Persistencia ==');
(function () {
  const sb = makeSandbox({ profile: { pasosDia: 22000 }, walks: [] });
  sb.document.getElementById('steps').value = '11111';
  sb.document.getElementById('walkDate').value = '2026-08-22';
  sb.document.getElementById('mins').value = '50';
  sb.addWalk();
  t('save() fue llamado', (sb.saves || 0) >= 1);
  const copia = JSON.parse(JSON.stringify(sb.state));
  const sb2 = makeSandbox(copia); // simula recarga: estado serializado vuelve a renderizarse
  const h2 = sb2.secCaminata();
  t('tras recarga: pasos 11,111 presentes', h2.indexOf((11111).toLocaleString() + ' de 22,000 pasos objetivo') >= 0);
  t('tras recarga: 50 min conservados', /fit5-hero-stat"><b>50 min<\/b>tiempo/.test(h2));
  t('tras recarga: millas 5.3 (fórmula)', /fit5-hero-stat"><b>5\.3<\/b>millas/.test(h2));
  t('tras recarga: kcal 500 (fórmula)', /fit5-hero-stat"><b>500<\/b>kcal aprox\./.test(h2));
  t('tras recarga: CTA Editar', h2.indexOf('✏️ Editar caminata de hoy') >= 0);
})();

console.log('==========================================');
console.log('Resultado: ' + passed + ' pasaron · ' + failed + ' fallaron');
console.log('==========================================');
process.exit(failed ? 1 : 0);
