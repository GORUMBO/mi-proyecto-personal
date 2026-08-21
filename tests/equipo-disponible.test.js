// ============================================================
// PRUEBAS — Equipo disponible (inventario real)
// Modos: Gimnasio | Casa sin equipo | Casa con equipo | Personalizado.
// Regla: NUNCA se propone un ejercicio cuyo equipo no esta disponible.
// Uso: node tests/equipo-disponible.test.js
// ============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extractFunc(name) {
  var src = HTML;
  let i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('No se encontró function ' + name);
  let parens = 0, j = i, q = null, lc = false, bc = false, bs = -1;
  for (; j < src.length; j++) {
    const c = src[j], n = src[j + 1];
    if (lc) { if (c === '\n') lc = false; continue; }
    if (bc) { if (c === '*' && n === '/') { bc = false; j++; } continue; }
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '/' && n === '/') { lc = true; j++; continue; }
    if (c === '/' && n === '*') { bc = true; j++; continue; }
    if (c === '(') parens++;
    else if (c === ')') { parens--; if (parens === 0) { bs = j + 1; break; } }
  }
  if (bs < 0) throw new Error('params de ' + name);
  let d = 0; q = null; lc = false; bc = false; j = bs;
  for (; j < src.length; j++) {
    const c = src[j], n = src[j + 1];
    if (lc) { if (c === '\n') lc = false; continue; }
    if (bc) { if (c === '*' && n === '/') { bc = false; j++; } continue; }
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '/' && n === '/') { lc = true; j++; continue; }
    if (c === '/' && n === '*') { bc = true; j++; continue; }
    if (c === '{') d++;
    else if (c === '}') { d--; if (d === 0) return src.slice(i, j + 1); }
  }
  throw new Error('incompleta: ' + name);
}
function extractObj(name) {
  var m = HTML.match(new RegExp('const ' + name + '=(\{.*?\});', 's'));
  if (!m) throw new Error('No se encontró const ' + name);
  return m[1];
}

let passed = 0, failed = 0;
const failures = [];
function t(name, cond, extra) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; failures.push(name + (extra ? ' → ' + extra : '')); console.log('  ✗ ' + name + (extra ? ' → ' + extra : '')); }
}

const sandbox = {
  console,
  state: { fitEffort: 'normal', fitVariant: 0, workoutLog: [], sessionFeedbacks: [], profile: { actividadDiaria: 'activo', nivelFit: 'intermedio', minutosSesion: '60' }, savedRoutines: [], fitDislikes: [] },
  fitDaySeed: function () { return 3; },
  todayISO: function () { return '2026-08-18'; },
  todayLocal: function () { return '2026-08-18'; },
  save: function () {},
  safeText: function (x) { return String(x == null ? '' : x); },
  alert: function () {},
  renderFitnessCoach: function () {},
  renderGuidedWorkout: function () {},
  quickFitnessToday: function () {},
  renderRoutineToday: function () {},
  document: { getElementById: function () { return { value: '', innerHTML: '' }; } }
};
sandbox.window = sandbox;
vm.runInNewContext(
  extractFunc('fitnessExerciseBank') + '\n' +
  extractFunc('f3Candidatos') + '\n' +
  extractFunc('f3Elegir') + '\n' +
  extractFunc('f3EquipKey') + '\n' +
  extractFunc('f3KeyEquipo') + '\n' +
  extractFunc('f3EqsPermitidos') + '\n' +
  extractFunc('f3InventarioEquipo') + '\n' +
  extractFunc('f3EquipoActualLabel') + '\n' +
  extractFunc('f3IdPorNombre') + '\n' +
  extractFunc('f3NivelNum') + '\n' +
  extractFunc('f3NivelBand') + '\n' +
  extractFunc('f3Mid') + '\n' +
  extractFunc('f3HistorialReciente') + '\n' +
  extractFunc('f3AltsBanco') + '\n' +
  extractFunc('f3EquipoOpcionesHTML') + '\n' +
  extractFunc('f3InventarioOpcionesHTML') + '\n' +
  extractFunc('f3Incompatibles') + '\n' +
  extractFunc('adaptarRutinaEquipo') + '\n' +
  extractFunc('openCreateRoutine') + '\n' +
  'var F3_RULES=' + extractObj('F3_RULES') + ';\n' +
  'var EX_LIB=' + extractObj('EX_LIB') + ';\n' +
  'var F3_ALIASES=' + extractObj('F3_ALIASES') + ';',
  sandbox
);
const EX_LIB = sandbox.EX_LIB;

