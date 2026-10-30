import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const library = require('../public/typed/voice-library.ts');
const settings = require('../public/typed/voice-settings.ts');
const output = require('../public/typed/voice-output.ts');

// Catalog shipped with the app: complete, well-formed and pointing at real model paths.
const { voices } = JSON.parse(readFileSync(new URL('../public/piper-voices.json', import.meta.url), 'utf8'));
assert.ok(voices.length >= 100, 'the whole Piper library is listed');
for (const voice of voices) {
  assert.match(voice.key, /^[a-zA-Z]{2,3}_[A-Z0-9]+-/);
  if (voice.source) {
    // Community voices: pinned to a commit, so a later upload cannot change what gets downloaded.
    assert.match(voice.url, /^https:\/\/huggingface\.co\/[^/]+\/[^/]+\/resolve\/[0-9a-f]{40}\/model\.onnx$/, voice.key);
    assert.match(voice.configUrl, /^https:\/\/huggingface\.co\/[^/]+\/[^/]+\/resolve\/[0-9a-f]{40}\/config\.json$/, voice.key);
  } else {
    assert.ok(voice.path.endsWith(`${voice.key}.onnx`), voice.key);
    assert.equal(voice.url, undefined, voice.key);
  }
  assert.ok(voice.size > 1e6, voice.key);
  assert.ok(voice.speakers >= 1, voice.key);
}
assert.equal(new Set(voices.map((voice) => voice.key)).size, voices.length, 'voice keys are unique');
assert.ok(voices.some((voice) => voice.family === 'tr'), 'a Turkish voice exists');

// Helpers.
assert.equal(library.isPiperVoice('piper:tr_TR-dfki-medium'), true);
assert.equal(library.isPiperVoice('Microsoft Tolga'), false);
assert.equal(library.isPiperVoice(null), false);
assert.equal(library.piperKey('piper:tr_TR-dfki-medium'), 'tr_TR-dfki-medium');
assert.equal(library.formatSize(63201294), '63 MB');
assert.equal(library.formatSize(0), '');
assert.equal(library.modelUrl({ path: 'tr/x.onnx' }), 'https://huggingface.co/rhasspy/piper-voices/resolve/main/tr/x.onnx');
assert.equal(library.configUrl({ path: 'tr/x.onnx' }), 'https://huggingface.co/rhasspy/piper-voices/resolve/main/tr/x.onnx.json');
assert.equal(library.modelUrl({ path: 'r/model.onnx', url: 'https://example.test/m.onnx' }), 'https://example.test/m.onnx');
assert.equal(library.configUrl({ path: 'r/model.onnx', url: 'https://example.test/m.onnx', configUrl: 'https://example.test/c.json' }), 'https://example.test/c.json');
assert.match(settings.describeVoice({ langName: 'Türkçe', country: 'Turkey', quality: 'medium', size: 63e6, speakers: 1, source: 'speaches-ai' }), /topluluk: speaches-ai · lisans belirtilmemiş/);
assert.match(library.sampleFor('tr'), /Hafize/);
assert.equal(library.sampleFor('zz'), library.sampleFor('en'));

const sorted = library.sortVoices(voices);
assert.equal(sorted[0].family, 'tr', 'Turkish comes first');
assert.ok(library.filterVoices(voices, 'tr', '').every((voice) => voice.family === 'tr'));
assert.equal(library.filterVoices(voices, '', '').length, voices.length);
assert.ok(library.filterVoices(voices, '', 'TÜRKÇE').some((voice) => voice.family === 'tr'), 'search ignores case in Turkish');
assert.equal(library.filterVoices(voices, 'tr', 'olmayan ses').length, 0);

// Loudness: quiet models are lifted to one level, silence is left alone, boost is capped.
assert.equal(library.normalizedGain([0, 0.45, -0.3]), 2);
assert.equal(library.normalizedGain([0, 0.001]), 1);
assert.equal(library.normalizedGain([0.05]), 8);

// Ids a model does not know are dropped instead of crashing its embedding lookup.
assert.deepEqual(library.keepKnownPhonemes([1, 132, 2, 3], { a: [1], b: [2], c: [3, 4] }), [1, 2, 3]);

// Estimated word timing is ordered, starts at zero and covers every word.
const timeline = library.wordTimeline('Merhaba ben Hafize');
assert.deepEqual(timeline.map((word) => [word.index, word.length]), [[0, 7], [8, 3], [12, 6]]);
assert.equal(timeline[0].at, 0);
assert.ok(timeline[1].at < timeline[2].at && timeline[2].at < 1);
assert.deepEqual(library.wordTimeline('   '), []);

// Settings helpers.
const languages = settings.languageOptions(voices);
assert.equal(languages[0].family, 'tr', 'Turkish is the first language');
assert.equal(languages.reduce((sum, entry) => sum + entry.count, 0), voices.length);
assert.match(settings.describeVoice({ langName: 'Türkçe', country: 'Turkey', quality: 'medium', size: 63e6, speakers: 3 }), /Türkçe \(Turkey\) · orta kalite · 63 MB · 3 konuşmacı/);

// A saved browser voice of any language is honoured; Turkish stays the automatic choice.
const browser = [{ lang: 'en-US', name: 'E', voiceURI: 'e' }, { lang: 'tr-TR', name: 'T', voiceURI: 't' }];
assert.equal(output.pickTurkishVoice(browser, 'e').voiceURI, 'e');
assert.equal(output.pickTurkishVoice(browser, null).voiceURI, 't');
assert.equal(output.pickTurkishVoice(browser, 'gone').voiceURI, 't');

// Files the browser loads by URL must exist; nothing is committed in the build output.
for (const file of ['PhonemizeWebWorker.js', 'piper_phonemize.wasm', 'piper_phonemize.data']) {
  assert.ok(statSync(new URL(`../public/vendor/piper-phonemize/${file}`, import.meta.url)).size > 1000, file);
}
const source = readFileSync(new URL('../public/typed/voice-library.ts', import.meta.url), 'utf8');
assert.match(source, /PhonemizeWebWorker\.js`, \{ type: 'module' \}/, 'the phonemizer is an ES module worker');
assert.match(source, /VOICE_TIMEOUT/, 'a stuck worker can never leave speech silently waiting');
assert.doesNotMatch(readFileSync(new URL('../public/typed/voice-settings.ts', import.meta.url), 'utf8'), /innerHTML/);
const vite = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
assert.match(vite, /'piper-worker':/);
assert.match(vite, /ort-wasm-simd-threaded\.wasm/);
assert.match(readFileSync(new URL('../THIRD_PARTY_NOTICES.md', import.meta.url), 'utf8'), /espeak-ng/i);

console.log('Voice library OK: catalog, filters, loudness, word timing, saved voices, vendored files and stuck-worker guard');
