// Credential words may carry a vendor/scope prefix (NVIDIA_API_KEY, github_access_token),
// so the leading boundary allows a bounded prefix run instead of requiring \b before the word.
const CREDENTIAL_ASSIGNMENT_PATTERN = /(?:^|[^a-z0-9])(?:[a-z0-9]{1,32}[_ -]){0,4}(?:api[_ -]?key|access[_ -]?token|refresh[_ -]?token|auth[_ -]?token|password|passwd|client[_ -]?secret|secret)\b\s*(?:=|:)\s*["']?[^\s"']{6,}/i;
const AUTHORIZATION_VALUE_PATTERN = /\b(?:authorization|proxy-authorization)\s*:\s*(?:bearer|basic)\s+[a-z0-9._~+\/=:-]{8,}/i;
const KNOWN_CREDENTIAL_TOKEN_PATTERN = /\b(?:github_pat_[a-z0-9_]{20,}|gh[pousr]_[a-z0-9]{30,}|nvapi-[a-z0-9_-]{20,})\b/i;
const GOOGLE_OAUTH_TOKEN_PATTERN = /(?:^|[^a-z0-9._~-])ya29\.[a-z0-9._~-]{20,}(?=$|[^a-z0-9._~-])/i;
const PRIVATE_KEY_PATTERN = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i;
const CREDENTIAL_FIELD_NAMES = new Set(['apikey', 'accesstoken', 'refreshtoken', 'authtoken', 'authorization', 'proxyauthorization', 'password', 'passwd', 'clientsecret', 'secret']);

function fieldNameSegments(value) {
  if (typeof value !== 'string') return [];
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function isCredentialFieldName(name) {
  const segments = fieldNameSegments(name);
  // A prefixed field (nvidia_api_key, googleRefreshToken) is still a credential field,
  // but a merely suffixed word (token_count, not_secret_related) is not.
  for (let index = 0; index < segments.length; index += 1) {
    if (CREDENTIAL_FIELD_NAMES.has(segments.slice(index).join(''))) return true;
  }
  return false;
}

export function isPlaintextCredentialField(name, value) {
  if (!isCredentialFieldName(name)) return false;
  return typeof value === 'string' && value.trim().length > 0;
}

// camelCase carriers (hafizeClientSecret=...) expose the same assignment shape once the
// case boundary is treated as a separator.
function withCaseBoundaries(value) {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1_$2');
}

export function containsPlaintextCredential(value) {
  return typeof value === 'string' && (
    CREDENTIAL_ASSIGNMENT_PATTERN.test(value) ||
    CREDENTIAL_ASSIGNMENT_PATTERN.test(withCaseBoundaries(value)) ||
    AUTHORIZATION_VALUE_PATTERN.test(value) ||
    KNOWN_CREDENTIAL_TOKEN_PATTERN.test(value) ||
    GOOGLE_OAUTH_TOKEN_PATTERN.test(value) ||
    PRIVATE_KEY_PATTERN.test(value)
  );
}
