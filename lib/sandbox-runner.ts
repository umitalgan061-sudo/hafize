// Sandboxed executor for model- or user-written JavaScript. Each run gets its own Node process
// started with the permission model (no file system, no child processes, no workers, no native
// addons), an empty environment, a heap cap and a wall-clock timeout. Inside that process the code
// runs in a fresh vm context that only sees `input`, `console`, standard built-ins and - when the
// manifest declares network access - a fetch limited to public https URLs.
import { spawn } from 'node:child_process';

export interface SandboxPermissions { readonly network?: boolean }
export interface SandboxRunResult {
  readonly ok: boolean;
  readonly result?: unknown;
  readonly logs: readonly string[];
  readonly error?: string;
  readonly durationMs: number;
  readonly timedOut: boolean;
}

export const SANDBOX_LIMITS = Object.freeze({ maxCode: 40_000, maxInput: 200_000, maxOutput: 256 * 1024, defaultTimeoutMs: 5_000, maxTimeoutMs: 30_000, heapMb: 96 });

// Runs inside the child. It captures what it needs, then removes every path back to Node APIs
// before evaluating untrusted code.
const RUNNER = String.raw`
const vm = require('node:vm');
const util = require('node:util');
const hostFetch = globalThis.fetch;
const write = process.stdout.write.bind(process.stdout);
const exit = process.exit.bind(process);
for (const name of ['require', 'module', 'exports', '__filename', '__dirname', 'fetch', 'WebSocket', 'EventSource', 'XMLHttpRequest']) { try { delete globalThis[name]; } catch {} try { globalThis[name] = undefined; } catch {} }
const deny = () => { throw new Error('SANDBOX_DENIED'); };
for (const name of ['getBuiltinModule', 'binding', '_linkedBinding', 'dlopen', 'kill', 'chdir', 'setuid', 'setgid']) { try { process[name] = deny; } catch {} }
const chunks = [];
process.stdin.on('data', (chunk) => chunks.push(chunk));
process.stdin.on('end', async () => {
  const job = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const logs = [];
  let logBytes = 0;
  const log = (...args) => { const line = args.map((arg) => typeof arg === 'string' ? arg : util.inspect(arg, { depth: 4, breakLength: 120 })).join(' '); if (logBytes < 64000) { logs.push(line.slice(0, 4000)); logBytes += line.length; } };
  const safeFetch = async (url, init = {}) => {
    const target = new URL(String(url));
    if (target.protocol !== 'https:' || /^(localhost|.*\.local|.*\.internal)$/i.test(target.hostname) || /^[\d.]+$|^\[|:/.test(target.hostname)) throw new Error('SANDBOX_URL_BLOCKED');
    const response = await hostFetch(target, { method: init.method || 'GET', headers: init.headers, body: init.body, redirect: 'error', signal: AbortSignal.timeout(10000) });
    const text = (await response.text()).slice(0, 500000);
    return { ok: response.ok, status: response.status, headers: Object.fromEntries(response.headers), text: async () => text, json: async () => JSON.parse(text) };
  };
  const sandbox = { input: job.input, console: { log, info: log, warn: log, error: log, debug: log }, setTimeout, clearTimeout, URL, URLSearchParams, TextEncoder, TextDecoder, structuredClone, atob, btoa };
  if (job.network) sandbox.fetch = safeFetch;
  const context = vm.createContext(sandbox, { codeGeneration: { strings: false, wasm: false }, name: 'hafize-sandbox' });
  const send = (payload) => { write('\n@@HAFIZE_SANDBOX@@' + JSON.stringify(payload) + '\n'); exit(0); };
  try {
    const script = new vm.Script('(async () => {\n' + job.code + '\n})()', { filename: 'skill.js' });
    const value = await script.runInContext(context, { timeout: job.timeoutMs, breakOnSigint: true });
    let result;
    try { result = value === undefined ? null : JSON.parse(JSON.stringify(value)); } catch { result = util.inspect(value, { depth: 4 }); }
    send({ ok: true, result, logs });
  } catch (error) {
    send({ ok: false, error: String(error && error.message || error).slice(0, 2000), logs });
  }
});
`;

