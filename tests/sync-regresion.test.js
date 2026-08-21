// ============================================================
// PRUEBAS — Regresion de sincronizacion (puente Cloudflare/Supabase)
// Cubre: save local + sync OK, respuesta HTML inesperada, 401/403/5xx,
// Worker JSON valido, service worker NO intercepta sync, fallo remoto
// NO sobrescribe lo local, y reintento conserva los cambios exactos.
// Uso: node tests/sync-regresion.test.js
// ============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const SW = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');

function extractFunc(name) {
  var src = HTML;
  let i = src.indexOf('async function ' + name + '(');
  if (i < 0) i = src.indexOf('function ' + name + '(');
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
    else if (c === '}') { d--; if (d === 0) return src.slice(i, j + 1); } }
  throw new Error('incompleta: ' + name);
}

let passed = 0, failed = 0;
const failures = [];
function t(name, cond, extra) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; failures.push(name + (extra ? ' → ' + extra : '')); console.log('  ✗ ' + name + (extra ? ' → ' + extra : '')); }
}

// ============================================================
// Sandbox: fetch simulado con registro de llamadas
// ============================================================
const llamadas = [];
let respuestaConfig = { status: 200, ok: true, ct: 'application/json', body: '{}' };
const sandbox = {
  console,
  PP_SYNC: { kind: '', lastError: '', lastHttp: null, writeLog: [] },
  state: { workoutLog: [{ id: 1, exercise: 'Sentadilla', weight: 100 }], profile: {} },
  getCloudConfig: function () { return { url: 'https://xyz.supabase.co', key: 'k' }; },
  refreshCloudSession: function (forzar) { if (forzar) sandbox._refreshForzados = (sandbox._refreshForzados || 0) + 1; return { access_token: 't' }; },
  safeStorage: { get: function (k) { if (k === 'pp_worker_cfg') return sandbox._workerCfg || '{}'; return null; }, set: function () {} },
  renderSyncUI: function () {},
  ppLogErr: function () {},
  normalizeAllWeights: function () {},
  ppWriteOrigen: function () { return 'test'; },
  mergeCloudStates: function (a, b) { return a; },
  fetch: function (url, opts) {
    llamadas.push({ url: String(url), method: (opts && opts.method) || 'GET', body: (opts && opts.body) || null });
    return Promise.resolve({
      status: respuestaConfig.status, ok: respuestaConfig.ok,
      headers: { get: function (h) { return h.toLowerCase() === 'content-type' ? respuestaConfig.ct : null; } },
      text: function () { return Promise.resolve(respuestaConfig.body); }
    });
  }
};
sandbox.window = sandbox;
vm.runInNewContext(
  extractFunc('cloudRest') + '\n' +
  extractFunc('ppRespBloqueada') + '\n' +
  extractFunc('ppWorkerUrl') + '\n' +
  extractFunc('ppWorkerOn') + '\n' +
  extractFunc('setSync'),
  sandbox
);

// ============================================================
// 1 · Save local OK + sync remoto OK
// ============================================================
console.log('== 1 · Sync remoto exitoso ==');
respuestaConfig = { status: 200, ok: true, ct: 'application/json', body: '{"x":1}' };
sandbox._workerCfg = '{}';
sandbox.cloudRest('personal_backups', { method: 'POST', body: '{"data":{}}' }).then(function (r) {
  t('1 · POST directo a Supabase con respuesta JSON se parsea y registra HTTP real',
    r && r.x === 1 && sandbox.PP_SYNC.lastHttp === 200 && llamadas[llamadas.length - 1].url.indexOf('supabase.co/rest/v1/') >= 0);
  return correr();
}).then(function () { finalizar(); }).catch(function (e) { console.log('ERR', e && e.stack); finalizar(); });
function finalizar() {
  console.log('');
  console.log('==========================================');
  console.log('Resultado: ' + passed + ' pasaron · ' + failed + ' fallaron');
  console.log('==========================================');
  if (failed) { console.log('Fallos:'); console.log(failures.join('\n')); process.exit(1); }
  process.exit(0);
}

