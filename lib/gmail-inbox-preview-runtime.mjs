const MAX_QUERY_CHARS = 120;
const MAX_RESULTS = 10;
const DEFAULT_RESULTS = 6;
const MAX_HEADER_CHARS = 240;
const MAX_SNIPPET_CHARS = 320;
const MESSAGE_ID_PATTERN = /^[A-Za-z0-9_-]{1,256}$/;
const ALLOWED_QUERY_KEYS = new Set(['q', 'limit']);

function fail(code, status = 400) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  throw error;
}

function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function normalizePreviewQuery(value) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value !== 'string') return null;
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  const clean = value.trim().replace(/\s+/g, ' ');
  if (clean.length > MAX_QUERY_CHARS) return null;
  return clean;
}

export function normalizePreviewLimit(value) {
  if (value === null || value === undefined || value === '') return DEFAULT_RESULTS;
  const text = typeof value === 'string' ? value.trim() : '';
  if (!/^\d{1,2}$/.test(text)) return null;
  const parsed = Number.parseInt(text, 10);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= MAX_RESULTS ? parsed : null;
}

function metadataHeader(payload, name) {
  const headers = Array.isArray(payload?.headers) ? payload.headers : [];
  const target = name.toLowerCase();
  const entry = headers.find((item) => item && typeof item.name === 'string' && item.name.toLowerCase() === target);
  return cleanText(entry?.value, MAX_HEADER_CHARS);
}

export function normalizePreviewMessage(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object') return null;
  const id = typeof value.id === 'string' ? value.id.trim() : '';
  if (!MESSAGE_ID_PATTERN.test(id)) return null;
  const payload = value.payload && !Array.isArray(value.payload) && typeof value.payload === 'object' ? value.payload : {};
  return Object.freeze({
    id,
    from: metadataHeader(payload, 'From') || 'Gönderen bilinmiyor',
    subject: metadataHeader(payload, 'Subject') || '(Konu yok)',
    date: metadataHeader(payload, 'Date'),
    snippet: cleanText(value.snippet, MAX_SNIPPET_CHARS),
    unread: Array.isArray(value.labelIds) && value.labelIds.includes('UNREAD')
  });
}

function mapError(error) {
  const code = String(error?.message || error?.code || '');
  if (code.includes('GMAIL_READ_REAUTH_REQUIRED')) return { status: 401, body: { error: 'GMAIL_REAUTH_REQUIRED' } };
  if (code.includes('GMAIL_READ_SCOPE_REQUIRED')) return { status: 403, body: { error: 'GMAIL_READ_SCOPE_REQUIRED' } };
  if (code.includes('GMAIL_READ_FAILED')) return { status: 502, body: { error: 'GMAIL_READ_FAILED' } };
  return { status: 500, body: { error: 'GMAIL_PREVIEW_FAILED' } };
}

export function createGmailInboxPreviewRuntime({ gmailRuntime } = {}) {
  if (!gmailRuntime || typeof gmailRuntime.requestContext !== 'function') fail('INVALID_GMAIL_PREVIEW_RUNTIME:gmailRuntime');

  async function handle({ method, pathname, url, headers } = {}) {
    if (pathname !== '/api/connectors/gmail/inbox-preview') return Object.freeze({ matched: false });
    if (method !== 'GET') return Object.freeze({ matched: true, status: 405, body: { error: 'METHOD_NOT_ALLOWED' } });
    if (!(url instanceof URL)) return Object.freeze({ matched: true, status: 400, body: { error: 'INVALID_REQUEST' } });
    for (const key of url.searchParams.keys()) {
      if (!ALLOWED_QUERY_KEYS.has(key)) return Object.freeze({ matched: true, status: 400, body: { error: 'INVALID_QUERY' } });
    }

    const query = normalizePreviewQuery(url.searchParams.get('q'));
    const limit = normalizePreviewLimit(url.searchParams.get('limit'));
    if (query === null || limit === null) return Object.freeze({ matched: true, status: 400, body: { error: 'INVALID_QUERY' } });

    const context = gmailRuntime.requestContext({ headers });
    if (!context?.gmailReadAuthenticated || typeof context.gmailReadTool?.execute !== 'function') {
      return Object.freeze({ matched: true, status: 401, body: { error: 'AUTH_REQUIRED' } });
    }

    try {
      const params = { maxResults: limit, includeSpamTrash: false };
      if (query) params.query = query;
      const list = await context.gmailReadTool.execute({ operation: 'message.list', params });
      const ids = [];
      for (const item of Array.isArray(list?.messages) ? list.messages : []) {
        const id = typeof item?.id === 'string' ? item.id.trim() : '';
        if (!MESSAGE_ID_PATTERN.test(id) || ids.includes(id)) continue;
        ids.push(id);
        if (ids.length >= limit) break;
      }

      const settled = await Promise.allSettled(ids.map((messageId) => context.gmailReadTool.execute({
        operation: 'message.get',
        params: { messageId, format: 'metadata' }
      })));
      const messages = [];
      for (const result of settled) {
        if (result.status !== 'fulfilled') continue;
        const normalized = normalizePreviewMessage(result.value);
        if (normalized) messages.push(normalized);
      }
      return Object.freeze({ matched: true, status: 200, body: { messages, count: messages.length } });
    } catch (error) {
      const mapped = mapError(error);
      return Object.freeze({ matched: true, status: mapped.status, body: mapped.body });
    }
  }

  return Object.freeze({ handle });
}

export const GMAIL_INBOX_PREVIEW_LIMITS = Object.freeze({
  maxQueryChars: MAX_QUERY_CHARS,
  maxResults: MAX_RESULTS,
  defaultResults: DEFAULT_RESULTS,
  maxHeaderChars: MAX_HEADER_CHARS,
  maxSnippetChars: MAX_SNIPPET_CHARS
});
