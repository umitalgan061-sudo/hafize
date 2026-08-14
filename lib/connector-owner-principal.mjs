import { createHmac } from 'node:crypto';

const SUBJECT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/+\-=]{0,199}$/;
const FIELDS = new Set(['authenticated', 'subject']);

function fail(reason) {
  throw new Error(`INVALID_CONNECTOR_PRINCIPAL:${reason}`);
}

function normalizeKey(value) {
  if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array)) fail('key');
  const key = Buffer.from(value);
  if (key.length !== 32) fail('key');
  return key;
}

function normalizePrincipal(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object') fail('principal');
  for (const field of Object.keys(value)) if (!FIELDS.has(field)) fail(`principal.${field}`);
  if (value.authenticated !== true) throw new Error('CONNECTOR_AUTH_REQUIRED');
  const subject = typeof value.subject === 'string' ? value.subject.trim() : '';
  if (!SUBJECT_PATTERN.test(subject)) fail('principal.subject');
  return subject;
}

export function createConnectorOwnerResolver({ key } = {}) {
  const ownerKey = normalizeKey(key);

  function resolve(principal) {
    const subject = normalizePrincipal(principal);
    const digest = createHmac('sha256', ownerKey).update('hafize:connector-owner:v1\0', 'utf8').update(subject, 'utf8').digest('base64url');
    return Object.freeze({ ownerId: `owner_${digest}` });
  }

  return Object.freeze({ resolve });
}
