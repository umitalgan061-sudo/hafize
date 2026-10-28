// Developer-environment tools: a structured test runner and a git worktree/branch helper.
// Both are confined to one workspace folder, the same boundary the local tools use, and both keep
// every action undoable or auditable. Test runs are read-only by nature (they execute code, never
// mutate the repo); branch writes are explicitly approval-gated because they change shared state.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { redactPlaintextCredentials } from './plaintext-credential-policy.ts';

const MAX_OUTPUT = 64 * 1024;
const MAX_LOG_BYTES = 2 * 1024 * 1024;
const BRANCH = /^[a-z0-9][a-z0-9._\/-]{0,119}$/i;
/** Only these test commands can run; anything else must go through shell_run with approval. */
const RUNNERS = new Set(['npm test', 'npm run test', 'npx vitest run', 'npx jest', 'npx pytest', 'go test ./...']);

// Every git call runs with settings that switch off the ways a repository can make git execute
// programs or write outside the repo (fsmonitor hooks, pagers, external diff, ssh/credential
// helpers), whatever .git/config says.
const SAFE_GIT_CONFIG = ['-c', 'core.fsmonitor=false', '-c', 'core.pager=cat', '-c', 'diff.external=', '-c', 'core.sshCommand=false', '-c', 'credential.helper=', '-c', 'core.hooksPath=/dev/null', '-c', 'protocol.allow=never'];
/** Options that run programs, write files or redirect git elsewhere; refused in every command. */
const FORBIDDEN_GIT_OPTION = /^(?:-c|-C|--config(?:-env)?|--exec(?:-path)?|--upload-pack|--receive-pack|--git-dir|--work-tree|--namespace|--output|--ext-diff|--textconv|--open-files-in-pager|-O|-o|--paginate|--super-prefix)(?:=|$)/;
const READ_ONLY_GIT = new Set(['status', 'diff', 'log', 'show', 'rev-parse', 'ls-files', 'blame', 'describe', 'shortlog', 'branch', 'tag', 'remote']);
/** Listing flags allowed for the verbs that can also mutate (branch / tag / remote). */
const LIST_ONLY = Object.freeze({ branch: /^(?:--list|-l|-a|--all|-r|--remotes|-v|-vv|--verbose|--show-current|--no-color|--contains|--merged|--no-merged)$/, tag: /^(?:--list|-l|-n\d*|--sort=.*|--contains|--merged|--no-merged)$/, remote: /^(?:-v|--verbose|show|get-url)$/ });

/** Accepts only read-only git invocations (the git_run tool's policy). Throws on anything else. */
export function assertReadOnlyGit(args: readonly string[]): void {
  const verb = String(args[0] || '').toLowerCase();
  if (!READ_ONLY_GIT.has(verb)) throw new DevToolError('GIT_WRITE_NOT_ALLOWED', 403);
  const rest = args.slice(1);
  const listOnly = (LIST_ONLY as Record<string, RegExp>)[verb];
  if (listOnly) {
    // branch/tag/remote mutate with positional arguments (git branch yeni, git tag v1, git remote add ...).
    const remoteNames = verb === 'remote' && /^(?:show|get-url)$/.test(rest[0] || '');
    for (const [index, arg] of rest.entries()) {
      if (listOnly.test(arg)) continue;
      if (remoteNames && index > 0 && /^[A-Za-z0-9._-]{1,60}$/.test(arg)) continue;
      if ((verb === 'branch' || verb === 'tag') && index > 0 && /^--(?:contains|merged|no-merged)$/.test(rest[index - 1] || '') && /^[A-Za-z0-9._\/-]{1,120}$/.test(arg)) continue;
      throw new DevToolError('GIT_WRITE_NOT_ALLOWED', 403);
    }
  }
}

export class DevToolError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 400) { super(code); this.name = 'DevToolError'; this.code = code; this.status = status }
}

function fail(code: string, status = 400): never {
  throw new DevToolError(code, status);
}

