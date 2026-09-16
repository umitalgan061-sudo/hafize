// Stop / regenerate rules, exercised directly.
//
// The chat runtime and the composer controls both ask this module the same two
// questions, so the answers are pinned here once: which transcripts can be
// regenerated, what the buttons may offer in each state, and what a stopped
// answer keeps.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const policy = require('../public/chat-stream-policy.js');

const user = (content = 'Merhaba') => ({ id: 'u1', role: 'user', content });
const answer = (content = 'Selam', extra = {}) => ({ id: 'a1', role: 'assistant', content, ...extra });

assert.ok(Object.isFrozen(policy), 'the policy surface is frozen');

// --- abort detection -------------------------------------------------------

assert.equal(policy.isAbortError({ name: 'AbortError' }), true);
assert.equal(policy.isAbortError({ code: 20 }), true, 'a bare DOMException code still reads as an abort');
assert.equal(policy.isAbortError({ code: 'ABORT_ERR' }), true);
assert.equal(policy.isAbortError(new TypeError('network')), false, 'a real failure is not an abort');
assert.equal(policy.isAbortError(null), false);
assert.equal(policy.isAbortError(undefined), false);

// --- which answer a regenerate replaces ------------------------------------

assert.equal(policy.findLastAnswer([]), null, 'an empty transcript has nothing to regenerate');
assert.equal(policy.findLastAnswer(null), null, 'a missing transcript is handled');
assert.equal(policy.findLastAnswer([user()]), null, 'a pending question is not an answer');
assert.equal(policy.findLastAnswer([answer()]), null, 'an answer nobody asked for cannot be reproduced');
assert.equal(policy.findLastAnswer([user(''), answer()]), null, 'an empty question carries no request');
assert.equal(policy.findLastAnswer([user(), answer()])?.index, 1);
assert.equal(policy.findLastAnswer([user(), answer(), user('devam')]), null, 'only a trailing answer qualifies');

// A stopped or failed answer is exactly what a user wants to retry.
assert.equal(policy.canRegenerate([user(), answer('yarım', { stopped: true })]), true);
assert.equal(policy.canRegenerate([user(), answer('NVIDIA yanıtı alınamadı: 500')]), true);
assert.equal(policy.canRegenerate([user(), answer('')]), true, 'an empty answer is still replaceable');

const transcript = [user(), answer(), user('tekrar'), answer('ikinci')];
const truncated = policy.truncateForRegenerate(transcript);
assert.deepEqual(truncated.map((item) => item.content), ['Merhaba', 'Selam', 'tekrar']);
assert.equal(transcript.length, 4, 'truncation does not mutate the transcript it was given');
assert.equal(policy.truncateForRegenerate([user()]), null);

// --- what the controls may offer -------------------------------------------

const idle = policy.describeState({ streaming: false, hasActiveStream: false, messages: [user(), answer()] });
assert.ok(Object.isFrozen(idle), 'a described state is frozen');
assert.deepEqual({ ...idle }, { streaming: false, canStop: false, canRegenerate: true, stopped: false });

const sending = policy.describeState({ streaming: true, hasActiveStream: false, messages: [user()] });
assert.equal(sending.canStop, false, 'there is nothing to abort before the request is open');
assert.equal(sending.canRegenerate, false, 'regenerating during a turn would race it');

const streaming = policy.describeState({ streaming: true, hasActiveStream: true, messages: [user(), answer('')] });
assert.equal(streaming.canStop, true);
assert.equal(streaming.streaming, true);

const stopped = policy.describeState({
  streaming: false,
  hasActiveStream: false,
  messages: [user(), answer('yarım', { stopped: true })]
});
assert.equal(stopped.stopped, true, 'a stopped turn is reported so the composer can say so');
assert.equal(stopped.canRegenerate, true);

const empty = policy.describeState();
assert.deepEqual({ ...empty }, { streaming: false, canStop: false, canRegenerate: false, stopped: false });

// --- what a stopped answer keeps -------------------------------------------

assert.equal(policy.stoppedContent('yarım kalan yanıt'), 'yarım kalan yanıt', 'a partial answer is kept verbatim');
assert.equal(policy.stoppedContent(''), policy.STOPPED_NOTE, 'an empty answer falls back to the note');
assert.equal(policy.stoppedContent('   '), policy.STOPPED_NOTE);
assert.equal(policy.stoppedContent(undefined), policy.STOPPED_NOTE);
assert.match(policy.STOPPED_NOTE, /durduruldu/i);
assert.match(policy.STOPPED_BADGE, /durduruldu/i);

console.log('chat stream policy: ok');
