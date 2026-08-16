import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const voiceOutput = require('../public/voice-output.js');

assert.equal(voiceOutput.normalizeSpeechText('  **Merhaba**   _Hafize_  '), 'Merhaba Hafize');
assert.equal(voiceOutput.normalizeSpeechText('Örnek: `const x = 1` https://example.com'), 'Örnek: const x = 1 bağlantı');
assert.match(voiceOutput.normalizeSpeechText('Önce ```js\nalert(1)\n``` sonra devam.'), /Kod bloğu atlandı/);
assert.ok(voiceOutput.normalizeSpeechText('x'.repeat(3000)).length <= 2400);
const chunks = voiceOutput.splitSpeechText('Birinci cümle kısa. İkinci cümle de kısa. Üçüncü cümle biraz daha uzundur.', 80);
assert.ok(chunks.length >= 1);
assert.ok(chunks.every((chunk) => chunk.length <= 80));
assert.deepEqual(voiceOutput.splitSpeechText('   '), []);
assert.equal(voiceOutput.VOICE_OUTPUT_STATE_EVENT, 'hafize:voice-output-state');

class FakeClassList {
  constructor() { this.values = new Set(); }
  toggle(name, active) { if (active) this.values.add(name); else this.values.delete(name); }
  contains(name) { return this.values.has(name); }
}
class FakeNode {
  constructor() { this.disabled = false; this.textContent = ''; this.title = ''; this.attributes = new Map(); this.listeners = new Map(); this.classList = new FakeClassList(); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  addEventListener(type, callback) { this.listeners.set(type, callback); }
  removeEventListener(type) { this.listeners.delete(type); }
  click() { this.listeners.get('click')?.({ preventDefault() {} }); }
  submit() { this.listeners.get('submit')?.({ preventDefault() {} }); }
}
class FakeEventTarget {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, callback) { const group = this.listeners.get(type) || new Set(); group.add(callback); this.listeners.set(type, group); }
  removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
  dispatch(type, detail) { for (const callback of this.listeners.get(type) || []) callback({ type, detail }); }
  dispatchEvent(event) { this.dispatch(event.type, event.detail); return true; }
}
class FakeCustomEvent {
  constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
}

const toggle = new FakeNode();
const card = new FakeNode();
const mic = new FakeNode();
const input = new FakeNode();
const composer = new FakeNode();
const assistantContent = new FakeNode();
assistantContent.textContent = 'Merhaba. Sana nasıl yardımcı olabilirim?';
const messages = new FakeNode();
messages.querySelectorAll = () => [assistantContent];
mic.setAttribute('aria-pressed', 'false');

const documentTarget = new FakeEventTarget();
documentTarget.hidden = false;
documentTarget.querySelector = (selector) => ({
  '#voiceOutputToggle': toggle,
  '.voice-card': card,
  '#micBtn': mic,
  '#messageInput': input,
  '#composer': composer,
  '#messages': messages
})[selector] || null;

const spoken = [];
let cancelCount = 0;
const synth = {
  speak(utterance) { spoken.push(utterance); },
  cancel() { cancelCount += 1; },
  getVoices() { return [{ lang: 'en-US', name: 'English' }, { lang: 'tr-TR', name: 'Türkçe' }]; }
};
class FakeUtterance { constructor(text) { this.text = text; } }
const storageValues = new Map();
const root = new FakeEventTarget();
root.CustomEvent = FakeCustomEvent;
root.speechSynthesis = synth;
root.SpeechSynthesisUtterance = FakeUtterance;
root.localStorage = { getItem(key) { return storageValues.get(key) ?? null; }, setItem(key, value) { storageValues.set(key, value); } };
root.observers = new Map();
root.MutationObserver = class {
  constructor(callback) { this.callback = callback; }
  observe(target) { root.observers.set(target, this); }
  disconnect() {}
};

const outputStates = [];
documentTarget.addEventListener(voiceOutput.VOICE_OUTPUT_STATE_EVENT, (event) => outputStates.push(event.detail));
const controller = voiceOutput.installVoiceOutput(documentTarget, root);
assert.equal(controller.isSupported, true);
assert.equal(controller.isEnabled(), false, 'sesli yanıt açık kullanıcı tercihi olmadan başlamamalı');
assert.equal(toggle.getAttribute('aria-pressed'), 'false');
assert.deepEqual(outputStates.at(-1), {
  source: 'voice-output', state: 'idle', speaking: false, thinking: false, enabled: false, supported: true
});