function correr() {
  var paso = Promise.resolve();
  paso = paso.then(function () {
    console.log('== 2 · HTML inesperado y fallback ==');
    llamadas.length = 0;
    sandbox._workerCfg = JSON.stringify({ url: 'https://mi-proyecto-sync.rubenalanfloo.workers.dev' });
    respuestaConfig = { status: 200, ok: true, ct: 'text/html', body: '<!doctype html><html><body>blocked</body></html>' };
    return sandbox.cloudRest('personal_backups', { method: 'PATCH', body: '{"data":{}}' }).then(function () { return null; }, function (e) { return e; });
  }).then(function (errHtml) {
    t('2 · con puente y HTML: primero workers.dev y luego Supabase directo',
      llamadas.length === 2 && /workers\.dev/.test(llamadas[0].url) && /supabase\.co/.test(llamadas[1].url),
      llamadas.map(function (l) { return l.url.slice(0, 60); }).join(' | '));
    t('2b · el fallback conserva el MISMO cuerpo y metodo (cambios exactos)',
      llamadas[0].body === llamadas[1].body && llamadas[0].method === llamadas[1].method);
    t('2c · si ambos devuelven HTML, error claro con HTTP y tipo reales',
      !!errHtml && /bloquead|interceptad/i.test(errHtml.message) && /HTTP 200/.test(errHtml.message) && /text\/html/.test(errHtml.message),
      errHtml && errHtml.message);
    llamadas.length = 0;
    sandbox.fetch = function (url, opts) {
      llamadas.push({ url: String(url), method: (opts && opts.method) || 'GET', body: (opts && opts.body) || null });
      var ok = llamadas.length >= 2; // el primero (puente) devuelve HTML; el directo responde JSON
      return Promise.resolve({ status: 200, ok: true, headers: { get: function () { return ok ? 'application/json' : 'text/html'; } }, text: function () { return Promise.resolve(ok ? '{"a":1}' : '<html>filtro</html>'); } });
    };
    return sandbox.cloudRest('personal_backups', { method: 'PATCH', body: '{"data":{"workoutLog":[1,2,3]}}' }).then(function (r) {
      t('2d · si el directo responde JSON, el guardado se CONFIRMA sin tocar el puente roto', !!r && llamadas.length === 2);
    });
  });
  paso = paso.then(function () {
    console.log('== 4 · Respuesta valida del Worker ==');
    sandbox.fetch = function (url, opts) {
      llamadas.push({ url: String(url), method: (opts && opts.method) || 'GET', body: (opts && opts.body) || null });
      return Promise.resolve({ status: respuestaConfig.status, ok: respuestaConfig.ok, headers: { get: function () { return respuestaConfig.ct; } }, text: function () { return Promise.resolve(respuestaConfig.body); } });
    };
    llamadas.length = 0;
    respuestaConfig = { status: 200, ok: true, ct: 'application/json', body: '{"workerVersion":"1.187.27","ok":true,"data":{"a":1}}' };
    return sandbox.cloudRest('personal_backups?select=data').then(function (rW) {
      t('4 · el puente JSON valido {ok:true,data} se desempaqueta', rW && rW.a === 1);
      respuestaConfig = { status: 401, ok: false, ct: 'application/json', body: '{"ok":false,"error":"token_invalido"}' };
      return sandbox.cloudRest('personal_backups', { method: 'PATCH', body: '{}' }).then(function () { return null; }, function (e) { return e; });
    }).then(function (errTok) {
      t('4b · error del puente se reporta con su mensaje real', !!errTok && /Puente: token_invalido/.test(errTok.message));
    });
  });
  paso = paso.then(function () {
    console.log('== 3 · 401/403/5xx ==');
    sandbox._workerCfg = '{}';
    llamadas.length = 0; sandbox._refreshForzados = 0;
    respuestaConfig = { status: 401, ok: false, ct: 'application/json', body: '{"error":"token"}' };
    return sandbox.cloudRest('personal_backups', { method: 'POST', body: '{}' }).then(function () { return null; }, function () { return 1; });
  }).then(function () {
    t('3 · 401 fuerza UN refresco de sesion y reintenta una vez',
      sandbox._refreshForzados === 1 && llamadas.length === 2, 'refresh=' + sandbox._refreshForzados + ' llamadas=' + llamadas.length);
    llamadas.length = 0;
    respuestaConfig = { status: 403, ok: false, ct: 'application/json', body: '{"error":"forbidden"}' };
    return sandbox.cloudRest('personal_backups', { method: 'POST', body: '{}' }).then(function () { return null; }, function (e) { return e; });
  }).then(function (err403) {
    t('3b · 403 falla de inmediato sin reintentos', llamadas.length === 1 && !!err403);
    llamadas.length = 0;
    respuestaConfig = { status: 500, ok: false, ct: 'application/json', body: 'err' };
    return sandbox.cloudRest('personal_backups', { method: 'POST', body: '{}' }).then(function () { return null; }, function (e) { return e; });
  }).then(function (err500) {
    t('3c · 5xx falla con el error del servidor', llamadas.length === 1 && !!err500);
  });
  paso = paso.then(function () {
    console.log('== 5 · Service worker y sync ==');
    var iniCond = SW.indexOf('if(/supabase');
    var finCond = SW.indexOf(')return;', iniCond);
    var cond = SW.slice(iniCond + 3, finCond);
    var condFn = new Function('url', 'return ' + cond);
    t('5 · workers.dev pasa directo a la red (nunca se cachea)', condFn('https://mi-proyecto-sync.rubenalanfloo.workers.dev/sync/personal_backups') === true);
    t('5b · Supabase REST pasa directo', condFn('https://xyz.supabase.co/rest/v1/personal_backups') === true);
    t('5c · /sync/ pasa directo', condFn('https://otro-host.com/sync/x') === true);
    t('5d · un asset de la app SI pasa por el SW', condFn('./index.html') === false);
    t('5e · los metodos que no son GET pasan directo (POST/PATCH no se cachean)', SW.indexOf("e.request.method!=='GET'") >= 0);
  });
    paso = paso.then(function () {
    console.log('== 6 · Sin sobrescritura local ==');
    sandbox._localAntes = JSON.stringify(sandbox.state);
    sandbox._workerCfg = JSON.stringify({ url: 'https://mi-proyecto-sync.rubenalanfloo.workers.dev' });
    respuestaConfig = { status: 200, ok: true, ct: 'text/html', body: '<html>filtro</html>' };
    return sandbox.cloudRest('personal_backups', { method: 'PATCH', body: '{}' }).then(function () { return null; }, function () { return 1; });
  }).then(function () {
    t('6 · tras el fallo remoto, el estado local queda intacto', JSON.stringify(sandbox.state) === sandbox._localAntes);
    return sandbox.cloudRest('personal_backups?select=data');
  }).then(function (rNull) {
    t('6b · una LECTURA bloqueada devuelve null (sin datos) y no toca el estado',
      rNull === null && JSON.stringify(sandbox.state) === sandbox._localAntes);
  });
  paso = paso.then(function () {
    console.log('== 7 · Reintento conserva cambios ==');
    sandbox._workerCfg = '{}';
    llamadas.length = 0;
    var intentos = 0;
    sandbox.fetch = function (url, opts) {
      llamadas.push({ url: String(url), method: (opts && opts.method) || 'GET', body: (opts && opts.body) || null });
      intentos++;
      if (intentos === 1) return Promise.resolve({ status: 500, ok: false, headers: { get: function () { return 'application/json'; } }, text: function () { return Promise.resolve('err'); } });
      return Promise.resolve({ status: 200, ok: true, headers: { get: function () { return 'application/json'; } }, text: function () { return Promise.resolve('{"ok":true}'); } });
    };
    var cuerpo = '{"data":{"workoutLog":[{"id":9,"exercise":"Zancadas"}]}}';
    return sandbox.cloudRest('personal_backups', { method: 'POST', body: cuerpo }).then(function () { return null; }, function () { return 1; });
  }).then(function () {
    var cuerpo = '{"data":{"workoutLog":[{"id":9,"exercise":"Zancadas"}]}}';
    return sandbox.cloudRest('personal_backups', { method: 'POST', body: cuerpo }).then(function (r2) {
      t('7 · el reintento envia exactamente el MISMO cuerpo y se confirma', r2 && llamadas[0].body === llamadas[1].body && llamadas[0].body === cuerpo);
    });
  });
return paso;
}

