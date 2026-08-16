import { createBearerPrincipalAuthenticator } from './server-auth.mjs';
import { createCloudSessionNodeServerRuntime } from './cloud-session-node-server-runtime.mjs';
import { createConnectorOwnerResolver } from './connector-owner-principal.mjs';
import { createPersonalMemoryRuntime } from './personal-memory-runtime.mjs';

const AUTH_TOKEN_ENV = 'HAFIZE_CONNECTOR_AUTH_TOKEN';
const AUTH_SUBJECT_ENV = 'HAFIZE_CONNECTOR_AUTH_SUBJECT';
const OWNER_KEY_ENV = 'HAFIZE_CONNECTOR_OWNER_KEY_B64';
const MEMORY_KEY_ENV = 'HAFIZE_MEMORY_KEY_B64';
const MEMORY_DIR_ENV = 'HAFIZE_MEMORY_STORAGE_DIR';
const CLOUD_ORIGIN_ENV = 'HAFIZE_CLOUD_SESSION_ORIGIN';

function fail(field) { throw new Error(`INVALID_MEMORY_CONTROL_RUNTIME:${field}`); }
function text(env, name) { return typeof env[name] === 'string' ? env[name].trim() : ''; }
function factory(value, name) { if (typeof value !== 'function') fail(name); return value; }
function ownerKey(value) {
  if (!/^[A-Za-z0-9+/]{43}=$/.test(value)) fail(OWNER_KEY_ENV);
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32 || key.toString('base64') !== value) fail(OWNER_KEY_ENV);
  return key;
}
function headerValue(headers, name) {
  if (!headers || typeof headers !== 'object') return '';
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? '' : typeof value === 'string' ? value.trim() : '';
}

export async function createPersonalMemoryControlRuntime({
  env = process.env,
  createAuthenticator = createBearerPrincipalAuthenticator,
  createSessionRuntime = createCloudSessionNodeServerRuntime,
  createOwnerResolver = createConnectorOwnerResolver,
  createMemoryRuntime = createPersonalMemoryRuntime
} = {}) {
  if (!env || Array.isArray(env) || typeof env !== 'object') fail('env');
  const authToken = text(env, AUTH_TOKEN_ENV);
  const authSubject = text(env, AUTH_SUBJECT_ENV);
  const keyText = text(env, OWNER_KEY_ENV);
  const memoryKey = text(env, MEMORY_KEY_ENV);
  const memoryDir = text(env, MEMORY_DIR_ENV);
  const cloudOrigin = text(env, CLOUD_ORIGIN_ENV);
  const bearerCount = [authToken, authSubject].filter(Boolean).length;
  if (bearerCount !== 0 && bearerCount !== 2) fail('bearerConfig');

  const memoryConfigured = Boolean(memoryKey || memoryDir);
  if (!memoryConfigured) {
    return Object.freeze({
      configured: false,
      authenticate() { return null; },
      authorizeMutation() { return Object.freeze({ ok: false, error: 'AUTH_REQUIRED' }); }
    });
  }

  const sessionRuntime = factory(createSessionRuntime, 'createSessionRuntime')({ env });
  const sessionAuthenticator = sessionRuntime?.configured ? sessionRuntime.authenticator : null;
  if (sessionRuntime?.configured && typeof sessionAuthenticator?.authenticate !== 'function') fail('cloudSession');
  const bearerConfigured = bearerCount === 2;
  const sessionConfigured = Boolean(sessionRuntime?.configured && sessionAuthenticator);
  if (!memoryKey || !memoryDir || !keyText || (!bearerConfigured && !sessionConfigured)) fail('config');
  if (sessionConfigured && !cloudOrigin) fail('cloudOrigin');

  const bearerAuthenticator = bearerConfigured
    ? factory(createAuthenticator, 'createAuthenticator')({ token: authToken, subject: authSubject })
    : null;
  const resolver = factory(createOwnerResolver, 'createOwnerResolver')({ key: ownerKey(keyText) });
  const memory = factory(createMemoryRuntime, 'createMemoryRuntime')({ env });
  if (bearerAuthenticator && typeof bearerAuthenticator.authenticate !== 'function') fail('authenticator');
  if (typeof resolver?.resolve !== 'function') fail('ownerResolver');
  for (const method of ['open', 'read', 'write', 'remove', 'exportOwner', 'deleteOwner']) {
    if (typeof memory?.[method] !== 'function') fail(`memory.${method}`);
  }
  await memory.open();

  function resolveAuthentication(result, authMode) {
    if (!result?.ok) return null;
    const ownership = resolver.resolve(result.principal);
    if (!ownership || typeof ownership.ownerId !== 'string' || !ownership.ownerId) fail('owner');
    return Object.freeze({ ownerId: ownership.ownerId, authMode });
  }

  function authenticate(headers) {
    if (sessionAuthenticator) {
      const session = resolveAuthentication(sessionAuthenticator.authenticate({ headers }), 'session');
      if (session) return session;
    }
    if (bearerAuthenticator) {
      const bearer = resolveAuthentication(bearerAuthenticator.authenticate({ headers }), 'bearer');
      if (bearer) return bearer;
    }
    return null;
  }

  function authorizeMutation({ headers, ownership } = {}) {
    if (!ownership?.ownerId) return Object.freeze({ ok: false, error: 'AUTH_REQUIRED' });
    if (ownership.authMode === 'bearer') return Object.freeze({ ok: true });
    if (ownership.authMode !== 'session') return Object.freeze({ ok: false, error: 'AUTH_REQUIRED' });
    const origin = headerValue(headers, 'origin');
    if (!origin || origin !== cloudOrigin) return Object.freeze({ ok: false, error: 'ORIGIN_REQUIRED' });
    return Object.freeze({ ok: true });
  }

  return Object.freeze({ configured: true, authenticate, authorizeMutation, memory });
}
