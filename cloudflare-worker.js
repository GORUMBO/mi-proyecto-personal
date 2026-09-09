// ============================================================
// Mi Proyecto Personal — puente Cloudflare Worker → Supabase
// - Reenvía solo las rutas que la app necesita (9 tablas + refresh de sesión).
// - El JWT del usuario llega en Authorization: Bearer y se reenvía TAL CUAL:
//   la autorización real la hace RLS en Supabase (auth.uid() = user_id).
// - NUNCA usa service_role ni contiene secretos privados.
// - Responde SIEMPRE JSON.
// ============================================================

const SUPABASE_URL = 'https://fzkpgrvqncqnmvagbjaf.supabase.co';
const SUPABASE_ANON = 'sb_publishable_v3rxA0aQmdf1Ol4vTTQKqQ_xUDl-b4u'; // llave pública (anon), no es secreto

const TABLAS = new Set(['personal_backups','peso','ejercicios','comidas','calorias','proteina','pasos','gastos','ajustes','telegram_inbox']);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization,apikey,Content-Type,Prefer',
  'Access-Control-Max-Age': '86400',
};

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, CORS_HEADERS),
  });
}
// v1.187.27: versión del Worker visible en TODAS las respuestas (verificable
// desde fuera sin token).
const WORKER_VERSION = '1.187.27';
function jsonV(data, status) {
  return json(Object.assign({ workerVersion: WORKER_VERSION }, data), status);
}

// Decodifica el JWT SOLO para validar exp/sub (la firma la valida Supabase).
function decodeJwt(token) {
  try {
    var part = token.split('.')[1];
    var bin = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, function (c) { return c.charCodeAt(0); })));
  } catch (e) { return null; }
}

async function proxyAuth(request, supabasePath) {
  var auth = request.headers.get('Authorization') || '';
  var token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return jsonV({ ok: false, error: 'sin_sesion' }, 401);
  try {
    var bodyText = await request.text();
    var upstream = await fetch(SUPABASE_URL + supabasePath, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: 'Bearer ' + token,
        'Content-Type': request.headers.get('Content-Type') || 'application/json',
      },
      body: bodyText,
    });
    var text = await upstream.text();
    var ct = (upstream.headers.get('content-type') || '').toLowerCase();
    if (ct.indexOf('application/json') < 0) return jsonV({ ok: false, error: 'respuesta_invalida', status: upstream.status }, 502);
    var data = null;
    try { data = JSON.parse(text); } catch (e) { return jsonV({ ok: false, error: 'respuesta_invalida', status: upstream.status }, 502); }
    return jsonV({ ok: upstream.ok, status: upstream.status, data });
  } catch (e) {
    return jsonV({ ok: false, error: 'supabase_inaccesible' }, 502);
  }
}

/* ===== TELEGRAM (entrada rápida, SOLO chat autorizado) =====
   Seguridad mínima:
   - Webhook valida X-Telegram-Bot-Api-Secret-Token (Cloudflare Secret) y que
     el chat_id sea exactamente TG_ALLOWED_CHAT (Cloudflare Secret).
   - El bot escribe en telegram_inbox con un JWT de rol `telegram_bot`
     (firmado aquí con TG_JWT_SECRET, el MISMO secreto custom agregado en
     Supabase → JWT Settings). RLS: auth.uid()=user_id en TODO momento.
   - NUNCA usa service_role. Ningún token se registra ni se expone.
   - El bot SOLO crea entradas pendientes; nunca toca Nevera ni Gastos. */
