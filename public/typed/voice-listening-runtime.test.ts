import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installVoiceMode } from './voice-mode.ts';

class FakeEl {
  dataset: Record<string, string> = {};
  style = { setProperty() {} };
  classList = { add() {}, remove() {}, toggle() { return false; }, contains() { return false; } };
  attributes = new Map<string, string>();
  listeners = new Map<string, Array<(event?: unknown) => void>>();
  value = '';
  hidden = false;
  disabled = false;
  innerHTML = '';
  textContent = '';
  isConnected = true;
  options: FakeEl[] = [];
  clientWidth = 350;
  sent = 0;
  constructor(readonly kind = '') {}
  setAttribute(key: string, value: string) { this.attributes.set(key, value); }
  getAttribute(key: string) { return this.attributes.get(key) ?? null; }
  removeAttribute(key: string) { this.attributes.delete(key); }
  addEventListener(name: string, fn: (event?: unknown) => void) {
    this.listeners.set(name, [...(this.listeners.get(name) || []), fn]);
  }
  removeEventListener(name: string, fn: (event?: unknown) => void) {
    this.listeners.set(name, (this.listeners.get(name) || []).filter((value) => value !== fn));
  }
  fire(name: string, event?: unknown) { (this.listeners.get(name) || []).forEach((fn) => fn(event)); }
  append(child: FakeEl) { if (this.kind === 'select') this.options.push(child); }
  remove(index?: number) { if (typeof index === 'number') this.options.splice(index, 1); }
  querySelectorAll() { return [] as FakeEl[]; }
  querySelector() { return null; }
  dispatchEvent() { return true; }
  focus() {}
  requestSubmit() { this.sent += 1; }
}

