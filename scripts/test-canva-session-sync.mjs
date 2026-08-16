import assert from 'node:assert/strict';
import { copyFile, unlink } from 'node:fs/promises';
import { createRequire } from 'node:module';

const source = new URL('../public/canva-session-sync.js', import.meta.url);
const copy = new URL('../public/canva-session-sync.test.cjs', import.meta.url);
await copyFile(source, copy);
const require = createRequire(import.meta.url);
const api = require(copy.pathname);
await unlink(copy);

assert.equal(api.normalizeState('active'), 'active');
assert.equal(api.normalizeState('idle'), 'idle');
assert.equal(api.normalizeState('disabled'), 'disabled');
assert.equal(api.normalizeState('error'), 'error');
assert.equal(api.normalizeState('loading'), null);
assert.equal(api.normalizeState(''), null);
assert.equal(api.normalizeState(null), null);

class Observer {
  constructor(callback) { this.callback = callback; Observer.instance = this; }
  observe(target, options) { this.target = target; this.options = options; }
  disconnect() { this.disconnected = true; }
  fire() { this.callback([{ type: 'attributes', target: this.target }]); }
}

function setup(initialState = 'loading') {
  let clicks = 0;
  const badge = { dataset: { state: initialState } };
  const refresh = { disabled: false, click() { clicks += 1; } };
  const documentRef = {
    querySelector(selector) {
      if (selector === '#sessionBadge') return badge;
      if (selector === '#canvaConnectionCard .canva-connection-refresh') return refresh;
      return null;
    }
  };
  const root = { MutationObserver: Observer };
  return { badge, refresh, documentRef, root, clicks: () => clicks };
}

{
  const env = setup('loading');
  const controller = api.mount(env.documentRef, env.root);
  assert.ok(controller);
  assert.equal(controller.getState(), null);
  assert.deepEqual(Observer.instance.options, { attributes: true, attributeFilter: ['data-state'] });

  env.badge.dataset.state = 'active';
  Observer.instance.fire();
  assert.equal(env.clicks(), 1);
  assert.equal(controller.getState(), 'active');

  Observer.instance.fire();
  assert.equal(env.clicks(), 1, 'same stable state must not refresh twice');

  env.badge.dataset.state = 'loading';
  Observer.instance.fire();
  assert.equal(env.clicks(), 1, 'transient loading state must be ignored');

  env.badge.dataset.state = 'idle';
  Observer.instance.fire();
  assert.equal(env.clicks(), 2);
  assert.equal(controller.getState(), 'idle');

  env.refresh.disabled = true;
  env.badge.dataset.state = 'active';
  Observer.instance.fire();
  assert.equal(env.clicks(), 2, 'busy status card must not receive another refresh click');

  assert.equal(controller.destroy(), true);
  assert.equal(Observer.instance.disconnected, true);
  assert.equal(controller.destroy(), false);
  env.refresh.disabled = false;
  env.badge.dataset.state = 'error';
  assert.equal(controller.sync(), false);
  assert.equal(env.clicks(), 2);
}

{
  const env = setup('active');
  const controller = api.mount(env.documentRef, env.root);
  assert.equal(controller.getState(), 'active');
  env.badge.dataset.state = 'idle';
  Observer.instance.fire();
  assert.equal(env.clicks(), 1);
  controller.destroy();
}

assert.equal(api.mount(null, { MutationObserver: Observer }), null);
assert.equal(api.mount({ querySelector() { return null; } }, { MutationObserver: Observer }), null);
assert.equal(api.mount({ querySelector() { return {}; } }, {}), null);

console.log('Canva session sync tests passed');
