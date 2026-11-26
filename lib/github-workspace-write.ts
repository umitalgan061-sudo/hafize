import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { containsPlaintextCredential, containsSourcePlaintextCredential } from './plaintext-credential-policy.ts';

const DEFAULT_API = 'https://api.github.com';
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const SHA_PATTERN = /^[0-9a-f]{40}$/i;
const MAX_REPOSITORY = 120;
const MAX_REF = 200;
const MAX_BRANCH = 200;
const MAX_PATH = 400;
const MAX_CONTENT = 256 * 1024;
const MAX_PATCH_TEXT = 12 * 1024;
const MAX_COMMIT_MESSAGE = 180;
const MAX_PR_TITLE = 240;
const MAX_PR_BODY = 4000;
const APPROVAL_TTL_MS = 2 * 60 * 1000;
const APPROVAL_TOKEN_BYTES = 24;
const MAX_APPROVALS = 1000;

const SENSITIVE_PATH = /(^|\/)(?:\.env(?:\.|$)|credentials?(?:\.|$)|secrets?(?:\.|$)|tokens?(?:\.|$)|private[._-]?keys?(?:\.|$)|id_(?:rsa|ed25519|ecdsa)(?:\.|$)|[^/]*(?:\.pem|\.key|\.p12|\.pfx))$/i;
const WORKFLOW_PATH = /^(?:\.github\/workflows)(?:\/|$)/i;

export type GitHubWriteAction = 'branch' | 'file' | 'pull' | 'deploy';

export type GitHubWriteErrorCode =
  | 'GITHUB_NOT_CONFIGURED'
  | 'GITHUB_WRITE_NOT_CONFIGURED'
  | 'GITHUB_REPO_NOT_ALLOWED'
  | 'GITHUB_REPO_PATH_NOT_ALLOWED'
  | 'INVALID_GITHUB_ARGUMENTS'
  | 'INVALID_GITHUB_REPOSITORY'
  | 'INVALID_GITHUB_REF'
  | 'INVALID_GITHUB_BRANCH'
  | 'INVALID_GITHUB_PATH'
  | 'GITHUB_SENSITIVE_PATH_BLOCKED'
  | 'GITHUB_WORKFLOW_PATH_BLOCKED'
  | 'GITHUB_CONTENT_CREDENTIAL_BLOCKED'
  | 'GITHUB_DEFAULT_BRANCH_BLOCKED'
  | 'GITHUB_WRITE_APPROVAL_REQUIRED'
  | 'GITHUB_WRITE_APPROVAL_EXPIRED'
  | 'GITHUB_WRITE_APPROVAL_MISMATCH'
  | 'GITHUB_WRITE_APPROVAL_REPLAY'
  | 'GITHUB_WRITE_APPROVAL_CAPACITY'
  | 'GITHUB_ENDPOINT_FAILED'
  | 'GITHUB_WRITE_FAILED'
  | 'INVALID_GITHUB_RESPONSE'
  | 'GITHUB_PR_PREFLIGHT_FAILED'
  | 'GITHUB_PR_VERIFICATION_FAILED'
  | 'GITHUB_COMMIT_VERIFICATION_FAILED'
  | 'GITHUB_PATCH_ANCHOR_NOT_UNIQUE'
  | 'GITHUB_HEAD_MOVED'
  | 'GITHUB_BOT_IDENTITY_INVALID';

export class GitHubWorkspaceWriteError extends Error {
  readonly code: GitHubWriteErrorCode;
  readonly status: number;
  constructor(code: GitHubWriteErrorCode, status = 400) {
    super(code);
    this.name = 'GitHubWorkspaceWriteError';
    this.code = code;
    this.status = status;
  }
}

type JsonRecord = Record<string, unknown>;
type Options = {
  readonly token?: string;
  readonly allowedRepositories?: readonly string[];
  readonly baseUrl?: string;
  readonly fetchImpl?: typeof fetch;
  readonly commitIdentity?: () => Promise<Readonly<{ name: string; email: string }>>;
};

type ApprovalRecord = {
  readonly action: GitHubWriteAction;
  readonly repository: string;
  readonly fingerprint: string;
  readonly expiresAt: number;
};

