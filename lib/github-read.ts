import { containsPlaintextCredential } from './plaintext-credential-policy.ts';

const DEFAULT_GITHUB_API = 'https://api.github.com';
const DEFAULT_MAX_FILE_BYTES = 64 * 1024;
const MIN_FILE_BYTES = 1024;
const MAX_FILE_BYTES = 256 * 1024;

const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const ALLOWED_INPUT_KEYS = new Set(['repository', 'path', 'ref']);
const SENSITIVE_FILE_PATTERNS = [
  /^\.env(?:\.|$)/i,
  /(?:^|[._-])(?:credential|secret|token)s?(?:[._-]|$)/i,
  /(?:^|[._-])private[._-]?key(?:[._-]|$)/i,
  /^id_(?:rsa|ed25519|ecdsa)(?:\.|$)/i,
  /\.(?:pem|key|p12|pfx)$/i
];

export type GitHubFetch = (input: URL, init: RequestInit) => Promise<Response>;

export interface GitHubReadOptions {
  readonly token?: unknown;
  readonly allowedRepositories?: unknown;
  readonly baseUrl?: unknown;
  readonly fetchImpl?: GitHubFetch | undefined;
  readonly maxFileBytes?: unknown;
}

export interface GitHubReadInput {
  readonly repository?: unknown;
  readonly path?: unknown;
  readonly ref?: unknown;
}

export interface GitHubReadResult {
  readonly repository: string;
  readonly path: string;
  readonly ref: string | null;
  readonly sha: string | null;
  readonly size: number;
  readonly content: string;
  readonly truncated: boolean;
}

export type GitHubReadFile = (input?: GitHubReadInput) => Promise<GitHubReadResult>;

export class GitHubReadError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 400) {
    super(code);
    this.name = 'GitHubReadError';
    this.code = code;
    this.status = status;
  }
}

export function parseGitHubRepoAllowlist(value: unknown): string[] {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
  }
  if (typeof value !== 'string') return [];
  return [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))];
}

function normalizeRepository(value: unknown): string {
  const repository = typeof value === 'string' ? value.trim() : '';
  if (!REPOSITORY_PATTERN.test(repository)) throw new GitHubReadError('INVALID_GITHUB_REPOSITORY');
  return repository;
}

function normalizePath(value: unknown): string {
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

function normalizeRef(value: unknown): string | null {
  if (value == null || value === '') return null;
  const ref = typeof value === 'string' ? value.trim() : '';
  if (!ref || ref.length > 200 || /[\u0000-\u001f\u007f]/.test(ref)) throw new GitHubReadError('INVALID_GITHUB_REF');
  return ref;
}

function encodeRepoPath(path: string): string {
  return path.split('/').map((segment) => encodeURIComponent(segment)).join('/');
}

interface DecodedContent {
  readonly sha: string | null;
  readonly size: number;
  readonly content: string;
  readonly truncated: boolean;
}

function decodeGitHubContent(payload: unknown, maxFileBytes: number): DecodedContent {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new GitHubReadError('GITHUB_PATH_NOT_FILE', 400);
  }
  const record = payload as Record<string, unknown>;
  if (record.type !== 'file') throw new GitHubReadError('GITHUB_PATH_NOT_FILE', 400);
  if (record.encoding !== 'base64' || typeof record.content !== 'string') {
    throw new GitHubReadError('UNSUPPORTED_GITHUB_CONTENT', 502);
  }

  const bytes = Buffer.from(record.content.replace(/\s+/g, ''), 'base64');
  if (bytes.includes(0)) throw new GitHubReadError('BINARY_GITHUB_FILE_BLOCKED', 415);
  const truncated = bytes.length > maxFileBytes;
  const visible = truncated ? bytes.subarray(0, maxFileBytes) : bytes;

  return {
    sha: typeof record.sha === 'string' ? record.sha : null,
    size: typeof record.size === 'number' && Number.isFinite(record.size) ? record.size : bytes.length,
    content: visible.toString('utf8'),
    truncated
  };
}

function boundedFileBytes(value: unknown): number {
  const requested = typeof value === 'number' && Number.isFinite(value) ? value : DEFAULT_MAX_FILE_BYTES;
  return Math.max(MIN_FILE_BYTES, Math.min(requested, MAX_FILE_BYTES));
}

export function createGitHubReadFile(options: GitHubReadOptions = {}): GitHubReadFile {
  const {
    token = '',
    allowedRepositories = [],
    baseUrl = DEFAULT_GITHUB_API,
    fetchImpl = globalThis.fetch as GitHubFetch | undefined,
    maxFileBytes = DEFAULT_MAX_FILE_BYTES
  } = options;
  const allowlist = new Set(parseGitHubRepoAllowlist(allowedRepositories).map((item) => item.toLowerCase()));
  const apiBase = String(baseUrl || DEFAULT_GITHUB_API).replace(/\/+$/, '');
  const authToken = typeof token === 'string' ? token.trim() : '';
  const fileByteLimit = boundedFileBytes(maxFileBytes);

  return async function githubReadFile(input: GitHubReadInput = {}): Promise<GitHubReadResult> {
    if (!authToken) throw new GitHubReadError('GITHUB_NOT_CONFIGURED', 503);
    if (typeof fetchImpl !== 'function') throw new GitHubReadError('GITHUB_FETCH_UNAVAILABLE', 503);
    if (!input || Array.isArray(input) || typeof input !== 'object') throw new GitHubReadError('INVALID_GITHUB_ARGUMENTS');
    if (Object.keys(input).some((key) => !ALLOWED_INPUT_KEYS.has(key))) throw new GitHubReadError('INVALID_GITHUB_ARGUMENTS');

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

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new GitHubReadError('INVALID_GITHUB_RESPONSE', 502);
    }

    const decoded = decodeGitHubContent(payload, fileByteLimit);
    if (containsPlaintextCredential(decoded.content)) throw new GitHubReadError('GITHUB_CONTENT_CREDENTIAL_BLOCKED', 403);
    return { repository, path, ref, ...decoded };
  };
}
