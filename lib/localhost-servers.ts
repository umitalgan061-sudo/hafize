// Local web servers Hafize starts on the user's behalf. A folder inside the workspace can be
// published as static files without asking; a command (npm run dev, node app.js, ...) runs code, so
// it needs the same approval as shell_run. There is deliberately no cap on how many may run at once.
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, realpathSync, statSync } from 'node:fs';
// http.Server, not http.createServer: the production guard patches the latter, and these servers
// are not Hafize's own API.
import { Server as HttpServer } from 'node:http';
import { connect, createServer as createNetServer } from 'node:net';
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import type { ApprovalRequester } from './local-tools.ts';
import { redactPlaintextCredentials } from './plaintext-credential-policy.ts';

export class LocalhostError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 400) { super(code); this.code = code; this.status = status; }
}

type Approver = ApprovalRequester;
type ServerKind = 'static' | 'command';
type ServerStatus = 'starting' | 'running' | 'exited';

interface Entry {
  readonly id: string;
  readonly ownerId: string;
  readonly name: string;
  readonly kind: ServerKind;
  readonly path: string;
  readonly command: string;
  readonly startedAt: string;
  port: number;
  status: ServerStatus;
  exitCode: number | null;
  log: string;
  stop: () => void;
}

const MAX_LOG_CHARS = 32 * 1024;
const MAX_EXITED_KEPT = 50;
const READY_TIMEOUT_MS = 40_000;
const READY_POLL_MS = 250;
const LISTEN_URL = /(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1?\]):(\d{2,5})/;
// Never handed out by the static server, whatever the folder contains.
const SECRET_NAME = /(^|[._-])(env|credentials?|secrets?|tokens?|private[._-]?keys?|master)([._-]|$)|\.(pem|key|p12|pfx)$/i;
const MIME: Readonly<Record<string, string>> = Object.freeze({
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.map': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.csv': 'text/csv; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.mp4': 'video/mp4', '.webm': 'video/webm', '.pdf': 'application/pdf', '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json'
});

function isInside(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

/** Resolves a request path to a file the static server may send, or null. */
export function resolveStaticFile(root: string, requestPath: string): string | null {
  let decoded: string;
  try { decoded = decodeURIComponent(requestPath); } catch { return null; }
  if (decoded.includes('\0')) return null;
  const segments = decoded.split(/[\\/]+/).filter(Boolean);
  if (segments.some((part) => part === '..' || part.startsWith('.') || SECRET_NAME.test(part))) return null;
  let target = resolve(root, ...segments);
  if (!isInside(root, target) || !existsSync(target)) return null;
  try {
    if (statSync(target).isDirectory()) target = join(target, 'index.html');
    if (!existsSync(target) || !statSync(target).isFile()) return null;
    // A link inside the folder must not lead out of it.
    return isInside(realpathSync(root), realpathSync(target)) ? target : null;
  } catch { return null; }
}

function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const probe = createNetServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      probe.close(() => (port ? resolvePort(port) : reject(new LocalhostError('LOCALHOST_NO_PORT', 500))));
    });
  });
}

function portAnswers(port: number): Promise<boolean> {
  return new Promise((done) => {
    const socket = connect({ port, host: '127.0.0.1' });
    const finish = (value: boolean) => { socket.destroy(); done(value); };
    socket.setTimeout(500, () => finish(false));
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });
}

function killTree(pid: number | undefined): void {
  if (!pid) return;
  if (process.platform === 'win32') { spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); return; }
  try { process.kill(-pid, 'SIGTERM'); } catch { /* already gone */ }
}

