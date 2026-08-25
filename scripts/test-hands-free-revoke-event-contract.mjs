import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const handsFree = require('../public/hands-free.js');
const backgroundGuard = require('../public/hands-free-background-guard.js');

assert.equal(
  handsFree.HANDS_FREE_REVOKE_EVENT,
  backgroundGuard.HANDS_FREE_REVOKE_EVENT,
  'runtime and guard must share one canonical revoke event name'
);
assert.equal(handsFree.HANDS_FREE_REVOKE_EVENT, 'hafize:hands-free-revoke');

class FakeCustomEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail;
  }
}

{
  const event = backgroundGuard.createRevokeEvent(
    { CustomEvent: FakeCustomEvent },
    'window-blur'
  );
  assert.ok(event instanceof FakeCustomEvent);
  assert.equal(event.type, handsFree.HANDS_FREE_REVOKE_EVENT);
  assert.deepEqual(event.detail, {
    source: 'hands-free-background-guard',
    reason: 'window-blur'
  });
  assert.equal(Object.isFrozen(event.detail), true, 'revocation metadata must be immutable');
  assert.equal('enabled' in event.detail, false);
  assert.equal('token' in event.detail, false);
  assert.equal('transcript' in event.detail, false);
}

{
  const event = backgroundGuard.createRevokeEvent({}, '');
  assert.equal(event.type, handsFree.HANDS_FREE_REVOKE_EVENT);
  assert.deepEqual(event.detail, {
    source: 'hands-free-background-guard',
    reason: 'background'
  });
}

{
  const event = backgroundGuard.createRevokeEvent(null, null);
  assert.equal(event.type, handsFree.HANDS_FREE_REVOKE_EVENT);
  assert.equal(event.detail.reason, 'background');
  assert.equal(Object.isFrozen(event.detail), true);
}

{
  const root = {
    CustomEvent: class extends FakeCustomEvent {
      constructor(type, options) {
        super(type, options);
        this.createdByBrowserPath = true;
      }
    }
  };
  const event = backgroundGuard.createRevokeEvent(root, 'freeze');
  assert.equal(event.createdByBrowserPath, true);
  assert.equal(event.detail.reason, 'freeze');
}

assert.equal(
  Object.prototype.hasOwnProperty.call(handsFree, 'enableHandsFree'),
  false,
  'global factory API must not add a revoke-adjacent enable shortcut'
);
assert.equal(
  Object.prototype.hasOwnProperty.call(backgroundGuard, 'enable'),
  false,
  'background guard must remain disable-only'
);

console.log('hands-free revoke event contract tests passed');