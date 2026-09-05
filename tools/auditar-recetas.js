// ============================================================
// Auditoría completa de recetas (NO destructiva).
// Replica la carga de baseRecipes (add legacy, addFull, RECETAS_NUEVAS/V2-V5,
// dedup y sufijos) y ejecuta recetaAuditar + recetaClasificarPaso sobre TODO.
// Uso: node tools/auditar-recetas.js [--json ruta]
// ============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

/* ---------- extracción de funciones/var de index.html ---------- */
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
function extractVar(name) {
  const m = HTML.match(new RegExp('var ' + name + '=([^;\\n]+);'));
  if (!m) throw new Error('No se encontró ' + name);
  return m[1];
}
function evalExpr(expr, ctx) {
  return vm.runInNewContext('(' + expr + ')', ctx || {});
}

/* ---------- escáner de arreglos de nivel superior ---------- */
// Recorre el HTML (quote-aware + comment-aware) y detecta literales de arreglo
// en profundidad 0. Devuelve {start,end,text} con las posiciones del '[' y ']'.
function scanTopArrays() {
  const out = [];
  let depth = 0, q = null, start = -1, i = 0;
  while (i < HTML.length) {
    const c = HTML[i];
    if (q) {
      if (q === 'TQ') { // template literal con posible ${}
        if (c === '\\') { i += 2; continue; }
        if (c === '`') q = null;
        i++; continue;
      }
      if (c === '\\') { i += 2; continue; }
      if (c === q) q = null;
      i++; continue;
    }
    if (c === '/' && HTML[i + 1] === '/') { while (i < HTML.length && HTML[i] !== '\n') i++; continue; }
    if (c === '/' && HTML[i + 1] === '*') { const e = HTML.indexOf('*/', i + 2); i = e < 0 ? HTML.length : e + 2; continue; }
    if (c === '"' || c === "'") { q = c; i++; continue; }
    if (c === '`') { q = 'TQ'; i++; continue; }
    if (c === '[') { if (depth === 0) start = i; depth++; i++; continue; }
    if (c === ']') {
      depth--;
      if (depth === 0 && start >= 0) out.push({ start: start, end: i, text: HTML.slice(start, i + 1) });
      i++; continue;
    }
    i++;
  }
  return out;
}

