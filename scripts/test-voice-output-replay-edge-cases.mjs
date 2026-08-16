import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const voiceOutput = require('../public/voice-output.js');

function node() {
  return {
    disabled: false,
    hidden: false,
    value: '',
    textContent: '',
    classList: { toggle() {} },
    setAttribute() {},
    addEventListener() {},
    removeEventListener() {}
  };
}

function build(messagesText = '') {
  const toggle = node();
  const card = node();
  const replay = node();
  const stop = node();
  const input = node();
  const messages = node();
  const content = node();
  content.textContent = messagesText;
  messages.querySelectorAll = () => messagesText ? [content] : [];
  const elements = {
    '#voiceOutputToggle': toggle,
    '#voiceReplayButton': replay,
    '#voiceStopButton': stop,
    '.voice-card': card,
    '#messageInput': input,
    '#messages': messages
  };
  const documentRef = {
    hidden: false,
    querySelector(selector) { return elements[selector] || null; },
    addEventListener() {},
    removeEventListener() {}
  };
  const spoken = [];
  const synth = {
    speak(utterance) { spoken.push(utterance); },
    cancel() {},
    getVoices() { return []; }
  };
  class Utterance { constructor(text) { this.text = text; } }
  const root = {
    speechSynthesis: synth,
    SpeechSynthesisUtterance: Utterance,
    localStorage: { getItem() { return 'true'; }, setItem() {} }
  };
  return { controller: voiceOutput.installVoiceOutput(documentRef, root), documentRef, replay, stop, spoken };
}

const empty = build('');
assert.equal(empty.controller.replayLatest(), false);
assert.equal(empty.replay.hidden, true, 'empty active conversation has nothing to replay');

const hidden = build('Gizli sekme yanıtı.');
hidden.documentRef.hidden = true;
assert.equal(hidden.controller.replayLatest(), false, 'existing speak guard prevents hidden-tab replay');
assert.equal(hidden.spoken.length, 0);

const whitespace = build('   ');
assert.equal(whitespace.controller.replayLatest(), false, 'normalized empty text fails closed');
assert.equal(whitespace.spoken.length, 0);

const long = build('x'.repeat(4000));
assert.equal(long.controller.replayLatest(), true);
assert.equal(long.spoken[0].text.length <= 2400, true, 'replay inherits the existing bounded TTS text limit');

console.log('voice output replay edge cases passed');
