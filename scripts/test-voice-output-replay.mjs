import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const voiceOutput = require('../public/voice-output.js');

class FakeClassList {
  constructor() { this.values = new Set(); }
  toggle(name, active) { if (active) this.values.add(name); else this.values.delete(name); }
}
class FakeNode {
  constructor() {
    this.disabled = false;
    this.hidden = false;
    this.value = '';
    this.textContent = '';
    this.attributes = new Map();
    this.listeners = new Map();
    this.classList = new FakeClassList();
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  addEventListener(type, callback) { this.listeners.set(type, callback); }
  removeEventListener(type) { this.listeners.delete(type); }
  click() { this.listeners.get('click')?.({ target: this }); }
}
class FakeEventTarget {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, callback) {
    const group = this.listeners.get(type) || new Set();
    group.add(callback);
    this.listeners.set(type, group);
  }
  removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
  dispatchEvent(event) {
    for (const callback of this.listeners.get(event.type) || []) callback(event);
    return true;
  }
}

const toggle = new FakeNode();
const pause = new FakeNode();
const status = new FakeNode();
const rateWrap = new FakeNode();
const rateSelect = new FakeNode();
const playbackActions = new FakeNode();
const replay = new FakeNode();
const stop = new FakeNode();
const card = new FakeNode();
const mic = new FakeNode();
const input = new FakeNode();
const composer = new FakeNode();
const assistant = new FakeNode();
assistant.textContent = 'Son Hafize yanıtı yeniden okunabilir.';
const messages = new FakeNode();
messages.querySelectorAll = () => [assistant];
mic.setAttribute('aria-pressed', 'false');

const documentRef = new FakeEventTarget();
documentRef.hidden = false;
documentRef.querySelector = (selector) => ({
  '#voiceOutputToggle': toggle,
  '#voicePauseToggle': pause,
  '#voiceOutputStatus': status,
  '#voiceRateWrap': rateWrap,
  '#voiceRateSelect': rateSelect,
  '#voicePlaybackActions': playbackActions,
  '#voiceReplayButton': replay,
  '#voiceStopButton': stop,
  '.voice-card': card,
  '#micBtn': mic,
  '#messageInput': input,
  '#composer': composer,
  '#messages': messages
})[selector] || null;

const spoken = [];
let cancels = 0;
const synth = {
  speak(utterance) { spoken.push(utterance); },
  cancel() { cancels += 1; },
  pause() {},
  resume() {},
  getVoices() { return []; }
};
class FakeUtterance { constructor(text) { this.text = text; } }

const root = {
  speechSynthesis: synth,
  SpeechSynthesisUtterance: FakeUtterance,
  localStorage: { getItem() { return 'true'; }, setItem() {} }
};

const controller = voiceOutput.installVoiceOutput(documentRef, root);
assert.ok(controller);
assert.equal(controller.isEnabled(), true);
assert.equal(replay.hidden, false, 'latest assistant response exposes explicit replay control while idle');
assert.equal(replay.disabled, false);
assert.equal(stop.hidden, true);

replay.click();
assert.equal(spoken.length, 1);
assert.equal(spoken[0].text, assistant.textContent);
assert.equal(controller.isSpeaking(), true);
assert.equal(replay.hidden, true, 'replay cannot restart an active utterance');
assert.equal(stop.hidden, false);
assert.equal(stop.disabled, false);

const cancelBeforeIdleStop = cancels;
stop.click();
assert.equal(controller.isSpeaking(), false);
assert.equal(cancels, cancelBeforeIdleStop + 1);
assert.equal(stop.hidden, true);
assert.equal(replay.hidden, false, 'stopped speech can be replayed again only by another click');

assert.equal(controller.stopSpeech(), false, 'idle stop is a no-op');
const spokenBeforeReplay = spoken.length;
assert.equal(controller.replayLatest(), true);
assert.equal(spoken.length, spokenBeforeReplay + 1);
assert.equal(controller.replayLatest(), false, 'programmatic replay also refuses to replace active speech');

controller.stopSpeech();
assistant.textContent = '```js\nsecretLikeCode()\n``` Devam https://example.com';
assert.equal(controller.replayLatest(), true);
assert.match(spoken.at(-1).text, /Kod bloğu atlandı/);
assert.doesNotMatch(spoken.at(-1).text, /https:\/\//, 'replay uses the existing bounded speech normalization');
controller.stopSpeech();

controller.setEnabled(false);
assert.equal(replay.hidden, true);
assert.equal(stop.hidden, true);
assert.equal(controller.replayLatest(), false, 'disabled voice output cannot be replayed');

controller.destroy();

console.log('voice output explicit replay/stop tests passed');
