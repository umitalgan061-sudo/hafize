// Headless Chrome over the DevTools protocol, shared by web_page_render (JavaScript-heavy pages)
// and diagram_render (Mermaid / Vega-Lite / Graphviz -> SVG/PNG). One browser process is reused and
// shut down when idle. When guardNetwork is on, every request the page makes is intercepted and
// only public internet addresses are allowed, so a page cannot reach the LAN or this machine.
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { lookup } from 'node:dns/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import net from 'node:net';
import { isPublicAddress } from './web-tools.ts';

const CANDIDATES = [
  process.env.HAFIZE_CHROME_PATH || '',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
];

export function findBrowser(): string | null {
  return CANDIDATES.find((path) => path && existsSync(path)) || null;
}

type Pending = { resolve: (value: Record<string, unknown>) => void; reject: (error: Error) => void };
type Listener = (method: string, params: Record<string, unknown>, sessionId?: string) => void;

export interface PageSession {
  send(method: string, params?: Record<string, unknown>): Promise<Record<string, unknown>>;
  evaluate<T = unknown>(expression: string): Promise<T>;
  close(): Promise<void>;
}

async function hostIsPublic(hostname: string): Promise<boolean> {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return false;
  if (net.isIP(host)) return isPublicAddress(host);
  try {
    const addresses = await lookup(host, { all: true });
    return addresses.length > 0 && addresses.every((entry) => isPublicAddress(entry.address));
  } catch { return false; }
}