input.disabled = true;
root.observers.get(input).callback();
assert.equal(card.classList.contains('thinking'), true);
assert.equal(outputStates.at(-1).state, 'thinking');
input.disabled = false;
root.observers.get(input).callback();
assert.equal(spoken.length, 0, 'kapalı sesli yanıt stream sonunda konuşmamalı');
assert.equal(outputStates.at(-1).state, 'idle');

toggle.click();
assert.equal(controller.isEnabled(), true);
assert.equal(storageValues.get(voiceOutput.STORAGE_KEY), 'true');
input.disabled = true;
root.observers.get(input).callback();
assert.equal(card.classList.contains('thinking'), true);
input.disabled = false;
root.observers.get(input).callback();
assert.equal(spoken.length, 1);
assert.equal(spoken[0].lang, 'tr-TR');
assert.equal(spoken[0].voice.name, 'Türkçe');
assert.equal(card.classList.contains('speaking'), true);
assert.equal(outputStates.at(-1).state, 'speaking');
assert.equal(outputStates.at(-1).speaking, true);

composer.submit();
assert.equal(card.classList.contains('speaking'), false);
assert.equal(outputStates.at(-1).speaking, false);
assert.ok(cancelCount >= 1, 'yeni kullanıcı mesajı aktif TTS konuşmasını kesmeli');

controller.speak('İkinci sesli yanıt.');
assert.equal(spoken.length, 2);
mic.setAttribute('aria-pressed', 'true');
root.observers.get(mic).callback();
assert.equal(card.classList.contains('speaking'), false, 'mikrofon başlayınca TTS kesilmeli');

mic.setAttribute('aria-pressed', 'false');
const longFirst = `${'A'.repeat(220)}. ${'B'.repeat(220)}.`;
assert.equal(controller.speak(longFirst), true);
const staleUtterance = spoken.at(-1);
assert.equal(staleUtterance.text.startsWith('A'), true);
assert.equal(controller.speak(`${'C'.repeat(220)}. ${'D'.repeat(220)}.`), true);
const freshFirst = spoken.at(-1);
const spokenBeforeStaleEnd = spoken.length;
staleUtterance.onend?.();
assert.equal(spoken.length, spokenBeforeStaleEnd, 'iptal edilmiş generation onend yeni kuyruğu ilerletmemeli');
assert.equal(controller.isSpeaking(), true);
freshFirst.onend?.();
assert.equal(spoken.length, spokenBeforeStaleEnd + 1, 'aktif generation kendi ikinci chunkına ilerlemeli');
assert.equal(spoken.at(-1).text.startsWith('D'), true);
spoken.at(-1).onend?.();
assert.equal(controller.isSpeaking(), false);
assert.equal(outputStates.at(-1).state, 'idle');

controller.speak('Ses hatası testi.');
const errorUtterance = spoken.at(-1);
errorUtterance.onerror?.();
assert.equal(controller.isSpeaking(), false);
assert.equal(outputStates.at(-1).state, 'idle');
errorUtterance.onend?.();
assert.equal(controller.isSpeaking(), false, 'error sonrası stale onend state değiştirmemeli');

documentTarget.hidden = true;
assert.equal(controller.speak('Gizli sekmede okunmamalı.'), false);
documentTarget.dispatch('visibilitychange');
assert.equal(card.classList.contains('speaking'), false);

toggle.click();
assert.equal(controller.isEnabled(), false);
assert.equal(storageValues.get(voiceOutput.STORAGE_KEY), 'false');
controller.destroy();

const unsupportedToggle = new FakeNode();
const unsupportedCard = new FakeNode();
const unsupportedDocument = new FakeEventTarget();
unsupportedDocument.querySelector = (selector) => ({ '#voiceOutputToggle': unsupportedToggle, '.voice-card': unsupportedCard })[selector] || null;
const unsupportedRoot = new FakeEventTarget();
unsupportedRoot.CustomEvent = FakeCustomEvent;
const unsupportedStates = [];
unsupportedDocument.addEventListener(voiceOutput.VOICE_OUTPUT_STATE_EVENT, (event) => unsupportedStates.push(event.detail));
const unsupported = voiceOutput.installVoiceOutput(unsupportedDocument, unsupportedRoot);
assert.equal(unsupported.isSupported, false);
assert.equal(unsupportedToggle.disabled, true);
assert.match(unsupportedToggle.textContent, /desteklenmiyor/);
assert.equal(unsupportedStates.at(-1).supported, false);
assert.equal(unsupportedStates.at(-1).speaking, false);

console.log('Voice output OK: explicit opt-in, state events, Turkish TTS, generation guard and barge-in cancellation');