function clamp(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function repository(value: unknown): string {
  const result = clamp(value, MAX_REPOSITORY);
  if (!REPOSITORY_PATTERN.test(result)) throw new GitHubWorkspaceWriteError('INVALID_GITHUB_REPOSITORY');
  return result;
}

function ref(value: unknown, required = true): string {
  const result = clamp(value, MAX_REF);
  if (!result && required) throw new GitHubWorkspaceWriteError('INVALID_GITHUB_REF');
  if (!result) return '';
  if (/[\u0000-\u001f\u007f]/.test(result) || result.includes('..') || result.includes('@{')) {
    throw new GitHubWorkspaceWriteError('INVALID_GITHUB_REF');
  }
  return result;
}

function branch(value: unknown): string {
  const result = clamp(value, MAX_BRANCH);
  if (
    !result ||
    /[\u0000-\u001f\u007f\s~^:?*\[]/.test(result) ||
    result.startsWith('/') ||
    result.endsWith('/') ||
    result.startsWith('.') ||
    result.endsWith('.') ||
    result.includes('..') ||
    result.includes('@{')
  ) {
    throw new GitHubWorkspaceWriteError('INVALID_GITHUB_BRANCH');
  }
  if (result.endsWith('.lock')) throw new GitHubWorkspaceWriteError('INVALID_GITHUB_BRANCH');
  return result;
}

function pathValue(value: unknown): string {
  const result = clamp(value, MAX_PATH);
  if (!result || result.startsWith('/') || result.includes('\\') || result.includes('\0')) {
    throw new GitHubWorkspaceWriteError('INVALID_GITHUB_PATH');
  }
  const parts = result.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) {
    throw new GitHubWorkspaceWriteError('INVALID_GITHUB_PATH');
  }
  if (SENSITIVE_PATH.test(result)) throw new GitHubWorkspaceWriteError('GITHUB_SENSITIVE_PATH_BLOCKED', 403);
  if (WORKFLOW_PATH.test(result)) throw new GitHubWorkspaceWriteError('GITHUB_WORKFLOW_PATH_BLOCKED', 403);
  return result;
}

function text(value: unknown, max: number, code: GitHubWriteErrorCode): string {
  const result = typeof value === 'string' ? value.trim() : '';
  if (!result || result.length > max) throw new GitHubWorkspaceWriteError(code);
  if (containsPlaintextCredential(result)) {
    throw new GitHubWorkspaceWriteError('GITHUB_CONTENT_CREDENTIAL_BLOCKED', 403);
  }
  return result;
}

function content(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.length || value.length > MAX_CONTENT) {
    throw new GitHubWorkspaceWriteError('INVALID_GITHUB_ARGUMENTS');
  }
  if (value.includes('\0')) throw new GitHubWorkspaceWriteError('INVALID_GITHUB_ARGUMENTS');
  if (containsSourcePlaintextCredential(value, path)) {
    throw new GitHubWorkspaceWriteError('GITHUB_CONTENT_CREDENTIAL_BLOCKED', 403);
  }
  return value;
}

function sha(value: unknown): string {
  const result = clamp(value, 80);
  if (!result) return '';
  if (!SHA_PATTERN.test(result)) throw new GitHubWorkspaceWriteError('INVALID_GITHUB_ARGUMENTS');
  return result.toLowerCase();
}

function bool(value: unknown): boolean {
  return value === true;
}

function action(value: unknown): GitHubWriteAction {
  const result = clamp(value, 20);
  if (!['branch', 'file', 'pull', 'deploy'].includes(result)) {
    throw new GitHubWorkspaceWriteError('INVALID_GITHUB_ARGUMENTS');
  }
  return result as GitHubWriteAction;
}

function object(value: unknown): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new GitHubWorkspaceWriteError('INVALID_GITHUB_ARGUMENTS');
  }
  return value as JsonRecord;
}

function encodedRepository(value: string): string {
  return value.split('/').map((part) => encodeURIComponent(part)).join('/');
}

function encodedPath(value: string): string {
  return value.split('/').map((part) => encodeURIComponent(part)).join('/');
}

function encodedRef(value: string): string {
  return encodeURIComponent(value);
}