export function createHeadlessBrowser({ idleMs = 60_000 }: { readonly idleMs?: number } = {}) {
  let child: ChildProcess | null = null;
  let socket: WebSocket | null = null;
  let profile = '';
  let nextId = 0;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let starting: Promise<void> | null = null;
  let openPages = 0;
  const pending = new Map<number, Pending>();
  const listeners = new Set<Listener>();

  function shutdown(): void {
    if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
    try { socket?.close(); } catch {}
    socket = null;
    if (child && child.exitCode === null) child.kill();
    child = null;
    for (const entry of pending.values()) entry.reject(new Error('BROWSER_CLOSED'));
    pending.clear();
    if (profile) { try { rmSync(profile, { recursive: true, force: true }); } catch {} profile = ''; }
  }

  function scheduleIdle(): void {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { if (!openPages) shutdown(); }, idleMs);
    idleTimer.unref?.();
  }

  async function start(): Promise<void> {
    if (socket && socket.readyState === WebSocket.OPEN) return;
    if (starting) return starting;
    starting = (async () => {
      const executable = findBrowser();
      if (!executable) throw Object.assign(new Error('BROWSER_NOT_FOUND'), { code: 'BROWSER_NOT_FOUND', status: 503 });
      profile = mkdtempSync(join(tmpdir(), 'hafize-headless-'));
      child = spawn(executable, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-sync', '--mute-audio', '--hide-scrollbars', '--window-size=1280,900', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
      const wsUrl = await new Promise<string>((resolve, reject) => {
        let buffer = '';
        const timer = setTimeout(() => reject(Object.assign(new Error('BROWSER_START_TIMEOUT'), { code: 'BROWSER_START_TIMEOUT', status: 503 })), 15_000);
        child!.stderr!.on('data', (chunk: Buffer) => {
          buffer += chunk.toString('utf8');
          const match = buffer.match(/DevTools listening on (ws:\/\/\S+)/);
          if (match) { clearTimeout(timer); resolve(match[1]!); }
        });
        child!.on('exit', () => { clearTimeout(timer); reject(Object.assign(new Error('BROWSER_EXITED'), { code: 'BROWSER_EXITED', status: 503 })); });
      });
      socket = new WebSocket(wsUrl);
      await new Promise<void>((resolve, reject) => {
        socket!.addEventListener('open', () => resolve(), { once: true });
        socket!.addEventListener('error', () => reject(new Error('BROWSER_CONNECT_FAILED')), { once: true });
      });
      socket.addEventListener('message', (event) => {
        const message = JSON.parse(String(event.data)) as { id?: number; result?: Record<string, unknown>; error?: { message?: string }; method?: string; params?: Record<string, unknown>; sessionId?: string };
        if (message.id !== undefined && pending.has(message.id)) {
          const entry = pending.get(message.id)!;
          pending.delete(message.id);
          if (message.error) entry.reject(new Error(String(message.error.message || 'CDP_ERROR'))); else entry.resolve(message.result || {});
        } else if (message.method) {
          for (const listener of listeners) listener(message.method, message.params || {}, message.sessionId);
        }
      });
      socket.addEventListener('close', () => { socket = null; });
    })();
    try { await starting; } catch (error) { shutdown(); throw error; } finally { starting = null; }
  }

  function rawSend(method: string, params: Record<string, unknown> = {}, sessionId?: string): Promise<Record<string, unknown>> {
    if (!socket) return Promise.reject(new Error('BROWSER_CLOSED'));
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      socket!.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error('CDP_TIMEOUT')); } }, 30_000).unref?.();
    });
  }

  /** Opens a fresh page (own browser context, so cookies never leak between pages). */
  async function openPage({ guardNetwork = true, width = 1280, height = 900 }: { readonly guardNetwork?: boolean; readonly width?: number; readonly height?: number } = {}): Promise<PageSession> {
    await start();
    openPages += 1;
    if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
    const { browserContextId } = await rawSend('Target.createBrowserContext', { disposeOnDetach: true });
    const { targetId } = await rawSend('Target.createTarget', { url: 'about:blank', browserContextId });
    const { sessionId } = await rawSend('Target.attachToTarget', { targetId, flatten: true }) as { sessionId: string };
    const send = (method: string, params: Record<string, unknown> = {}) => rawSend(method, params, sessionId);
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    let listener: Listener | null = null;
    if (guardNetwork) {
      await send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
      listener = (method, params, eventSession) => {
        if (method !== 'Fetch.requestPaused' || eventSession !== sessionId) return;
        const requestId = String(params.requestId);
        const url = String((params.request as { url?: string })?.url || '');
        void (async () => {
          let allowed = false;
          try {
            const parsed = new URL(url);
            allowed = parsed.protocol === 'data:' || parsed.protocol === 'blob:' || ((parsed.protocol === 'https:' || parsed.protocol === 'http:') && (!parsed.port || ['80', '443'].includes(parsed.port)) && await hostIsPublic(parsed.hostname));
          } catch { allowed = false; }
          await rawSend(allowed ? 'Fetch.continueRequest' : 'Fetch.failRequest', allowed ? { requestId } : { requestId, errorReason: 'BlockedByClient' }, sessionId).catch(() => {});
        })();
      };
      listeners.add(listener);
    }
    return {
      send,
      async evaluate<T>(expression: string): Promise<T> {
        const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }) as { result?: { value?: unknown }; exceptionDetails?: { exception?: { description?: string }; text?: string } };
        if (result.exceptionDetails) throw new Error(String(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'EVALUATION_FAILED').slice(0, 300));
        return result.result?.value as T;
      },
      async close() {
        if (listener) listeners.delete(listener);
        await rawSend('Target.disposeBrowserContext', { browserContextId }).catch(() => {});
        openPages = Math.max(0, openPages - 1);
        scheduleIdle();
      }
    };
  }

  /** Waits for Page.loadEventFired on the given session (or the timeout). */
  function waitForLoad(timeoutMs: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(done, timeoutMs);
      function done() { clearTimeout(timer); listeners.delete(listener); resolve(); }
      const listener: Listener = (method) => { if (method === 'Page.loadEventFired') done(); };
      listeners.add(listener);
    });
  }

  return Object.freeze({ openPage, waitForLoad, shutdown, get available() { return Boolean(findBrowser()); } });
}
export type HeadlessBrowser = ReturnType<typeof createHeadlessBrowser>;
