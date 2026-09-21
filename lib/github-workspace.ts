import type { GitHubReadFile } from './github-read.ts';

const DEFAULT_API = 'https://api.github.com';
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const MAX_REPOSITORY = 120;
const MAX_REF = 200;
const MAX_PATH = 400;
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 30;

export type GitHubWorkspaceAction = 'repo' | 'branches' | 'commits' | 'pulls' | 'file';
export type GitHubWorkspaceErrorCode =
  | 'GITHUB_NOT_CONFIGURED'
  | 'GITHUB_REPO_NOT_ALLOWED'
  | 'INVALID_GITHUB_ARGUMENTS'
  | 'INVALID_GITHUB_REPOSITORY'
  | 'INVALID_GITHUB_REF'
  | 'INVALID_GITHUB_PATH'
  | 'GITHUB_ENDPOINT_FAILED'
  | 'INVALID_GITHUB_RESPONSE';

export class GitHubWorkspaceError extends Error {
  readonly code: GitHubWorkspaceErrorCode;
  readonly status: number;
  constructor(code: GitHubWorkspaceErrorCode, status = 400) {
    super(code);
    this.name = 'GitHubWorkspaceError';
    this.code = code;
    this.status = status;
  }
}

type WorkspaceReaderOptions = {
  readonly token?: string;
  readonly allowedRepositories?: readonly string[];
  readonly baseUrl?: string;
  readonly fetchImpl?: typeof fetch;
  readonly readFile?: GitHubReadFile;
};
type JsonRecord = Record<string, unknown>;

function clampString(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
function normalizeRepository(value: unknown): string {
  const repository = clampString(value, MAX_REPOSITORY);
  if (!REPOSITORY_PATTERN.test(repository)) throw new GitHubWorkspaceError('INVALID_GITHUB_REPOSITORY');
  return repository;
}
function normalizeRef(value: unknown): string | null {
  if (value == null || value === '') return null;
  const ref = clampString(value, MAX_REF);
  if (!ref || /[\u0000-\u001f\u007f]/.test(ref)) throw new GitHubWorkspaceError('INVALID_GITHUB_REF');
  return ref;
}
function normalizePath(value: unknown): string {
  const path = clampString(value, MAX_PATH);
  if (!path || path.startsWith('/') || path.includes('\\') || path.includes('\0')) {
    throw new GitHubWorkspaceError('INVALID_GITHUB_PATH');
  }
  const segments = path.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new GitHubWorkspaceError('INVALID_GITHUB_PATH');
  }
  return path;
}
function normalizeAction(value: unknown): GitHubWorkspaceAction {
  const action = clampString(value, 20);
  if (!['repo', 'branches', 'commits', 'pulls', 'file'].includes(action)) {
    throw new GitHubWorkspaceError('INVALID_GITHUB_ARGUMENTS');
  }
  return action as GitHubWorkspaceAction;
}
function normalizeLimit(value: unknown): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isInteger(parsed)) return DEFAULT_LIMIT;
  return Math.min(Math.max(parsed, 1), MAX_LIMIT);
}
function assertAllowed(repository: string, allowedRepositories: Set<string>): void {
  if (!allowedRepositories.has(repository.toLowerCase())) {
    throw new GitHubWorkspaceError('GITHUB_REPO_NOT_ALLOWED', 403);
  }
}
function encodeRepositoryPath(repository: string): string {
  return repository.split('/').map((segment) => encodeURIComponent(segment)).join('/');
}
function compactErrorStatus(status: unknown): number {
  return typeof status === 'number' && Number.isInteger(status) && status >= 400 && status <= 599 ? status : 502;
}

