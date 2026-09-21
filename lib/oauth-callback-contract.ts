const STATE_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
const CALLBACK_FIELDS = new Set(['code','state','error','error_description']);

export interface OAuthSuccessCallback { readonly ok: true; readonly state: string; readonly code: string; }
export interface OAuthErrorCallback { readonly ok: false; readonly state: string; readonly error: string; readonly errorDescription: string | null; }
export type OAuthCallback = OAuthSuccessCallback | OAuthErrorCallback;

function text(value: unknown, label: string, min: number, max: number): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (normalized.length < min || normalized.length > max) throw new Error(`INVALID_OAUTH_CALLBACK:${label}`);
  return normalized;
}

export function normalizeOAuthCallback(input: unknown): OAuthCallback {
  if (!input || Array.isArray(input) || typeof input !== 'object') throw new Error('INVALID_OAUTH_CALLBACK:input');
  const source = input as Record<string, unknown>;
  for (const key of Object.keys(source)) if (!CALLBACK_FIELDS.has(key)) throw new Error('INVALID_OAUTH_CALLBACK:field');
  const state = text(source.state, 'state', 32, 128);
  if (!STATE_PATTERN.test(state)) throw new Error('INVALID_OAUTH_CALLBACK:state');
  const hasCode = source.code != null;
  const hasError = source.error != null;
  if (hasCode === hasError) throw new Error('INVALID_OAUTH_CALLBACK:result');
  if (hasError) return Object.freeze({ ok: false, state, error: text(source.error, 'error', 1, 128), errorDescription: source.error_description == null ? null : text(source.error_description, 'errorDescription', 1, 512) });
  if (source.error_description != null) throw new Error('INVALID_OAUTH_CALLBACK:errorDescription');
  return Object.freeze({ ok: true, state, code: text(source.code, 'code', 8, 2048) });
}
