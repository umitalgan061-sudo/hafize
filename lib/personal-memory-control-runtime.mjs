import { createBearerPrincipalAuthenticator } from './server-auth.mjs';
import { createConnectorOwnerResolver } from './connector-owner-principal.mjs';
import { createPersonalMemoryRuntime } from './personal-memory-runtime.mjs';

const AUTH_TOKEN_ENV = 'HAFIZE_CONNECTOR_AUTH_TOKEN';
const AUTH_SUBJECT_ENV = 'HAFIZE_CONNECTOR_AUTH_SUBJECT';
const OWNER_KEY_ENV = 'HAFIZE_CONNECTOR_OWNER_KEY_B64';
const MEMORY_KEY_ENV = 'HAFIZE_MEMORY_KEY_B64';
const MEMORY_DIR_ENV = 'HAFIZE_MEMORY_STORAGE_DIR';

function fail(field) { throw new Error(`INVALID_MEMORY_CONTROL_RUNTIME:${field}`); }
function text(env, name) { return typeof env[name] === 'string' ? env[name].trim() : ''; }
function factory(value, name) { if (typeof value !== 'function') fail(name); return value; }
function ownerKey(value) {
  if (!/^[A-Za-z0-9+/]{43}=$/.test(value)) fail(OWNER_KEY_ENV);
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32 || key.toString('base64') !== value) fail(OWNER_KEY_ENV);
  return key;
}

export async function createPersonalMemoryControlRuntime({
  env = process.env,
  createAuthenticator = createBearerPrincipalAuthenticator,
  createOwnerResolver = createConnectorOwnerResolver,
  createMemoryRuntime = createPersonalMemoryRuntime
} = {}) {
  if (!env || Array.isArray(env) || typeof env !== 'object') fail('env');
  const authToken = text(env, AUTH_TOKEN_ENV);
  const authSubject = text(env, AUTH_SUBJECT_ENV);
  const keyText = text(env, OWNER_KEY_ENV);
  const memoryKey = text(env, MEMORY_KEY_ENV);
  const memoryDir = text(env, MEMORY_DIR_ENV);
  const memoryConfigured = Boolean(memoryKey || memoryDir);
  if (!memoryConfigured) {
    return Object.freeze({ configured: false, authenticate() { return null; } });
  }
  if (!memoryKey || !memoryDir || !authToken || !authSubject || !keyText) fail('config');

  const authenticator = factory(createAuthenticator, 'createAuthenticator')({ token: authToken, subject: authSubject });
  const resolver = factory(createOwnerResolver, 'createOwnerResolver')({ key: ownerKey(keyText) });
  const memory = factory(createMemoryRuntime, 'createMemoryRuntime')({ env });
  if (typeof authenticator?.authenticate !== 'function') fail('authenticator');
  if (typeof resolver?.resolve !== 'function') fail('ownerResolver');
  for (const method of ['open', 'read', 'write', 'remove', 'exportOwner', 'deleteOwner']) {
    if (typeof memory?.[method] !== 'function') fail(`memory.${method}`);
  }
  await memory.open();

  function authenticate(headers) {
    const result = authenticator.authenticate({ headers });
    if (!result?.ok) return null;
    const ownership = resolver.resolve(result.principal);
    if (!ownership || typeof ownership.ownerId !== 'string' || !ownership.ownerId) fail('owner');
    return Object.freeze({ ownerId: ownership.ownerId });
  }

  return Object.freeze({ configured: true, authenticate, memory });
}
