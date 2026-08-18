import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';
const require = createRequire(import.meta.url);
const ui = require('../public/schedule-scope-counts-ui.js');

function countButton(key) {
  const count = { textContent: '0', hidden: true };
  const dataset = { filter: key };
  const attributes = new Map();
  const button = {
    dataset,
    querySelector(selector) { return selector === '.schedule-list-filter-count' ? count : null; },
    setAttribute(name, value) { attributes.set(name, String(value)); }
  };
  return { button, count, attributes };
}

const refs = new Map(ui.KEYS.map((key) => [key, countButton(key)]));
const controls = {
  querySelectorAll(selector) {
    assert.equal(selector, '[data-filter]');
    return Array.from(refs.values(), (entry) => entry.button);
  }
};
const nodes = ui.collectCountNodes(controls);
assert.equal(nodes.size, 4);
assert.equal(ui.renderCounts(nodes, { all: 9, active: 2, history: 7, failed: 3 }), true);
for (const key of ui.KEYS) {
  const entry = refs.get(key);
  assert.equal(entry.count.hidden, false);
  assert.equal(entry.count.textContent, String({ all: 9, active: 2, history: 7, failed: 3 }[key]));
  assert.equal(entry.button.dataset.serverCount, entry.count.textContent);
  assert.match(entry.attributes.get('aria-label'), /görev$/);
}

class Root extends EventEmitter {
  addEventListener(name, listener) { this.on(name, listener); }
  removeEventListener(name, listener) { this.off(name, listener); }
}
const root = new Root();
let requests = 0;
let resolveRequest;
const fetchImpl = () => {
  requests += 1;
  return new Promise((resolve) => {
    resolveRequest = () => resolve({
      ok: true,
      status: 200,
      json: async () => ({ listMeta: { scopeCounts: { all: requests, active: requests, history: 0, failed: 0 } } })
    });
  });
};
const documentRef = { getElementById: (id) => id === ui.CONTROLS_ID ? controls : null };
const mounted = ui.mount(documentRef, root, controls, { fetchImpl });
assert.ok(mounted);
assert.equal(requests, 1);
root.emit('hafize:schedule-created');
root.emit('hafize:schedule-cancelled');
assert.equal(requests, 1, 'refreshes must coalesce while a request is running');
resolveRequest();
await new Promise((resolve) => setImmediate(resolve));
assert.equal(requests, 2, 'one pending refresh must run after the active request');
resolveRequest();
await new Promise((resolve) => setImmediate(resolve));
assert.deepEqual(mounted.getCounts(), { all: 2, active: 2, history: 0, failed: 0 });

root.emit('hafize:schedule-rescheduled');
assert.equal(requests, 3);
resolveRequest();
await new Promise((resolve) => setImmediate(resolve));
assert.deepEqual(mounted.getCounts(), { all: 3, active: 3, history: 0, failed: 0 });

mounted.destroy();
const beforeDestroyEvent = requests;
root.emit('hafize:schedule-created');
assert.equal(requests, beforeDestroyEvent);
for (const key of ui.KEYS) assert.equal('serverCount' in refs.get(key).button.dataset, false);
const afterDestroy = await mounted.refresh();
assert.equal(afterDestroy.ok, false);
assert.equal(afterDestroy.reason, 'destroyed');

process.stdout.write('schedule scope counts UI lifecycle tests passed\n');
