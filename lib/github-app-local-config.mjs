// Pure, secret-free plan for enabling a GitHub App in a LOCAL Hafize backend.
// Production and cloud environments must use their own secret manager.
export const HAFIZE_GITHUB_APP_ID = '5833389';
export const HAFIZE_GITHUB_APP_INSTALLATION_ID = '183684460';
export const HAFIZE_GITHUB_APP_SLUG = 'hafize-umitalgan';
export const HAFIZE_GITHUB_APP_REPOSITORY = 'umitalgan061-sudo/hafize';

const TARGET_KEYS = Object.freeze([
  'HAFIZE_GITHUB_APP_ID',
  'HAFIZE_GITHUB_APP_INSTALLATION_ID',
  'HAFIZE_GITHUB_APP_SLUG',
  'HAFIZE_GITHUB_APP_PRIVATE_KEY_PATH',
  'HAFIZE_GITHUB_READ_REPOS',
  'HAFIZE_GITHUB_WRITE_REPOS'
]);
const TARGET_SET = new Set(TARGET_KEYS);

export class GitHubAppLocalConfigError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
    this.name = 'GitHubAppLocalConfigError';
  }
}

function unquote(raw) {
  const value = String(raw).trim();
  if (value.length >= 2 && ['"', "'"].includes(value[0]) && value.at(-1) === value[0]) {
    return value.slice(1, -1);
  }
  return value;
}

function rejectUnsafeValue(value) {
  if (!value || /[\r\n\0#"'=]/.test(value)) {
    throw new GitHubAppLocalConfigError('GITHUB_APP_UNSAFE_KEY_PATH');
  }
}

function appendRepository(raw, repository) {
  const old = unquote(raw);
  const tokens = old ? old.split(',').map(x => x.trim()).filter(Boolean) : [];
  if (tokens.some(x => x === '*' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(x))) {
    throw new GitHubAppLocalConfigError('GITHUB_APP_INVALID_REPOSITORY_ALLOWLIST');
  }
  if (!tokens.some(x => x.toLowerCase() === repository.toLowerCase())) tokens.push(repository);
  return [...new Set(tokens)].join(',');
}

function readExistingLines(text) {
  if (typeof text !== 'string' || text.includes('\0')) {
    throw new GitHubAppLocalConfigError('GITHUB_APP_INVALID_ENV_FILE');
  }
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const seen = new Map();
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);
    if (m) {
      if (seen.has(m[1])) {
        throw new GitHubAppLocalConfigError('GITHUB_APP_DUPLICATE_ENV_KEY');
      }
      seen.set(m[1], { raw: m[2].trim(), line: i });
    }
  }
  return { lines, seen };
}

export function planLocalGitHubAppEnv(existingText, privateKeyPath) {
  rejectUnsafeValue(privateKeyPath);
  const { lines, seen } = readExistingLines(existingText);
  const nodeEnv = unquote(seen.get('NODE_ENV')?.raw || '').toLowerCase();
  const host = unquote(seen.get('HOST')?.raw || '').toLowerCase();

  // This setup is specifically for the user's local workstation, never a
  // public endpoint without production authentication and TLS controls.
  if ((nodeEnv && nodeEnv !== 'development') ||
      (host && !['127.0.0.1', 'localhost', '::1'].includes(host))) {
    throw new GitHubAppLocalConfigError('GITHUB_APP_LOCAL_ONLY');
  }

  const wanted = {
    HAFIZE_GITHUB_APP_ID,
    HAFIZE_GITHUB_APP_INSTALLATION_ID,
    HAFIZE_GITHUB_APP_SLUG,
    HAFIZE_GITHUB_APP_PRIVATE_KEY_PATH: privateKeyPath,
    HAFIZE_GITHUB_READ_REPOS: appendRepository(
      seen.get('HAFIZE_GITHUB_READ_REPOS')?.raw || '', HAFIZE_GITHUB_APP_REPOSITORY),
    HAFIZE_GITHUB_WRITE_REPOS: appendRepository(
      seen.get('HAFIZE_GITHUB_WRITE_REPOS')?.raw || '', HAFIZE_GITHUB_APP_REPOSITORY)
  };

  // Never silently point an existing deployment at a different GitHub App/key.
  for (const key of TARGET_KEYS.slice(0, 4)) {
    const current = unquote(seen.get(key)?.raw || '');
    if (current && current !== wanted[key]) {
      throw new GitHubAppLocalConfigError('GITHUB_APP_EXISTING_SETTING_CONFLICT');
    }
  }

  const hasExisting = existingText.trim().length > 0;
  const untouched = lines.filter(line => {
    const key = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1];
    return !key || !TARGET_SET.has(key);
  });

  const base = hasExisting
    ? untouched.join('\n').trimEnd()
    : 'NODE_ENV=development\nHOST=127.0.0.1\nPORT=4173';

  // Append exactly one setting per key; unrelated keys, including auth/model
  // secrets and bearer credentials, stay unchanged.
  const output = base + '\n\n# Hafize GitHub App — server side only; never commit .env\n' +
    TARGET_KEYS.map(key => key + '=' + wanted[key]).join('\n') + '\n';

  return Object.freeze({
    content: output,
    repository: HAFIZE_GITHUB_APP_REPOSITORY,
    mode: hasExisting ? 'update' : 'create'
  });
}
