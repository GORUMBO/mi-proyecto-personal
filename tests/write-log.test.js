// ============================================================
// PRUEBAS v1.187.16 — Bitácora de TODAS las escrituras a Supabase
// (quién, tabla, workoutLog enviados, HTTP, fila devuelta).
// Uso: node tests/write-log.test.js
// ============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extractFunc(src, name) {
  let i = src.indexOf('async function ' + name + '(');
  if (i < 0) i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('No se encontró function ' + name);
  // Saltar la lista de parámetros (puede tener defaults con llaves: options={}).
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
const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

const wl53 = Array.from({ length: 53 }, function (_, i) { return { id: i + 1, exercise: 'E' + (i + 1) }; });
const wl42 = wl53.slice(0, 42);

let serverRow = { user_id: 'u-123', data: { workoutLog: wl42 }, updated_at: '2026-08-15T10:00:00.000Z' };

const sb = {
  console: { log: function () {}, warn: function () {}, error: function () {} },
  PP_SYNC: { writeLog: [] },
  getCloudSession: function () { return { user: { id: 'u-123' }, access_token: 'tok' }; },
  getCloudConfig: function () { return { url: 'https://xyz.supabase.co', key: 'KEY' }; },
  refreshCloudSession: async function () { return sb.getCloudSession(); },
  fetch: async function (url, opts) {
    // El POST guarda en la fila lo que recibe y devuelve representation.
    if (opts && opts.method === 'POST') {
      const body = JSON.parse(opts.body);
      serverRow = body;
      return { ok: true, status: 200, text: async function () { return JSON.stringify([serverRow]); } };
    }
    return { ok: true, status: 200, text: async function () { return '[]'; } };
  }
};
sb.window = sb;
vm.createContext(sb);
['ppRespBloqueada', 'cloudRest', 'ppWriteOrigen'].forEach(function (n) { vm.runInContext(extractFunc(HTML, n), sb); });

(async function () {
  console.log('\n== Bitácora de escrituras (cloudRest real + fetch simulado) ==');
  // Escritura de 53 (como cloudSave con fusión previa).
  await sb.cloudRest('personal_backups?on_conflict=user_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ user_id: 'u-123', data: { workoutLog: wl53 }, updated_at: '2026-08-15T10:01:00.000Z' })
  });
  // Escritura ciega de 42 (como una instancia vieja).
  await sb.cloudRest('personal_backups?on_conflict=user_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ user_id: 'u-123', data: { workoutLog: wl42 }, updated_at: '2026-08-15T10:02:00.000Z' })
  });
  const log = sb.PP_SYNC.writeLog;
  t('W1 · Cada escritura queda registrada en orden (la última primero)', log.length === 2 && log[0].wl === 42 && log[1].wl === 53);
  t('W2 · Registra tabla, HTTP y updated_at enviado', log[0].tabla === 'personal_backups' && log[0].http === 200 && log[0].tsEnviado === '2026-08-15T10:02:00.000Z');
  t('W3 · Registra la fila que devolvió el servidor (respWl y tsResp)', log[1].respWl === 53 && log[1].tsResp === '2026-08-15T10:01:00.000Z' && log[0].respWl === 42);
  t('W4 · La función de origen queda capturada del stack', typeof log[0].fn === 'string' && log[0].fn.length > 0);

  console.log('\n==========================================');
  console.log('Resultado: ' + passed + ' pasaron · ' + failed + ' fallaron');
  console.log('==========================================');
  if (failed) {
    console.log('\nFallos:\n' + failures.map(function (f) { return '  ✗ ' + f; }).join('\n'));
    process.exit(1);
  }
  process.exit(0);
})();