export function createLocalhostServers({ workspaceDir }: { readonly workspaceDir: string }) {
  const root = resolve(workspaceDir);
  const entries = new Map<string, Entry>();

  const view = (entry: Entry) => Object.freeze({
    id: entry.id, name: entry.name, kind: entry.kind, path: entry.path, command: entry.command, startedAt: entry.startedAt, port: entry.port,
    url: entry.port ? `http://127.0.0.1:${entry.port}/` : '', status: entry.status, exitCode: entry.exitCode
  });

  function folder(path: unknown): { absolute: string; relativePath: string } {
    const text = typeof path === 'string' ? path.trim() : '';
    if (text.includes('\0')) throw new LocalhostError('LOCALHOST_INVALID_PATH');
    mkdirSync(root, { recursive: true });
    const absolute = resolve(root, text || '.');
    if (!isInside(root, absolute)) throw new LocalhostError('LOCALHOST_PATH_OUTSIDE_WORKSPACE', 403);
    if (!existsSync(absolute) || !statSync(absolute).isDirectory()) throw new LocalhostError('LOCALHOST_FOLDER_NOT_FOUND', 404);
    if (!isInside(realpathSync(root), realpathSync(absolute))) throw new LocalhostError('LOCALHOST_PATH_OUTSIDE_WORKSPACE', 403);
    return { absolute, relativePath: relative(root, absolute).split(sep).join('/') || '.' };
  }

  function pruneExited(): void {
    const exited = [...entries.values()].filter((entry) => entry.status === 'exited');
    for (const entry of exited.slice(0, Math.max(0, exited.length - MAX_EXITED_KEPT))) entries.delete(entry.id);
  }

  function register(input: Omit<Entry, 'id' | 'startedAt' | 'status' | 'exitCode' | 'log'>): Entry {
    const entry: Entry = { ...input, id: `srv_${randomUUID().slice(0, 8)}`, startedAt: new Date().toISOString(), status: 'starting', exitCode: null, log: '' };
    entries.set(entry.id, entry);
    return entry;
  }

  async function startStatic(ownerId: string, name: string, target: { absolute: string; relativePath: string }) {
    const server = new HttpServer((req, res) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return; }
      const pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname;
      const file = resolveStaticFile(target.absolute, pathname);
      if (!file) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Bulunamadı'); return; }
      res.writeHead(200, { 'Content-Type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' });
      if (req.method === 'HEAD') { res.end(); return; }
      createReadStream(file).on('error', () => res.destroy()).pipe(res);
    });
    await new Promise<void>((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => done()); });
    const address = server.address();
    const entry = register({
      ownerId, name, kind: 'static', path: target.relativePath, command: '', port: typeof address === 'object' && address ? address.port : 0,
      stop: () => { server.close(); server.closeAllConnections(); entry.status = 'exited'; pruneExited(); }
    });
    entry.status = 'running';
    return view(entry);
  }

  async function startCommand(ownerId: string, name: string, command: string, target: { absolute: string; relativePath: string }, requestApproval: Approver | undefined, signal?: AbortSignal) {
    if (command.length > 2_000) throw new LocalhostError('LOCALHOST_COMMAND_TOO_LONG');
    if (!requestApproval) throw new LocalhostError('LOCALHOST_NEEDS_APPROVAL', 403);
    const approved = await requestApproval({ kind: 'shell.run', title: 'Bu yerel sunucu başlatılsın mı?', detail: `Klasör: ${target.absolute}\n\n${command}`, risk: 'high' });
    if (!approved) throw new LocalhostError('LOCALHOST_DENIED', 403);

    const port = await freePort();
    // Same rule as shell_run: secrets of the server process never reach the command.
    const env = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !/KEY|TOKEN|SECRET|PASSWORD|PASS|CREDENTIAL|NVIDIA|HAFIZE_|GITHUB|AWS_|AZURE_|GOOGLE_|^PORT$|^HOST$/i.test(key))), PORT: String(port), HOST: '127.0.0.1' };
    const isWindows = process.platform === 'win32';
    const executable = isWindows ? 'powershell.exe' : '/bin/sh';
    const argv = isWindows ? ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', `[Console]::OutputEncoding=[Text.Encoding]::UTF8; ${command}`] : ['-c', command];
    const child = spawn(executable, argv, { cwd: target.absolute, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], detached: !isWindows });
    const entry = register({ ownerId, name, kind: 'command', path: target.relativePath, command, port, stop: () => killTree(child.pid) });
    const onOutput = (chunk: Buffer) => {
      entry.log = (entry.log + chunk.toString('utf8')).slice(-MAX_LOG_CHARS);
      // Dev servers that ignore PORT announce their own; believe the first one that is not ours.
      const announced = Number(LISTEN_URL.exec(entry.log)?.[1]);
      if (entry.status === 'starting' && announced && announced !== entry.port) entry.port = announced;
    };
    child.stdout?.on('data', onOutput);
    child.stderr?.on('data', onOutput);
    child.once('error', () => { entry.status = 'exited'; entry.log += '\nSUNUCU_BASLATILAMADI'; });
    child.once('exit', (code) => { entry.status = 'exited'; entry.exitCode = code; pruneExited(); });

    const deadline = Date.now() + READY_TIMEOUT_MS;
    while (entry.status === 'starting' && Date.now() < deadline && !signal?.aborted) {
      if (await portAnswers(entry.port)) { entry.status = 'running'; break; }
      await new Promise((done) => setTimeout(done, READY_POLL_MS));
    }
    return { ...view(entry), log: redactPlaintextCredentials(entry.log.slice(-4_000)) };
  }

  async function start(ownerId: string, args: { readonly path?: unknown; readonly command?: unknown; readonly name?: unknown }, requestApproval?: Approver, signal?: AbortSignal) {
    const target = folder(args.path);
    const command = typeof args.command === 'string' ? args.command.trim() : '';
    const name = (typeof args.name === 'string' && args.name.trim() ? args.name.trim() : target.relativePath === '.' ? 'Çalışma klasörü' : target.relativePath).slice(0, 80);
    return command ? startCommand(ownerId, name, command, target, requestApproval, signal) : startStatic(ownerId, name, target);
  }

  const list = (ownerId: string) => [...entries.values()].filter((entry) => entry.ownerId === ownerId).map(view);

  function stop(ownerId: string, id: unknown): boolean {
    const entry = entries.get(String(id));
    if (!entry || entry.ownerId !== ownerId) return false;
    if (entry.status === 'exited') { entries.delete(entry.id); return true; }
    entry.stop();
    entry.status = 'exited';
    return true;
  }

  function stopAll(): void {
    for (const entry of entries.values()) if (entry.status !== 'exited') entry.stop();
    entries.clear();
  }

  return Object.freeze({ start, list, stop, stopAll, root });
}
