const CREDENTIAL_ASSIGNMENT_PATTERN = /\b(?:api[_ -]?key|access[_ -]?token|refresh[_ -]?token|auth[_ -]?token|password|passwd|client[_ -]?secret|secret)\b\s*(?:=|:)\s*["']?[^\s"']{6,}/i;
const AUTHORIZATION_VALUE_PATTERN = /\b(?:authorization|proxy-authorization)\s*:\s*(?:bearer|basic)\s+[a-z0-9._~+\/=:-]{8,}/i;
const KNOWN_CREDENTIAL_TOKEN_PATTERN = /\b(?:github_pat_[a-z0-9_]{20,}|gh[pousr]_[a-z0-9]{30,}|nvapi-[a-z0-9_-]{20,})\b/i;
const PRIVATE_KEY_PATTERN = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i;
const CREDENTIAL_FIELD_NAMES = new Set([
  'apikey',
  'accesstoken',
  'refreshtoken',
  'authtoken',
  'authorization',
  'proxyauthorization',
  'password',
  'passwd',
  'clientsecret',
  'secret'
]);

function normalizeFieldName(value) {
  return typeof value === 'string' ? value.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
}

export function isPlaintextCredentialField(name, value) {
  if (!CREDENTIAL_FIELD_NAMES.has(normalizeFieldName(name))) return false;
  return typeof value === 'string' && value.trim().length > 0;
}

export function containsPlaintextCredential(value) {
  return typeof value === 'string' && (
    CREDENTIAL_ASSIGNMENT_PATTERN.test(value)
    || AUTHORIZATION_VALUE_PATTERN.test(value)
    || KNOWN_CREDENTIAL_TOKEN_PATTERN.test(value)
    || PRIVATE_KEY_PATTERN.test(value)
  );
}