function page(userAgent: string) {
  const composer = new FakeEl();
  const input = new FakeEl();
  const mic = new FakeEl();
  const messages = new FakeEl();
  const body = new FakeEl('body');
  const template = new FakeEl();
  const elements = new Map<string, FakeEl>();
  const select = (selector: string) => {
    if (selector === '.vm-canvas') return null;
    if (!elements.has(selector)) elements.set(selector, new FakeEl(selector === '.vm-voice' ? 'select' : ''));
    return elements.get(selector)!;
  };
  template.querySelector = select as typeof template.querySelector;
  const documentRef = {
    hidden: false,
    body,
    activeElement: body,
    documentElement: { dataset: {}, lang: 'tr' },
    querySelector: (selector: string) => selector === '#composer' ? composer
      : selector === '#messageInput' ? input : selector === '#micBtn' ? mic
      : selector === '#messages' ? messages : null,
    createElement: () => new FakeEl(),
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; }
  };
  const recognizers: FakeRecognition[] = [];
  const observers: Array<() => void> = [];
  class FakeRecognition {
    lang = ''; continuous = false; interimResults = false; maxAlternatives = 0;
    onstart: (() => void) | null = null;
    onend: (() => void) | null = null;
    onresult: ((event: { results: unknown }) => void) | null = null;
    onerror: ((event: { error?: string }) => void) | null = null;
    onaudiostart: (() => void) | null = null;
    onspeechstart: (() => void) | null = null;
    onspeechend: (() => void) | null = null;
    stopCalls = 0;
    abortCalls = 0;
    constructor() { recognizers.push(this); }
    start() { this.onstart?.(); }
    stop() { this.stopCalls += 1; }
    abort() { this.abortCalls += 1; }
  }
  const root = {
    SpeechRecognition: FakeRecognition,
    speechSynthesis: { getVoices: () => [], addEventListener() {}, removeEventListener() {} },
    navigator: { userAgent },
    Event: class { constructor(readonly type: string) {} },
    CustomEvent: class { constructor(readonly type: string, readonly init: unknown) {} },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    matchMedia: () => ({ matches: true }),
    getComputedStyle: () => ({ fontSize: '18px' }),
    requestAnimationFrame: () => 1,
    cancelAnimationFrame() {},
    MutationObserver: class {
      constructor(callback: () => void) { observers.push(callback); }
      observe() {}
      disconnect() {}
    },
    performance: { now: () => Date.now() }
  };
  const controller = installVoiceMode(documentRef as unknown as Document, root as unknown as typeof globalThis);
  if (!controller) throw Error('voice controller was not installed');
  return { controller, recognizers, elements, composer, input, documentRef,
    notify: () => observers.forEach((callback) => callback()) };
}
const result = (transcript: string, isFinal: boolean) =>
  [Object.assign([{ transcript }], { isFinal })];

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('real speech recognition instead of a fake recording indicator', () => {
  it('shows verified speech detection and interim words, then sends the naturally-ended iPhone turn', async () => {
    const p = page('Mozilla/5.0 (iPhone; CPU iPhone OS 26_5 like Mac OS X) Mobile/15E148');
    p.controller.open();
    const rec = p.recognizers[0];
    const status = p.elements.get('.vm-status')!;
    const caption = p.elements.get('.vm-cap-before')!;
    expect(rec.continuous).toBe(false);
    expect(status.textContent).toContain('Mikrofon oturumu açık');
    rec.onspeechstart?.();
    expect(status.textContent).toContain('Sesini algıladım');
    rec.onresult?.({ results: result('Hafize naber', false) });
    expect(caption.textContent).toBe('Hafize naber');
    expect(status.textContent).toContain('Seni duyuyorum');

    rec.onresult?.({ results: result('Hafize naber', true) });
    await vi.advanceTimersByTimeAsync(850);
    expect(rec.stopCalls).toBe(0); // Safari must be allowed to end itself.
    rec.onend?.();
    expect(p.composer.sent).toBe(1);
    expect(p.input.value).toBe('Hafize naber');
    p.controller.destroy();
  });

  it('does not automatically abort a quiet first session after the diagnostics threshold', async () => {
    const p = page('Mozilla/5.0 (iPhone; CPU iPhone OS 26_5 like Mac OS X) Mobile/15E148');
    p.controller.open();
    const rec = p.recognizers[0];
    await vi.advanceTimersByTimeAsync(14_100);
    expect(rec.abortCalls).toBe(0);
    expect(p.elements.get('.vm-status')?.textContent).toContain('ses tanınmadı');
    expect(p.controller.state()).toBe('listening');
    p.controller.destroy();
  });

  it('retries an iPhone recognizer that becomes deaf after a completed conversational turn', async () => {
    const p = page('Mozilla/5.0 (iPhone; CPU iPhone OS 26_5 like Mac OS X) Mobile/15E148');
    p.controller.open();
    const first = p.recognizers[0];
    first.onresult?.({ results: result('Merhaba', true) });
    first.onend?.();
    expect(p.composer.sent).toBe(1);

    // Simulate the assistant request becoming busy and then completing; when
    // no speech output is available the next listening turn opens on its own.
    p.input.disabled = true; p.notify();
    p.input.disabled = false; p.notify();
    const second = p.recognizers[1];
    expect(second).toBeDefined();
    expect(second).not.toBe(first);
    expect(second.continuous).toBe(false);

    // Safari bug: onstart succeeds but no speech/result/error/end ever arrives.
    await vi.advanceTimersByTimeAsync(14_100);
    expect(second.abortCalls).toBe(1);
    await vi.advanceTimersByTimeAsync(500);
    expect(p.recognizers[2]).toBeDefined();
    expect(p.controller.state()).toBe('listening');
    p.controller.destroy();
  });

  it('ends a desktop utterance quickly while keeping recognition continuous', async () => {
    const p = page('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/132.0');
    p.controller.open();
    const rec = p.recognizers[0];
    expect(rec.continuous).toBe(true);
    rec.onresult?.({ results: result('Bugün nasılsın', true) });
    await vi.advanceTimersByTimeAsync(700);
    expect(rec.stopCalls).toBe(1);
    p.controller.destroy();
  });
});
