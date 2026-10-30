import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const mode = require('../public/typed/voice-mode.ts');
const output = require('../public/typed/voice-output.ts');

// Status line for every state.
for (const state of ['idle', 'listening', 'thinking', 'speaking', 'paused']) assert.ok(mode.statusText(state).length > 3, state);
assert.equal(mode.statusText('closed'), '');

// Transcript: final and interim parts read from index 0.
const results = [Object.assign([{ transcript: 'Merhaba ' }], { isFinal: true }), Object.assign([{ transcript: ' nasıl  ' }], { isFinal: false })];
assert.deepEqual(mode.readTranscript(results), { final: 'Merhaba', interim: 'nasıl' });
assert.deepEqual(mode.readTranscript(null), { final: '', interim: '' });

// Caption window keeps the spoken word visible with context.
assert.deepEqual(mode.captionWindow('Bugün hava güzel', 6, 4), ['Bugün ', 'hava', ' güzel']);
assert.deepEqual(mode.captionWindow('Kısa', -1, 0), ['Kısa', '', '']);
const long = `${'kelime '.repeat(60)}HEDEF ${'son '.repeat(60)}`;
const [before, word, after] = mode.captionWindow(long, long.indexOf('HEDEF'), 5, 100);
assert.equal(word, 'HEDEF');
assert.ok(before.startsWith('…') && after.endsWith('…'));

// The text window follows the caption's real size, and the newest spoken words stay visible.
assert.equal(mode.captionCapacity(0, 16), 180);
assert.equal(mode.captionCapacity(280, 17), Math.floor(280 / (17 * 0.56)) * 3);
assert.equal(mode.captionCapacity(5000, 16), 240);
assert.equal(mode.captionCapacity(40, 20), 40);
assert.equal(mode.captionTail('kısa', 20), 'kısa');
const tail = mode.captionTail(`${'eski '.repeat(40)}yeni söz`, 30);
assert.ok(tail.startsWith('…') && tail.endsWith('yeni söz') && tail.length <= 30);

// Without speech recognition (or the composer) the screen is not installed, so the microphone
// keeps its dictation fallback and its "unsupported" explanation.
assert.equal(mode.installVoiceMode({ querySelector: () => null, body: {} }, {}), null);

// Contract checks on the source: the screen must not read text into the DOM as HTML, it must
// hand microphone ownership to hands-free via the shared event, and it must route speech through
// voice-output instead of calling speechSynthesis.speak itself.
const source = readFileSync(new URL('../public/typed/voice-mode.ts', import.meta.url), 'utf8');
assert.equal((source.match(/innerHTML\s*=/g) || []).length, 2, 'only the constant template and icons use innerHTML');
assert.match(source, /hafize:voice-input-state/);
assert.match(source, /hafize:voice-output-speak/);
assert.doesNotMatch(source, /speechSynthesis\.speak\(/);
assert.match(source, /addEventListener\(type, fn, options\)/);

// voice-output: a speak request reads aloud even when automatic replies are off, with its origin.
{
  const said = [];
  const events = [];
  const listeners = new Map();
  const doc = {
    hidden: false,
    documentElement: { dataset: {} },
    querySelector: (selector) => (selector === '#voiceOutputToggle' ? { setAttribute() {}, addEventListener() {}, removeEventListener() {}, classList: { toggle() {} } } : null),
    addEventListener: (type, fn) => listeners.set(type, fn),
    removeEventListener: (type) => listeners.delete(type),
    dispatchEvent: (event) => events.push(event.detail)
  };
  const root = {
    speechSynthesis: { speak(u) { said.push(u); }, cancel() {}, getVoices() { return [{ lang: 'tr-TR', name: 'A', voiceURI: 'a' }, { lang: 'tr-TR', name: 'B', voiceURI: 'b' }]; } },
    SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
    CustomEvent: class { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
    localStorage: { getItem: (key) => ({ [output.RATE_KEY]: '1.25', [output.VOICE_KEY]: 'b' })[key] ?? null, setItem() {} }
  };
  const controller = output.installVoiceOutput(doc, root);
  assert.equal(controller.isEnabled(), false);
  listeners.get(output.VOICE_OUTPUT_SPEAK_EVENT)({ detail: { text: 'Bu yanıtı oku.', origin: 'message:1' } });
  assert.equal(said.length, 1, 'speaks on request while auto replies are off');
  assert.equal(said[0].rate, 1.25, 'uses the saved speaking rate');
  assert.equal(said[0].voice.voiceURI, 'b', 'uses the saved voice');
  assert.deepEqual(events.at(-1), { source: 'voice-output', speaking: true, origin: 'message:1' });
  listeners.get(output.VOICE_OUTPUT_STOP_EVENT)();
  assert.deepEqual(events.at(-1), { source: 'voice-output', speaking: false, origin: '' });
  assert.equal(output.readRate({ getItem: () => '9' }), 1, 'out-of-range rates fall back to 1');
  controller.destroy();
}

console.log('Voice mode OK: states, transcript and caption helpers, safe DOM contract, speak-on-request with saved rate/voice');
