import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const voiceOutput = require('../public/typed/voice-output.ts');

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

{
  // Cancelling for a new answer makes the browser report 'interrupted' on the old utterance;
  // that must neither show an error nor wipe the new answer's queue.
  const said = [];
  const events = [];
  const toastNode = new FakeNode();
  toastNode.classList.remove = () => {}; toastNode.classList.add = () => {};
  const doc = new FakeEventTarget();
  doc.hidden = false;
  doc.dispatchEvent = (event) => events.push(event.detail);
  doc.querySelector = (selector) => ({ '#voiceOutputToggle': new FakeNode(), '#toast': toastNode })[selector] || null;
  const r = new FakeEventTarget();
  r.speechSynthesis = { speak(u) { said.push(u); }, cancel() {}, getVoices() { return []; } };
  r.SpeechSynthesisUtterance = FakeUtterance;
  r.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init.detail; } };
  r.localStorage = { getItem() { return 'true'; }, setItem() {} };
  const c = voiceOutput.installVoiceOutput(doc, r);
  c.speak('Birinci yanıt.');
  const first = said.at(-1);
  c.speak('İkinci yanıt. Devamı da var.');
  first.onerror?.({ error: 'interrupted' });
  assert.equal(toastNode.textContent, '', 'kesilen konuşma hata uyarısı göstermemeli');
  assert.equal(c.isSpeaking(), true, 'yeni yanıtın kuyruğu silinmemeli');
  assert.deepEqual(events.at(-1), { source: 'voice-output', speaking: true, origin: 'auto' });
  said.at(-1).onerror?.({ error: 'synthesis-failed' });
  assert.equal(toastNode.textContent, 'Sesli yanıt tamamlanamadı.');
  assert.deepEqual(events.at(-1), { source: 'voice-output', speaking: false, origin: '' });
  c.destroy();
}
assert.equal(voiceOutput.pickTurkishVoice([{ lang: 'tr-TR', name: 'Tolga' }, { lang: 'tr-TR', name: 'Emel Online (Natural)' }]).name, 'Emel Online (Natural)');
assert.equal(voiceOutput.pickTurkishVoice([{ lang: 'en-US', name: 'X' }]), null);
assert.equal(voiceOutput.normalizeSpeechText('Ben **Hafize**. Merhaba **dünya**, nasılsın?'), 'Ben Hafize. Merhaba dünya, nasılsın?');
assert.equal(voiceOutput.normalizeSpeechText('## Başlık\n- [bağ](https://x.y) madde'), 'Başlık. bağ madde');

console.log('Voice output OK: explicit opt-in, Turkish TTS, stream state and barge-in cancellation');
