// Local shim layer: tools that act on this computer, confined to one workspace folder
// (HAFIZE_WORKSPACE_DIR, default <project>/workspace). Files can be listed, read and written (writes
// are undoable); SQLite databases in the folder can be queried (read-only unless approved); shell
// commands always need the user's explicit approval for each call and run with a scrubbed
// environment, a timeout and an output cap.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { containsPlaintextCredential, redactPlaintextCredentials } from './plaintext-credential-policy.ts';

export const LOCAL_TOOL_LIMITS = Object.freeze({ maxFileBytes: 1024 * 1024, maxListEntries: 300, maxRows: 200, shellTimeoutMs: 60_000, maxShellOutput: 64 * 1024 });
const TEXT_EXTENSIONS = /^\.(txt|md|markdown|json|csv|tsv|html?|css|js|mjs|cjs|ts|tsx|jsx|py|java|c|h|cpp|cs|go|rs|rb|php|sql|xml|yaml|yml|toml|ini|log|sh|ps1|bat|svg)$/i;

export class LocalToolError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 400) { super(code); this.name = 'LocalToolError'; this.code = code; this.status = status; }
}

export type ApprovalRequester = (request: { readonly kind: string; readonly title: string; readonly detail: string; readonly risk: 'low' | 'medium' | 'high' }) => Promise<boolean>;

