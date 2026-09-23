import type { GitHubApiFetch } from './runtime-contracts.ts';

const DEFAULT_API = 'https://api.github.com';
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const MAX_REPOSITORY = 120;
const MAX_REF = 200;
const MAX_PATH = 400;
const MAX_LIMIT = 30;

export class GitHubWorkspaceExtraError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 400) {
    super(code);
    this.name = 'GitHubWorkspaceExtraError';
    this.code = code;
    this.status = status;
  }
}

type Options = {
  readonly token?: string;
  readonly allowedRepositories?: readonly string[];
  readonly baseUrl?: string;
  readonly fetchImpl?: GitHubApiFetch;
};

export interface GitHubDirectoryEntry {
  readonly name: string;
  readonly path: string;
  readonly type: string;
  readonly size: number;
  readonly sha: string;
  readonly htmlUrl: string;
}
export interface GitHubDirectoryResult {
  readonly repository: string;
  readonly path: string;
  readonly ref: string | null;
  readonly entries: readonly GitHubDirectoryEntry[];
}
export interface GitHubCompareFile {
  readonly filename: string;
  readonly status: string;
  readonly additions: number;
  readonly deletions: number;
  readonly changes: number;
}
export interface GitHubCompareResult {
  readonly repository: string;
  readonly base: string;
  readonly head: string;
  readonly status: string;
  readonly aheadBy: number;
  readonly behindBy: number;
  readonly totalCommits: number;
  readonly files: readonly GitHubCompareFile[];
}

function clamp(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
function repository(value: unknown): string {
  const result = clamp(value, MAX_REPOSITORY);
  if (!REPOSITORY_PATTERN.test(result)) throw new GitHubWorkspaceExtraError('INVALID_GITHUB_REPOSITORY');
  return result;
}
function ref(value: unknown): string | null {
  if (value == null || value === '') return null;
  const result = clamp(value, MAX_REF);
  if (!result || /[\u0000-\u001f\u007f]/.test(result)) throw new GitHubWorkspaceExtraError('INVALID_GITHUB_REF');
  return result;
}
function pathValue(value: unknown): string {
  const result = clamp(value, MAX_PATH);
  if (!result || result.startsWith('/') || result.includes('\\')) throw new GitHubWorkspaceExtraError('INVALID_GITHUB_PATH');
  const segments = result.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) throw new GitHubWorkspaceExtraError('INVALID_GITHUB_PATH');
  return result;
}
function allowed(repo: string, set: Set<string>): void {
  if (!set.has(repo.toLowerCase())) throw new GitHubWorkspaceExtraError('GITHUB_REPO_NOT_ALLOWED', 403);
}
function encodedRepo(repo: string): string {
  return repo.split('/').map((segment) => encodeURIComponent(segment)).join('/');
}
function encodedPath(value: string): string {
  return value.split('/').map((segment) => encodeURIComponent(segment)).join('/');
}

export function createGitHubWorkspaceExtra(options: Options = {}) {
  const token = typeof options.token === 'string' ? options.token.trim() : '';
  const baseUrl = String(options.baseUrl || DEFAULT_API).replace(/\/+$/, '');
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const allowlist = new Set((options.allowedRepositories || []).map((value) => String(value).trim().toLowerCase()).filter(Boolean));

  async function request(pathname: string, params = new URLSearchParams()): Promise<unknown> {
    if (!token || typeof fetchImpl !== 'function') throw new GitHubWorkspaceExtraError('GITHUB_NOT_CONFIGURED', 503);
    const url = new URL(baseUrl + pathname);
    for (const [key, value] of params.entries()) url.searchParams.set(key, value);
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: 'Bearer ' + token,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Hafize-GitHub-Workspace'
      }
    });
    if (!response.ok) throw new GitHubWorkspaceExtraError('GITHUB_ENDPOINT_FAILED', response.status || 502);
    try { return await response.json(); } catch { throw new GitHubWorkspaceExtraError('INVALID_GITHUB_RESPONSE', 502); }
  }

  async function directory(input: { readonly repository: unknown; readonly path?: unknown; readonly ref?: unknown }): Promise<GitHubDirectoryResult> {
    const repo = repository(input.repository);
    allowed(repo, allowlist);
    const path = input.path ? pathValue(input.path) : '';
    const branch = ref(input.ref);
    const params = new URLSearchParams();
    if (branch) params.set('ref', branch);
    const endpoint = '/repos/' + encodedRepo(repo) + '/contents' + (path ? '/' + encodedPath(path) : '');
    const payload = await request(endpoint, params);
    if (!Array.isArray(payload)) throw new GitHubWorkspaceExtraError('INVALID_GITHUB_RESPONSE', 502);
    const entries = payload.slice(0, MAX_LIMIT).flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return [];
      const item = entry as Record<string, unknown>;
      const name = clamp(item.name, 200);
      const entryPath = clamp(item.path, MAX_PATH);
      const type = clamp(item.type, 20);
      if (!name || !entryPath || !['file', 'dir'].includes(type)) return [];
      if (/(^|[._-])(\.env|credentials?|secrets?|tokens?|private[._-]?keys?)([._-]|$)|\.(pem|key|p12|pfx)$/i.test(name)) return [];
      return [{
        name,
        path: entryPath,
        type,
        size: Number.isFinite(item.size) ? Math.max(0, Math.min(10_000_000, Number(item.size))) : 0,
        sha: clamp(item.sha, 80),
        htmlUrl: clamp(item.html_url, 500)
      }];
    });
    return { repository: repo, path, ref: branch, entries };
  }

  async function compare(input: { readonly repository: unknown; readonly base: unknown; readonly head: unknown }): Promise<GitHubCompareResult> {
    const repo = repository(input.repository);
    allowed(repo, allowlist);
    const base = ref(input.base);
    const head = ref(input.head);
    if (!base || !head || base === head) throw new GitHubWorkspaceExtraError('INVALID_GITHUB_ARGUMENTS');
    const payload = await request('/repos/' + encodedRepo(repo) + '/compare/' + encodeURIComponent(base + '...' + head));
    if (!payload || Array.isArray(payload) || typeof payload !== 'object') throw new GitHubWorkspaceExtraError('INVALID_GITHUB_RESPONSE', 502);
    const item = payload as Record<string, unknown>;
    const files = Array.isArray(item.files) ? item.files : [];
    return {
      repository: repo,
      base,
      head,
      status: clamp(item.status, 40),
      aheadBy: Number.isFinite(item.ahead_by) ? Number(item.ahead_by) : 0,
      behindBy: Number.isFinite(item.behind_by) ? Number(item.behind_by) : 0,
      totalCommits: Number.isFinite(item.total_commits) ? Number(item.total_commits) : 0,
      files: files.slice(0, MAX_LIMIT).flatMap((entry) => {
        if (!entry || typeof entry !== 'object') return [];
        const file = entry as Record<string, unknown>;
        const filename = clamp(file.filename, MAX_PATH);
        const status = clamp(file.status, 30);
        if (!filename || !status) return [];
        return [{
          filename,
          status,
          additions: Number.isFinite(file.additions) ? Number(file.additions) : 0,
          deletions: Number.isFinite(file.deletions) ? Number(file.deletions) : 0,
          changes: Number.isFinite(file.changes) ? Number(file.changes) : 0
        }];
      })
    };
  }

  return Object.freeze({ directory, compare });
}