export function createGitHubWorkspaceReader(options: WorkspaceReaderOptions = {}) {
  const token = typeof options.token === 'string' ? options.token.trim() : '';
  const baseUrl = String(options.baseUrl || DEFAULT_API).replace(/\/+$/, '');
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const allowedRepositories = new Set(
    (Array.isArray(options.allowedRepositories) ? options.allowedRepositories : [])
      .map((value) => String(value).trim().toLowerCase())
      .filter(Boolean)
  );
  const readFile = options.readFile;

  async function requestJson(pathname: string, search = new URLSearchParams()): Promise<JsonRecord | JsonRecord[]> {
    if (!token) throw new GitHubWorkspaceError('GITHUB_NOT_CONFIGURED', 503);
    if (typeof fetchImpl !== 'function') throw new GitHubWorkspaceError('GITHUB_NOT_CONFIGURED', 503);
    const url = new URL(baseUrl + pathname);
    for (const [key, value] of search.entries()) url.searchParams.set(key, value);
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: 'Bearer ' + token,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Hafize-GitHub-Workspace'
      }
    });
    if (!response.ok) throw new GitHubWorkspaceError('GITHUB_ENDPOINT_FAILED', compactErrorStatus(response.status));
    try {
      return await response.json() as JsonRecord | JsonRecord[];
    } catch {
      throw new GitHubWorkspaceError('INVALID_GITHUB_RESPONSE', 502);
    }
  }

  async function repository(input: { readonly repository: unknown }): Promise<JsonRecord> {
    const repo = normalizeRepository(input.repository);
    assertAllowed(repo, allowedRepositories);
    const payload = await requestJson('/repos/' + encodeRepositoryPath(repo));
    if (Array.isArray(payload) || !payload || typeof payload !== 'object') {
      throw new GitHubWorkspaceError('INVALID_GITHUB_RESPONSE', 502);
    }
    return {
      repository: repo,
      name: clampString(payload.name, 120),
      fullName: clampString(payload.full_name, 160),
      description: clampString(payload.description, 500),
      defaultBranch: clampString(payload.default_branch, MAX_REF) || 'main',
      visibility: clampString(payload.visibility, 40),
      archived: payload.archived === true,
      htmlUrl: clampString(payload.html_url, 500)
    };
  }

  async function branches(input: { readonly repository: unknown; readonly limit?: unknown }): Promise<JsonRecord> {
    const repo = normalizeRepository(input.repository);
    assertAllowed(repo, allowedRepositories);
    const search = new URLSearchParams({ per_page: String(normalizeLimit(input.limit)) });
    const payload = await requestJson('/repos/' + encodeRepositoryPath(repo) + '/branches', search);
    if (!Array.isArray(payload)) throw new GitHubWorkspaceError('INVALID_GITHUB_RESPONSE', 502);
    return {
      repository: repo,
      branches: payload.slice(0, MAX_LIMIT).flatMap((branch) => {
        if (!branch || typeof branch !== 'object') return [];
        const item = branch as JsonRecord;
        const commit = item.commit && typeof item.commit === 'object' ? item.commit as JsonRecord : {};
        const name = clampString(item.name, MAX_REF);
        const sha = clampString(commit.sha, 80);
        return name && sha ? [{ name, sha, protected: item.protected === true }] : [];
      })
    };
  }

  async function commits(input: { readonly repository: unknown; readonly ref?: unknown; readonly limit?: unknown }): Promise<JsonRecord> {
    const repo = normalizeRepository(input.repository);
    assertAllowed(repo, allowedRepositories);
    const search = new URLSearchParams({ per_page: String(normalizeLimit(input.limit)) });
    const ref = normalizeRef(input.ref);
    if (ref) search.set('sha', ref);
    const payload = await requestJson('/repos/' + encodeRepositoryPath(repo) + '/commits', search);
    if (!Array.isArray(payload)) throw new GitHubWorkspaceError('INVALID_GITHUB_RESPONSE', 502);
    return {
      repository: repo,
      ref,
      commits: payload.slice(0, MAX_LIMIT).flatMap((entry) => {
        if (!entry || typeof entry !== 'object') return [];
        const item = entry as JsonRecord;
        const author = item.author && typeof item.author === 'object' ? item.author as JsonRecord : {};
        const commit = item.commit && typeof item.commit === 'object' ? item.commit as JsonRecord : {};
        const committer = commit.committer && typeof commit.committer === 'object' ? commit.committer as JsonRecord : {};
        const message = clampString(commit.message, 240);
        const sha = clampString(item.sha, 80);
        return sha && message ? [{
          sha,
          shortSha: sha.slice(0, 10),
          message: message.split('\n')[0]!.slice(0, 180),
          author: clampString(author.login || author.name || committer.name, 120),
          date: clampString(committer.date, 40),
          htmlUrl: clampString(item.html_url, 500)
        }] : [];
      })
    };
  }

  async function pulls(input: { readonly repository: unknown; readonly state?: unknown; readonly limit?: unknown }): Promise<JsonRecord> {
    const repo = normalizeRepository(input.repository);
    assertAllowed(repo, allowedRepositories);
    const requestedState = clampString(input.state, 20);
    const state = requestedState === 'closed' || requestedState === 'all' ? requestedState : 'open';
    const search = new URLSearchParams({ per_page: String(normalizeLimit(input.limit)), state });
    const payload = await requestJson('/repos/' + encodeRepositoryPath(repo) + '/pulls', search);
    if (!Array.isArray(payload)) throw new GitHubWorkspaceError('INVALID_GITHUB_RESPONSE', 502);
    return {
      repository: repo,
      state,
      pullRequests: payload.slice(0, MAX_LIMIT).flatMap((entry) => {
        if (!entry || typeof entry !== 'object') return [];
        const item = entry as JsonRecord;
        const number = typeof item.number === 'number' ? item.number : 0;
        const title = clampString(item.title, 220);
        if (!number || !title) return [];
        const user = item.user && typeof item.user === 'object' ? item.user as JsonRecord : {};
        const head = item.head && typeof item.head === 'object' ? item.head as JsonRecord : {};
        const base = item.base && typeof item.base === 'object' ? item.base as JsonRecord : {};
        return [{
          number,
          title,
          state: clampString(item.state, 20),
          draft: item.draft === true,
          author: clampString(user.login, 120),
          createdAt: clampString(item.created_at, 40),
          updatedAt: clampString(item.updated_at, 40),
          htmlUrl: clampString(item.html_url, 500),
          head: clampString(head.ref, MAX_REF),
          base: clampString(base.ref, MAX_REF)
        }];
      })
    };
  }

  async function file(input: { readonly repository: unknown; readonly path: unknown; readonly ref?: unknown }): Promise<JsonRecord> {
    const repo = normalizeRepository(input.repository);
    assertAllowed(repo, allowedRepositories);
    const path = normalizePath(input.path);
    const ref = normalizeRef(input.ref);
    if (typeof readFile !== 'function') throw new GitHubWorkspaceError('GITHUB_NOT_CONFIGURED', 503);
    const result = await readFile({ repository: repo, path, ref });
    return { repository: repo, path: result.path, ref: result.ref, sha: result.sha, size: result.size, truncated: result.truncated, content: result.content };
  }

  async function inspect(input: { readonly action: unknown; readonly repository: unknown; readonly path?: unknown; readonly ref?: unknown; readonly state?: unknown; readonly limit?: unknown }): Promise<JsonRecord> {
    const action = normalizeAction(input.action);
    if (action === 'repo') return repository(input);
    if (action === 'branches') return branches(input);
    if (action === 'commits') return commits(input);
    if (action === 'pulls') return pulls(input);
    if (action === 'file') return file(input);
    throw new GitHubWorkspaceError('INVALID_GITHUB_ARGUMENTS');
  }

  return Object.freeze({ inspect, repository, branches, commits, pulls, file });
}

export const GITHUB_WORKSPACE_LIMITS = Object.freeze({
  maxRepository: MAX_REPOSITORY,
  maxRef: MAX_REF,
  maxPath: MAX_PATH,
  defaultLimit: DEFAULT_LIMIT,
  maxLimit: MAX_LIMIT
});
