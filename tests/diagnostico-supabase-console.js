// ============================================================
// AUDITORÍA DE LA FILA REAL DE SUPABASE (se pega en la consola)
// Uso: abre la app en Chrome, inicia sesión, F12 > Console, pega TODO.
// NO borra ni sobrescribe nada: solo LEE. Devuelve:
//  - sesión (email + user_id),
//  - TODAS las filas visibles de personal_backups para tu usuario
//    (RLS solo muestra las tuyas): cuántas filas hay, user_id, fecha y
//    cuántos workoutLog tiene CADA una (si hay más de una fila, esa es
//    la causa de "subo 53 pero leo 42": se escribe en una y se lee otra),
//  - conteo de ejercicios granulares.
// Para una prueba de escritura controlada (NO destructiva: re-envía el
// MISMO contenido que ya tiene la fila), cambia TEST_ESCRITURA a true.
// ============================================================
(async function () {
  var TEST_ESCRITURA = false; // ← ponlo en true SOLO para la prueba controlada
  var c = { url: 'https://fzkpgrvqncqnmvagbjaf.supabase.co', key: 'sb_publishable_v3rxA0aQmdf1Ol4vTTQKqQ_xUDl-b4u' };
  var out = [];
  function log(x) { out.push(x); console.log(x); }
  var s = JSON.parse(localStorage.getItem('pp_cloud_session') || 'null');
  if (!s || !s.access_token) { log('NO hay sesión en este navegador. Inicia sesión en la app primero.'); return; }
  log('🔑 Sesión: ' + (s.user && s.user.email) + ' · user_id: ' + (s.user && s.user.id));
  var J = s.access_token;
  function R(p, opts) {
    return fetch(c.url + '/rest/v1/' + p, Object.assign({ headers: { apikey: c.key, Authorization: 'Bearer ' + J } }, opts || {}))
      .then(function (r) { return r.text().then(function (t) { return { status: r.status, body: t }; }); });
  }
  // 1) TODAS las filas visibles de personal_backups (sin filtro → RLS limita a las tuyas).
  // IMPORTANTE: pedir TAMBIÉN la columna 'data' (sin ella, workoutLog sale 0).
  var rows = await R('personal_backups?select=user_id,updated_at,data');
  log('☁️ personal_backups · HTTP ' + rows.status + ' · cuerpo: ' + rows.body.slice(0, 300));
  try {
    var lista = JSON.parse(rows.body);
    if (Array.isArray(lista)) {
      log('☁️ FILAS VISIBLES: ' + lista.length);
      for (var i = 0; i < lista.length; i++) {
        var f = lista[i];
        var wl = (f.data && f.data.workoutLog) || [];
        log('   fila ' + (i + 1) + ' · user_id: ' + f.user_id + ' · updated_at: ' + f.updated_at + ' · workoutLog: ' + wl.length
          + (wl.length ? ' · último: ' + wl[wl.length - 1].exercise + '#' + wl[wl.length - 1].id : ''));
      }
      if (lista.length > 1) log('⚠️ HAY MÁS DE UNA FILA → se escribe en una y se lee otra.');
    }
  } catch (e) { log('   (no se pudo parsear: ' + e.message + ')'); }
  // 2) Tabla granular de ejercicios.
  var ej = await R('ejercicios?select=client_id,updated_at&order=updated_at.desc&limit=5');
  try {
    var ejLista = JSON.parse(ej.body);
    log('💪 ejercicios · últimas ' + (Array.isArray(ejLista) ? ejLista.length : 0) + ' filas: ' + ej.body.slice(0, 600));
  } catch (e) { log('💪 ejercicios · HTTP ' + ej.status + ' · ' + ej.body.slice(0, 200)); }
  // 3) Prueba de escritura controlada (opcional, NO destructiva).
  if (TEST_ESCRITURA && Array.isArray(lista) && lista.length === 1) {
    var unica = lista[0];
    log('🧪 Prueba controlada: re-enviando el MISMO contenido de la fila (nada cambia).');
    var before = (unica.data && unica.data.workoutLog) || [];
    var send = await R('personal_backups?on_conflict=user_id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({ user_id: s.user.id, data: unica.data, updated_at: new Date().toISOString() })
    });
    log('🧪 Respuesta del upsert: HTTP ' + send.status + ' · ' + send.body.slice(0, 400));
    var after = await R('personal_backups?select=user_id,updated_at,data');
    try {
      var afterLista = JSON.parse(after.body);
      log('🧪 FILAS tras el upsert: ' + afterLista.length);
      afterLista.forEach(function (f, i) {
        log('   fila ' + (i + 1) + ' · workoutLog: ' + (((f.data && f.data.workoutLog) || [])).length);
      });
    } catch (e) { log('🧪 (no se pudo parsear: ' + e.message + ')'); }
  }
  log('🏁 FIN DE LA AUDITORÍA');
  console.log(out.join('\n'));
})();
