const STATE_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
const CALLBACK_FIELDS = new Set(['code', 'state', 'error', 'error_description']);

function text(value, label, min, max) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (normalized.length < min || normalized.length > max) throw new Error(`INVALID_OAUTH_CALLBACK:${label}`);
  return normalized;
}

export function normalizeOAuthCallback(input) {
  if (!input || Array.isArray(input) || typeof input !== 'object') throw new Error('INVALID_OAUTH_CALLBACK:input');
  for (const key of Object.keys(input)) if (!CALLBACK_FIELDS.has(key)) throw new Error('INVALID_OAUTH_CALLBACK:field');
  const state = text(input.state, 'state', 32, 128);
  if (!STATE_PATTERN.test(state)) throw new Error('INVALID_OAUTH_CALLBACK:state');
  const hasCode = input.code != null;
  const hasError = input.error != null;
  if (hasCode === hasError) throw new Error('INVALID_OAUTH_CALLBACK:result');
  if (hasError) {
    return Object.freeze({
      ok: false,
      state,
      error: text(input.error, 'error', 1, 128),
      errorDescription: input.error_description == null ? null : text(input.error_description, 'errorDescription', 1, 512)
    });
  }
  if (input.error_description != null) throw new Error('INVALID_OAUTH_CALLBACK:errorDescription');
  return Object.freeze({ ok: true, state, code: text(input.code, 'code', 8, 2048) });
}
