const DEFAULT_GITHUB_API = 'https://api.github.com';
const DEFAULT_MAX_FILE_BYTES = 64 * 1024;

const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const SENSITIVE_FILE_PATTERNS = [
  /^\.env(?:\.|$)/i,
  /^credentials?(?:\.|$)/i,
  /^secrets?(?:\.|$)/i,
  /^id_(?:rsa|ed25519|ecdsa)(?:\.|$)/i,
  /\.(?:pem|key|p12|pfx)$/i
];

export class GitHubReadError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.name = 'GitHubReadError';
    this.code = code;
    this.status = status;
  }
}

export function parseGitHubRepoAllowlist(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
  }
  if (typeof value !== 'string') return [];
  return [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))];
}

function normalizeRepository(value) {
  const repository = typeof value === 'string' ? value.trim() : '';
  if (!REPOSITORY_PATTERN.test(repository)) throw new GitHubReadError('INVALID_GITHUB_REPOSITORY');
  return repository;
}

function normalizePath(value) {
  const path = typeof value === 'string' ? value.trim() : '';
  if (!path || path.length > 400 || path.startsWith('/') || path.includes('\\') || path.includes('\0')) {
    throw new GitHubReadError('INVALID_GITHUB_PATH');
  }

  const segments = path.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new GitHubReadError('INVALID_GITHUB_PATH');
  }
  if (segments.some((segment) => SENSITIVE_FILE_PATTERNS.some((pattern) => pattern.test(segment)))) {
    throw new GitHubReadError('SENSITIVE_GITHUB_PATH_BLOCKED', 403);
  }
  return path;
}

function normalizeRef(value) {
  if (value == null || value === '') return null;
  const ref = typeof value === 'string' ? value.trim() : '';
  if (!ref || ref.length > 200 || /[\u0000-\u001f\u007f]/.test(ref)) throw new GitHubReadError('INVALID_GITHUB_REF');
  return ref;
}

function encodeRepoPath(path) {
  return path.split('/').map((segment) => encodeURIComponent(segment)).join('/');
}

function decodeGitHubContent(payload, maxFileBytes) {
  if (!payload || Array.isArray(payload) || payload.type !== 'file') throw new GitHubReadError('GITHUB_PATH_NOT_FILE', 400);
  if (payload.encoding !== 'base64' || typeof payload.content !== 'string') {
    throw new GitHubReadError('UNSUPPORTED_GITHUB_CONTENT', 502);
  }

  const bytes = Buffer.from(payload.content.replace(/\s+/g, ''), 'base64');
  if (bytes.includes(0)) throw new GitHubReadError('BINARY_GITHUB_FILE_BLOCKED', 415);
  const truncated = bytes.length > maxFileBytes;
  const visible = truncated ? bytes.subarray(0, maxFileBytes) : bytes;

  return {
    sha: typeof payload.sha === 'string' ? payload.sha : null,
    size: Number.isFinite(payload.size) ? payload.size : bytes.length,
    content: visible.toString('utf8'),
    truncated
  };
}

export function createGitHubReadFile({
  token = '',
  allowedRepositories = [],
  baseUrl = DEFAULT_GITHUB_API,
  fetchImpl = globalThis.fetch,
  maxFileBytes = DEFAULT_MAX_FILE_BYTES
} = {}) {
  const allowlist = new Set(parseGitHubRepoAllowlist(allowedRepositories).map((item) => item.toLowerCase()));
  const apiBase = String(baseUrl || DEFAULT_GITHUB_API).replace(/\/+$/, '');
  const authToken = typeof token === 'string' ? token.trim() : '';

  return async function githubReadFile(input = {}) {
    if (!authToken) throw new GitHubReadError('GITHUB_NOT_CONFIGURED', 503);
    if (typeof fetchImpl !== 'function') throw new GitHubReadError('GITHUB_FETCH_UNAVAILABLE', 503);

    const repository = normalizeRepository(input.repository);
    if (!allowlist.has(repository.toLowerCase())) throw new GitHubReadError('GITHUB_REPO_NOT_ALLOWED', 403);

    const path = normalizePath(input.path);
    const ref = normalizeRef(input.ref);
    const url = new URL(`${apiBase}/repos/${repository}/contents/${encodeRepoPath(path)}`);
    if (ref) url.searchParams.set('ref', ref);

    const response = await fetchImpl(url, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${authToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Hafize-AI'
      }
    });

    if (!response.ok) {
      const status = Number.isInteger(response.status) ? response.status : 502;
      throw new GitHubReadError('GITHUB_READ_FAILED', status);
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new GitHubReadError('INVALID_GITHUB_RESPONSE', 502);
    }

    return {
      repository,
      path,
      ref,
      ...decodeGitHubContent(payload, Math.max(1024, Math.min(maxFileBytes, 256 * 1024)))
    };
  };
}
