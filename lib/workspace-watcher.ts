// Turns file changes inside the workspace folder into `file.changed` rule events. Editors and
// test runs touch a file several times in a row, so changes are coalesced per path; tool output
// folders never count, or a rule whose task writes files would keep waking itself up.
import { mkdirSync, watch, type FSWatcher } from 'node:fs';

const IGNORED_SEGMENTS = new Set(['.git', 'node_modules', '.backup', '__pycache__', '.venv', 'dist', 'build', 'coverage']);
const DEFAULT_DEBOUNCE_MS = 1_500;
const MAX_PENDING_PATHS = 200;

/** Workspace-relative path with forward slashes, or null for paths rules should never see. */
export function normalizeWatchedPath(raw: unknown): string | null {
  if (typeof raw !== 'string' && !Buffer.isBuffer(raw)) return null;
  const path = String(raw).replace(/\\/g, '/').replace(/^\.\//, '').trim();
  if (!path || path.startsWith('/') || path.length > 400) return null;
  const segments = path.split('/');
  if (segments.some((segment) => !segment || segment === '..' || IGNORED_SEGMENTS.has(segment))) return null;
  return path;
}

export interface WorkspaceWatcherOptions {
  readonly dir: string;
  readonly onChange: (path: string) => unknown;
  readonly debounceMs?: number;
  readonly watchImpl?: typeof watch;
}

export function createWorkspaceWatcher({ dir, onChange, debounceMs = DEFAULT_DEBOUNCE_MS, watchImpl = watch }: WorkspaceWatcherOptions) {
  const pending = new Map<string, ReturnType<typeof setTimeout>>();
  let watcher: FSWatcher | null = null;

  const flush = (path: string) => {
    pending.delete(path);
    try { void Promise.resolve(onChange(path)).catch(() => {}); } catch { /* a failing rule must not stop the watcher */ }
  };
  const notice = (raw: unknown) => {
    const path = normalizeWatchedPath(raw);
    if (!path) return;
    const existing = pending.get(path);
    if (existing) clearTimeout(existing);
    else if (pending.size >= MAX_PENDING_PATHS) return;
    const timer = setTimeout(() => flush(path), debounceMs);
    timer.unref?.();
    pending.set(path, timer);
  };

  function start(): boolean {
    if (watcher) return true;
    try {
      mkdirSync(dir, { recursive: true });
      watcher = watchImpl(dir, { recursive: true, persistent: false }, (_event, name) => notice(name));
      // A vanished folder or a watch limit must not take the server down; rules simply stop firing.
      watcher.on?.('error', () => { stop(); });
      return true;
    } catch {
      watcher = null;
      return false;
    }
  }
  function stop(): void {
    for (const timer of pending.values()) clearTimeout(timer);
    pending.clear();
    try { watcher?.close(); } catch { /* already closed */ }
    watcher = null;
  }
  return Object.freeze({ start, stop, notice, isRunning: () => watcher !== null });
}
