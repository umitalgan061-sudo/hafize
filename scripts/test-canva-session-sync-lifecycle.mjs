import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/canva-session-sync.js', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(source, { module, exports: module.exports, globalThis: {}, self: {} });
const api = module.exports;

class FakeObserver {
  static instances = [];
  constructor(callback) {
    this.callback = callback;
    this.disconnected = false;
    this.observed = null;
    FakeObserver.instances.push(this);
  }
  observe(node, options) {
    this.observed = { node, options };
  }
  disconnect() {
    this.disconnected = true;
  }
  fire() {
    this.callback([{ type: 'attributes', attributeName: 'data-state' }]);
  }
}

function createHarness({ state = 'idle', refreshDisabled = false, refreshMissing = false, refreshThrows = false, observer = FakeObserver } = {}) {
  FakeObserver.instances = [];
  const badge = { dataset: { state } };
  const refresh = {
    disabled: refreshDisabled,
    clicks: 0,
    click() {
      if (refreshThrows) throw new Error('refresh failed');
      this.clicks += 1;
    }
  };
  const documentRef = {
    querySelector(selector) {
      if (selector === '#sessionBadge') return badge;
      if (selector === '#canvaConnectionCard .canva-connection-refresh') return refreshMissing ? null : refresh;
      return null;
    }
  };
  return { badge, refresh, documentRef, root: { MutationObserver: observer } };
}

assert.equal(api.normalizeState('active'), 'active');
assert.equal(api.normalizeState('idle'), 'idle');
assert.equal(api.normalizeState('unknown'), null);
assert.equal(api.normalizeState(null), null);
assert.deepEqual([...api.STABLE_STATES], ['active', 'idle', 'disabled', 'error']);

{
  const h = createHarness();
  const controller = api.mount(h.documentRef, h.root);
  assert.ok(controller);
  assert.equal(controller.getState(), 'idle');
  assert.equal(FakeObserver.instances.length, 1);
  assert.deepEqual(Array.from(FakeObserver.instances[0].observed.options.attributeFilter), ['data-state']);

  h.badge.dataset.state = 'active';
  FakeObserver.instances[0].fire();
  assert.equal(h.refresh.clicks, 1);
  assert.equal(controller.getState(), 'active');

  FakeObserver.instances[0].fire();
  assert.equal(h.refresh.clicks, 1, 'same state must not refresh twice');
}

{
  const h = createHarness({ refreshDisabled: true });
  const controller = api.mount(h.documentRef, h.root);
  h.badge.dataset.state = 'active';
  assert.equal(controller.sync(), false);
  assert.equal(controller.getState(), 'idle', 'failed refresh must not consume state transition');
  assert.equal(h.refresh.clicks, 0);

  h.refresh.disabled = false;
  assert.equal(controller.sync(), true);
  assert.equal(controller.getState(), 'active');
  assert.equal(h.refresh.clicks, 1);
}

for (const options of [{ refreshMissing: true }, { refreshThrows: true }]) {
  const h = createHarness(options);
  const controller = api.mount(h.documentRef, h.root);
  h.badge.dataset.state = 'active';
  assert.equal(controller.sync(), false);
  assert.equal(controller.getState(), 'idle', 'unavailable refresh must preserve retryable state');
}

{
  const h = createHarness();
  const controller = api.mount(h.documentRef, h.root);
  const observer = FakeObserver.instances[0];
  assert.equal(controller.destroy(), true);
  assert.equal(observer.disconnected, true);
  assert.equal(controller.destroy(), false);

  h.badge.dataset.state = 'active';
  observer.fire();
  assert.equal(h.refresh.clicks, 0, 'stale observer callback must be inert after destroy');
  assert.equal(controller.sync(), false);
  assert.equal(controller.getState(), 'idle');
}

{
  class ThrowingObserve extends FakeObserver {
    observe() { throw new Error('observe failed'); }
  }
  const h = createHarness({ observer: ThrowingObserve });
  assert.equal(api.mount(h.documentRef, h.root), null);
  assert.equal(FakeObserver.instances.length, 1);
  assert.equal(FakeObserver.instances[0].disconnected, true);
}

{
  assert.equal(api.mount(null, { MutationObserver: FakeObserver }), null);
  assert.equal(api.mount({ querySelector: () => null }, { MutationObserver: FakeObserver }), null);
  assert.equal(api.mount({ querySelector: () => ({ dataset: {} }) }, {}), null);
}

{
  const h = createHarness({ state: 'unknown' });
  const controller = api.mount(h.documentRef, h.root);
  assert.equal(controller.getState(), null);
  h.badge.dataset.state = 'error';
  assert.equal(controller.sync(), true);
  assert.equal(controller.getState(), 'error');
  assert.equal(h.refresh.clicks, 1);
}

console.log('canva session sync lifecycle tests passed');
