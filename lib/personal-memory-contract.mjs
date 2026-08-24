const MEMORY_KINDS = new Set(['identity', 'preference', 'project', 'note']);
const SOURCE_TYPES = new Set(['user_statement', 'user_note', 'user_import']);
const WRITE_FIELDS = new Set([
  'ownerId', 'kind', 'content', 'sourceType', 'sourceRef', 'sensitivity', 'explicitUserIntent'
]);
const READ_FIELDS = new Set(['ownerId', 'query', 'kinds', 'limit']);
const DELETE_FIELDS = new Set(['ownerId', 'memoryId', 'exactMatch']);
const MEMORY_ID_PATTERN = /^memory_[a-zA-Z0-9_-]{8,80}$/;
const CREDENTIAL_ASSIGNMENT_PATTERN = /\b(?:api[_ -]?key|access[_ -]?token|refresh[_ -]?token|auth[_ -]?token|password|passwd|client[_ -]?secret|secret)\b\s*(?:=|:)\s*["']?[^\s"']{6,}/i;
const AUTHORIZATION_VALUE_PATTERN = /\b(?:authorization|proxy-authorization)\s*:\s*(?:bearer|basic)\s+[a-z0-9._~+\/=:-]{8,}/i;
const PRIVATE_KEY_PATTERN = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i;
const MAX_CONTENT = 4000;
const MAX_QUERY = 1000;
const MAX_KINDS = 4;
const MAX_LIMIT = 20;

function fail(error) {
  return { ok: false, error };
}

function cleanText(value, label, maxLength) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > maxLength) throw new Error(`INVALID_MEMORY_COMMAND:${label}`);
  return text;
}

function containsPlaintextCredential(value) {
  return CREDENTIAL_ASSIGNMENT_PATTERN.test(value)
    || AUTHORIZATION_VALUE_PATTERN.test(value)
    || PRIVATE_KEY_PATTERN.test(value);
}

function normalizeMemoryContent(value) {
  const content = cleanText(value, 'content', MAX_CONTENT);
  if (containsPlaintextCredential(content)) {
    throw new Error('MEMORY_PLAINTEXT_CREDENTIAL_NOT_ALLOWED');
  }
  return content;
}

function requireExactFields(input, allowed) {
  if (!input || Array.isArray(input) || typeof input !== 'object') {
    throw new Error('INVALID_MEMORY_COMMAND:input');
  }
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) throw new Error('INVALID_MEMORY_COMMAND:field');
  }
}

function normalizeOwnerId(value) {
  return cleanText(value, 'ownerId', 200);
}

function normalizeKind(value) {
  const kind = cleanText(value, 'kind', 40);
  if (!MEMORY_KINDS.has(kind)) throw new Error('INVALID_MEMORY_COMMAND:kind');
  return kind;
}

function normalizeSourceType(value) {
  const type = cleanText(value, 'sourceType', 40);
  if (!SOURCE_TYPES.has(type)) throw new Error('INVALID_MEMORY_COMMAND:sourceType');
  return type;
}

function normalizeSourceRef(value) {
  if (value == null) return null;
  return cleanText(value, 'sourceRef', 300);
}

function normalizeKinds(value) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > MAX_KINDS) {
    throw new Error('INVALID_MEMORY_COMMAND:kinds');
  }
  const kinds = value.map(normalizeKind);
  if (new Set(kinds).size !== kinds.length) throw new Error('INVALID_MEMORY_COMMAND:kinds.duplicate');
  return kinds;
}

export function normalizeMemoryWrite(input) {
  try {
    requireExactFields(input, WRITE_FIELDS);
    if (input.explicitUserIntent !== true) {
      throw new Error('MEMORY_WRITE_REQUIRES_EXPLICIT_USER_INTENT');
    }
    if (input.sensitivity !== 'personal') {
      throw new Error('MEMORY_SENSITIVITY_NOT_ALLOWED');
    }
    return {
      ok: true,
      command: {
        ownerId: normalizeOwnerId(input.ownerId),
        kind: normalizeKind(input.kind),
        content: normalizeMemoryContent(input.content),
        sourceType: normalizeSourceType(input.sourceType),
        sourceRef: normalizeSourceRef(input.sourceRef),
        sensitivity: 'personal'
      }
    };
  } catch (error) {
    return fail(error.message);
  }
}

export function normalizeMemoryRead(input) {
  try {
    requireExactFields(input, READ_FIELDS);
    const limit = input.limit == null ? 5 : input.limit;
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      throw new Error('INVALID_MEMORY_COMMAND:limit');
    }
    return {
      ok: true,
      command: {
        ownerId: normalizeOwnerId(input.ownerId),
        query: cleanText(input.query, 'query', MAX_QUERY),
        kinds: normalizeKinds(input.kinds),
        limit
      }
    };
  } catch (error) {
    return fail(error.message);
  }
}

export function normalizeMemoryDelete(input) {
  try {
    requireExactFields(input, DELETE_FIELDS);
    const memoryId = cleanText(input.memoryId, 'memoryId', 100);
    if (!MEMORY_ID_PATTERN.test(memoryId)) throw new Error('INVALID_MEMORY_COMMAND:memoryId');
    if (input.exactMatch !== true) throw new Error('MEMORY_DELETE_REQUIRES_EXACT_MATCH');
    return {
      ok: true,
      command: { ownerId: normalizeOwnerId(input.ownerId), memoryId }
    };
  } catch (error) {
    return fail(error.message);
  }
}

export const PERSONAL_MEMORY_CONTRACT = Object.freeze({
  kinds: Object.freeze([...MEMORY_KINDS]),
  sourceTypes: Object.freeze([...SOURCE_TYPES]),
  allowedSensitivity: 'personal',
  maxContentLength: MAX_CONTENT,
  maxQueryLength: MAX_QUERY,
  maxReadLimit: MAX_LIMIT
});