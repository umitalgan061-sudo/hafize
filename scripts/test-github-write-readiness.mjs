import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/github-write-readiness.js');

assert.equal(api.HEALTH_PATH, '/api/health');
assert.deepEqual(api.normalizeHealth({ githubWriteConfigured: true }), { githubWriteConfigured: true });
assert.deepEqual(api.normalizeHealth({ githubWriteConfigured: false }), { githubWriteConfigured: false });
assert.equal(api.normalizeHealth({ githubWriteConfigured: 'true' }), null);
assert.equal(api.normalizeHealth(null), null);
assert.equal(api.deriveSummary({ githubWriteConfigured: true }).state, 'ready');
assert.match(api.deriveSummary({ githubWriteConfigured: true }).text, /açık onay/);
assert.equal(api.deriveSummary({ githubWriteConfigured: false }).state, 'off');
assert.match(api.deriveSummary({ githubWriteConfigured: false }).text, /salt-okunur/);
assert.equal(api.deriveSummary(null).state, 'error');

function node(tag = 'div') {
  const listeners = new Map();
  return {
    tagName: tag.toUpperCase(),
    children: [],
    dataset: {},
    attributes: new Map(),
    className: '',
    textContent: '',
    disabled: false,
    parentNode: null,
    nextSibling: null,
    append(...items) {
      for (const item of items) {
        if (!item) continue;
        item.parentNode = this;
        this.children.push(item);
      }
    },
    insertBefore(item, before) {
      item.parentNode = this;
      const index = this.children.indexOf(before);
      if (index < 0) this.children.push(item);
      else this.children.splice(index, 0, item);
    },
    setAttribute(name, value) { this.attributes.set(name, String(value)); },
    getAttribute(name) { return this.attributes.get(name) ?? null; },
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type, listener) { if (listeners.get(type) === listener) listeners.delete(type); },
    click() { listeners.get('click')?.({ type: 'click' }); },
    remove() {
      if (!this.parentNode) return;
      this.parentNode.children = this.parentNode.children.filter((item) => item !== this);
      this.parentNode = null;
    },
    querySelector(selector) {
      if (selector === '#scheduleRuntimeCard') return this.children.find((item) => item.id === 'scheduleRuntimeCard') || null;
      return null;
    }
  };
}

const rail = node('aside');
rail.className = 'utility-rail';
const schedule = node('section');
schedule.id = 'scheduleRuntimeCard';
rail.append(schedule);
const created = [];
const byId = new Map();
const documentRef = {
  querySelector(selector) {
    if (selector === '.utility-rail') return rail;
    if (selector.startsWith('#')) return byId.get(selector.slice(1)) || null;
    return null;
  },
  createElement(tag) {
    const item = node(tag);
    created.push(item);
    Object.defineProperty(item, 'id', {
      get() { return this._id || ''; },
      set(value) { this._id = value; if (value) byId.set(value, this); }
    });
    return item;
  }
};

const requests = [];
let nextHealth = { githubWriteConfigured: true };
async function fetchImpl(path, init) {
  requests.push({ path, init });
  return { ok: true, async json() { return nextHealth; } };
}

const controller = api.createController({ documentRef, fetchImpl });
assert.equal(controller.mount(), true);
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(requests.length, 1);
assert.equal(requests[0].path, '/api/health');
assert.equal(requests[0].init.method, 'GET');
assert.equal(requests[0].init.cache, 'no-store');
assert.equal(requests[0].init.credentials, 'same-origin');
assert.deepEqual(requests[0].init.headers, { Accept: 'application/json' });

const card = byId.get(api.CARD_ID);
const status = byId.get(api.STATUS_ID);
assert.ok(card);
assert.ok(status);
assert.equal(card.getAttribute('aria-busy'), 'false');
assert.equal(status.getAttribute('role'), 'status');
assert.equal(status.getAttribute('aria-live'), 'polite');
assert.equal(status.getAttribute('aria-atomic'), 'true');
assert.equal(status.dataset.state, 'ready');
assert.match(status.textContent, /ayrı açık onay/);

const badge = created.find((item) => item.className === 'github-write-readiness-badge');
assert.ok(badge);
assert.equal(badge.textContent, 'Açık onay gerekli');
assert.equal(badge.dataset.state, 'ready');

nextHealth = { githubWriteConfigured: false };
await controller.load();
assert.equal(status.dataset.state, 'off');
assert.equal(badge.textContent, 'Kapalı');

nextHealth = { githubWriteConfigured: 'yes' };
await controller.load();
assert.equal(status.dataset.state, 'error');
assert.equal(badge.textContent, 'Bilinmiyor');

assert.equal(controller.mount(), false);
assert.equal(controller.destroy(), true);
assert.equal(byId.get(api.CARD_ID).parentNode, null);
assert.equal(controller.destroy(), false);

const missingRailController = api.createController({
  documentRef: { querySelector() { return null; }, createElement() { return node(); } },
  fetchImpl
});
assert.equal(missingRailController.mount(), false);

console.log('github write readiness tests passed');
