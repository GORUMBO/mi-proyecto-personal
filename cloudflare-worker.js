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

const TABLAS = new Set(['personal_backups','peso','ejercicios','comidas','calorias','proteina','pasos','gastos','ajustes']);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization,apikey,Content-Type,Prefer',
  'Access-Control-Max-Age': '86400',
};

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, CORS_HEADERS),
  });
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
  if (!token) return json({ ok: false, error: 'sin_sesion' }, 401);
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
    if (ct.indexOf('application/json') < 0) return json({ ok: false, error: 'respuesta_invalida', status: upstream.status }, 502);
    var data = null;
    try { data = JSON.parse(text); } catch (e) { return json({ ok: false, error: 'respuesta_invalida', status: upstream.status }, 502); }
    return json({ ok: upstream.ok, status: upstream.status, data });
  } catch (e) {
    return json({ ok: false, error: 'supabase_inaccesible' }, 502);
  }
}

async function handleRequest(request) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });

  var url = new URL(request.url);
  var path = url.pathname;

  // 1) Renovación de sesión (para que el refresh tampoco pase por Canopy).
  if (path === '/auth/refresh') return proxyAuth(request, '/auth/v1/token?grant_type=refresh_token');

  // 2) Solo rutas de datos permitidas: /sync/<tabla>
  var m = path.match(/^\/sync\/([a-z_]+)$/);
  if (!m || !TABLAS.has(m[1])) return json({ ok: false, error: 'ruta_no_permitida', ruta: path }, 403);
  var tabla = m[1];

  // 3) JWT obligatorio.
  var auth = request.headers.get('Authorization') || '';
  var token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return json({ ok: false, error: 'sin_sesion' }, 401);
  var claims = decodeJwt(token);
  if (!claims || !claims.sub) return json({ ok: false, error: 'token_invalido' }, 401);
  if (claims.exp && Date.now() / 1000 > claims.exp) return json({ ok: false, error: 'sesion_caducada' }, 401);

  // 4) Solo GET y POST.
  var method = request.method.toUpperCase();
  if (method !== 'GET' && method !== 'POST') return json({ ok: false, error: 'metodo_no_permitido', metodo: method }, 405);

  // 5) Escrituras en personal_backups: el user_id del body debe ser el MISMO
  //    del JWT (defensa en profundidad; RLS decide al final).
  var body = null;
  if (method === 'POST') {
    try { body = await request.text(); } catch (e) { return json({ ok: false, error: 'body_ilegible' }, 400); }
    if (tabla === 'personal_backups') {
      try {
        var parsed = JSON.parse(body);
        var filas = Array.isArray(parsed) ? parsed : [parsed];
        for (var i = 0; i < filas.length; i++) {
          if (filas[i].user_id && filas[i].user_id !== claims.sub) {
            return json({ ok: false, error: 'user_id_no_coincide_con_la_sesion' }, 403);
          }
        }
      } catch (e) { return json({ ok: false, error: 'body_json_invalido' }, 400); }
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

  var upstream;
  try {
    upstream = await fetch(supabaseUrl, { method: method, headers: headers, body: body || undefined });
  } catch (e) {
    return json({ ok: false, error: 'supabase_inaccesible' }, 502);
  }

  var text = await upstream.text();
  var ct = (upstream.headers.get('content-type') || '').toLowerCase();

  // 7) La respuesta de Supabase DEBE ser JSON (si llega HTML: filtro/portal → error claro).
  if (ct.indexOf('application/json') < 0) {
    return json({ ok: false, error: 'respuesta_invalida_de_supabase', status: upstream.status, contentType: ct }, 502);
  }
  var data = null;
  try { data = JSON.parse(text); } catch (e) {
    return json({ ok: false, error: 'respuesta_invalida_de_supabase', status: upstream.status }, 502);
  }

  if (!upstream.ok) {
    return json({ ok: false, error: 'supabase_error', status: upstream.status, data }, upstream.status < 500 ? 400 : 502);
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
    queryEnviado: q,
    metodo: method,
    preferRecibido: prefer || null,
    bodyBytes: body ? body.length : 0,
    upstreamStatus: upstream.status,
    upstreamCT: ct,
    upstreamText: text.slice(0, 300)
  };
  return json({ ok: true, status: upstream.status, workoutLogCount: workoutLogCount, updatedAt: updatedAt, sub: claims.sub, rowUserId: rowUserId, data: data, diag: diag });
}

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request);
  },
};
