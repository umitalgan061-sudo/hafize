const DEFAULT_API = 'https://api.github.com';
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const MAX_REPOSITORY = 120;
const MAX_REF = 200;
const MAX_BODY = 2400;
const MAX_FILES = 30;

export class GitHubWorkspaceDetailsError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 400) {
    super(code);
    this.name = 'GitHubWorkspaceDetailsError';
    this.code = code;
    this.status = status;
  }
}

type Options = {
  readonly token?: string;
  readonly allowedRepositories?: readonly string[];
  readonly baseUrl?: string;
  readonly fetchImpl?: typeof fetch;
};

function clamp(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
function repo(value: unknown): string {
  const result = clamp(value, MAX_REPOSITORY);
  if (!REPOSITORY_PATTERN.test(result)) throw new GitHubWorkspaceDetailsError('INVALID_GITHUB_REPOSITORY');
  return result;
}
function ref(value: unknown): string {
  const result = clamp(value, MAX_REF);
  if (!result || /[\u0000-\u001f\u007f]/.test(result)) throw new GitHubWorkspaceDetailsError('INVALID_GITHUB_REF');
  return result;
}
function encodeRepo(value: string): string {
  return value.split('/').map((segment) => encodeURIComponent(segment)).join('/');
}
function encodeRef(value: string): string {
  return encodeURIComponent(value);
}

export function createGitHubWorkspaceDetails(options: Options = {}) {
  const token = typeof options.token === 'string' ? options.token.trim() : '';
  const baseUrl = String(options.baseUrl || DEFAULT_API).replace(/\/+$/, '');
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const allowlist = new Set((options.allowedRepositories || []).map((value) => String(value).trim().toLowerCase()).filter(Boolean));

  function allowed(repository: string): void {
    if (!allowlist.has(repository.toLowerCase())) throw new GitHubWorkspaceDetailsError('GITHUB_REPO_NOT_ALLOWED', 403);
  }

  async function request(pathname: string): Promise<unknown> {
    if (!token || typeof fetchImpl !== 'function') throw new GitHubWorkspaceDetailsError('GITHUB_NOT_CONFIGURED', 503);
    const response = await fetchImpl(new URL(baseUrl + pathname), {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: 'Bearer ' + token,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Hafize-GitHub-Workspace'
      }
    });
    if (!response.ok) throw new GitHubWorkspaceDetailsError('GITHUB_ENDPOINT_FAILED', response.status || 502);
    try { return await response.json(); } catch { throw new GitHubWorkspaceDetailsError('INVALID_GITHUB_RESPONSE', 502); }
  }

  async function commit(input: { readonly repository: unknown; readonly sha: unknown }): Promise<Record<string, unknown>> {
    const repository = repo(input.repository);
    allowed(repository);
    const sha = ref(input.sha);
    const payload = await request('/repos/' + encodeRepo(repository) + '/commits/' + encodeRef(sha));
    if (!payload || Array.isArray(payload) || typeof payload !== 'object') throw new GitHubWorkspaceDetailsError('INVALID_GITHUB_RESPONSE', 502);
    const item = payload as Record<string, unknown>;
    const commitData = item.commit && typeof item.commit === 'object' ? item.commit as Record<string, unknown> : {};
    const author = commitData.author && typeof commitData.author === 'object' ? commitData.author as Record<string, unknown> : {};
    const stats = item.stats && typeof item.stats === 'object' ? item.stats as Record<string, unknown> : {};
    const files = Array.isArray(item.files) ? item.files : [];
    return {
      repository,
      sha: clamp(item.sha, 80),
      message: clamp(commitData.message, MAX_BODY),
      author: clamp(author.name || author.email, 160),
      date: clamp(author.date, 40),
      additions: Number.isFinite(stats.additions) ? Number(stats.additions) : 0,
      deletions: Number.isFinite(stats.deletions) ? Number(stats.deletions) : 0,
      changes: Number.isFinite(stats.total) ? Number(stats.total) : 0,
      htmlUrl: clamp(item.html_url, 500),
      files: files.slice(0, MAX_FILES).flatMap((entry) => {
        if (!entry || typeof entry !== 'object') return [];
        const file = entry as Record<string, unknown>;
        const filename = clamp(file.filename, 400);
        if (!filename) return [];
        return [{
          filename,
          status: clamp(file.status, 30),
          additions: Number.isFinite(file.additions) ? Number(file.additions) : 0,
          deletions: Number.isFinite(file.deletions) ? Number(file.deletions) : 0,
          changes: Number.isFinite(file.changes) ? Number(file.changes) : 0
        }];
      })
    };
  }

  async function pull(input: { readonly repository: unknown; readonly number: unknown }): Promise<Record<string, unknown>> {
    const repository = repo(input.repository);
    allowed(repository);
    const number = Number.parseInt(String(input.number ?? ''), 10);
    if (!Number.isInteger(number) || number < 1 || number > 1_000_000_000) {
      throw new GitHubWorkspaceDetailsError('INVALID_GITHUB_ARGUMENTS');
    }
    const payload = await request('/repos/' + encodeRepo(repository) + '/pulls/' + String(number));
    if (!payload || Array.isArray(payload) || typeof payload !== 'object') throw new GitHubWorkspaceDetailsError('INVALID_GITHUB_RESPONSE', 502);
    const item = payload as Record<string, unknown>;
    const user = item.user && typeof item.user === 'object' ? item.user as Record<string, unknown> : {};
    const head = item.head && typeof item.head === 'object' ? item.head as Record<string, unknown> : {};
    const base = item.base && typeof item.base === 'object' ? item.base as Record<string, unknown> : {};
    return {
      repository,
      number,
      title: clamp(item.title, 240),
      state: clamp(item.state, 20),
      draft: item.draft === true,
      author: clamp(user.login, 120),
      body: clamp(item.body, MAX_BODY),
      createdAt: clamp(item.created_at, 40),
      updatedAt: clamp(item.updated_at, 40),
      head: clamp(head.ref, MAX_REF),
      base: clamp(base.ref, MAX_REF),
      htmlUrl: clamp(item.html_url, 500)
    };
  }

  return Object.freeze({ commit, pull });
}
