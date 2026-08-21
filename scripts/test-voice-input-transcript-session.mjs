import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const voice = require('../public/voice-input.js');

function result(text, isFinal = false) {
  const entry = [{ transcript: text }];
  entry.isFinal = isFinal;
  return entry;
}

function event(results, resultIndex = 0) {
  return { results, resultIndex };
}

{
  const session = voice.createTranscriptSession();
  const first = session.apply(event([result('Merhaba', false)], 0));
  assert.equal(first.changed, true);
  assert.equal(first.text, 'Merhaba');
  assert.equal(first.finalText, '');
  assert.equal(first.segmentCount, 1);
  assert.deepEqual(session.snapshot(), [{ text: 'Merhaba', isFinal: false }]);

  const second = session.apply(event([result('Merhaba', true), result('nasılsın', false)], 0));
  assert.equal(second.changed, true);
  assert.equal(second.text, 'Merhaba nasılsın');
  assert.equal(second.finalText, 'Merhaba');
  assert.equal(second.segmentCount, 2);

  const third = session.apply(event([result('Merhaba', true), result('nasılsın bugün', false)], 1));
  assert.equal(third.changed, true);
  assert.equal(third.text, 'Merhaba nasılsın bugün');
  assert.equal(third.finalText, 'Merhaba');
  assert.deepEqual(session.snapshot(), [
    { text: 'Merhaba', isFinal: true },
    { text: 'nasılsın bugün', isFinal: false }
  ]);

  const fourth = session.apply(event([result('Merhaba', true), result('nasılsın bugün', true)], 1));
  assert.equal(fourth.text, 'Merhaba nasılsın bugün');
  assert.equal(fourth.finalText, 'Merhaba nasılsın bugün');
}

{
  const session = voice.createTranscriptSession();
  session.apply(event([result('bir', true), result('iki', true), result('üç', false)], 0));
  const update = session.apply(event([result('bir', true), result('iki', true), result('üç dört', false)], 2));
  assert.equal(update.text, 'bir iki üç dört', 'advanced resultIndex preserves earlier final segments');
  assert.equal(update.finalText, 'bir iki');
}

{
  const session = voice.createTranscriptSession();
  session.apply(event([result('ilk', true), result('ikinci', false)], 0));
  const update = session.apply(event([result('ilk', true), result('ikinci', true), result('üçüncü', false)], 1));
  assert.equal(update.text, 'ilk ikinci üçüncü');
  assert.equal(update.finalText, 'ilk ikinci');
  assert.equal(update.segmentCount, 3);
}

{
  const session = voice.createTranscriptSession();
  session.apply(event([result('korunacak', true), result('silinecek', false)], 0));
  const shortened = session.apply(event([result('korunacak', true)], 1));
  assert.equal(shortened.changed, true);
  assert.equal(shortened.text, 'korunacak');
  assert.equal(shortened.segmentCount, 1);
}

{
  const session = voice.createTranscriptSession();
  session.apply(event([result('A', true), result('B', false)], 0));
  const blank = session.apply(event([result('A', true), result('   ', false)], 1));
  assert.equal(blank.text, 'A');
  assert.deepEqual(session.snapshot(), [{ text: 'A', isFinal: true }, null]);
}

{
  const session = voice.createTranscriptSession();
  session.apply(event([result('değişmedi', true)], 0));
  const unchanged = session.apply(event([result('değişmedi', true)], 0));
  assert.equal(unchanged.changed, false);
  assert.equal(unchanged.text, 'değişmedi');
}

{
  const session = voice.createTranscriptSession();
  const malformed = session.apply({ results: null, resultIndex: 0 });
  assert.equal(malformed.changed, false);
  assert.equal(malformed.text, '');
  assert.equal(malformed.segmentCount, 0);
}

{
  const session = voice.createTranscriptSession();
  session.apply(event([result('önce', true)], 0));
  const negative = session.apply(event([result('sonra', true)], -99));
  assert.equal(negative.text, 'sonra', 'negative resultIndex clamps to zero');

  const beyond = session.apply(event([result('sonra', true)], 99));
  assert.equal(beyond.changed, false, 'resultIndex beyond length clamps to result length');
  assert.equal(beyond.text, 'sonra');
}

{
  const session = voice.createTranscriptSession();
  session.apply(event([result('bir', true), result('iki', false)], 0));
  const snapshot = session.snapshot();
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot[0]), true);
  assert.throws(() => snapshot.push({ text: 'x', isFinal: true }), TypeError);
  assert.equal(session.text(), 'bir iki');

  session.reset();
  assert.equal(session.text(), '');
  assert.equal(session.finalText(), '');
  assert.deepEqual(session.snapshot(), []);
}

{
  assert.equal(voice.mergeTranscript('Taslak', 'merhaba dünya', 12000), 'Taslak merhaba dünya');
  assert.equal(voice.mergeTranscript('Taslak   ', '  merhaba   dünya  ', 12000), 'Taslak merhaba dünya');
  assert.equal(voice.mergeTranscript('', 'merhaba', 5), 'merha');
  assert.equal(voice.mergeTranscript('abc', 'def', 6), 'abc de');
}

console.log('voice input transcript session tests passed');