function responseStatus(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 400 && value <= 599 ? value : 502;
}

function safeResponseRecord(payload: unknown): JsonRecord {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new GitHubWorkspaceWriteError('INVALID_GITHUB_RESPONSE', 502);
  }
  return payload as JsonRecord;
}

function normalizeFingerprintInput(kind: GitHubWriteAction, raw: unknown): JsonRecord {
  const input = object(raw);
  const repo = repository(input.repository);

  if (kind === 'deploy') {
    // This action may only invoke the audited Hafize Firebase Hosting workflow
    // on the protected main branch. No workflow name, ref, or token is accepted
    // from the browser or an LLM tool call.
    if (repo.toLowerCase() !== 'umitalgan061-sudo/hafize' ||
        Object.keys(input).some((key) => !['repository', 'action', 'ref'].includes(key)) ||
        (input.ref !== undefined && input.ref !== 'main')) {
      throw new GitHubWorkspaceWriteError('INVALID_GITHUB_ARGUMENTS');
    }
    return Object.freeze({ action: kind, repository: repo, ref: 'main' });
  }

  if (kind === 'branch') {
    return Object.freeze({
      action: kind,
      repository: repo,
      branch: branch(input.branch),
      fromRef: ref(input.fromRef)
    });
  }

  if (kind === 'file') {
    const targetBranch = branch(input.branch);
    const filePath = pathValue(input.path);
    return Object.freeze({
      action: kind,
      repository: repo,
      branch: targetBranch,
      path: filePath,
      content: content(input.content, filePath),
      message: text(input.message, MAX_COMMIT_MESSAGE, 'INVALID_GITHUB_ARGUMENTS'),
      existingSha: sha(input.existingSha)
    });
  }

  const head = branch(input.head);
  const base = ref(input.base);
  const title = text(input.title, MAX_PR_TITLE, 'INVALID_GITHUB_ARGUMENTS');
  const body = typeof input.body === 'string' ? input.body.trim().slice(0, MAX_PR_BODY) : '';
  if (containsPlaintextCredential(body)) {
    throw new GitHubWorkspaceWriteError('GITHUB_CONTENT_CREDENTIAL_BLOCKED', 403);
  }
  if (!base || head === base) throw new GitHubWorkspaceWriteError('INVALID_GITHUB_ARGUMENTS');
  return Object.freeze({
    action: kind,
    repository: repo,
    head,
    base,
    title,
    body,
    draft: bool(input.draft)
  });
}

