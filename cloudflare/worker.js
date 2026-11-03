// Hafize — Cloudflare Worker girişi.
//
// Arayüz dosyaları (public/) Cloudflare'in statik varlık deposundan sunulur; bu betik yalnızca
// /api/* isteklerinde çalışır (wrangler.jsonc → assets.run_worker_first). Hafize'nin sohbet,
// hafıza ve ajan uçları Node sunucusunda (server.ts) yaşar ve Workers'ta çalışmaz. Bu yüzden
// /api istekleri HAFIZE_API_ORIGIN değişkeninde yazan sunucuya olduğu gibi iletilir. Değişken
// boşsa açık bir 503 yanıtı döner; arayüz yine açılır, yalnızca sunucu gerektiren özellikler
// çalışmaz.

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8'
};

function json(status, payload) {
  return new Response(JSON.stringify(payload), { status, headers: SECURITY_HEADERS });
}

function apiOrigin(env) {
  const raw = String(env.HAFIZE_API_ORIGIN || '').trim().replace(/\/+$/, '');
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.origin : null;
  } catch {
    return null;
  }
}

async function proxyApi(request, env, url) {
  const origin = apiOrigin(env);
  if (!origin) {
    return json(503, {
      error: 'API_NOT_CONFIGURED',
      message: 'Hafize sunucusu bu yayına henüz bağlanmadı (HAFIZE_API_ORIGIN boş).'
    });
  }
  if (origin === url.origin) return json(508, { error: 'API_PROXY_LOOP' });

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.set('X-Forwarded-Host', url.host);
  headers.set('X-Forwarded-Proto', url.protocol.replace(':', ''));
  const clientIp = request.headers.get('CF-Connecting-IP');
  if (clientIp) headers.set('X-Forwarded-For', clientIp);

  const target = new URL(url.pathname + url.search, origin);
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  try {
    return await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? request.body : undefined,
      redirect: 'manual'
    });
  } catch {
    return json(502, { error: 'API_UPSTREAM_UNREACHABLE' });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      return proxyApi(request, env, url);
    }
    return env.ASSETS.fetch(request);
  }
};
