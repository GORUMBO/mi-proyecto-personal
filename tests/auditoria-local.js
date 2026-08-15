// ============================================================
// AUDITORÍA LOCAL DE SUPABASE (corre en tu computadora, sin mostrar el token)
// Lee la sesión de ./session-token.txt (gitignored), consulta la fila REAL
// de personal_backups con RLS y hace una prueba de escritura CONTROLADA
// (re-envía el MISMO contenido de la fila; solo cambia updated_at).
// Uso: node tests/auditoria-local.js
// ============================================================
const fs = require('fs');
const path = require('path');

const TOKEN_FILE = path.join(__dirname, '..', 'session-token.txt');
const C = { url: 'https://fzkpgrvqncqnmvagbjaf.supabase.co', key: 'sb_publishable_v3rxA0aQmdf1Ol4vTTQKqQ_xUDl-b4u' };

function log(x) { console.log(x); }

(async function () {
  let sess;
  try {
    // Bloc de notas guarda con BOM UTF-8: quitarlo antes de parsear.
    sess = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8').replace(/^﻿/, ''));
  } catch (e) {
    log('✘ No se pudo leer session-token.txt: ' + e.message);
    process.exit(1);
  }
  if (!sess || !sess.access_token) { log('✘ session-token.txt no tiene access_token'); process.exit(1); }
  const J = sess.access_token;
  // NUNCA imprimir el token.
  log('🔑 Sesión: ' + (sess.user && sess.user.email) + ' · user_id: ' + (sess.user && sess.user.id));

  async function R(p, opts) {
    const r = await fetch(C.url + '/rest/v1/' + p, Object.assign({ headers: { apikey: C.key, Authorization: 'Bearer ' + J } }, opts || {}));
    const t = await r.text();
    return { status: r.status, body: t };
  }

  log('\n=== 1) AUDITORÍA SOLO LECTURA ===');
  const all = await R('personal_backups?select=user_id,updated_at,data');
  log('personal_backups (todas las filas visibles) · HTTP ' + all.status);
  let rows = [];
  try { rows = JSON.parse(all.body); } catch (e) { log('   (respuesta no-JSON: ' + all.body.slice(0, 200) + ')'); }
  if (Array.isArray(rows)) {
    log('FILAS VISIBLES: ' + rows.length);
    rows.forEach(function (f, i) {
      const wl = (f.data && f.data.workoutLog) || [];
      const last = wl.length ? wl[wl.length - 1] : null;
      log('   fila ' + (i + 1) + ' · user_id: ' + f.user_id + ' · updated_at: ' + f.updated_at + ' · workoutLog: ' + wl.length
        + (last ? ' · último: ' + last.exercise + '#' + last.id + ' · fecha: ' + (last.localDate || last.date || '') : ''));
    });
  }

  // La MISMA consulta filtrada que usa la app (cloudStartupSync/cloudLoad).
  const filt = await R('personal_backups?user_id=eq.' + encodeURIComponent(sess.user.id) + '&select=data,updated_at');
  let fRows = [];
  try { fRows = JSON.parse(filt.body); } catch (e) {}
  const fwl = (fRows[0] && fRows[0].data && fRows[0].data.workoutLog) || [];
  log('SELECT filtrado (como la app): filas=' + fRows.length + ' · workoutLog: ' + fwl.length);

  const peso = await R('peso?user_id=eq.' + encodeURIComponent(sess.user.id) + '&deleted=is.false&select=client_id,updated_at');
  let pRows = []; try { pRows = JSON.parse(peso.body); } catch (e) {}
  log('peso (granular, filtrado): ' + pRows.length + ' filas');

  const ej = await R('ejercicios?user_id=eq.' + encodeURIComponent(sess.user.id) + '&select=client_id,data,updated_at&order=updated_at.desc&limit=5');
  let eRows = []; try { eRows = JSON.parse(ej.body); } catch (e) {}
  log('ejercicios (últimas 5): ' + eRows.length);
  eRows.forEach(function (r) {
    log('   · ' + r.client_id + ' · ' + ((r.data && r.data.exercise) || '(sin exercise)') + ' · ' + r.updated_at);
  });

  if (rows.length === 1 && rows[0].data && rows[0].data.workoutLog && rows[0].data.workoutLog.length >= 42) {
    log('\n=== 2) PRUEBA DE ESCRITURA CONTROLADA (mismo contenido; solo cambia updated_at) ===');
    const unica = rows[0];
    const antes = (unica.data.workoutLog || []).length;
    log('antes del upsert: workoutLog ' + antes);
    const send = await R('personal_backups?on_conflict=user_id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({ user_id: sess.user.id, data: unica.data, updated_at: new Date().toISOString() })
    });
    log('respuesta del upsert: HTTP ' + send.status);
    try {
      const respRows = JSON.parse(send.body);
      const respArr = Array.isArray(respRows) ? respRows : [respRows];
      respArr.forEach(function (r) {
        log('   fila devuelta por el upsert · user_id: ' + r.user_id + ' · workoutLog: ' + (((r.data && r.data.workoutLog) || [])).length);
      });
    } catch (e) { log('   (respuesta no-JSON: ' + send.body.slice(0, 300) + ')'); }
    const after = await R('personal_backups?select=user_id,updated_at,data');
    let aRows = []; try { aRows = JSON.parse(after.body); } catch (e) {}
    aRows.forEach(function (f, i) {
      log('después del upsert · fila ' + (i + 1) + ' · workoutLog: ' + (((f.data && f.data.workoutLog) || [])).length);
    });
  }

  log('\n🏁 FIN DE LA AUDITORÍA');
  process.exit(0);
})();
