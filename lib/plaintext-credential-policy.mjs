// `\b` does not separate an underscore from a letter, so environment style
// names such as NVIDIA_API_KEY= or HAFIZE_AUTH_TOKEN= slipped past a plain
// word-boundary match. These edges treat every non-alphanumeric character as a
// separator while still refusing to match inside a word ("mysecret=...").
const NAME_START = '(?:^|[^a-z0-9])';
const NAME_END = '(?![a-z0-9])';
const CREDENTIAL_NAMES = '(?:api[_ -]?key|access[_ -]?token|refresh[_ -]?token|auth[_ -]?token|password|passwd|client[_ -]?secret|secret)';
const CREDENTIAL_ASSIGNMENT_PATTERN = new RegExp(`${NAME_START}${CREDENTIAL_NAMES}${NAME_END}\\s*(?:=|:)\\s*["']?[^\\s"']{6,}`, 'i');
const AUTHORIZATION_VALUE_PATTERN = new RegExp(`${NAME_START}(?:authorization|proxy-authorization)${NAME_END}\\s*:\\s*(?:bearer|basic)\\s+[a-z0-9._~+/=:-]{8,}`, 'i');
const KNOWN_CREDENTIAL_TOKEN_PATTERN = new RegExp(`${NAME_START}(?:github_pat_[a-z0-9_]{20,}|gh[pousr]_[a-z0-9]{30,}|nvapi-[a-z0-9_-]{20,})${NAME_END}`, 'i');
const GOOGLE_OAUTH_TOKEN_PATTERN = /(?:^|[^a-z0-9._~-])ya29\.[a-z0-9._~-]{20,}(?=$|[^a-z0-9._~-])/i;
const PRIVATE_KEY_PATTERN = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i;
const CREDENTIAL_FIELD_NAMES = new Set(['apikey', 'accesstoken', 'refreshtoken', 'authtoken', 'authorization', 'proxyauthorization', 'password', 'passwd', 'clientsecret', 'secret']);

function normalizeFieldName(value) {
  return typeof value === 'string' ? value.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
}

export function isPlaintextCredentialField(name, value) {
  if (!CREDENTIAL_FIELD_NAMES.has(normalizeFieldName(name))) return false;
  return typeof value === 'string' && value.trim().length > 0;
}

export function containsPlaintextCredential(value) {
  return typeof value === 'string' && (
    CREDENTIAL_ASSIGNMENT_PATTERN.test(value) ||
    AUTHORIZATION_VALUE_PATTERN.test(value) ||
    KNOWN_CREDENTIAL_TOKEN_PATTERN.test(value) ||
    GOOGLE_OAUTH_TOKEN_PATTERN.test(value) ||
    PRIVATE_KEY_PATTERN.test(value)
  );
}