function eqsDeNombres(nombres) {
  var out = {};
  nombres.forEach(function (n) {
    var id = sandbox.f3IdPorNombre(n);
    if (!id) return;
    var e = EX_LIB[id];
    ['gym', 'man', 'casa'].forEach(function (k) {
      if (e.var[k] && e.var[k].n === n) out[n] = e.var[k].eq;
    });
  });
  return out;
}

// ============================================================
// A · Metadatos de equipo del banco
// ============================================================
console.log('== A · Metadatos de equipo ==');
var eqsValidos = ['pc', 'ban', 'man', 'bar', 'maq', 'pol'];
var todosValidos = Object.keys(EX_LIB).every(function (id) {
  return ['gym', 'man', 'casa'].every(function (k) {
    var v = EX_LIB[id].var[k];
    return v && v.n && eqsValidos.indexOf(v.eq) >= 0;
  });
});
t('A1 · cada variante de cada ejercicio tiene un eq valido', todosValidos);
t('A2 · f3EqsPermitidos: gimnasio = todo', sandbox.f3EqsPermitidos('Gimnasio') === null);
t('A3 · f3EqsPermitidos: casa sin equipo = pc + bandas ligeras',
  JSON.stringify(sandbox.f3EqsPermitidos('Casa / sin equipo')) === JSON.stringify(['pc', 'ban']));
sandbox.state.profile.inventario = { man: true };
t('A4 · casa con equipo + mancuernas = pc + man',
  JSON.stringify(sandbox.f3EqsPermitidos('Casa con equipo')) === JSON.stringify(['pc', 'man']));
sandbox.state.profile.inventario = { man: true, bar: true, ban: true };
t('A5 · personalizado mixto = pc + man + bar + ban',
  JSON.stringify(sandbox.f3EqsPermitidos('Equipo personalizado')) === JSON.stringify(['pc', 'man', 'bar', 'ban']));
t('A6 · f3KeyEquipo: mixto con barra usa variantes de gimnasio', sandbox.f3KeyEquipo('Equipo personalizado') === 'gym');
sandbox.state.profile.inventario = { man: true };
t('A7 · f3KeyEquipo: solo mancuernas usa variantes de mancuernas', sandbox.f3KeyEquipo('Casa con equipo') === 'man');
sandbox.state.profile.inventario = {};
t('A8 · f3KeyEquipo: sin inventario cae a peso corporal', sandbox.f3KeyEquipo('Casa con equipo') === 'casa');

// ============================================================
// B · Candidatos filtrados por inventario
// ============================================================
console.log('== B · Candidatos por inventario ==');
function candsDe(musc, pat, equip) {
  return sandbox.f3Candidatos(musc, pat, { equip: equip, nivel: 'intermedio', dia: 0 }, {}, []).map(function (e) {
    return e.var[sandbox.f3EquipKey(equip)].n;
  });
}
var gymPecho = candsDe('pecho', 'empuje_horizontal', 'Gimnasio');
var eqGym = eqsDeNombres(gymPecho);
t('B1 · gimnasio: puede usar maquinas y poleas',
  Object.keys(eqGym).some(function (n) { return eqGym[n] === 'maq' || eqGym[n] === 'pol'; }));
var casaPierna = candsDe('pierna', 'rodilla', 'Casa / sin equipo');
t('B2 · casa sin equipo: NO aparecen prensa ni maquinas',
  casaPierna.every(function (n) { return !/prensa|maquina|maq|polea|press/i.test(n); }), casaPierna.join(','));
