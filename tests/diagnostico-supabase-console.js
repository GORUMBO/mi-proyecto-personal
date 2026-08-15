// ============================================================
// DIAGNÓSTICO SUPABASE CON EVIDENCIA REAL (se pega en la consola)
// Uso: abre la app en Chrome (https://gorumbo.github.io/mi-proyecto-personal/),
// inicia sesión, abre DevTools (F12) > Console, pega TODO este archivo y Enter.
// Devuelve: sesión (email + user_id), fila real de personal_backups,
// últimas filas de ejercicios y una sonda Realtime de 60 s con tu token real.
// NO escribe, NO borra, NO modifica nada: solo lee y escucha.
// ============================================================
(async function () {
  const c = { url: 'https://fzkpgrvqncqnmvagbjaf.supabase.co', key: 'sb_publishable_v3rxA0aQmdf1Ol4vTTQKqQ_xUDl-b4u' };
  const out = [];
  const log = function (x) { out.push(x); console.log(x); };
  const s = JSON.parse(localStorage.getItem('pp_cloud_session') || 'null');
  if (!s || !s.access_token) { log('NO hay sesión en este navegador. Inicia sesión en la app primero.'); return; }
  log('🔑 Sesión: ' + (s.user && s.user.email) + ' · user_id: ' + (s.user && s.user.id));
  const J = s.access_token;
  const R = async function (p) {
    const r = await fetch(c.url + '/rest/v1/' + p, { headers: { apikey: c.key, Authorization: 'Bearer ' + J } });
    return r.text();
  };
  const b = await R('personal_backups?select=user_id,updated_at');
  log('☁️ personal_backups (tu fila): HTTP → ' + b.slice(0, 300));
  const wl = await R('personal_backups?select=data->workoutLog');
  log('☁️ workoutLog en tu respaldo (últimos 2000 chars): ' + wl.slice(0, 2000));
  // Los 4 ÚLTIMOS registros del respaldo (¿está el ejercicio nuevo?):
  try {
    const parsed = JSON.parse(wl);
    const list = parsed && parsed[0] && parsed[0].workoutLog;
    if (Array.isArray(list)) {
      log('☁️ Total workoutLog en la nube: ' + list.length);
      list.slice(-4).forEach(function (x, i) {
        log('   #' + (list.length - 4 + i + 1) + ' · ' + x.exercise + ' · id ' + x.id + ' · fecha ' + (x.localDate || x.date || '') + ' · reps ' + (x.reps || '') + ' · peso ' + (x.weight || 0));
      });
    }
  } catch (e) { log('   (no se pudo parsear workoutLog: ' + e.message + ')'); }
  const ej = await R('ejercicios?select=user_id,client_id,updated_at&order=updated_at.desc&limit=5');
  log('💪 ejercicios (últimas 5 filas): ' + ej.slice(0, 1500));
  log('📡 Sonda Realtime 60 s con TU token. AHORA registra un ejercicio de prueba en el iPhone.');
  const ws = new WebSocket(c.url.replace(/^https/, 'wss') + '/realtime/v1/websocket?apikey=' + encodeURIComponent(c.key) + '&vsn=1.0.0');
  let n = 0;
  ws.onopen = function () {
    ['personal_backups', 'ejercicios'].forEach(function (t, i) {
      ws.send(JSON.stringify({
        topic: 'realtime:public:' + t + ':user_id=eq.' + s.user.id,
        event: 'phx_join',
        payload: { config: { postgres_changes: [{ event: '*', schema: 'public', table: t, filter: 'user_id=eq.' + s.user.id }] }, access_token: J },
        ref: 'diag_' + i
      }));
    });
  };
  ws.onmessage = function (ev) { n++; log('📡 ' + String(ev.data).slice(0, 400)); };
  setTimeout(function () { log('🏁 RESULTADO SONDA: ' + n + ' mensajes en 60 s.'); console.log(out.join('\n')); }, 60000);
})();
