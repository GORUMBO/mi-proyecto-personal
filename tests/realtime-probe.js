// Sonda Realtime REAL contra Supabase (sin token, solo anon key).
// Uso: node tests/_rt-probe.js
const KEY = 'sb_publishable_v3rxA0aQmdf1Ol4vTTQKqQ_xUDl-b4u';
const URL = 'wss://fzkpgrvqncqnmvagbjaf.supabase.co/realtime/v1/websocket?apikey=' + encodeURIComponent(KEY) + '&vsn=1.0.0';

const ws = new WebSocket(URL);
let got = 0;
ws.onopen = function () {
  console.log('socket ABIERTO');
  ['personal_backups', 'peso', 'ejercicios'].forEach(function (tabla) {
    ws.send(JSON.stringify({
      topic: 'realtime:public:' + tabla,
      event: 'phx_join',
      payload: { config: { postgres_changes: [{ event: '*', schema: 'public', table: tabla }] } },
      ref: 'probe_' + tabla
    }));
    console.log('join enviado: realtime:public:' + tabla + ' (sin token, sin filtro)');
  });
};
ws.onmessage = function (ev) {
  try {
    const m = JSON.parse(ev.data);
    console.log('MENSAJE:', JSON.stringify(m).slice(0, 400));
    got++;
  } catch (e) { console.log('raw:', String(ev.data).slice(0, 200)); }
};
ws.onclose = function (ev) { console.log('socket CERRADO code=' + ev.code + ' reason=' + ev.reason); };
ws.onerror = function (ev) { console.log('socket ERROR', ev && ev.message ? ev.message : ''); };
setTimeout(function () {
  console.log('--- resultado: mensajes recibidos: ' + got + ' (sin token, esperado: solo phx_reply de cada join)');
  process.exit(0);
}, 12000);
