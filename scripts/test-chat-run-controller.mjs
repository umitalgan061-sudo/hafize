import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/chat-run-controller.js');

class FakeAbortController {
  constructor() {
    const listeners = new Set();
    this.signal = {
      aborted: false,
      reason: undefined,
      addEventListener(type, listener) {
        if (type === 'abort') listeners.add(listener);
      }
    };
    this.abortCalls = 0;
    this.abort = (reason) => {
      if (this.signal.aborted) return;
      this.abortCalls += 1;
      this.signal.aborted = true;
      this.signal.reason = reason;
      for (const listener of listeners) listener({ type: 'abort' });
    };
  }
}

assert.equal(typeof api.createChatRunController, 'function');
assert.equal(typeof api.isAbortError, 'function');

const controller = api.createChatRunController({ AbortControllerImpl: FakeAbortController });
assert.deepEqual(controller.snapshot(), { active: false, generation: 0, aborted: false });

const first = controller.begin();
assert.equal(first.token.generation, 1);
assert.equal(first.signal.aborted, false);
assert.equal(controller.isCurrent(first.token), true);
assert.deepEqual(controller.snapshot(), { active: true, generation: 1, aborted: false });
assert.throws(() => controller.begin(), /CHAT_RUN_ALREADY_ACTIVE/);

let abortEvents = 0;
first.signal.addEventListener('abort', () => { abortEvents += 1; });
assert.equal(controller.abort('user'), true);
assert.equal(first.signal.aborted, true);
assert.equal(first.signal.reason, 'user');
assert.equal(abortEvents, 1);
assert.equal(controller.abort('user-again'), false, 'abort must be idempotent for an active signal');
assert.deepEqual(controller.snapshot(), { active: true, generation: 1, aborted: true });

assert.equal(controller.finish(Object.freeze({ generation: 1 })), false, 'lookalike token must not finish a run');
assert.equal(controller.isCurrent(first.token), true);
assert.equal(controller.finish(first.token), true);
assert.equal(controller.finish(first.token), false, 'finish must be idempotent');
assert.equal(controller.abort(), false, 'inactive controller must not fabricate an abort');
assert.deepEqual(controller.snapshot(), { active: false, generation: 1, aborted: false });

const second = controller.begin();
assert.equal(second.token.generation, 2);
assert.notStrictEqual(second.token, first.token);
assert.equal(controller.isCurrent(first.token), false);
assert.equal(controller.isCurrent(second.token), true);
assert.equal(controller.finish(first.token), false, 'stale run must not finish current generation');
assert.equal(controller.finish(second.token), true);

assert.equal(api.isAbortError(new DOMException('stopped', 'AbortError')), true);
assert.equal(api.isAbortError({ code: 'ABORT_ERR' }), true);
assert.equal(api.isAbortError(new Error('network'), { aborted: true }), true);
assert.equal(api.isAbortError(new Error('network'), { aborted: false }), false);
assert.equal(api.isAbortError(null, null), false);

assert.throws(
  () => api.createChatRunController({ AbortControllerImpl: null }),
  /CHAT_RUN_ABORT_UNAVAILABLE/
);
assert.throws(
  () => api.createChatRunController({ AbortControllerImpl: class BrokenAbortController {} }).begin(),
  /CHAT_RUN_ABORT_UNAVAILABLE/
);

console.log('chat run controller tests passed');
