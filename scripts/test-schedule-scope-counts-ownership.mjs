import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ui = require('../public/schedule-scope-counts-ui.js');

class FakeElement {
  constructor() {
    this.dataset = {};
    this.textContent = '';
    this.hidden = false;
    this.attributes = new Map();
    this.count = null;
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  removeAttribute(name) { this.attributes.delete(name); }
  querySelector(selector) {
    return selector === '.schedule-list-filter-count' ? this.count : null;
  }
}

function makeControl(key, {
  countText = `local-${key}`,
  countHidden = true,
  ariaLabel,
  serverCount
} = {}) {
  const button = new FakeElement();
  button.dataset.filter = key;
  if (serverCount !== undefined) button.dataset.serverCount = String(serverCount);
  if (ariaLabel !== undefined) button.setAttribute('aria-label', ariaLabel);
  const count = new FakeElement();
  count.textContent = countText;
  count.hidden = countHidden;
  button.count = count;
  return { button, count };
}

function fixture(overrides = {}) {
  const refs = new Map(ui.KEYS.map((key) => [key, makeControl(key, overrides[key])]));
  const controls = {
    querySelectorAll(selector) {
      assert.equal(selector, '[data-filter]');
      return [...refs.values()].map((entry) => entry.button);
    }
  };
  const listeners = new Map();
  const root = {
    fetch: null,
    addEventListener(name, listener) {
      if (!listeners.has(name)) listeners.set(name, []);
      listeners.get(name).push(listener);
    },
    removeEventListener(name, listener) {
      const entries = listeners.get(name) || [];
      listeners.set(name, entries.filter((candidate) => candidate !== listener));
    },
    dispatch(name) {
      for (const listener of listeners.get(name) || []) listener({ type: name });
    }
  };
  const documentRef = { getElementById: () => controls };
  return { refs, controls, listeners, root, documentRef };
}

function response(counts, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    async json() { return { listMeta: { scopeCounts: counts } }; }
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function assertHostState(refs, expected) {
  for (const key of ui.KEYS) {
    const entry = refs.get(key);
    const state = expected[key];
    assert.equal(entry.count.textContent, state.countText, `${key} count text restored`);
    assert.equal(entry.count.hidden, state.countHidden, `${key} count visibility restored`);
    assert.equal(entry.button.getAttribute('aria-label'), state.ariaLabel ?? null, `${key} aria-label restored`);
    if (state.serverCount === undefined) {
      assert.equal(Object.prototype.hasOwnProperty.call(entry.button.dataset, 'serverCount'), false, `${key} server count removed`);
    } else {
      assert.equal(entry.button.dataset.serverCount, String(state.serverCount), `${key} server count restored`);
    }
  }
}

{
  const host = {
    all: { countText: 'yerel 8', countHidden: true, ariaLabel: 'Host tümü', serverCount: 91 },
    active: { countText: 'yerel 3', countHidden: false, ariaLabel: undefined, serverCount: undefined },
    history: { countText: 'yerel 5', countHidden: true, ariaLabel: 'Host geçmiş', serverCount: undefined },
    failed: { countText: 'yerel 2', countHidden: false, ariaLabel: 'Host başarısız', serverCount: 7 }
  };
  const f = fixture(host);
  const fetchCalls = [];
  const controller = ui.mount(f.documentRef, f.root, f.controls, {
    fetchImpl: async (...args) => {
      fetchCalls.push(args);
      return response({ all: 12, active: 4, history: 8, failed: 3 });
    }
  });
  assert.ok(controller, 'controller mounts');
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(fetchCalls.length, 1);
  for (const [key, value] of Object.entries({ all: 12, active: 4, history: 8, failed: 3 })) {
    const refs = f.refs.get(key);
    assert.equal(refs.count.textContent, String(value));
    assert.equal(refs.count.hidden, false);
    assert.equal(refs.button.getAttribute('aria-label'), `${({ all: 'Tümü', active: 'Aktif', history: 'Geçmiş', failed: 'Başarısız' })[key]}: ${value} görev`);
    assert.equal(refs.button.dataset.serverCount, String(value));
  }
  controller.destroy();
  assertHostState(f.refs, host);
  assert.equal(ui.REFRESH_EVENTS.every((name) => (f.listeners.get(name) || []).length === 0), true, 'listeners removed exactly');
  assert.deepEqual(await controller.refresh(), { ok: false, reason: 'destroyed' });
}

{
  const f = fixture();
  const fetchImpl = async () => response({ all: 2, active: 1, history: 1, failed: 0 });
  const first = ui.mount(f.documentRef, f.root, f.controls, { fetchImpl });
  assert.ok(first);
  const second = ui.mount(f.documentRef, f.root, f.controls, { fetchImpl });
  assert.equal(second, null, 'same controls cannot have two active owners');
  first.destroy();
  const remounted = ui.mount(f.documentRef, f.root, f.controls, { fetchImpl });
  assert.ok(remounted, 'destroy releases ownership for a clean remount');
  remounted.destroy();
}

{
  const f = fixture({ all: { countText: 'host-all', countHidden: true, ariaLabel: 'host-label' } });
  const pending = deferred();
  const controller = ui.mount(f.documentRef, f.root, f.controls, {
    fetchImpl: async () => pending.promise
  });
  assert.ok(controller);
  controller.destroy();
  pending.resolve(response({ all: 20, active: 5, history: 15, failed: 4 }));
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(f.refs.get('all').count.textContent, 'host-all', 'late response cannot overwrite restored host text');
  assert.equal(f.refs.get('all').count.hidden, true, 'late response cannot overwrite restored visibility');
  assert.equal(f.refs.get('all').button.getAttribute('aria-label'), 'host-label', 'late response cannot overwrite restored ARIA');
  assert.equal(Object.prototype.hasOwnProperty.call(f.refs.get('all').button.dataset, 'serverCount'), false);
}

{
  const f = fixture();
  let addCalls = 0;
  f.root.addEventListener = (name, listener) => {
    addCalls += 1;
    if (addCalls === 2) throw new Error('listener install failed');
    if (!f.listeners.has(name)) f.listeners.set(name, []);
    f.listeners.get(name).push(listener);
  };
  const controller = ui.mount(f.documentRef, f.root, f.controls, {
    fetchImpl: async () => response({ all: 1, active: 1, history: 0, failed: 0 })
  });
  assert.equal(controller, null, 'partial listener installation fails closed');
  assert.equal([...f.listeners.values()].every((entries) => entries.length === 0), true, 'partial listener install rolls back');

  f.root.addEventListener = (name, listener) => {
    if (!f.listeners.has(name)) f.listeners.set(name, []);
    f.listeners.get(name).push(listener);
  };
  const retry = ui.mount(f.documentRef, f.root, f.controls, {
    fetchImpl: async () => response({ all: 1, active: 1, history: 0, failed: 0 })
  });
  assert.ok(retry, 'failed installation releases ownership for retry');
  retry.destroy();
}

console.log('schedule scope counts ownership tests passed');
