export type EventTargetLike = { addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: AddEventListenerOptions | boolean): void; removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: EventListenerOptions | boolean): void };

export class Disposer {
  #items: Array<() => void> = [];
  add(dispose: () => void): void { this.#items.push(dispose); }
  flush(): void { while (this.#items.length) { try { this.#items.pop()?.(); } catch {} } }
}

export function on(target: EventTargetLike | null | undefined, type: string, listener: EventListenerOrEventListenerObject, options?: AddEventListenerOptions | boolean, disposer?: Disposer): boolean {
  if (!target?.addEventListener || !target.removeEventListener) return false;
  target.addEventListener(type, listener, options);
  disposer?.add(() => target.removeEventListener(type, listener, typeof options === 'boolean' ? options : options ? { capture: options.capture } : undefined));
  return true;
}

export function query<T extends Element>(documentRef: Document, selector: string): T | null { return documentRef.querySelector<T>(selector); }
export function requireElement<T extends Element>(documentRef: Document, selector: string): T { const node = query<T>(documentRef, selector); if (!node) throw new Error(`MISSING_ELEMENT:${selector}`); return node; }

export function text<T extends HTMLElement>(documentRef: Document, tag: string, value = '', className?: string): T {
  const node = documentRef.createElement(tag) as T;
  if (className) node.className = className;
  node.textContent = value;
  return node;
}

export function boundedText(value: unknown, max: number): string { return String(value ?? '').slice(0, Math.max(0, max)); }
export function normalizeLineText(value: unknown, max: number): string { return boundedText(value, max).replace(/\r\n?/g, '\n'); }

export function sameOriginPath(value: string, origin = globalThis.location?.origin): string | null {
  try { const url = new URL(value, globalThis.location?.href); return origin && url.origin === origin ? url.pathname : null; } catch { return null; }
}

export function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  try { return JSON.parse(raw || '') as T; } catch { return fallback; }
}

export function safeStorage(storage: Storage | undefined, key: string, fallback: string): string {
  try { return storage?.getItem(key) ?? fallback; } catch { return fallback; }
}

export function writeStorage(storage: Storage | undefined, key: string, value: string): boolean {
  try { storage?.setItem(key, value); return true; } catch { return false; }
}

export function timeoutSignal(ms: number, parent?: AbortSignal): AbortSignal {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(new DOMException('Timeout', 'TimeoutError')), Math.max(1, ms));
  const cancel = () => { globalThis.clearTimeout(timer); controller.abort(parent?.reason); };
  if (parent?.aborted) cancel(); else parent?.addEventListener('abort', cancel, { once: true });
  return controller.signal;
}

export function installStyle(documentRef: Document, id: string, cssText: string): HTMLStyleElement {
  const existing = documentRef.getElementById(id);
  if (existing instanceof HTMLStyleElement) return existing;
  const style = documentRef.createElement('style');
  style.id = id;
  style.textContent = cssText;
  documentRef.head.append(style);
  return style;
}

export function dispatch(root: EventTarget, type: string, detail?: unknown): void {
  try { root.dispatchEvent(new CustomEvent(type, { detail })); } catch {}
}