var casaCore = candsDe('core', 'core', 'Casa / sin equipo');
t('B3 · casa sin equipo: NO aparece Crunch en polea',
  casaCore.indexOf('Crunch en polea') < 0, casaCore.join(','));
sandbox.state.profile.inventario = { man: true };
var manPierna = candsDe('pierna', 'rodilla', 'Casa con equipo');
var eqMan = eqsDeNombres(manPierna);
t('B4 · casa con SOLO mancuernas: todo es pc o man (sin barra/maquina)',
  manPierna.length > 0 && Object.keys(eqMan).every(function (n) { return eqMan[n] === 'pc' || eqMan[n] === 'man'; }), JSON.stringify(eqMan));
sandbox.state.profile.inventario = { man: true, banco: true };
var manBanPierna = candsDe('pierna', 'rodilla', 'Casa con equipo');
t('B5 · casa mancuernas + banco: mismos permitidos (banco es auxiliar)',
  manBanPierna.every(function (n) { var eq = eqsDeNombres([n])[n]; return !eq || eq === 'pc' || eq === 'man'; }));
sandbox.state.profile.inventario = { ban: true };
var banEspalda = candsDe('espalda', 'traccion_vertical', 'Casa con equipo');
var eqBan = eqsDeNombres(banEspalda);
t('B6 · casa con bandas: traccion vertical con pc o ban',
  banEspalda.length > 0 && Object.keys(eqBan).every(function (n) { return eqBan[n] === 'pc' || eqBan[n] === 'ban'; }), JSON.stringify(eqBan));
sandbox.state.profile.inventario = { man: true, bar: true, ban: true };
var mixPecho = candsDe('pecho', 'empuje_horizontal', 'Equipo personalizado');
var eqMix = eqsDeNombres(mixPecho);
t('B7 · personalizado mixto: incluye barra y excluye maquinas',
  mixPecho.indexOf('Press banca con barra') >= 0 && Object.keys(eqMix).every(function (n) { return ['pc', 'man', 'bar', 'ban'].indexOf(eqMix[n]) >= 0; }), JSON.stringify(eqMix));
sandbox.state.profile.inventario = { man: true };
var mixSinBar = candsDe('pecho', 'empuje_horizontal', 'Equipo personalizado');
t('B8 · personalizado sin barra: la barra NO aparece',
  mixSinBar.indexOf('Press banca con barra') < 0, mixSinBar.join(','));
sandbox.state.profile.inventario = {};

// ============================================================
// C · Alternativas y cambio de ejercicio respetando equipo
// ============================================================
console.log('== C · Alternativas por equipo ==');
sandbox.state.profile.inventario = { man: true };
var altsMix = sandbox.f3AltsBanco({ musc: 'pecho', equip: 'Equipo personalizado', nivel: 'intermedio' });
var eqAlts = eqsDeNombres(altsMix);
t('C1 · alternativas en personalizado (solo mancuernas): sin maquinas ni poleas',
  altsMix.length >= 3 && Object.keys(eqAlts).every(function (n) { return eqAlts[n] === 'pc' || eqAlts[n] === 'man'; }), JSON.stringify(eqAlts));
sandbox.state.profile.inventario = { man: true, bar: true };
var altsBar = sandbox.f3AltsBanco({ musc: 'pecho', equip: 'Equipo personalizado', nivel: 'intermedio' });
t('C2 · con barra, el nombre de la alternativa es la variante real (Press banca con barra)',
  altsBar.indexOf('Press banca con barra') >= 0 && altsBar.indexOf('Press máquina pecho') < 0, altsBar.join(','));
var altsCasa = sandbox.f3AltsBanco({ musc: 'espalda', equip: 'Casa / sin equipo', nivel: 'intermedio' });
t('C3 · alternativas en casa sin equipo: sin maquinas/poleas/barra',
  altsCasa.every(function (n) { return !/maquina|polea|barra|prensa|jalon|cable/i.test(n); }), altsCasa.join(','));
