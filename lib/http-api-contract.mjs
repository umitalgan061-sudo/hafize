const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']);
const MAX_PATH = 300;
const MAX_HEADER = 1_000;
const MAX_REQUEST_ID = 120;
const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function clean(value, max, code) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > max || text.includes('\0')) throw new Error(code);
  return text;
}

export function normalizeHttpRequest(request = {}) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) throw new Error('INVALID_HTTP_REQUEST');
  const method = clean(request.method || 'GET', 16, 'INVALID_HTTP_METHOD').toUpperCase();
  if (!METHODS.has(method)) throw new Error('INVALID_HTTP_METHOD');
  const path = clean(request.path || '/', MAX_PATH, 'INVALID_HTTP_PATH');
  if (!path.startsWith('/')) throw new Error('INVALID_HTTP_PATH');
  const requestId = request.requestId == null ? null : clean(request.requestId, MAX_REQUEST_ID, 'INVALID_HTTP_REQUEST_ID');
  const contentType = request.contentType == null ? '' : clean(request.contentType, MAX_HEADER, 'INVALID_HTTP_CONTENT_TYPE');
  const bodyBytes = request.bodyBytes == null ? 0 : request.bodyBytes;
  if (!Number.isInteger(bodyBytes) || bodyBytes < 0) throw new Error('INVALID_HTTP_BODY_SIZE');
  return Object.freeze({ method, path, requestId, contentType, bodyBytes, hasBody: BODY_METHODS.has(method) && bodyBytes > 0 });
}

export function shouldRequireJsonBody(request) {
  const normalized = normalizeHttpRequest(request);
  return BODY_METHODS.has(normalized.method) && normalized.path.startsWith('/api/') && normalized.bodyBytes > 0;
}

export function classifyHttpResponse({ status = 200, cacheControl = 'no-store', sensitive = true } = {}) {
  if (!Number.isInteger(status) || status < 100 || status > 599) throw new Error('INVALID_HTTP_STATUS');
  const cache = typeof cacheControl === 'string' ? cacheControl.trim().slice(0, MAX_HEADER) : 'no-store';
  return Object.freeze({
    status,
    cacheControl: sensitive ? 'no-store' : cache || 'no-store',
    retryable: status === 408 || status === 425 || status === 429 || status >= 500,
    success: status >= 200 && status < 300
  });
}

export function securityHeaders({ allowCredentials = false } = {}) {
  return Object.freeze({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'no-store',
    ...(allowCredentials ? { 'Vary': 'Cookie, Authorization' } : {})
  });
}

export const HTTP_API_CONTRACT_LIMITS = Object.freeze({ maxPathLength: MAX_PATH, maxHeaderLength: MAX_HEADER, maxRequestIdLength: MAX_REQUEST_ID });