function b64url(buf) {
  var s = '';
  var bytes = new Uint8Array(buf);
  for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function firmarTgJwt(env) {
  var header = b64url(new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  var ahora = Math.floor(Date.now() / 1000);
  var payload = b64url(new TextEncoder().encode(JSON.stringify({ sub: env.OWNER_USER_ID, role: 'telegram_bot', iat: ahora, exp: ahora + 300 })));
  var key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.TG_JWT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  var firma = b64url(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(header + '.' + payload)));
  return header + '.' + payload + '.' + firma;
}
function tgEnvOk(env) {
  return env && env.BOT_TOKEN && env.TG_WEBHOOK_SECRET && env.TG_ALLOWED_CHAT && env.OWNER_USER_ID && env.TG_JWT_SECRET;
}
async function handleTelegramWebhook(request, env) {
  try {
    if (!tgEnvOk(env)) return jsonV({ ok: false, error: 'telegram_no_configurado' }, 503);
    if (request.method !== 'POST') return jsonV({ ok: false, error: 'metodo_no_permitido' }, 405);
    // 1) Secret del webhook (evita llamadas de cualquiera que conozca la URL).
    var secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '';
    if (secret !== env.TG_WEBHOOK_SECRET) return jsonV({ ok: false, error: 'no_autorizado' }, 401);
    var update = null;
    try { update = await request.json(); } catch (e) { return jsonV({ ok: false, error: 'body_invalido' }, 400); }
    var msg = update && update.message;
    var chatId = msg && msg.chat && String(msg.chat.id);
    // 2) Solo el chat autorizado (un solo número, configurado como Secret).
    if (!chatId || chatId !== String(env.TG_ALLOWED_CHAT)) return jsonV({ ok: false, error: 'chat_no_autorizado' }, 403);

    var texto = String(msg.text || msg.caption || '').trim();
    var foto = null;
    if (msg.photo && msg.photo.length) foto = msg.photo[msg.photo.length - 1]; // la más grande

    var tipo = foto ? 'ticket' : (/^\/lista\b|^\s*agrega\b/i.test(texto) ? 'lista' : (/comp(?:r[ée]|re)\b|^\/nevera\b/i.test(texto) ? 'nevera' : 'comida'));
    var imagenUrl = null;

    if (foto) {
      // 3) Descargar la imagen (token del bot SOLO aquí, nunca se expone).
      var fileRes = await fetch('https://api.telegram.org/bot' + env.BOT_TOKEN + '/getFile?file_id=' + encodeURIComponent(foto.file_id));
      var fileJson = await fileRes.json();
      var filePath = fileJson && fileJson.result && fileJson.result.file_path;
      if (!filePath) return jsonV({ ok: false, error: 'archivo_no_encontrado' }, 502);
      var imgRes = await fetch('https://api.telegram.org/file/bot' + env.BOT_TOKEN + '/' + filePath);
      var imgBytes = await imgRes.arrayBuffer();
      if (!imgRes.ok || !imgBytes.byteLength) return jsonV({ ok: false, error: 'descarga_fallo' }, 502);
      // 4) Subir a la carpeta del usuario (misma política de RLS por carpeta).
      var ext = (filePath.match(/\.(\w+)$/) || [0, 'jpg'])[1];
      var nombre = env.OWNER_USER_ID + '/telegram/' + Date.now() + '.' + ext;
      var jwt = await firmarTgJwt(env);
      var upRes = await fetch(SUPABASE_URL + '/storage/v1/object/personal-media/' + encodeURIComponent(nombre), {
        method: 'POST',
        headers: { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + jwt, 'Content-Type': 'image/jpeg', 'x-upsert': 'false' },
        body: imgBytes
      });
      if (!upRes.ok) return jsonV({ ok: false, error: 'storage_rechazo', status: upRes.status }, 502);
      imagenUrl = nombre;
    }
    if (!foto && !texto) return jsonV({ ok: false, error: 'sin_contenido' }, 400);
    // 5) Insertar SOLO en telegram_inbox (rol telegram_bot, RLS por user_id).
    var jwt2 = await firmarTgJwt(env);
    var insRes = await fetch(SUPABASE_URL + '/rest/v1/telegram_inbox', {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + jwt2, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ user_id: env.OWNER_USER_ID, chat_id: chatId, tipo: tipo, texto: texto || null, imagen_url: imagenUrl, estado: 'pendiente' })
    });
    if (!insRes.ok) return jsonV({ ok: false, error: 'buzon_rechazo', status: insRes.status }, 502);

    // 6) Respuesta corta al usuario (sin afirmar conteos que aún no existen).
    var resp = foto
      ? '🧾 Ticket recibido. Lo leo y lo dejo pendiente para que lo revises en tu app.'
      : (tipo === 'lista' ? '🛒 Recibido. Lo agrego a tu lista de compras y te confirmo en un momento.'
        : (tipo === 'nevera' ? '🧊 Recibido. Lo dejo pendiente para confirmar en tu app.'
          : '📝 Recibido, pero todavía no entiendo comidas por texto.'));
    await fetch('https://api.telegram.org/bot' + env.BOT_TOKEN + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: resp })
    });
    return jsonV({ ok: true, tipo: tipo, imagen: !!imagenUrl });
  } catch (e) {
    return jsonV({ ok: false, error: 'telegram_error' }, 500);
  }
}
async function handleTelegramNotify(request, env) {
  try {
    if (!tgEnvOk(env)) return jsonV({ ok: false, error: 'telegram_no_configurado' }, 503);
    if (request.method !== 'POST') return jsonV({ ok: false, error: 'metodo_no_permitido' }, 405);
    // La app notifica con su SESIÓN normal: solo el dueño puede responder por el bot.
    var auth = request.headers.get('Authorization') || '';
    var token = auth.replace(/^Bearer\s+/i, '');
    var claims = decodeJwt(token);
    if (!claims || !claims.sub) return jsonV({ ok: false, error: 'sin_sesion' }, 401);
    if (claims.exp && Date.now() / 1000 > claims.exp) return jsonV({ ok: false, error: 'sesion_caducada' }, 401);
    if (String(claims.sub) !== String(env.OWNER_USER_ID)) return jsonV({ ok: false, error: 'no_autorizado' }, 403);
    var body = null;
    try { body = await request.json(); } catch (e) { return jsonV({ ok: false, error: 'body_invalido' }, 400); }
    var texto = String((body && body.text) || '').slice(0, 400);
    if (!texto) return jsonV({ ok: false, error: 'sin_texto' }, 400);
    var send = await fetch('https://api.telegram.org/bot' + env.BOT_TOKEN + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TG_ALLOWED_CHAT, text: texto })
    });
    return jsonV({ ok: send.ok });
  } catch (e) {
    return jsonV({ ok: false, error: 'telegram_error' }, 500);
  }
}