/* ---------- reconstrucción de baseRecipes ---------- */
function buildBaseRecipes() {
  const arrays = scanTopArrays();
  const base = [];
  const consts = {};   // nombre -> texto del arreglo (para NUEVAS/V2..V5)
  const legacy = [];  // bloques en orden de archivo
  const full = [];    // bloques addFull en orden de archivo

  for (const a of arrays) {
    const before = HTML.slice(Math.max(0, a.start - 120), a.start);
    const after = HTML.slice(a.end + 1, a.end + 40);
    let m = before.match(/const\s+(RECETAS_(?:V2|V3|V4|V5|NUEVAS))\s*=\s*$/);
    if (m) { consts[m[1]] = a.text; continue; }
    if (/^\s*\.forEach\(r=>add\(/.test(after)) { legacy.push(a.text); continue; }
    if (/^\s*\.forEach\(addFull\)/.test(after)) { full.push(a.text); continue; }
  }
  // 1) add legacy
  const sbAdd = {
    add: (type, name, time, k, p, cost, steps, method, tags, temp, ingredients) =>
      base.push({ type, name, time, k, p, cost, steps, method, tags, temp, ingredients })
  };
  for (const t of legacy) {
    vm.runInNewContext('(' + t + ').forEach(function(r){add(r[1],r[0],r[2],r[3],r[4],r[5],r[6],r[7],r[8],r[9]||\'\',r[10]||\'\')});', sbAdd);
  }
  // 2) addFull
  const sbFull = { baseRecipes: base };
  for (const t of full) {
    vm.runInNewContext('(' + t + ').forEach(function(o){baseRecipes.push(Object.assign({method:\'estufa\',tags:\'\',temp:\'\',ingredients:\'\',porciones:\'\',carbs:null,grasas:null,dificultad:\'\',conservar:\'\',duracion:\'\',recalentar:\'\',llevarTrabajo:\'\',methods:null},o));});', sbFull);
  }
  // 3) RECETAS_NUEVAS, V2..V5 con dedup por nombre
  const orden = ['RECETAS_NUEVAS', 'RECETAS_V2', 'RECETAS_V3', 'RECETAS_V4', 'RECETAS_V5'];
  const yaEstan = {};
  base.forEach(r => { if (r && r.name) yaEstan[r.name] = 1; });
  for (const n of orden) {
    if (!consts[n]) throw new Error('No se encontró const ' + n);
    const arr = evalExpr(consts[n]);
    arr.forEach(r => { if (!yaEstan[r.name]) { base.push(r); yaEstan[r.name] = 1; } });
  }
  // 4) sufijos para nombres duplicados
  const vistos = {};
  base.forEach(r => {
    if (!r || !r.name) return;
    if (vistos[r.name]) {
      const a = vistos[r.name], b = r;
      const grande = a.k >= b.k ? a : b;
      const chica = a.k >= b.k ? b : a;
      if (!/\(/.test(grande.name)) grande.name = grande.name + ' (porción grande · ' + grande.k + ' kcal)';
      if (!/\(/.test(chica.name)) chica.name = chica.name + ' (porción chica · ' + chica.k + ' kcal)';
    } else vistos[r.name] = r;
  });
  return { base, consts };
}

/* ---------- sandbox con las funciones de auditoría ---------- */
function makeSandbox(base) {
  const sb = {
    safeText: x => String(x == null ? '' : x),
    baseRecipes: base,
    RECETA_ESTADOS: evalExpr(extractVar('RECETA_ESTADOS')),
  };
  sb.RECETA_ESTADOS_RX = evalExpr(extractVar('RECETA_ESTADOS_RX'), sb);
  sb.RECETA_COCCION_VERB = evalExpr(extractVar('RECETA_COCCION_VERB'));
  sb.RECETA_CRITERIO_RX = evalExpr(extractVar('RECETA_CRITERIO_RX'));
  sb.RECETA_COCCION_VERB_PROFUNDO = evalExpr(extractVar('RECETA_COCCION_VERB_PROFUNDO'));
  sb.RECETA_METODO_ESTADO = evalExpr(extractVar('RECETA_METODO_ESTADO'));
  sb.RECETA_PASO_REPOSO = evalExpr(extractVar('RECETA_PASO_REPOSO'));
  sb.RECETA_PASO_DORAR = evalExpr(extractVar('RECETA_PASO_DORAR'));
  sb.RECETA_PASO_ESCURRIR = evalExpr(extractVar('RECETA_PASO_ESCURRIR'));
  sb.RECETA_PASO_SAZONAR = evalExpr(extractVar('RECETA_PASO_SAZONAR'));
  sb.RECETA_PASO_HASTA = evalExpr(extractVar('RECETA_PASO_HASTA'));
  sb.RECETA_PASO_TEMP = evalExpr(extractVar('RECETA_PASO_TEMP'));
  sb.RECETA_PASO_TIP = evalExpr(extractVar('RECETA_PASO_TIP'));
  const FUNCS = ['recetaSujetoDe', 'recetaExplicaPreparacion', 'recetaAuditar', 'recetaTiempoPaso',
    'recetaStemDe', 'recetaRxSujeto', 'recetaExplicaPreparacionProfunda', 'recetaSubrecetaPreparacion',
    'recetaVerboDeEstado', 'recetaInconsistenciaTituloPasos', 'recetaScoreSubreceta', 'recetaMejorSubreceta',
    'recetaClasificarPaso'];
  FUNCS.forEach(n => { sb[n] = vm.runInNewContext('(' + extractFunc(n) + ')', sb); });
  sb.globalThis = sb;
  return sb;
}

/* ---------- auditoría ---------- */
// verificación de fuentes (cuántos bloques se capturaron por origen)
(function () {
  const arrays = scanTopArrays();
  let leg = 0, full = 0;
  const consts = {};
  for (const a of arrays) {
    const before = HTML.slice(Math.max(0, a.start - 120), a.start);
    const after = HTML.slice(a.end + 1, a.end + 40);
    const m = before.match(/const\s+(RECETAS_(?:V2|V3|V4|V5|NUEVAS))\s*=\s*$/);
    if (m) { consts[m[1]] = vm.runInNewContext('(' + a.text + ')').length; continue; }
    if (/^\s*\.forEach\(r=>add\(/.test(after)) leg++;
    else if (/^\s*\.forEach\(addFull\)/.test(after)) full++;
  }
  console.log('[fuentes] bloques add legacy: ' + leg + ' (esperado 29) · addFull: ' + full + ' (esperado 5) · consts: ' + JSON.stringify(consts));
})();
const { base } = buildBaseRecipes();
const sb = makeSandbox(base);
const report = {
  total: base.length,
  porScore: { '🟢': 0, '🟡': 0, '🔴': 0 },
  problemas: { 'preparacion-asumida': 0, 'paso-sin-criterio': 0, 'tm5-sin-parametros': 0, 'temp-sin-metodo': 0, 'metodo-sin-criterio': 0 },
  pasosPorNivel: { '🟢': 0, '🟡': 0, '🔴': 0 },
  rojas: [],          // recetas con score 🔴
  amarillas: [],      // recetas con score 🟡
  pasosRojos: [],     // pasos 🔴 (recetaClasificarPaso)
  pasosAmarillos: []  // pasos 🟡
};

base.forEach((r, i) => {
  const a = sb.recetaAuditar(r);
  report.porScore[a.score]++;
  a.problemas.forEach(p => { report.problemas[p.tipo] = (report.problemas[p.tipo] || 0) + 1; });
  // análisis por problema
  const det = a.problemas.map(p => {
    const d = { tipo: p.tipo };
    if (p.tipo === 'preparacion-asumida') {
      d.texto = p.texto; d.sujeto = p.sujeto; d.estado = p.estado;
      d.grupoA = sb.recetaExplicaPreparacionProfunda(r, p.sujeto);
      const mejor = sb.recetaMejorSubreceta(r, p);
      d.grupoB = mejor ? { idx: mejor.idx, nombre: mejor.sub.sub } : null;
      const cands = sb.recetaSubrecetaPreparacion(r, p.sujeto);
      d.candidatas = cands.map(c => c.nombre);
      if (!d.grupoA && !d.grupoB) d.sinDatos = true;
    } else if (p.tipo === 'paso-sin-criterio') {
      d.paso = p.paso; d.texto = p.texto;
      // ¿otro paso de la misma receta trae tiempo o criterio reutilizable?
      const otros = (r.steps || []).map((s, j) => ({ s, j })).filter(x => x.j !== (p.paso - 1));
      d.datosMismaReceta = otros.filter(x => sb.recetaTiempoPaso(x.s) || /°C|fuego (medio|alto|bajo)/i.test(x.s))
        .map(x => ({ paso: x.j + 1, texto: String(x.s).slice(0, 90) }));
    }
    return d;
  });
  // pasos: clasificación individual
  (r.steps || []).forEach((s, j) => {
    const c = sb.recetaClasificarPaso(s);
    report.pasosPorNivel[c.nivel]++;
    if (c.nivel === '🔴') {
      // ¿datos en la MISMA receta para resolverlo sin inventar?
      const otros = (r.steps || []).map((x, k) => ({ x, k })).filter(x => x.k !== j);
      const conDatos = otros.filter(x => sb.recetaTiempoPaso(x.x) || /°C|fuego (medio|alto|bajo)/i.test(x.x))
        .map(x => ({ paso: x.k + 1, texto: String(x.x).slice(0, 90) }));
      report.pasosRojos.push({ receta: r.name, idx: i, paso: j + 1, texto: String(s).slice(0, 120), tipo: c.tipo, conDatos });
    } else if (c.nivel === '🟡') {
      const otros = (r.steps || []).map((x, k) => ({ x, k })).filter(x => x.k !== j);
      const conDatos = otros.filter(x => sb.recetaTiempoPaso(x.x) || /°C|fuego (medio|alto|bajo)/i.test(x.x))
        .map(x => ({ paso: x.k + 1, texto: String(x.x).slice(0, 90) }));
      report.pasosAmarillos.push({ receta: r.name, idx: i, paso: j + 1, texto: String(s).slice(0, 120), tipo: c.tipo, conDatos });
    }
  });
  if (a.score === '🔴') report.rojas.push({ idx: i, name: r.name, steps: r.steps, method: r.method, temp: r.temp, ingredients: r.ingredients, det });
  if (a.score === '🟡') report.amarillas.push({ idx: i, name: r.name, steps: r.steps, det });
});

/* ---------- salida ---------- */
console.log('===== AUDITORÍA COMPLETA DE RECETAS =====');
console.log('Total recetas en baseRecipes: ' + report.total);
console.log('Por score: 🟢 ' + report.porScore['🟢'] + ' · 🟡 ' + report.porScore['🟡'] + ' · 🔴 ' + report.porScore['🔴']);
console.log('Problemas por tipo:');
Object.keys(report.problemas).forEach(k => console.log('  ' + k + ': ' + report.problemas[k]));
const totProblemas = Object.values(report.problemas).reduce((a, b) => a + b, 0);
console.log('  TOTAL problemas: ' + totProblemas);
console.log('Pasos por nivel (recetaClasificarPaso): 🟢 ' + report.pasosPorNivel['🟢'] + ' · 🟡 ' + report.pasosPorNivel['🟡'] + ' · 🔴 ' + report.pasosPorNivel['🔴']);
console.log('Recetas 🔴: ' + report.rojas.length + ' · Recetas 🟡: ' + report.amarillas.length);

// análisis de corregibilidad
let redA = 0, redB = 0, redSinDatos = 0;
report.rojas.forEach(x => {
  const prev = x.det.filter(d => d.tipo === 'preparacion-asumida');
  prev.forEach(p => { if (p.grupoA) redA++; else if (p.grupoB) redB++; else redSinDatos++; });
});
console.log('Problemas preparación-asumida: grupo A (misma receta explica) ' + redA + ' · grupo B (subreceta 🟢) ' + redB + ' · sin datos ' + redSinDatos);

const pasosRojosConDatos = report.pasosRojos.filter(x => x.conDatos.length);
console.log('Pasos 🔴: ' + report.pasosRojos.length + ' (con datos en la misma receta: ' + pasosRojosConDatos.length + ')');
const pasosAmConDatos = report.pasosAmarillos.filter(x => x.conDatos.length);
console.log('Pasos 🟡: ' + report.pasosAmarillos.length + ' (con datos en la misma receta: ' + pasosAmConDatos.length + ')');

const jsonArg = process.argv.indexOf('--json');
const jsonPath = jsonArg >= 0 ? process.argv[jsonArg + 1] : path.join(__dirname, 'auditoria-report.json');
fs.writeFileSync(jsonPath, JSON.stringify(report, null, 1), 'utf8');
console.log('Reporte JSON: ' + jsonPath);
// volcado completo de recetas para análisis manual
const dump = base.map((r, i) => ({ i, name: r.name, method: r.method, temp: r.temp, ingredients: r.ingredients, steps: r.steps }));
fs.writeFileSync(path.join(__dirname, 'recetas-dump.json'), JSON.stringify(dump, null, 1), 'utf8');
console.log('Dump de recetas: ' + path.join(__dirname, 'recetas-dump.json'));
