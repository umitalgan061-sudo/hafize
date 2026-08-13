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
  dispatch(type) { for (const callback of this.listeners.get(type) || []) callback({ type }); }
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
root.speechSynthesis = synth;
root.SpeechSynthesisUtterance = FakeUtterance;
root.localStorage = { getItem(key) { return storageValues.get(key) ?? null; }, setItem(key, value) { storageValues.set(key, value); } };
root.observers = new Map();
root.MutationObserver = class {
  constructor(callback) { this.callback = callback; }
  observe(target) { root.observers.set(target, this); }
  disconnect() {}
};

const controller = voiceOutput.installVoiceOutput(documentTarget, root);
assert.equal(controller.isSupported, true);
assert.equal(controller.isEnabled(), false, 'sesli yanıt açık kullanıcı tercihi olmadan başlamamalı');
assert.equal(toggle.getAttribute('aria-pressed'), 'false');

input.disabled = true;
root.observers.get(input).callback();
assert.equal(card.classList.contains('thinking'), true);
input.disabled = false;
root.observers.get(input).callback();
assert.equal(spoken.length, 0, 'kapalı sesli yanıt stream sonunda konuşmamalı');

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

composer.submit();
assert.equal(card.classList.contains('speaking'), false);
assert.ok(cancelCount >= 1, 'yeni kullanıcı mesajı aktif TTS konuşmasını kesmeli');

controller.speak('İkinci sesli yanıt.');
assert.equal(spoken.length, 2);
mic.setAttribute('aria-pressed', 'true');
root.observers.get(mic).callback();
assert.equal(card.classList.contains('speaking'), false, 'mikrofon başlayınca TTS kesilmeli');

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
const unsupported = voiceOutput.installVoiceOutput(unsupportedDocument, new FakeEventTarget());
assert.equal(unsupported.isSupported, false);
assert.equal(unsupportedToggle.disabled, true);
assert.match(unsupportedToggle.textContent, /desteklenmiyor/);

console.log('Voice output OK: explicit opt-in, Turkish TTS, stream state and barge-in cancellation');
