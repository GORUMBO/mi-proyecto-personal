// ============================================================
// PRUEBAS v1.191.0-Peso — sección ⚖️ Peso (rediseño) + navegación.
// Cubre: estado vacío, registrar/editar (upsert), borrado, deltas,
// duplicados históricos (contador sin tocar), tendencia 7d/30d/3m,
// persistencia y regresión de navegación: render() de sync NO debe
// regresar al usuario de Peso/Caminata a la primera subtab del grupo.
// Uso: node tests/peso.test.js
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

// Fecha fija: 2026-08-23T12:00:00Z (mismo dominio que todayISO).
const RealDate = Date;
function FixedDate() {
  if (!arguments.length) return new RealDate('2026-08-23T12:00:00Z');
  return new (Function.prototype.bind.apply(RealDate, [null].concat(Array.prototype.slice.call(arguments))))();
}
FixedDate.now = function () { return new RealDate('2026-08-23T12:00:00Z').getTime(); };
FixedDate.parse = RealDate.parse;
FixedDate.UTC = RealDate.UTC;
FixedDate.prototype = RealDate.prototype;

function makeSandbox(initialState) {
  const inputs = { wDate: { value: '' }, wVal: { value: '' } };
  const els = {
    wDate: inputs.wDate, wVal: inputs.wVal,
    pesoRoot: { innerHTML: '' },
    pesoChartOut: { innerHTML: '' },
    weightOut: { innerHTML: '' },
    wFormCard: { style: {}, scrollIntoView: function () {} }
  };
  const sb = {
    console,
    _u: 0,
    Date: FixedDate,
    todayISO: function () { return '2026-08-23'; },
    state: JSON.parse(JSON.stringify(initialState)),
    save: function () { sb.saves = (sb.saves || 0) + 1; },
    confirm: function () { return true; },
    alert: function () {},
    drawGrafica: function () {},
    ppUUID: function () { sb._u = (sb._u || 0) + 1; return 'id-' + sb._u; },
    normalizeWeightEntry: function (x) {
      if (!x.client_id) x.client_id = (x.id != null ? String(x.id) : 'id-' + (++sb._u));
      if (x.id == null) x.id = x.client_id;
      if (!x.updated_at) x.updated_at = (x.d ? x.d + 'T12:00:00.000Z' : '2026-08-23T12:00:00.000Z');
      return x;
    },
    esMetrico: function () { return !!(sb.state.region && sb.state.region.sistema === 'metrico'); },
    U: {
      pesoUnidad: function () { return sb.esMetrico() ? 'kg' : 'lb'; },
      peso: function (lb) { return sb.esMetrico() ? (+lb * 0.4536).toFixed(1) + ' kg' : (+lb).toFixed(1) + ' lb'; },
      aLb: function (v) { return sb.esMetrico() ? +v / 0.4536 : +v; }
    },
    safeText: function (s) { return String(s == null ? '' : s); },
    openTab: function () {},
    document: {
      getElementById: function (id) { return els[id] || null; },
      querySelector: function () { return null; },
      querySelectorAll: function () { return []; },
      createElement: function () { return { style: {}, className: '', textContent: '', remove: function () {}, parentNode: null }; }
    },
    setTimeout: function (fn) { try { fn(); } catch (e) {} }
  };
  sb.window = sb;
  sb.globalThis = sb;
  for (const fn of ['pesoHTML', 'renderPesoInterno', 'renderPesoChart', 'setPesoRango', 'setUnidadPeso', 'abrirFormPeso', 'addWeight', 'delWeight', 'renderWeight']) {
    sb[fn] = vm.runInNewContext('(' + extractFunc(fn) + ')', sb, { filename: fn });
  }
  return sb;
}
function heroInfo(sb) {
  sb.renderPesoInterno();
  const h = sb.document.getElementById('pesoRoot').innerHTML;
  return {
    chip: (h.match(/fit5-statuschip">([^<]+)/) || [])[1],
    big: (h.match(/font-size:30px;font-weight:950;line-height:1">([^<]+)/) || [])[1],
    cta: (h.match(/fit5-cta"[^>]*>([^<]+)/) || [])[1],
    stats: (h.match(/fit5-hero-stat"><b>([^<]*)<\/b>/g) || []).join(' | '),
    sinObj: /Sin objetivo configurado/.test(h),
    dupes: /(\d+) fecha\(s\) con registros duplicados/.exec(h) ? RegExp.$1 : '0'
  };
}

let passed = 0, failed = 0;
function t(name, cond, extra) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.log('  ✗ ' + name + (extra ? ' → ' + extra : '')); }
}

console.log('== 1 · Estado vacío ==');
(function () {
  const sb = makeSandbox({ profile: {}, weight: [] });
  const i = heroInfo(sb);
  t('statuschip "Sin registro hoy"', i.chip === 'Sin registro hoy');
  t('peso grande —', i.big === '—');
  t('CTA "Registrar peso"', i.cta === '✏️ Registrar peso');
  t('sin barra de progreso + "Sin objetivo configurado"', i.sinObj);
  t('resumen con — (sin datos)', sb.document.getElementById('pesoRoot').innerHTML.indexOf('promedio 7 días') >= 0 && (sb.document.getElementById('pesoRoot').innerHTML.match(/<b>—<\/b>/g) || []).length >= 4);
})();

console.log('== 2 · Registrar / editar hoy (UPSERT) / borrar ==');
(function () {
  const sb = makeSandbox({ profile: {}, weight: [] });
  sb.document.getElementById('wDate').value = '2026-08-23';
  sb.document.getElementById('wVal').value = '165';
  sb.addWeight();
  let i = heroInfo(sb);
  t('registrar: chip "Registrado hoy" y peso 165.0 lb', i.chip === 'Registrado hoy' && i.big === '165.0 lb');
  t('registrar: CTA "Editar peso de hoy"', i.cta === '✏️ Editar peso de hoy');
  t('registrar: save() llamado', sb.saves >= 1);
  sb.document.getElementById('wVal').value = '170';
  sb.addWeight();
  t('editar: UNA sola fila para hoy', sb.state.weight.filter(x => x.d === '2026-08-23').length === 1);
  t('editar: peso actualizado a 170', sb.state.weight.find(x => x.d === '2026-08-23').w === 170);
  i = heroInfo(sb);
  t('editar: hero muestra 170.0 lb', i.big === '170.0 lb');
  t('editar: historial sin duplicados de hoy', (sb.document.getElementById('weightOut').innerHTML.match(/2026-08-23 · HOY/g) || []).length === 1);
  // registro de ayer → deltas
  sb.document.getElementById('wDate').value = '2026-08-22';
  sb.document.getElementById('wVal').value = '160';
  sb.addWeight();
  i = heroInfo(sb);
  t('deltas: vs anterior/7 días/total +10.0', (i.stats.match(/<b>\+10\.0<\/b>/g) || []).length === 3);
  // borrar el de hoy
  const hoy = sb.state.weight.find(x => x.d === '2026-08-23');
  sb.delWeight(hoy.client_id || hoy.id);
  i = heroInfo(sb);
  t('borrar: chip vuelve a "Sin registro hoy"', i.chip === 'Sin registro hoy');
  t('borrar: CTA vuelve a "Registrar peso"', i.cta === '✏️ Registrar peso');
  t('borrar: peso actual = último histórico (160.0 lb)', i.big === '160.0 lb');
  t('borrar: resumen recalculado (promedio 160)', sb.document.getElementById('pesoRoot').innerHTML.indexOf('<b>160.0 lb</b><span>promedio 7 días</span>') >= 0);
})();

console.log('== 3 · Duplicados históricos: contador sin tocar ==');
(function () {
  const sb = makeSandbox({ profile: {}, weight: [
    { d: '2026-08-20', w: 158, client_id: 'p1', id: 'p1', updated_at: '2026-08-20T10:00:00Z' },
    { d: '2026-08-20', w: 159, client_id: 'p2', id: 'p2', updated_at: '2026-08-20T18:00:00Z' },
    { d: '2026-08-23', w: 165, client_id: 'p3', id: 'p3', updated_at: '2026-08-23T12:00:00Z' }
  ] });
  const i = heroInfo(sb);
  t('contador detecta 1 fecha duplicada', i.dupes === '1');
  t('lista muestra la fecha ×2', sb.document.getElementById('pesoRoot').innerHTML.indexOf('2026-08-20 × 2') >= 0);
  t('históricos intactos (3 filas)', sb.state.weight.length === 3);
  sb.document.getElementById('wDate').value = '2026-08-20';
  sb.document.getElementById('wVal').value = '160';
  sb.addWeight();
  t('upsert sobre fecha duplicada NO crea tercera fila', sb.state.weight.filter(x => x.d === '2026-08-20').length === 2);
})();

console.log('== 4 · Tendencia 7d/30d/3m ==');
(function () {
  const recs = [];
  for (let k = 0; k < 80; k += 5) {
    const d = new RealDate(Date.UTC(2026, 7, 23) - k * 86400000).toISOString().slice(0, 10);
    recs.push({ d: d, w: 160 + k / 10, client_id: 'c' + k, id: 'c' + k, updated_at: d + 'T12:00:00Z' });
  }
  const sb = makeSandbox({ profile: {}, weight: recs });
  sb.renderPesoInterno();
  const c7 = (sb.document.getElementById('pesoChartOut').innerHTML.match(/<circle/g) || []).length;
  sb.setPesoRango('30d');
  const c30 = (sb.document.getElementById('pesoChartOut').innerHTML.match(/<circle/g) || []).length;
  sb.setPesoRango('3m');
  const c3m = (sb.document.getElementById('pesoChartOut').innerHTML.match(/<circle/g) || []).length;
  t('7d menos puntos que 30d y 3m', c7 < c30 && c7 < c3m);
  t('3m más puntos que 30d', c3m > c30);
  t('promedio móvil presente (línea punteada)', sb.document.getElementById('pesoChartOut').innerHTML.indexOf('stroke-dasharray') >= 0);
  t('sin registros: aviso y sin gráfica', (function () {
    const sb2 = makeSandbox({ profile: {}, weight: [] });
    sb2.renderPesoInterno();
    return sb2.document.getElementById('pesoChartOut').innerHTML.indexOf('Sin registros en este periodo.') >= 0 && sb2.document.getElementById('pesoChartOut').innerHTML.indexOf('<circle') < 0;
  })());
})();

console.log('== 5 · Persistencia tras recarga ==');
(function () {
  const sb = makeSandbox({ profile: {}, weight: [] });
  sb.document.getElementById('wDate').value = '2026-08-23';
  sb.document.getElementById('wVal').value = '168.5';
  sb.addWeight();
  const copia = JSON.parse(JSON.stringify(sb.state));
  const sb2 = makeSandbox(copia);
  const i = heroInfo(sb2);
  t('tras recarga el registro permanece (168.5 lb)', i.big === '168.5 lb');
  t('tras recarga CTA "Editar peso de hoy"', i.cta === '✏️ Editar peso de hoy');
})();

console.log('== 7 · Unidades lb/kg ==');
(function () {
  const sb = makeSandbox({ profile: {}, region: { id: 'maui', sistema: 'imperial' }, weight: [{ d: '2026-08-23', w: 128, client_id: 'u1', id: 'u1', updated_at: '2026-08-23T12:00:00Z' }] });
  let i = heroInfo(sb);
  t('imperial: 128.0 lb', i.big === '128.0 lb');
  sb.setUnidadPeso('kg');
  i = heroInfo(sb);
  t('kg: 58.1 kg (128×0.4536)', i.big === '58.1 kg');
  t('cambiar unidad NO altera registros (1 fila, 128 lb interno)', sb.state.weight.length === 1 && sb.state.weight[0].w === 128);
  t('historial en kg (sin mezcla con lb)', sb.document.getElementById('weightOut').innerHTML.indexOf('58.1 kg') >= 0 && sb.document.getElementById('weightOut').innerHTML.indexOf(' lb') < 0);
  t('resumen en kg (promedio 58.1 kg)', sb.document.getElementById('pesoRoot').innerHTML.indexOf('<b>58.1 kg</b><span>promedio 7 días</span>') >= 0);
  sb.document.getElementById('wDate').value = '2026-08-22';
  sb.document.getElementById('wVal').value = '58.1';
  sb.addWeight();
  t('registrar en kg guarda equivalente interno (58.1 kg → 128.1 lb)', sb.state.weight.find(x => x.d === '2026-08-22').w === 128.1);
  sb.document.getElementById('wVal').value = '60';
  sb.addWeight();
  t('editar en kg actualiza el interno (60 kg → 132.3 lb)', sb.state.weight.find(x => x.d === '2026-08-22').w === 132.3);
  t('editar en kg no crea fila extra', sb.state.weight.filter(x => x.d === '2026-08-22').length === 1);
  sb.setUnidadPeso('lb');
  i = heroInfo(sb);
  t('volver a lb: hoy se muestra 128.0 lb de nuevo', i.big === '128.0 lb');
  const copia = JSON.parse(JSON.stringify(sb.state));
  const sb2 = makeSandbox(copia);
  i = heroInfo(sb2);
  t('recarga conserva la preferencia (imperial)', i.big === '128.0 lb' && sb2.esMetrico() === false);
})();

console.log('== 6 · Navegación: render() de sync NO regresa a la primera subtab ==');
(function () {
  // Harness del render() REAL: initNav simula el reseteo real (showGroup→showTab
  // de la primera pestaña del grupo, '💪 Ejercicio') como hace showGroup hoy.
  const calls = [];
  const sb = {
    console,
    tabs: ['💪 Ejercicio', '🚶 Caminata', '⚖️ Peso'],
    _activeTab: 2, // usuario parado en Peso
    lastShow: null,
    showTab: function (i, b) { sb._activeTab = i; sb.lastShow = i; },
    buildTabIfNeeded: function (i) { calls.push(i); return false; },
    initNav: function () { sb.showTab(0, null); }, // comportamiento real de showGroup
    bindAll: function () {},
    quickFitnessToday: function () {},
    $: function (sel) { return { innerHTML: '' }; },
    window: { scrollY: 0, innerWidth: 1200, _renderPreservando: false, scrollTo: function () {} },
    document: {
      activeElement: null,
      elementFromPoint: function () { return null; },
      getElementById: function () { return null; },
      querySelector: function () { return null; },
      documentElement: { scrollTop: 0 },
      body: { scrollTop: 0 }
    }
  };
  sb.globalThis = sb;
  const renderFn = vm.runInNewContext('(' + extractFunc('render') + ')', sb, { filename: 'render' });
  renderFn();
  t('tras render() de sync, _activeTab sigue en Peso (2)', sb._activeTab === 2);
  t('la última showTab fue Peso, no Ejercicio', sb.lastShow === 2);
  t('buildTabIfNeeded reconstruyó Peso tras el reseteo', calls.indexOf(2) >= 0);
})();

console.log('==========================================');
console.log('Resultado: ' + passed + ' pasaron · ' + failed + ' fallaron');
console.log('==========================================');
process.exit(failed ? 1 : 0);