function resolveInWorkspace(root: string, raw: unknown, { mustExist = false }: { readonly mustExist?: boolean } = {}): string {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text || text.length > 400) fail('INVALID_WORKSPACE_PATH');
  const target = join(root, text);
  if (target !== root && !target.startsWith(root + sep)) fail('WORKSPACE_TRAVERSAL', 403);
  if (mustExist && !existsSync(target)) fail('WORKSPACE_FILE_NOT_FOUND', 404);
  return target;
}

export interface DevToolsDeps {
  readonly workspaceDir: string;
  readonly now?: () => Date;
}

export function createDevTools({ workspaceDir, now = () => new Date() }: DevToolsDeps) {
  mkdirSync(workspaceDir, { recursive: true });
  const resultsDir = join(workspaceDir, '.hafize-test-results');
  mkdirSync(resultsDir, { recursive: true });

  /** Runs a whitelisted test command and stores a structured, replayable result. */
  async function runTests(input: { readonly command?: unknown; readonly scope?: unknown; readonly timeoutMs?: unknown }, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const requested = typeof input?.command === 'string' ? input.command.trim() : 'npm test';
    const command = RUNNERS.has(requested) ? requested : fail('UNSUPPORTED_TEST_COMMAND');
    const scope = typeof input?.scope === 'string' ? input.scope.trim().slice(0, 200) : '';
    if (scope && !/^[a-zA-Z0-9_./-]+$/.test(scope)) fail('INVALID_TEST_SCOPE');
    const timeoutMs = Math.min(Math.max(Number(input?.timeoutMs) || 120_000, 5_000), 300_000);
    const isWindows = process.platform === 'win32';
    const executable = isWindows ? 'powershell.exe' : '/bin/sh';
    const argv = isWindows
      ? ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', `[Console]::OutputEncoding=[Text.Encoding]::UTF8; ${command}${scope ? ` -- ${scope}` : ''}`]
      : ['-c', `${command}${scope ? ` ${scope}` : ''}`];
    const runId = `run_${now().getTime().toString(36)}`;
    const startedAt = Date.now();
    const outcome = await new Promise<{ exitCode: number | null; stdout: string; stderr: string; timedOut: boolean }>((resolveRun) => {
      // Secrets of the server process never reach the test process.
      const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/KEY|TOKEN|SECRET|PASSWORD|PASS|CREDENTIAL|NVIDIA|HAFIZE_|GITHUB|AWS_|AZURE_|GOOGLE_/i.test(key)));
      const child = spawn(executable, argv, { cwd: workspaceDir, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      const cap = (current: string, chunk: Buffer) => (current.length < MAX_OUTPUT ? current + chunk.toString('utf8') : current);
      child.stdout.on('data', (chunk: Buffer) => { stdout = cap(stdout, chunk); });
      child.stderr.on('data', (chunk: Buffer) => { stderr = cap(stderr, chunk); });
      const kill = () => { if (child.exitCode === null) child.kill(); };
      const timer = setTimeout(() => { timedOut = true; kill(); }, timeoutMs);
      signal?.addEventListener('abort', kill, { once: true });
      child.on('error', () => { clearTimeout(timer); resolveRun({ exitCode: null, stdout, stderr: stderr || 'TEST_START_FAILED', timedOut }); });
      child.on('close', (exitCode) => { clearTimeout(timer); signal?.removeEventListener('abort', kill); resolveRun({ exitCode, stdout, stderr, timedOut }); });
    });
    const ok = outcome.exitCode === 0 && !outcome.timedOut;
    const record = {
      runId,
      command,
      ...(scope ? { scope } : {}),
      ok,
      exitCode: outcome.exitCode,
      timedOut: outcome.timedOut,
      durationMs: Date.now() - startedAt,
      startedAt: new Date(startedAt).toISOString(),
      stdout: redactPlaintextCredentials(outcome.stdout.slice(0, MAX_OUTPUT)),
      stderr: redactPlaintextCredentials(outcome.stderr.slice(0, 8_000))
    };
    writeFileSync(join(resultsDir, `${runId}.json`), JSON.stringify(record, null, 2), 'utf8');
    return record;
  }

  /** Reads back a stored test run (or the most recent one) for follow-up questions. */
  function readTestResult(input: { readonly runId?: unknown } = {}): Record<string, unknown> {
    const requested = typeof input?.runId === 'string' ? input.runId.trim() : '';
    if (requested && !/^run_[a-z0-9]{1,24}$/.test(requested)) fail('INVALID_TEST_RUN_ID');
    if (requested) {
      const file = join(resultsDir, `${requested}.json`);
      if (!existsSync(file)) fail('TEST_RUN_NOT_FOUND', 404);
      return JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
    }
    const latest = existsSync(resultsDir)
      ? readdirSync(resultsDir).filter((name: string) => name.endsWith('.json')).sort().pop()
      : undefined;
    if (!latest) fail('TEST_RUN_NOT_FOUND', 404);
    return JSON.parse(readFileSync(join(resultsDir, String(latest)), 'utf8')) as Record<string, unknown>;
  }

  /** Runs git in the workspace folder; the caller decides which verbs are allowed. */
  async function git(input: { readonly args?: readonly unknown[] }, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const args = Array.isArray(input?.args) ? input.args.map((item) => String(item)) : [];
    if (!args.length || args.length > 12) fail('INVALID_GIT_ARGS');
    if (args.some((arg) => /[\0\r\n]/.test(arg) || arg.length > 200)) fail('INVALID_GIT_ARGS');
    if (args.some((arg) => FORBIDDEN_GIT_OPTION.test(arg))) fail('GIT_OPTION_NOT_ALLOWED', 403);
    // Secrets of the server process never reach git (or anything it might start). GIT_CONFIG_* is
    // cleared as a set: a surviving GIT_CONFIG_COUNT whose KEY/VALUE pairs were stripped makes git
    // fail with "missing config key", so the count has to go too.
    const env = {
      ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !/KEY|TOKEN|SECRET|PASSWORD|PASS|CREDENTIAL|NVIDIA|HAFIZE_|GITHUB|AWS_|AZURE_|GOOGLE_/i.test(key))),
      ...Object.fromEntries(Object.entries(process.env).filter(([key]) => /^GIT_CONFIG_(?:COUNT|KEY_|VALUE_)/.test(key)).map(([key]) => [key, ''])),
      GIT_TERMINAL_PROMPT: '0',
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_PAGER: 'cat'
    };
    const outcome = await new Promise<{ exitCode: number | null; stdout: string; stderr: string }>((resolveRun) => {
      const child = spawn('git', ['--no-pager', ...SAFE_GIT_CONFIG, ...args], { cwd: workspaceDir, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk: Buffer) => { stdout = cap(stdout, chunk); });
      child.stderr.on('data', (chunk: Buffer) => { stderr = cap(stderr, chunk); });
      const kill = () => { if (child.exitCode === null) child.kill(); };
      signal?.addEventListener('abort', kill, { once: true });
      child.on('error', () => resolveRun({ exitCode: null, stdout, stderr: 'GIT_START_FAILED' }));
      child.on('close', (exitCode) => { signal?.removeEventListener('abort', kill); resolveRun({ exitCode, stdout, stderr }); });
    });
    return { ok: outcome.exitCode === 0, exitCode: outcome.exitCode, stdout: redactPlaintextCredentials(outcome.stdout.slice(0, MAX_OUTPUT)), stderr: redactPlaintextCredentials(outcome.stderr.slice(0, 8_000)) };
  }

  function cap(current: string, chunk: Buffer): string {
    return current.length < MAX_OUTPUT ? current + chunk.toString('utf8') : current;
  }

  return Object.freeze({ runTests, readTestResult, git, workspaceDir, resultsDir });
}

export type DevTools = ReturnType<typeof createDevTools>;
