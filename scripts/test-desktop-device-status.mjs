import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public/desktop-device-status.js', import.meta.url), 'utf8');

function element(tagName) {
  return {
    tagName: tagName.toUpperCase(),
    children: [],
    attributes: new Map(),
    listeners: new Map(),
    textContent: '',
    className: '',
    id: '',
    disabled: false,
    type: '',
    parent: null,
    append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } },
    appendChild(node) { this.append(node); return node; },
    replaceChildren(...nodes) { this.children = []; this.append(...nodes); },
    setAttribute(name, value) { this.attributes.set(name, String(value)); },
    getAttribute(name) { return this.attributes.get(name) ?? null; },
    addEventListener(name, fn) { this.listeners.set(name, fn); },
    removeEventListener(name, fn) { if (this.listeners.get(name) === fn) this.listeners.delete(name); },
    remove() { if (!this.parent) return; this.parent.children = this.parent.children.filter((node) => node !== this); this.parent = null; }
  };
}

const head = element('head');
const rail = element('aside');
const byId = new Map();
const documentRef = {
  head,
  createElement(tag) {
    const node = element(tag);
    Object.defineProperty(node, 'id', {
      get() { return this._id || ''; },
      set(value) { this._id = value; if (value) byId.set(value, this); }
    });
    return node;
  },
  getElementById(id) { return byId.get(id) || null; },
  querySelector(selector) { return selector === '.utility-rail' ? rail : null; }
};

const context = { module: { exports: {} }, exports: {}, console, URL, globalThis: {} };
vm.createContext(context);
vm.runInContext(source, context, { filename: 'desktop-device-status.js' });
const api = context.module.exports;

assert.deepEqual(
  JSON.parse(JSON.stringify(api.normalizeSystemInfo({ platform: 'darwin', arch: 'arm64', appVersion: '0.1.0', cpuCount: 12, totalMemoryMb: 32768 }))),
  { platform: 'darwin', arch: 'arm64', appVersion: '0.1.0', cpuCount: 12, totalMemoryMb: 32768 }
);
assert.equal(api.normalizeSystemInfo(null), null);
assert.equal(api.formatMemory(32768), '32 GB');
assert.equal(api.formatMemory(1536), '1.5 GB');
assert.equal(api.formatMemory(0), '—');

let calls = 0;
const bridge = {
  async getSystemInfo() {
    calls += 1;
    return { ok: true, value: { platform: 'linux', arch: 'x64', appVersion: '0.1.0', cpuCount: 8, totalMemoryMb: 16384 } };
  }
};
const controller = api.createController({ documentRef, bridge });
assert.equal(controller.hasBridge(), true);
assert.equal(controller.mount(), true);
await new Promise((resolve) => setImmediate(resolve));
assert.equal(calls, 1);
assert.equal(rail.children.length, 1);
const card = rail.children[0];
assert.equal(card.id, api.CARD_ID);
assert.equal(card.getAttribute('aria-busy'), 'false');
assert.match(card.children[1].textContent, /salt-okunur/);
assert.equal(card.children[2].children.length, 5);
assert.equal(card.children[2].children[0].children[1].textContent, 'linux');
assert.equal(card.children[2].children[4].children[1].textContent, '16 GB');

const refresh = card.children[3].children[0];
await refresh.listeners.get('click')();
assert.equal(calls, 2);

assert.equal(controller.destroy(), true);
assert.equal(rail.children.length, 0);
assert.equal(controller.destroy(), false);

const noBridge = api.createController({ documentRef, bridge: null });
assert.equal(noBridge.hasBridge(), false);
assert.equal(noBridge.mount(), false);

const failingBridge = { async getSystemInfo() { return { ok: false, error: 'DEVICE_ACTION_FAILED' }; } };
const failing = api.createController({ documentRef, bridge: failingBridge });
assert.equal(failing.mount(), true);
await new Promise((resolve) => setImmediate(resolve));
const failedCard = rail.children[0];
assert.match(failedCard.children[1].textContent, /alınamadı/);
failing.destroy();

console.log('desktop device status tests passed');
