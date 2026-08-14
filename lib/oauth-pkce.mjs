import { createHash, randomBytes } from 'node:crypto';

const VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/;
const STATE_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
const HTTPS_URL_PATTERN = /^https:\/\//i;
const ALLOWED_AUTH_FIELDS = new Set([
  'authorizationEndpoint', 'clientId', 'redirectUri', 'scopes', 'state',
  'codeChallenge', 'extraParams'
]);

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function boundedString(value, label, { min = 1, max = 512 } = {}) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length < min || text.length > max) throw new Error(`INVALID_OAUTH_PKCE:${label}`);
  return text;
}

function normalizeHttpsUrl(value, label) {
  const text = boundedString(value, label, { max: 2048 });
  if (!HTTPS_URL_PATTERN.test(text)) throw new Error(`INVALID_OAUTH_PKCE:${label}`);
  let url;
  try { url = new URL(text); } catch { throw new Error(`INVALID_OAUTH_PKCE:${label}`); }
  if (url.username || url.password || url.hash) throw new Error(`INVALID_OAUTH_PKCE:${label}`);
  return url.toString();
}

function normalizeScopes(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 16) {
    throw new Error('INVALID_OAUTH_PKCE:scopes');
  }
  const scopes = value.map((scope) => boundedString(scope, 'scope', { max: 256 }));
  if (new Set(scopes).size !== scopes.length) throw new Error('INVALID_OAUTH_PKCE:scopes');
  return scopes;
}

function normalizeExtraParams(value) {
  if (value == null) return {};
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    throw new Error('INVALID_OAUTH_PKCE:extraParams');
  }
  const entries = Object.entries(value);
  if (entries.length > 8) throw new Error('INVALID_OAUTH_PKCE:extraParams');
  const output = {};
  for (const [key, raw] of entries) {
    if (!/^[A-Za-z0-9_]{1,40}$/.test(key)) throw new Error('INVALID_OAUTH_PKCE:extraParams');
    if (['client_id', 'redirect_uri', 'response_type', 'scope', 'state', 'code_challenge', 'code_challenge_method'].includes(key)) {
      throw new Error('INVALID_OAUTH_PKCE:reservedParam');
    }
    output[key] = boundedString(raw, 'extraParam', { max: 256 });
  }
  return output;
}

export function createPkceVerifier({ random = randomBytes } = {}) {
  if (typeof random !== 'function') throw new Error('INVALID_OAUTH_PKCE:random');
  let raw;
  try { raw = Buffer.from(random(48)); } catch { throw new Error('OAUTH_PKCE_RANDOM_FAILED'); }
  if (raw.length !== 48) throw new Error('OAUTH_PKCE_RANDOM_FAILED');
  const verifier = base64url(raw);
  if (!VERIFIER_PATTERN.test(verifier)) throw new Error('OAUTH_PKCE_RANDOM_FAILED');
  return verifier;
}

export function createOAuthState({ random = randomBytes } = {}) {
  if (typeof random !== 'function') throw new Error('INVALID_OAUTH_PKCE:random');
  let raw;
  try { raw = Buffer.from(random(32)); } catch { throw new Error('OAUTH_PKCE_RANDOM_FAILED'); }
  if (raw.length !== 32) throw new Error('OAUTH_PKCE_RANDOM_FAILED');
  const state = base64url(raw);
  if (!STATE_PATTERN.test(state)) throw new Error('OAUTH_PKCE_RANDOM_FAILED');
  return state;
}

export function createPkceChallenge(verifier) {
  const normalized = boundedString(verifier, 'verifier', { min: 43, max: 128 });
  if (!VERIFIER_PATTERN.test(normalized)) throw new Error('INVALID_OAUTH_PKCE:verifier');
  return createHash('sha256').update(normalized, 'ascii').digest('base64url');
}

export function buildOAuthAuthorizationUrl(input) {
  if (!input || Array.isArray(input) || typeof input !== 'object') throw new Error('INVALID_OAUTH_PKCE:input');
  for (const key of Object.keys(input)) if (!ALLOWED_AUTH_FIELDS.has(key)) throw new Error('INVALID_OAUTH_PKCE:field');
  const authorizationEndpoint = normalizeHttpsUrl(input.authorizationEndpoint, 'authorizationEndpoint');
  const clientId = boundedString(input.clientId, 'clientId', { max: 256 });
  const redirectUri = normalizeHttpsUrl(input.redirectUri, 'redirectUri');
  const scopes = normalizeScopes(input.scopes);
  const state = boundedString(input.state, 'state', { min: 32, max: 128 });
  if (!STATE_PATTERN.test(state)) throw new Error('INVALID_OAUTH_PKCE:state');
  const codeChallenge = boundedString(input.codeChallenge, 'codeChallenge', { min: 43, max: 128 });
  const url = new URL(authorizationEndpoint);
  url.search = '';
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scopes.join(' '));
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  for (const [key, value] of Object.entries(normalizeExtraParams(input.extraParams))) url.searchParams.set(key, value);
  return url.toString();
}

export const OAUTH_PKCE_LIMITS = Object.freeze({
  verifierMin: 43,
  verifierMax: 128,
  maxScopes: 16,
  maxExtraParams: 8
});
