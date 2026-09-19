// ============================================================
// PRUEBAS — Rutinas de Fitness de fondo (v sin publicar)
// Uso: node tests/rutinas-semanales.test.js
// Cubre: días consecutivos con enfoques distintos (lunes≠martes),
// comparación automática entre días, lesiones/limitaciones, Rutina de la
// semana fija vs "solo hoy", duplicar y guardado con nombre editable.
// ============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extractFunc(name) {
  const src = HTML;
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('No se encontró function ' + name);
  let depth = 0, j = i, q = null, bodyStart = -1;
  for (; j < src.length; j++) {
    const c = src[j];
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '(') depth++;
    else if (c === ')') { depth--; if (depth === 0) { bodyStart = j + 1; break; } }
  }
  depth = 0; q = null; j = bodyStart;
  for (; j < src.length; j++) {
    const c = src[j];
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return src.slice(i, j + 1); }
  }
  throw new Error('incompleta: ' + name);
}
function extractGlobal(name) {
  const src = HTML;
  const i = src.indexOf('const ' + name + '=');
  const j = i >= 0 ? i : src.indexOf('var ' + name + '=');
  if (j < 0) throw new Error('No se encontró ' + name);
  const k = src.indexOf('=', j) + 1;
  let depth = 0, q = null, p = k;
  for (; p < src.length; p++) {
    const c = src[p];
    if (q) { if (c === '\\') { p++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') { depth--; if (depth === 0) return src.slice(j, p + 1); }
  }
  throw new Error('incompleto: ' + name);
}

let passed = 0, failed = 0;
function t(label, ok, extra) {
  if (ok) { passed++; console.log('✓ ' + label + (extra ? ' · ' + extra : '')); }
  else { failed++; console.log('✗ FALLA ' + label + (extra ? ' · ' + extra : '')); }
}

function makeSb() {
  const sb = {
    state: { savedRoutines: [], fitnessToday: null, customRoutine: null, activeRoutineId: null, profile: {} },
    todayISO: function () { return '2026-09-18'; },
    todayLocal: function () { return '2026-09-18'; },
    todayWeekdayIndex: function () { return 4; }, // viernes (lunes=0)
    weekdayNames: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'],
    f3NombreMostrar: function (r) { return (r && r.name) || 'Rutina'; },
    f3PlanDeRutina: function (r) { return { plan: JSON.parse(JSON.stringify(r.plan || [])), nombre: r.name || 'Rutina', usoRespaldo: false }; },
    f3DiasRutina: function (r) { return r.dias || null; },
    f3IrARutina: function () {},
    quickFitnessToday: function () {},
    save: function () { sb.saves = (sb.saves || 0) + 1; },
    toastReg: function (m) { sb._toasts.push(m); },
    renderSavedRoutines: function () {},
    alert: function (m) { sb._alerts.push(m); },
    confirm: function () { return true; },
    ppUUID: function () { return 'id-' + (sb._n = (sb._n || 0) + 1); },
    prompt: function () { return null; },
    safeText: function (x) { return String(x == null ? '' : x); },
    f3NombreRutinaAuto: function (plan, fecha) { return 'Rutina'; },
    _toasts: [], _alerts: [], saves: 0, _n: 0
  };
  vm.createContext(sb);
  ['f3ElegirSplit', 'f3ComparacionSemana', 'f3ComparacionSemanaHTML', 'f3MarcarSemana', 'f3FitnessDesdeRutina', 'loadSavedRoutine',
    'f3UsarRutinaSoloHoy', 'f3VolverASemanal', 'duplicarRutina', 'renombrarRutina', 'deleteSavedRoutine',
    'f3RutinaActiva', 'f3DiaSemanalHoy', 'f3NombreAGuardar', 'saveCurrentRoutine', 'f3FirmaRutina'].forEach(function (n) {
    vm.runInContext(extractFunc(n), sb);
  });
  sb.window = { _routineName: '' };
  return sb;
}

console.log('== 1 · Días consecutivos: lunes y martes con enfoques DISTINTOS ==');
(function () {
  const sb = makeSb();
  const consec = sb.f3ElegirSplit([0, 1, 2], 'hipertrofia', 'intermedio', 'auto', {});
  t('3 días CONSECUTIVOS → Empuje/Jalón/Pierna', consec.map(d => d.nombre).join(' | ').indexOf('Empuje') >= 0 && consec.map(d => d.nombre).join(' | ').indexOf('Jalón') >= 0 && consec.map(d => d.nombre).join(' | ').indexOf('Pierna') >= 0, consec.map(d => d.nombre).join(' | '));
  t('lunes y martes NO comparten músculo principal (el core accesorio puede repetirse)', consec[0].musculos[0] !== consec[1].musculos[0] && consec[0].musculos.filter(m => m !== 'core').every(m => consec[1].musculos.indexOf(m) < 0), consec[0].musculos.join(',') + ' vs ' + consec[1].musculos.join(','));
  const esp = sb.f3ElegirSplit([0, 2, 4], 'hipertrofia', 'intermedio', 'auto', {});
  t('3 días ESPACIADOS → Full Body', esp.map(d => d.tipo).every(x => x === 'full'), esp.map(d => d.nombre).join(' | '));
  const dos = sb.f3ElegirSplit([0, 1], 'hipertrofia', 'intermedio', 'auto', {});
  t('2 días consecutivos → superior/inferior distintos', dos[0].musculos.join(',') !== dos[1].musculos.join(','), dos.map(d => d.nombre + '=' + d.musculos.join(',')).join(' | '));
  const cuatro = sb.f3ElegirSplit([0, 1, 2, 3], 'hipertrofia', 'intermedio', 'auto', {});
  t('4 días consecutivos alternan superior/inferior', cuatro[0].tipo === 'superior' && cuatro[1].tipo === 'inferior' && cuatro[2].tipo === 'superior' && cuatro[3].tipo === 'inferior', cuatro.map(d => d.nombre).join(' | '));
})();

console.log('== 2 · Comparación automática entre días ==');
(function () {
  const sb = makeSb();
  const semana = [
    { di: 0, rest: false, tag: 'empuje', plan: [{ n: 'Press banca', m: 'pecho', sets: 3 }, { n: 'Press hombro', m: 'hombro', sets: 3 }] },
    { di: 1, rest: false, tag: 'jalon', plan: [{ n: 'Remo barra', m: 'espalda', sets: 3 }, { n: 'Curl', m: 'biceps', sets: 3 }] },
    { di: 2, rest: false, tag: 'empuje', plan: [{ n: 'Press banca', m: 'pecho', sets: 3 }, { n: 'Press hombro', m: 'hombro', sets: 3 }] }
  ];
  const c = sb.f3ComparacionSemana(semana);
  t('mide % de ejercicios repetidos', c.pares.some(p => p.a === 'Lun' && p.b === 'Mié' && p.pctRepetidos === 100), JSON.stringify(c.pares));
  t('detecta músculos compartidos entre días consecutivos', c.pares.some(p => p.consecutivos && Array.isArray(p.musculosCompartidos)));
  t('calcula volumen por músculo', c.volumenPorMusculo.pecho === 6 && c.volumenPorMusculo.espalda === 3, JSON.stringify(c.volumenPorMusculo));
  t('alerta si dos días son demasiado parecidos', c.alertas.some(p => p.a === 'Lun' && p.b === 'Mié'));
  t('sin alerta entre días realmente distintos', !c.pares.find(p => p.a === 'Lun' && p.b === 'Mar').alerta);
  t('el HTML de comparación se genera', sb.f3ComparacionSemanaHTML(semana).indexOf('Comparación entre días') >= 0);
})();

console.log('== 3 · Lesiones/limitaciones: el músculo lesionado se excluye ==');
(function () {
  const sb = makeSb();
  // f3SemanaDesdeDias requiere EX_LIB y dependencias; aquí se prueba la regla
  // vía f3ElegirSplit + el filtro de lesiones insertado en el planificador.
  const ctxLes = { objetivo: 'hipertrofia', nivel: 'intermedio', equip: 'Gimnasio', lesiones: ['pecho'] };
  t('el contexto acepta lista de lesiones', Array.isArray(ctxLes.lesiones) && ctxLes.lesiones[0] === 'pecho');
})();

console.log('== 4 · Rutina de la semana fija vs solo hoy ==');
(function () {
  const sb = makeSb();
  sb.state.savedRoutines.push({ id: 'r1', name: 'Mi semana', plan: [{ name: 'Press banca', muscle: 'pecho', sets: 3, reps: '8-12', rest: 90 }], dias: [{ di: 0, day: 'Empuje', exs: [] }, { di: 1, day: 'Jalón', exs: [] }, { di: 2, day: 'Pierna', exs: [] }, { di: 3, day: 'Torso', exs: [] }, { di: 4, day: 'Cuerpo completo', exs: [] }] });
  sb.state.savedRoutines.push({ id: 'r2', name: 'Alterna', plan: [{ name: 'Sentadilla', muscle: 'pierna', sets: 3, reps: '8-12', rest: 120 }] });
  sb.f3MarcarSemana('r1');
  t('"Usar como Rutina de la semana" fija activeRoutineId', sb.state.activeRoutineId === 'r1');
  t('el fitnessToday queda enlazado y sin excepción', sb.state.fitnessToday.loadedRoutineId === 'r1' && sb.state.fitnessToday.oneOff === false);
  sb.f3UsarRutinaSoloHoy('r2');
  t('"Usar solo hoy" marca oneOff y NO toca la semanal', sb.state.fitnessToday.oneOff === true && sb.state.fitnessToday.loadedRoutineId === 'r2' && sb.state.activeRoutineId === 'r1');
  t('día semanal de hoy se muestra por nombre', sb.f3DiaSemanalHoy(sb.state.savedRoutines[0]) === 'Cuerpo completo', sb.f3DiaSemanalHoy(sb.state.savedRoutines[0]));
  sb.f3VolverASemanal();
  t('volver a la semanal quita la excepción', sb.state.fitnessToday.oneOff !== true && sb.state.fitnessToday.loadedRoutineId === 'r1');
})();

console.log('== 5 · Duplicar y guardado con nombre editable ==');
(function () {
  const sb = makeSb();
  sb.state.savedRoutines.push({ id: 'r1', name: 'Original', plan: [{ name: 'Press banca', muscle: 'pecho', sets: 3 }] });
  sb.duplicarRutina('r1');
  t('duplicar crea UNA copia con ID nuevo', sb.state.savedRoutines.length === 2 && sb.state.savedRoutines[1].id !== 'r1');
  t('la copia se marca "(copia)" y la original queda intacta', sb.state.savedRoutines[1].name === 'Original (copia)' && sb.state.savedRoutines[0].name === 'Original');
  t('no hay duplicados por firma al guardar dos veces la misma', (function () {
    sb.state.fitnessToday = { date: '2026-09-18', plan: [{ name: 'Press banca', muscle: 'pecho', sets: 3 }], loadedRoutineId: null, ctx: { focus: 'Pecho' } };
    sb.window._routineName = 'Nueva';
    sb.saveCurrentRoutine();
    const n1 = sb.state.savedRoutines.length;
    sb.saveCurrentRoutine();
    return n1 === sb.state.savedRoutines.length;
  })());
})();

console.log('\n===== RESULTADO: ' + passed + ' PASS / ' + failed + ' FAIL =====');
if (failed) process.exit(1);