function fingerprint(kind: GitHubWriteAction, input: unknown): string {
  const normalized = normalizeFingerprintInput(kind, input);
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

function randomApprovalToken(): string {
  return randomBytes(APPROVAL_TOKEN_BYTES).toString('hex');
}

function equalSecret(left: string, right: string): boolean {
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function createGitHubWorkspaceWriter(options: Options = {}) {
  const token = typeof options.token === 'string' ? options.token.trim() : '';
  const baseUrl = String(options.baseUrl || DEFAULT_API).replace(/\/+$/, '');
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const commitIdentity = options.commitIdentity;
  const allowedRepositories = new Set(
    (Array.isArray(options.allowedRepositories) ? options.allowedRepositories : [])
      .map((value) => String(value).trim().toLowerCase())
      .filter(Boolean)
  );
  const approvals = new Map<string, ApprovalRecord>();

  function configured(): boolean {
    return Boolean(token && typeof fetchImpl === 'function' && allowedRepositories.size);
  }

  function assertConfigured(): void {
    if (!token || typeof fetchImpl !== 'function') {
      throw new GitHubWorkspaceWriteError('GITHUB_NOT_CONFIGURED', 503);
    }
    if (!allowedRepositories.size) {
      throw new GitHubWorkspaceWriteError('GITHUB_WRITE_NOT_CONFIGURED', 503);
    }
  }

  function assertAllowed(repo: string): void {
    if (!allowedRepositories.has(repo.toLowerCase())) {
      throw new GitHubWorkspaceWriteError('GITHUB_REPO_NOT_ALLOWED', 403);
    }
  }

  function purge(now = Date.now()): void {
    for (const [ticket, record] of approvals) {
      if (record.expiresAt <= now) approvals.delete(ticket);
    }
  }

  function normalizeInput(kind: GitHubWriteAction, raw: unknown): JsonRecord {
    return normalizeFingerprintInput(kind, raw);
  }

  async function request(method: string, pathname: string, body?: JsonRecord): Promise<unknown> {
    assertConfigured();
    const url = new URL(baseUrl + pathname);
    const init: RequestInit = {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: 'Bearer ' + token,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Hafize-GitHub-Workspace-Write'
      }
    };
    if (body) {
      (init.headers as Record<string, string>)['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    init.redirect = 'error';
    init.signal = AbortSignal.timeout(45_000);
    const response = await fetchImpl(url, init);
    if (!response.ok) {
      throw new GitHubWorkspaceWriteError(
        method === 'GET' ? 'GITHUB_ENDPOINT_FAILED' : 'GITHUB_WRITE_FAILED',
        responseStatus(response.status)
      );
    }
    try {
      return await response.json();
    } catch {
      throw new GitHubWorkspaceWriteError('INVALID_GITHUB_RESPONSE', 502);
    }
  }

  async function repositoryDefaultBranch(repo: string): Promise<string> {
    const payload = safeResponseRecord(await request(
      'GET',
      '/repos/' + encodedRepository(repo)
    ));
    const defaultBranch = clamp(payload.default_branch, MAX_REF);
    if (!defaultBranch) throw new GitHubWorkspaceWriteError('INVALID_GITHUB_RESPONSE', 502);
    return defaultBranch;
  }

  async function assertWritableBranch(repo: string, targetBranch: string): Promise<string> {
    const defaultBranch = await repositoryDefaultBranch(repo);
    if (defaultBranch.toLowerCase() === targetBranch.toLowerCase()) {
      throw new GitHubWorkspaceWriteError('GITHUB_DEFAULT_BRANCH_BLOCKED', 403);
    }
    return defaultBranch;
  }

  async function resolveCommitSha(repo: string, fromRef: string): Promise<string> {
    if (SHA_PATTERN.test(fromRef)) return fromRef.toLowerCase();
    const payload = safeResponseRecord(await request(
      'GET',
      '/repos/' + encodedRepository(repo) + '/commits/' + encodedRef(fromRef)
    ));
    const resolved = clamp(payload.sha, 80);
    if (!SHA_PATTERN.test(resolved)) throw new GitHubWorkspaceWriteError('INVALID_GITHUB_RESPONSE', 502);
    return resolved.toLowerCase();
  }

  function issueApproval(kind: GitHubWriteAction, raw: unknown, approved = false): JsonRecord {
    assertConfigured();
    purge();
    const normalized = normalizeInput(kind, raw);
    const repo = String(normalized.repository);
    assertAllowed(repo);
    if (!approved) {
      throw new GitHubWorkspaceWriteError('GITHUB_WRITE_APPROVAL_REQUIRED', 428);
    }
    if (approvals.size >= MAX_APPROVALS) throw new GitHubWorkspaceWriteError('GITHUB_WRITE_APPROVAL_CAPACITY', 503);
    const ticket = randomApprovalToken();
    const expiresAt = Date.now() + APPROVAL_TTL_MS;
    approvals.set(ticket, Object.freeze({
      action: kind,
      repository: repo,
      fingerprint: fingerprint(kind, normalized),
      expiresAt
    }));
    return {
      ticket,
      action: kind,
      repository: repo,
      expiresAt
    };
  }

  function consumeApproval(ticketValue: unknown, kind: GitHubWriteAction, raw: unknown): JsonRecord {
    purge();
    const ticket = clamp(ticketValue, 128);
    if (!ticket) throw new GitHubWorkspaceWriteError('GITHUB_WRITE_APPROVAL_REQUIRED', 428);
    const record = approvals.get(ticket);
    if (!record) throw new GitHubWorkspaceWriteError('GITHUB_WRITE_APPROVAL_EXPIRED', 409);
    approvals.delete(ticket);
    if (record.expiresAt <= Date.now()) {
      throw new GitHubWorkspaceWriteError('GITHUB_WRITE_APPROVAL_EXPIRED', 409);
    }
    const normalized = normalizeInput(kind, raw);
    const repo = String(normalized.repository);
    if (
      record.action !== kind ||
      !equalSecret(record.repository.toLowerCase(), repo.toLowerCase()) ||
      record.fingerprint !== fingerprint(kind, normalized)
    ) {
      throw new GitHubWorkspaceWriteError('GITHUB_WRITE_APPROVAL_MISMATCH', 409);
    }
    return normalized;
  }

  async function createBranch(ticket: unknown, input: unknown): Promise<JsonRecord> {
    const payload = consumeApproval(ticket, 'branch', input);
    const repo = String(payload.repository);
    const newBranch = String(payload.branch);
    const fromRef = String(payload.fromRef);
    const fromSha = await resolveCommitSha(repo, fromRef);
    const response = safeResponseRecord(await request(
      'POST',
      '/repos/' + encodedRepository(repo) + '/git/refs',
      { ref: 'refs/heads/' + newBranch, sha: fromSha }
    ));
    const createdRef = clamp(response.ref, 260);
    const refObject=response.object&&typeof response.object==='object'?response.object as JsonRecord:{};
    if(createdRef!=='refs/heads/'+newBranch||refObject.type!=='commit'||sha(refObject.sha)!==fromSha)throw new GitHubWorkspaceWriteError('INVALID_GITHUB_RESPONSE',502);
    return Object.freeze({
      action: 'branch',
      repository: repo,
      branch: newBranch,
      fromRef,
      fromSha,
      ref: createdRef,
      htmlUrl: 'https://github.com/' + repo + '/tree/' + encodeURIComponent(newBranch)
    });
  }

  // Read the exact existing blob on the authorized branch, apply one unique
  // literal replacement on the server, and bind the resulting full file to
  // the existing single-use approval and GitHub blob-SHA compare-and-swap.
  async function prepareFilePatch(raw: unknown): Promise<JsonRecord> {
    const input = object(raw);
    const repo = repository(input.repository);
    assertAllowed(repo);
    const targetBranch = branch(input.branch);
    const filePath = pathValue(input.path);
    const existingSha = sha(input.existingSha);
    const before = input.find;
    const after = input.replace;
    if (!existingSha || typeof before !== 'string' || !before.length ||
        before.length > MAX_PATCH_TEXT || typeof after !== 'string' ||
        after.length > MAX_PATCH_TEXT || before === after ||
        before.includes('\0') || after.includes('\0')) {
      throw new GitHubWorkspaceWriteError('INVALID_GITHUB_ARGUMENTS');
    }
    await assertWritableBranch(repo, targetBranch);
    const snapshot = safeResponseRecord(await request('GET',
      '/repos/' + encodedRepository(repo) + '/contents/' + encodedPath(filePath) +
      '?ref=' + encodedRef(targetBranch)));
    if (snapshot.sha !== existingSha) throw new GitHubWorkspaceWriteError('GITHUB_HEAD_MOVED', 409);
    if (snapshot.type !== 'file' || snapshot.encoding !== 'base64' ||
        typeof snapshot.content !== 'string' || typeof snapshot.size !== 'number' ||
        !Number.isSafeInteger(snapshot.size) || snapshot.size < 1 || snapshot.size > MAX_CONTENT ||
        snapshot.content.length > MAX_CONTENT * 2) throw new GitHubWorkspaceWriteError('INVALID_GITHUB_RESPONSE', 502);
    const bytes = Buffer.from(snapshot.content.replace(/\s/g, ''), 'base64');
    const original = bytes.toString('utf8');
    const gitSha = createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
    if (bytes.length !== snapshot.size || gitSha !== existingSha ||
        !Buffer.from(original, 'utf8').equals(bytes) || original.includes('\0')) {
      throw new GitHubWorkspaceWriteError('INVALID_GITHUB_RESPONSE', 502);
    }
    if (containsSourcePlaintextCredential(original, filePath)) throw new GitHubWorkspaceWriteError('GITHUB_CONTENT_CREDENTIAL_BLOCKED', 403);
    const offset = original.indexOf(before);
    if (offset < 0 || original.indexOf(before, offset + 1) >= 0) {
      throw new GitHubWorkspaceWriteError('GITHUB_PATCH_ANCHOR_NOT_UNIQUE', 409);
    }
    return normalizeInput('file', { repository: repo, branch: targetBranch, path: filePath,
      existingSha, message: input.message,
      content: original.slice(0, offset) + after + original.slice(offset + before.length) });
  }

  async function commitFile(ticket: unknown, input: unknown): Promise<JsonRecord> {
    const payload = consumeApproval(ticket, 'file', input);
    const repo = String(payload.repository);
    const targetBranch = String(payload.branch);
    const filePath = String(payload.path);
    const message = String(payload.message);
    const fileContent = String(payload.content);
    const existingSha = String(payload.existingSha || '');
    await assertWritableBranch(repo, targetBranch);
    const body: JsonRecord = {
      message,
      content: Buffer.from(fileContent, 'utf8').toString('base64'),
      branch: targetBranch
    };
    if (existingSha) body.sha = existingSha;
    if (commitIdentity) {
      // Server-only identity is verified against GitHub's bot account, never
      // accepted from the browser payload or the model's tool-call arguments.
      const identity = await commitIdentity();
      const name = identity?.name;
      const email = identity?.email;
      if (typeof name !== 'string' || !/^[A-Za-z0-9_-]+\[bot\]$/.test(name) ||
          typeof email !== 'string' || !/^[1-9][0-9]*\+[A-Za-z0-9_-]+\[bot\]@users\.noreply\.github\.com$/.test(email) ||
          !email.endsWith('+' + name + '@users.noreply.github.com')) {
        throw new GitHubWorkspaceWriteError('GITHUB_BOT_IDENTITY_INVALID', 503);
      }
      body.author = { name, email };
      body.committer = { name, email };
    }
    const response = safeResponseRecord(await request(
      'PUT',
      '/repos/' + encodedRepository(repo) + '/contents/' + encodedPath(filePath),
      body
    ));
    const commit = response.commit && typeof response.commit === 'object' ? response.commit as JsonRecord : {};
    const commitSha = clamp(commit.sha, 80);
    if (!SHA_PATTERN.test(commitSha)) throw new GitHubWorkspaceWriteError('INVALID_GITHUB_RESPONSE', 502);
    return Object.freeze({
      action: 'file',
      repository: repo,
      branch: targetBranch,
      path: filePath,
      created: !existingSha,
      commitSha,
      commitUrl: clamp(commit.html_url, 500)
    });
  }

  // Verify the exact blob at the returned immutable commit, not a mutable branch.
  async function verifyFileCommit(raw: unknown, result: unknown): Promise<JsonRecord> {
    const payload = normalizeInput('file', raw);
    const repo = String(payload.repository);
    assertAllowed(repo);
    const recorded = safeResponseRecord(result);
    const commitSha = sha(recorded.commitSha);
    if (!commitSha) throw new GitHubWorkspaceWriteError('INVALID_GITHUB_RESPONSE', 502);
    const bytes = Buffer.from(String(payload.content), 'utf8');
    const expected = createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
    const checked = safeResponseRecord(await request('GET', '/repos/' + encodedRepository(repo) +
      '/contents/' + encodedPath(String(payload.path)) + '?ref=' + commitSha));
    if (checked.type !== 'file' || checked.sha !== expected || checked.size !== bytes.length) {
      throw new GitHubWorkspaceWriteError('GITHUB_COMMIT_VERIFICATION_FAILED', 502);
    }
    return Object.freeze({ ...recorded, blobSha: expected, verified: true });
  }

  // One exact open PR per source/base. Reuse only verified same-repository
  // matches. A lost POST response may be reconciled with GET, never another POST.
  async function createPullRequest(ticket: unknown, input: unknown): Promise<JsonRecord> {
    const payload = consumeApproval(ticket, 'pull', input);
    const repo = String(payload.repository);
    const head = String(payload.head);
    const base = String(payload.base);
    const root='/repos/'+encodedRepository(repo)+'/pulls';
    const parse=(raw:unknown,existing:boolean):JsonRecord=>{
      const pr=safeResponseRecord(raw);
      const h=safeResponseRecord(pr.head),b=safeResponseRecord(pr.base);
      const hr=safeResponseRecord(h.repo),br=safeResponseRecord(b.repo);
      const number=pr.number;
      if(typeof number!=='number'||!Number.isSafeInteger(number)||number<1||pr.state!=='open'||h.ref!==head||b.ref!==base||String(hr.full_name).toLowerCase()!==repo.toLowerCase()||String(br.full_name).toLowerCase()!==repo.toLowerCase()||!sha(h.sha)||typeof pr.draft!=='boolean'||(!existing&&pr.draft!==(payload.draft===true)))throw new GitHubWorkspaceWriteError('GITHUB_PR_VERIFICATION_FAILED',502);
      return Object.freeze({action:'pull',repository:repo,number,title:String(payload.title),head,base,draft:pr.draft,htmlUrl:'https://github.com/'+repo+'/pull/'+number,headSha:sha(h.sha),...(existing?{existing:true}:{})});
    };
    const observed=async()=>{
      const list=await request('GET',root+'?state=open&base='+encodeURIComponent(base)+'&head='+encodeURIComponent(repo.split('/')[0]+':'+head)+'&per_page=100');
      if(!Array.isArray(list)||list.length>1)throw new GitHubWorkspaceWriteError('GITHUB_PR_VERIFICATION_FAILED',502);
      return list.length?parse(list[0],true):null;
    };
    let existing:JsonRecord|null;
    try{existing=await observed();}catch{throw new GitHubWorkspaceWriteError('GITHUB_PR_PREFLIGHT_FAILED',409);}
    if(existing)return existing;
    const body:JsonRecord={title:String(payload.title),head,base,draft:payload.draft===true};
    if(payload.body)body.body=String(payload.body);
    try{return parse(await request('POST',root,body),false);}
    catch(error){
      try{const recovered=await observed();if(recovered)return recovered;}catch{/* Keep uncertainty. */}
      if(error instanceof GitHubWorkspaceWriteError&&error.code==='GITHUB_WRITE_FAILED'&&[400,401,403,404,409,422].includes(error.status))throw error;
      throw new GitHubWorkspaceWriteError('GITHUB_PR_VERIFICATION_FAILED',502);
    }
  }

  async function dispatchFirebaseDeploy(ticket: unknown, input: unknown): Promise<JsonRecord> {
    const payload = consumeApproval(ticket, 'deploy', input);
    const repo = String(payload.repository);
    assertAllowed(repo);
    const workflow = 'firebase-hosting-live.yml';
    // GitHub's workflow_dispatch API returns HTTP 204 with *no JSON body*.
    // Reuse server-only short-lived GitHub App / PAT credentials. No redirect
    // may send an installation token outside api.github.com.
    const url = new URL(baseUrl + '/repos/' + encodedRepository(repo) +
      '/actions/workflows/' + workflow + '/dispatches');
    const response = await fetchImpl(url, {
      method: 'POST',
      redirect: 'error',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: 'Bearer ' + token,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'User-Agent': 'Hafize-GitHub-Workspace-Write'
      },
      body: JSON.stringify({ ref: 'main' })
    });
    if (response.status !== 204) {
      throw new GitHubWorkspaceWriteError('GITHUB_WRITE_FAILED', responseStatus(response.status));
    }
    return Object.freeze({
      action: 'deploy',
      repository: repo,
      workflow,
      ref: 'main',
      htmlUrl: 'https://github.com/' + repo + '/actions/workflows/' + workflow,
      queued: true
    });
  }

  return Object.freeze({
    configured,
    issueApproval,
    createBranch,
    commitFile,
    prepareFilePatch,
    verifyFileCommit,
    createPullRequest,
    dispatchFirebaseDeploy,
    limits: Object.freeze({
      maxRepository: MAX_REPOSITORY,
      maxRef: MAX_REF,
      maxBranch: MAX_BRANCH,
      maxPath: MAX_PATH,
      maxContent: MAX_CONTENT,
      maxCommitMessage: MAX_COMMIT_MESSAGE,
      maxPrTitle: MAX_PR_TITLE,
      maxPrBody: MAX_PR_BODY,
      approvalTtlMs: APPROVAL_TTL_MS,
      maxApprovals: MAX_APPROVALS
    }),
    normalizeInput
  });
}