sandbox.state.profile.inventario = {};

// ============================================================
// D · Equipo cambiado: aviso + Adaptar rutina (sin destruir)
// ============================================================
console.log('== D · Cambio de equipo y adaptacion ==');
var planMixto = [
  { name: 'Prensa de piernas', muscle: 'pierna', sets: 3, reps: '6-15', rest: 135, alts: [], altsCompletas: [] },
  { name: 'Press banca con barra', muscle: 'pecho', sets: 3, reps: '6-15', rest: 135, alts: [], altsCompletas: [] },
  { name: 'Sentadilla con barra', muscle: 'pierna', sets: 3, reps: '6-15', rest: 135, alts: [], altsCompletas: [] },
  { name: 'Plancha', muscle: 'core', sets: 3, reps: '30-45s', rest: 60, alts: [], altsCompletas: [] }
];
sandbox.state.profile.equipo = 'casa';
sandbox.state.fitnessToday = { date: '2026-08-18', plan: JSON.parse(JSON.stringify(planMixto)) };
var inc = sandbox.f3Incompatibles(sandbox.state.fitnessToday.plan, 'Casa / sin equipo');
t('D1 · detecta los incompatibles con casa sin equipo (barra incluida)',
  inc.length === 3 && inc[0].name === 'Prensa de piernas' && inc[1].name === 'Press banca con barra' && inc[2].name === 'Sentadilla con barra', JSON.stringify(inc.map(function (x) { return x.name; })));
sandbox.adaptarRutinaEquipo();
var adaptado = sandbox.state.fitnessToday.plan;
t('D2 · sustituye SOLO los incompatibles (el compatible queda intacto)',
  adaptado[3].name === 'Plancha');
t('D3 · los sustitutos son compatibles con casa (pc/ban)',
  ['0', '1', '2'].every(function (i) {
    var id = sandbox.f3IdPorNombre(adaptado[i].name);
    var eq = id && EX_LIB[id] ? EX_LIB[id].var.casa.eq : null;
    return eq === 'pc' || eq === 'ban';
  }), adaptado.map(function (x) { return x.name; }).join(','));
t('D4 · conserva series/reps/orden del resto de la estructura',
  adaptado.length === 4 && adaptado[2].sets === 3 && adaptado[3].reps === '30-45s'
  && adaptado[0].sets === 3 && adaptado[1].sets === 3);
var inc2 = sandbox.f3Incompatibles(adaptado, 'Casa / sin equipo');
t('D5 · tras adaptar no quedan incompatibles', inc2.length === 0, JSON.stringify(inc2));

// ============================================================
// E · UI del constructor
// ============================================================
console.log('== E · UI del constructor ==');
var htmlCons = String(sandbox.openCreateRoutine || '');
t('E1 · el constructor tiene el bloque de equipo disponible', htmlCons.indexOf('Equipo disponible') >= 0);
t('E2 · selector de 4 modos (crEquipoRow)', htmlCons.indexOf('crEquipoRow') >= 0);
t('E3 · inventario solo para casa con equipo / personalizado (crInventarioRow)', htmlCons.indexOf('crInventarioRow') >= 0);
var invSrc = String(sandbox.f3InventarioOpcionesHTML || '');
t('E4 · inventario con mancuernas, barra, bandas, polea y dominadas',
  ['Mancuernas', 'Barra', 'Bandas', 'Polea casera', 'Barra de dominadas'].every(function (x) { return invSrc.indexOf(x) >= 0; }));

console.log('');
console.log('==========================================');
console.log('Resultado: ' + passed + ' pasaron · ' + failed + ' fallaron');
console.log('==========================================');
if (failed) {
  console.log('Fallos:');
  console.log(failures.map(function (f) { return '  ✗ ' + f; }).join('\n'));
  process.exit(1);
}
process.exit(0);