export function createSandboxRunner({ nodePath = process.execPath, heapMb = SANDBOX_LIMITS.heapMb }: { readonly nodePath?: string; readonly heapMb?: number } = {}) {
  let active = 0;
  const waiting: Array<() => void> = [];
  // At most four sandboxes run at once; later runs wait in a short queue.
  async function acquire(): Promise<void> {
    if (active < 4) { active += 1; return; }
    if (waiting.length >= 20) throw Object.assign(new Error('SANDBOX_BUSY'), { code: 'SANDBOX_BUSY', status: 429 });
    await new Promise<void>((resolve) => waiting.push(resolve));
  }
  function release(): void {
    const next = waiting.shift();
    if (next) next(); else active -= 1;
  }

  async function run({ code, input = null, timeoutMs = SANDBOX_LIMITS.defaultTimeoutMs, permissions = {}, signal }: { readonly code: string; readonly input?: unknown; readonly timeoutMs?: number; readonly permissions?: SandboxPermissions; readonly signal?: AbortSignal | undefined }): Promise<SandboxRunResult> {
    if (typeof code !== 'string' || !code.trim()) throw Object.assign(new Error('INVALID_SANDBOX_CODE'), { code: 'INVALID_SANDBOX_CODE', status: 400 });
    if (code.length > SANDBOX_LIMITS.maxCode) throw Object.assign(new Error('SANDBOX_CODE_TOO_LARGE'), { code: 'SANDBOX_CODE_TOO_LARGE', status: 413 });
    const payload = JSON.stringify({ code, input, timeoutMs: Math.min(Math.max(Math.trunc(timeoutMs), 100), SANDBOX_LIMITS.maxTimeoutMs), network: permissions.network === true });
    if (payload.length > SANDBOX_LIMITS.maxInput + SANDBOX_LIMITS.maxCode) throw Object.assign(new Error('SANDBOX_INPUT_TOO_LARGE'), { code: 'SANDBOX_INPUT_TOO_LARGE', status: 413 });
    await acquire();
    const startedAt = Date.now();
    const wallMs = Math.min(Math.max(Math.trunc(timeoutMs), 100), SANDBOX_LIMITS.maxTimeoutMs) + 1_500;
    try {
      return await new Promise<SandboxRunResult>((resolve) => {
        const child = spawn(nodePath, ['--permission', `--max-old-space-size=${heapMb}`, '--stack-size=1000', '--disallow-code-generation-from-strings', '-e', RUNNER], { env: {}, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
        let stdout = '';
        let stderr = '';
        let timedOut = false;
        let settled = false;
        const finish = (value: Omit<SandboxRunResult, 'durationMs' | 'timedOut'>) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          signal?.removeEventListener('abort', onAbort);
          if (child.exitCode === null) child.kill('SIGKILL');
          resolve(Object.freeze({ ...value, durationMs: Date.now() - startedAt, timedOut }));
        };
        const onAbort = () => finish({ ok: false, error: 'SANDBOX_ABORTED', logs: [] });
        const timer = setTimeout(() => { timedOut = true; finish({ ok: false, error: 'SANDBOX_TIMEOUT', logs: [] }); }, wallMs);
        signal?.addEventListener('abort', onAbort, { once: true });
        child.stdout.on('data', (chunk: Buffer) => {
          stdout += chunk.toString('utf8');
          if (stdout.length > SANDBOX_LIMITS.maxOutput) finish({ ok: false, error: 'SANDBOX_OUTPUT_TOO_LARGE', logs: [] });
        });
        child.stderr.on('data', (chunk: Buffer) => { if (stderr.length < 8_000) stderr += chunk.toString('utf8'); });
        child.on('error', () => finish({ ok: false, error: 'SANDBOX_START_FAILED', logs: [] }));
        child.on('close', (exitCode) => {
          const marker = stdout.lastIndexOf('@@HAFIZE_SANDBOX@@');
          if (marker >= 0) {
            try {
              const parsed = JSON.parse(stdout.slice(marker + 18).split('\n')[0]!) as { ok: boolean; result?: unknown; error?: string; logs?: string[] };
              finish({ ok: parsed.ok === true, ...(parsed.ok ? { result: parsed.result } : { error: parsed.error || 'SANDBOX_ERROR' }), logs: Object.freeze((parsed.logs || []).slice(0, 200)) });
              return;
            } catch { /* fall through */ }
          }
          const oom = /heap out of memory|Allocation failed/i.test(stderr);
          finish({ ok: false, error: oom ? 'SANDBOX_MEMORY_LIMIT' : `SANDBOX_CRASHED${exitCode === null ? '' : `:${exitCode}`}`, logs: [] });
        });
        child.stdin.on('error', () => {});
        child.stdin.end(payload);
      });
    } finally {
      release();
    }
  }

  return Object.freeze({ run });
}
export type SandboxRunner = ReturnType<typeof createSandboxRunner>;