export function createLocalTools({ workspaceDir }: { readonly workspaceDir: string }) {
  mkdirSync(workspaceDir, { recursive: true });
  const root = realpathSync(workspaceDir);

  /** Resolves a workspace-relative path, refusing anything that escapes the folder (incl. via links). */
  function resolvePath(raw: unknown, { mustExist = false }: { readonly mustExist?: boolean } = {}): string {
    const text = typeof raw === 'string' ? raw.trim() : '';
    if (!text || text.length > 400 || isAbsolute(text) || /^[a-z]:/i.test(text) || text.includes('\0')) throw new LocalToolError('INVALID_WORKSPACE_PATH');
    const target = resolve(root, text);
    if (target !== root && !target.startsWith(root + sep)) throw new LocalToolError('WORKSPACE_TRAVERSAL', 403);
    if (existsSync(target)) {
      const real = realpathSync(target);
      if (real !== root && !real.startsWith(root + sep)) throw new LocalToolError('WORKSPACE_TRAVERSAL', 403);
    } else if (mustExist) {
      throw new LocalToolError('WORKSPACE_FILE_NOT_FOUND', 404);
    }
    return target;
  }

  function list(args: { readonly path?: unknown }) {
    const dir = args.path === undefined || args.path === '' || args.path === '.' ? root : resolvePath(args.path, { mustExist: true });
    if (!statSync(dir).isDirectory()) throw new LocalToolError('NOT_A_DIRECTORY');
    const entries = readdirSync(dir, { withFileTypes: true }).slice(0, LOCAL_TOOL_LIMITS.maxListEntries).map((entry) => {
      const full = join(dir, entry.name);
      const info = statSync(full);
      return { name: entry.name, path: relative(root, full).split(sep).join('/'), type: entry.isDirectory() ? 'directory' : 'file', size: entry.isDirectory() ? null : info.size, modified: info.mtime.toISOString() };
    });
    return { workspace: root, path: relative(root, dir).split(sep).join('/') || '.', entries };
  }

  function read(args: { readonly path?: unknown }) {
    const file = resolvePath(args.path, { mustExist: true });
    const info = statSync(file);
    if (!info.isFile()) throw new LocalToolError('NOT_A_FILE');
    if (info.size > LOCAL_TOOL_LIMITS.maxFileBytes) throw new LocalToolError('WORKSPACE_FILE_TOO_LARGE', 413);
    if (!TEXT_EXTENSIONS.test(extname(file))) throw new LocalToolError('WORKSPACE_FILE_NOT_TEXT', 415);
    const content = readFileSync(file, 'utf8');
    return { path: relative(root, file).split(sep).join('/'), size: info.size, content: redactPlaintextCredentials(content) };
  }

  /** Writes a text file; returns what is needed to undo the write. */
  function write(args: { readonly path?: unknown; readonly content?: unknown; readonly append?: unknown }) {
    const file = resolvePath(args.path);
    if (!TEXT_EXTENSIONS.test(extname(file))) throw new LocalToolError('WORKSPACE_FILE_NOT_TEXT', 415);
    const content = typeof args.content === 'string' ? args.content : '';
    if (Buffer.byteLength(content) > LOCAL_TOOL_LIMITS.maxFileBytes) throw new LocalToolError('WORKSPACE_FILE_TOO_LARGE', 413);
    if (containsPlaintextCredential(content)) throw new LocalToolError('WORKSPACE_SECRET_BLOCKED', 403);
    const existed = existsSync(file);
    if (existed && !statSync(file).isFile()) throw new LocalToolError('NOT_A_FILE');
    const previous = existed ? readFileSync(file, 'utf8') : null;
    if (previous !== null && Buffer.byteLength(previous) > LOCAL_TOOL_LIMITS.maxFileBytes) throw new LocalToolError('WORKSPACE_FILE_TOO_LARGE', 413);
    mkdirSync(dirname(file), { recursive: true });
    const next = args.append === true && previous !== null ? previous + content : content;
    writeFileSync(file, next, 'utf8');
    const path = relative(root, file).split(sep).join('/');
    return { result: { path, bytes: Buffer.byteLength(next), created: !existed }, undo: { path, previous } };
  }

  /** Compensation for write: restores the previous content or removes a created file. */
  function restore(payload: Readonly<Record<string, unknown>>) {
    const file = resolvePath(payload.path);
    if (payload.previous === null || payload.previous === undefined) {
      if (existsSync(file)) rmSync(file);
      return { path: payload.path, removed: true };
    }
    writeFileSync(file, String(payload.previous), 'utf8');
    return { path: payload.path, restored: true };
  }

  async function sqlite(args: { readonly path?: unknown; readonly sql?: unknown; readonly params?: unknown }, requestApproval?: ApprovalRequester) {
    const file = resolvePath(args.path, { mustExist: true });
    if (!/\.(db|sqlite|sqlite3)$/i.test(file)) throw new LocalToolError('NOT_A_SQLITE_FILE', 415);
    const sql = typeof args.sql === 'string' ? args.sql.trim() : '';
    if (!sql || sql.length > 10_000) throw new LocalToolError('INVALID_SQL');
    const params = Array.isArray(args.params) ? args.params.slice(0, 50).map((value) => (typeof value === 'number' || typeof value === 'string' || value === null ? value : String(value))) : [];
    const readOnly = /^\s*(select|with|explain|pragma\s+table_info|pragma\s+index_list)\b/i.test(sql) && !/;\s*\S/.test(sql.replace(/;\s*$/, ''));
    if (!readOnly) {
      if (!requestApproval) throw new LocalToolError('SQLITE_WRITE_NEEDS_APPROVAL', 403);
      const approved = await requestApproval({ kind: 'sqlite.write', title: 'Veritabanında değişiklik yapılsın mı?', detail: `${relative(root, file)}\n\n${sql}`, risk: 'medium' });
      if (!approved) throw new LocalToolError('APPROVAL_DENIED', 403);
    }
    const db = new DatabaseSync(file, { readOnly });
    try {
      if (readOnly) {
        const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;
        return { rows: rows.slice(0, LOCAL_TOOL_LIMITS.maxRows), rowCount: rows.length, truncated: rows.length > LOCAL_TOOL_LIMITS.maxRows };
      }
      const result = db.prepare(sql).run(...params);
      return { changes: Number(result.changes), lastInsertRowid: Number(result.lastInsertRowid) };
    } catch (error) {
      throw Object.assign(new LocalToolError('SQLITE_ERROR'), { detail: String((error as Error).message).slice(0, 300) });
    } finally {
      db.close();
    }
  }

  /** Runs a shell command in the workspace after explicit approval of that exact command. */
  async function shell(args: { readonly command?: unknown; readonly timeoutMs?: unknown }, requestApproval?: ApprovalRequester, signal?: AbortSignal) {
    const command = typeof args.command === 'string' ? args.command.trim() : '';
    if (!command || command.length > 4_000) throw new LocalToolError('INVALID_COMMAND');
    if (!requestApproval) throw new LocalToolError('SHELL_NEEDS_APPROVAL', 403);
    const approved = await requestApproval({ kind: 'shell.run', title: 'Bu komut bilgisayarında çalıştırılsın mı?', detail: `Klasör: ${root}\n\n${command}`, risk: 'high' });
    if (!approved) throw new LocalToolError('APPROVAL_DENIED', 403);
    const timeoutMs = Math.min(Math.max(Number(args.timeoutMs) || 30_000, 1_000), LOCAL_TOOL_LIMITS.shellTimeoutMs);
    // Secrets of the server process never reach the command.
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/KEY|TOKEN|SECRET|PASSWORD|PASS|CREDENTIAL|NVIDIA|HAFIZE_|GITHUB|AWS_|AZURE_|GOOGLE_/i.test(key)));
    const isWindows = process.platform === 'win32';
    const executable = isWindows ? 'powershell.exe' : '/bin/sh';
    const argv = isWindows ? ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', `[Console]::OutputEncoding=[Text.Encoding]::UTF8; ${command}`] : ['-c', command];
    const startedAt = Date.now();
    return new Promise<{ exitCode: number | null; stdout: string; stderr: string; timedOut: boolean; durationMs: number }>((resolveRun) => {
      const child = spawn(executable, argv, { cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      const cap = (current: string, chunk: Buffer) => (current.length < LOCAL_TOOL_LIMITS.maxShellOutput ? current + chunk.toString('utf8') : current);
      child.stdout.on('data', (chunk: Buffer) => { stdout = cap(stdout, chunk); });
      child.stderr.on('data', (chunk: Buffer) => { stderr = cap(stderr, chunk); });
      const kill = () => { if (child.exitCode === null) child.kill(); };
      const timer = setTimeout(() => { timedOut = true; kill(); }, timeoutMs);
      signal?.addEventListener('abort', kill, { once: true });
      child.on('error', () => { clearTimeout(timer); resolveRun({ exitCode: null, stdout, stderr: stderr || 'SHELL_START_FAILED', timedOut, durationMs: Date.now() - startedAt }); });
      child.on('close', (exitCode) => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', kill);
        resolveRun({ exitCode, stdout: redactPlaintextCredentials(stdout.slice(0, LOCAL_TOOL_LIMITS.maxShellOutput)), stderr: redactPlaintextCredentials(stderr.slice(0, 8_000)), timedOut, durationMs: Date.now() - startedAt });
      });
    });
  }

  return Object.freeze({ list, read, write, restore, sqlite, shell, root });
}
export type LocalTools = ReturnType<typeof createLocalTools>;