async function handleRequest(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });

  var url = new URL(request.url);
  var path = url.pathname;

  // 1) Renovación de sesión (para que el refresh tampoco pase por Canopy).
  if (path === '/auth/refresh') return proxyAuth(request, '/auth/v1/token?grant_type=refresh_token');

  // 1b) Telegram: webhook del bot y envío de respuestas desde la app.
  if (path === '/telegram/webhook') return handleTelegramWebhook(request, env);
  if (path === '/telegram/notify') return handleTelegramNotify(request, env);

  // 2) Solo rutas de datos permitidas: /sync/<tabla>
  var m = path.match(/^\/sync\/([a-z_]+)$/);
  if (!m || !TABLAS.has(m[1])) return jsonV({ ok: false, error: 'ruta_no_permitida', ruta: path }, 403);
  var tabla = m[1];

  // 3) JWT obligatorio.
  var auth = request.headers.get('Authorization') || '';
  var token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return jsonV({ ok: false, error: 'sin_sesion' }, 401);
  var claims = decodeJwt(token);
  if (!claims || !claims.sub) return jsonV({ ok: false, error: 'token_invalido' }, 401);
  if (claims.exp && Date.now() / 1000 > claims.exp) return jsonV({ ok: false, error: 'sesion_caducada' }, 401);

  // 4) Solo GET, POST y PATCH (v1.187.27: PATCH para escrituras del puente).
  var method = request.method.toUpperCase();
  if (method !== 'GET' && method !== 'POST' && method !== 'PATCH') return jsonV({ ok: false, error: 'metodo_no_permitido', metodo: method }, 405);

  // 5) Escrituras en personal_backups: el user_id del body debe ser el MISMO
  //    del JWT (defensa en profundidad; RLS decide al final).
  var body = null;
  if (method === 'POST' || method === 'PATCH') {
    try { body = await request.text(); } catch (e) { return jsonV({ ok: false, error: 'body_ilegible' }, 400); }
    if (tabla === 'personal_backups') {
      try {
        var parsed = JSON.parse(body);
        var filas = Array.isArray(parsed) ? parsed : [parsed];
        for (var i = 0; i < filas.length; i++) {
          if (filas[i].user_id && filas[i].user_id !== claims.sub) {
            return jsonV({ ok: false, error: 'user_id_no_coincide_con_la_sesion' }, 403);
          }
        }
      } catch (e) { return jsonV({ ok: false, error: 'body_json_invalido' }, 400); }
    }
  }

  // 6) Reenviar a Supabase (el origen es Cloudflare: Canopy ya no está en el camino).
  //    Quitar parámetros que PostgREST rechazaría (p. ej. ts de anti-caché).
  var q = url.search.replace(/[?&]ts=[^&]*/g, '');
  var supabaseUrl = SUPABASE_URL + '/rest/v1/' + tabla + q;
  var headers = {
    apikey: SUPABASE_ANON,
    Authorization: 'Bearer ' + token,
    'Content-Type': 'application/json',
  };
  var prefer = request.headers.get('Prefer');
  if (prefer) headers.Prefer = prefer;

  var upstream, text = null, ct = null, metodoUsado = method, queryUpstream = q;
  try {
    if (tabla === 'personal_backups' && (method === 'POST' || method === 'PATCH')) {
      // v1.187.24/27: para personal_backups usar PATCH filtrado estrictamente por
      // user_id = sub del JWT (UPDATE directo vía RLS), enviando SOLO data y
      // updated_at. El upsert POST desde Cloudflare no aplicaba cambios.
      var bObj = JSON.parse(body);
      delete bObj.user_id;
      var patchBody = JSON.stringify(bObj);
      queryUpstream = '?user_id=eq.' + encodeURIComponent(claims.sub);
      // PATCH SOLO con return=representation (resolution=merge-duplicates es
      // exclusivo de POST y no debe acompañar al PATCH).
      var patchHeaders = Object.assign({}, headers, { Prefer: 'return=representation' });
      upstream = await fetch(SUPABASE_URL + '/rest/v1/personal_backups' + queryUpstream, { method: 'PATCH', headers: patchHeaders, body: patchBody });
      text = await upstream.text();
      ct = (upstream.headers.get('content-type') || '').toLowerCase();
      var patchData = null; try { patchData = JSON.parse(text); } catch (e) {}
      var patchRows = Array.isArray(patchData) ? patchData : (patchData ? [patchData] : []);
      metodoUsado = 'PATCH';
      if (patchRows.length === 0) {
        // La fila no existe todavía: crearla con el upsert de siempre.
        metodoUsado = 'POST';
        upstream = await fetch(supabaseUrl, { method: 'POST', headers: headers, body: body || undefined });
        text = null; ct = null;
      }
    } else {
      upstream = await fetch(supabaseUrl, { method: method, headers: headers, body: body || undefined });
    }
  } catch (e) {
    return jsonV({ ok: false, error: 'supabase_inaccesible' }, 502);
  }

  if (text === null) text = await upstream.text();
  if (ct === null) ct = (upstream.headers.get('content-type') || '').toLowerCase();

  // 7) La respuesta de Supabase DEBE ser JSON (si llega HTML: filtro/portal → error claro).
  if (ct.indexOf('application/json') < 0) {
    return jsonV({ ok: false, error: 'respuesta_invalida_de_supabase', status: upstream.status, contentType: ct }, 502);
  }
  var data = null;
  try { data = JSON.parse(text); } catch (e) {
    return jsonV({ ok: false, error: 'respuesta_invalida_de_supabase', status: upstream.status }, 502);
  }

  if (!upstream.ok) {
    return jsonV({ ok: false, error: 'supabase_error', status: upstream.status, data }, upstream.status < 500 ? 400 : 502);
  }

  // 8) Éxito: para personal_backups, confirmar el conteo real de workoutLog.
  //    Diagnóstico de identidad: sub del JWT y user_id de la fila devuelta.
  var rows = Array.isArray(data) ? data : [data];
  var workoutLogCount = null, updatedAt = null, rowUserId = null;
  if (rows.length && rows[0]) rowUserId = rows[0].user_id || null;
  if (tabla === 'personal_backups' && rows.length && rows[0] && rows[0].data) {
    workoutLogCount = (rows[0].data.workoutLog || []).length;
    updatedAt = rows[0].updated_at || null;
  }
  // v1.187.22: diagnóstico crudo del reenvío (sin secretos) para localizar
  // por qué el upsert responde 200 pero la fila no cambia.
  var diag = {
    queryRecibido: url.search,
    queryEnviado: queryUpstream,
    metodo: metodoUsado,
    preferRecibido: prefer || null,
    bodyBytes: body ? body.length : 0,
    upstreamStatus: upstream.status,
    upstreamCT: ct,
    upstreamText: text.slice(0, 300)
  };
  return jsonV({ ok: true, status: upstream.status, workoutLogCount: workoutLogCount, updatedAt: updatedAt, sub: claims.sub, rowUserId: rowUserId, data: data, diag: diag });
}

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request);
  },
};
