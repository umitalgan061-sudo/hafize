import { afterEach, describe, expect, it, vi } from 'vitest';
import { wavOf } from './voice-library.ts';
import { NOT_STARTED, START_TIMEOUT_MS, installVoiceOutput } from './voice-output.ts';

// 20 Kasım 2026, the owner's iPhone: whatever voice was chosen Yelda spoke, and "Hafize konuşuyor" sometimes showed over
// silence. Downloaded voices now play through an <audio> element unlocked by the first touch, and speech that never
// starts is stopped and said so instead of being shown as speaking.

function element() {
  const attributes = new Map<string, string>();
  const listeners = new Map<string, Array<() => void>>();
  return {
    id: '', textContent: '', title: '', disabled: false,
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute: (name: string, value: string) => { attributes.set(name, value); },
    getAttribute: (name: string) => attributes.get(name) ?? null,
    addEventListener: (type: string, listener: () => void) => { listeners.set(type, [...(listeners.get(type) ?? []), listener]); },
    removeEventListener() {},
    attributes,
  };
}

function page({ starts }: { starts: boolean }) {
  const toggle = element();
  const toast = element();
  const spoken: Array<{ text: string; volume?: number }> = [];
  const events: Array<{ type: string; detail?: { origin?: string; speaking?: boolean } }> = [];
  const documentListeners = new Map<string, Array<(event?: unknown) => void>>();
  const documentRef = {
    hidden: false,
    documentElement: { dataset: {} },
    querySelectorAll: () => [toggle],
    querySelector: (selector: string) => (selector === '#toast' ? toast : null),
    addEventListener: (type: string, listener: (event?: unknown) => void) => { documentListeners.set(type, [...(documentListeners.get(type) ?? []), listener]); },
    removeEventListener() {},
    dispatchEvent(event: { type: string; detail?: { origin?: string; speaking?: boolean } }) { events.push(event); return true; },
  };
  class Utterance { text: string; volume = 1; lang = ''; rate = 1; pitch = 1; voice: unknown = null; onstart?: () => void; onend?: () => void; onerror?: () => void; onboundary?: () => void; constructor(text: string) { this.text = text; } }
  const synth = {
    paused: false,
    speak(utterance: Utterance) { spoken.push({ text: utterance.text, volume: utterance.volume }); if (starts) queueMicrotask(() => utterance.onstart?.()); },
    cancel() {}, resume() {}, getVoices: () => [], addEventListener() {}, removeEventListener() {},
  };
  const storage = new Map<string, string>([['hafize.voiceOutput.v1', 'true']]);
  class FakeCustomEvent { type: string; detail: { origin?: string; speaking?: boolean }; constructor(type: string, init: { detail: { origin?: string; speaking?: boolean } }) { this.type = type; this.detail = init.detail; } }
  const root = { speechSynthesis: synth, SpeechSynthesisUtterance: Utterance, CustomEvent: FakeCustomEvent, localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value); } } } as unknown as typeof globalThis;
  const controller = installVoiceOutput(documentRef as unknown as Document, root)!;
  return { controller, toast, toggle, spoken, events,
    fire: (type: string, detail?: { text?: string; origin?: string; append?: boolean }) => { for (const listener of documentListeners.get(type) ?? []) listener({ detail }); } };
}

afterEach(() => { vi.useRealTimers(); });

describe('voice on a phone', () => {
  it('speech that never starts is stopped and the owner is told, not shown as speaking', async () => {
    vi.useFakeTimers();
    const p = page({ starts: false });
    expect(p.controller.speak('Merhaba, bugün hava güzel.')).toBe(true);
    expect(p.controller.isSpeaking()).toBe(true);
    await vi.advanceTimersByTimeAsync(START_TIMEOUT_MS + 10);
    expect(p.controller.isSpeaking()).toBe(false);
    expect(p.toast.textContent).toBe(NOT_STARTED);
    expect(p.toggle.attributes.get('data-speaking')).toBe('false');
  });

  it('speech that starts is left alone by the watchdog', async () => {
    vi.useFakeTimers();
    const p = page({ starts: true });
    p.controller.speak('Merhaba.');
    await vi.advanceTimersByTimeAsync(START_TIMEOUT_MS + 10);
    expect(p.controller.isSpeaking()).toBe(true);
    expect(p.toast.textContent).toBe('');
  });

  it('reports the origin of every spoken phrase, so captions never mix unrelated voices', async () => {
    const p = page({ starts: true });
    p.fire('hafize:voice-output-speak', { text: 'Merhaba.', origin: 'voice-mode' });
    await Promise.resolve();
    const progress = p.events.filter((event) => event.type === 'hafize:voice-output-progress');
    expect(progress.length).toBeGreaterThan(0);
    expect(progress.every((event) => event.detail?.origin === 'voice-mode')).toBe(true);
  });

  it('the first touch speaks one silent utterance to open speech, and only once', () => {
    const p = page({ starts: true });
    p.fire('pointerdown');
    p.fire('touchend');
    p.fire('keydown');
    expect(p.spoken).toEqual([{ text: ' ', volume: 0 }]);
  });

  it('a chunk becomes a 16-bit mono WAV at its rate, loudness evened and clipped', () => {
    const bytes = wavOf(new Float32Array([0, 0.25, -0.5, 2]), 22050, 1);
    const view = new DataView(bytes.buffer);
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe('RIFF');
    expect(new TextDecoder().decode(bytes.slice(8, 12))).toBe('WAVE');
    expect(view.getUint32(24, true)).toBe(22050);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(8);
    expect(view.getInt16(44 + 2, true)).toBe(Math.trunc(0.25 * 0x7fff));
    expect(view.getInt16(44 + 4, true)).toBe(-0.5 * 0x8000);
    expect(view.getInt16(44 + 6, true)).toBe(0x7fff);
    // Default gain brings the peak to 0.9.
    const loud = new DataView(wavOf(new Float32Array([0.1, -0.2]), 16000).buffer);
    expect(loud.getInt16(44 + 2, true)).toBe(Math.trunc(-0.9 * 0x8000));
  });
});
