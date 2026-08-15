// ============================================================
// PRUEBAS v1.187.12 — Botón de auditoría Supabase en la app
// (usa la sesión existente; muestra resultados en pantalla;
// la escritura controlada re-envía el MISMO contenido de la fila;
// nunca muestra tokens).
// Uso: node tests/audit-button.test.js
// ============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extractFunc(src, name) {
  let i = src.indexOf('async function ' + name + '(');
  if (i < 0) i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('No se encontró function ' + name);
  let depth = 0, j = i, q = null;
  for (; j < src.length; j++) {
    const c = src[j];
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; continue; }
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

const fakeEls = {};
let n = 0;
function makeEl(id) {
  return {
    id: id, innerHTML: '', style: {}, children: [],
    appendChild: function (c) { this.children.push(c); },
    remove: function () { delete fakeEls[this.id]; }
  };
}
const docStub = {
  getElementById: function (id) { if (!fakeEls[id]) fakeEls[id] = makeEl(id); return fakeEls[id]; },
  createElement: function () { return makeEl('_e' + (++n)); },
  body: { appendChild: function (el) { if (el && el.id) fakeEls[el.id] = el; } }
};

let hasSession = true;
const requests = [];
const row42 = { user_id: 'u-123', updated_at: '2026-08-15T00:00:00Z', data: { workoutLog: Array.from({ length: 42 }, function (_, i) { return { id: i + 1, exercise: 'E' + (i + 1) }; }) } };

const sb = {
  console: { log: function () {}, warn: function () {}, error: function () {} },
  document: docStub,
  safeText: function (s) { return String(s == null ? '' : s); },
  getCloudSession: function () { return hasSession ? { user: { id: 'u-123', email: 'x@y.z' }, access_token: 'tok-secreto' } : null; },
  getCloudConfig: function () { return { url: 'https://xyz.supabase.co', key: 'KEY' }; },
  refreshCloudSession: async function () { return sb.getCloudSession(); },
  fetch: async function (url, opts) {
    requests.push({ url: String(url), opts: opts || {} });
    const p = String(url).replace('https://xyz.supabase.co/rest/v1/', '');
    if (p.indexOf('personal_backups?select=user_id,updated_at,data') === 0) return { status: 200, text: async function () { return JSON.stringify([row42]); } };
    if (p.indexOf('personal_backups?user_id=eq.') === 0) return { status: 200, text: async function () { return JSON.stringify([row42]); } };
    if (opts && opts.method === 'POST') return { status: 200, text: async function () { return JSON.stringify([row42]); } };
    return { status: 200, text: async function () { return '[]'; } };
  },
  PP_SYNCCHAIN: [],
  state: { onboarded: true }
};
sb.window = sb;
vm.createContext(sb);
['ppAuditPanel', 'ppAuditLine', 'ppAuditarSupabase', 'renderSyncChain', 'syncChainPush', 'ppRenderUploadTrace']
  .forEach(function (n) { vm.runInContext(extractFunc(HTML, n), sb); });
sb.ppUploadTrace = { inicio: null, merge: null, payload: null, ultimo: null, http: null, releida: null, result: null, error: null };

(async function () {
  console.log('\n== Botón de auditoría (sesión de la app, sin copiar tokens) ==');
  await sb.ppAuditarSupabase();
  await sleep(20);
  const lineas = (fakeEls.ppAuditLines && fakeEls.ppAuditLines.children || []).map(function (c) { return c.innerHTML; });
  t('A1 · Muestra la sesión y el workoutLog REAL de la fila en pantalla',
    lineas.some(function (l) { return l.indexOf('u-123') >= 0; })
    && lineas.some(function (l) { return l.indexOf('workoutLog <b>42</b>') >= 0; }));
  const post = requests.find(function (r) { return r.opts.method === 'POST'; });
  t('A2 · La escritura controlada re-envía el MISMO contenido de la fila (42, sin tocar datos)',
    !!post && JSON.parse(post.opts.body).data.workoutLog.length === 42);
  t('A3 · Nunca muestra tokens en pantalla', !lineas.some(function (l) { return l.indexOf('tok-secreto') >= 0; }));

  fakeEls.ppAuditLines = makeEl('ppAuditLines');
  fakeEls.ppAuditOut = makeEl('ppAuditOut');
  hasSession = false;
  await sb.ppAuditarSupabase();
  await sleep(10);
  const lineas2 = (fakeEls.ppAuditLines && fakeEls.ppAuditLines.children || []).map(function (c) { return c.innerHTML; });
  t('A4 · Sin sesión, avisa en pantalla (no trona)', lineas2.some(function (l) { return l.indexOf('Sin sesión') >= 0; }));

  sb.PP_SYNCCHAIN = [{ evento: 'x', detalle: 'y', t: '00:00' }];
  sb.renderSyncChain();
  t('A5 · La barra de la cadena incluye el botón "🔍 Auditar Supabase"',
    (fakeEls.syncChainBar && fakeEls.syncChainBar.innerHTML.indexOf('Auditar Supabase') >= 0));

  // A6: traza de subida en pantalla (para iPhone sin DevTools).
  sb.ppUploadTrace = { inicio: 53, merge: 53, payload: 53, ultimo: 'Remo#1011', http: 'ok', releida: 42, result: 'fail', error: 'enviado 53 pero guardado 42' };
  sb.ppRenderUploadTrace();
  const bar = fakeEls.ppUploadTraceBar && fakeEls.ppUploadTraceBar.innerHTML;
  t('A6 · La traza en pantalla muestra cada paso y el fallo de confirmación',
    bar && bar.indexOf('inicio: <b>53</b>') >= 0 && bar.indexOf('payload: <b>53</b>') >= 0
    && bar.indexOf('releída: <b>42</b>') >= 0 && bar.indexOf('NO confirmado') >= 0);

  console.log('\n==========================================');
  console.log('Resultado: ' + passed + ' pasaron · ' + failed + ' fallaron');
  console.log('==========================================');
  if (failed) {
    console.log('\nFallos:\n' + failures.map(function (f) { return '  ✗ ' + f; }).join('\n'));
    process.exit(1);
  }
  process.exit(0);
})();
