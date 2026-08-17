import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public/desktop-device-status.js', import.meta.url), 'utf8');
const sandbox = { module: { exports: {} }, exports: {}, URL, globalThis: {} };
vm.runInNewContext(source, sandbox, { filename: 'public/desktop-device-status.js' });
const api = sandbox.module.exports;

class ElementStub {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.hidden = false;
    this.disabled = false;
    this.textContent = '';
    this.className = '';
    this.title = '';
    this.type = '';
    this.focused = false;
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  addEventListener(name, listener) { this.listeners.set(name, listener); }
  removeEventListener(name, listener) { if (this.listeners.get(name) === listener) this.listeners.delete(name); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = [...nodes]; }
  focus() { this.focused = true; }
  remove() { this.removed = true; }
}

function flatten(node) {
  return [node, ...(node.children || []).flatMap(flatten)];
}

const rail = new ElementStub('aside');
const documentListeners = new Map();
const documentRef = {
  createElement: (tag) => new ElementStub(tag),
  querySelector: (selector) => selector === '.utility-rail' ? rail : null,
  addEventListener: (name, listener) => documentListeners.set(name, listener),
  removeEventListener: (name, listener) => {
    if (documentListeners.get(name) === listener) documentListeners.delete(name);
  }
};
const bridge = {
  async getSystemInfo() {
    return { ok: true, value: { platform: 'win32', arch: 'x64', appVersion: '0.1.0', cpuCount: 12, totalMemoryMb: 32768 } };
  },
  async getCapabilities() {
    return { ok: true, value: { browserOrigins: ['https://github.com'], appIds: ['calculator'] } };
  },
  async openBrowser() { return { ok: true }; },
  async openApp() { return { ok: true }; }
};

const controller = api.createController({ documentRef, bridge, root: {} });
assert.equal(controller.mount(), true);
await new Promise((resolve) => setTimeout(resolve, 0));

assert.equal(rail.children.length, 1);
const card = rail.children[0];
const nodes = flatten(card);
assert.equal(card.id, 'desktopDeviceStatusCard');
assert.equal(card.getAttribute('aria-labelledby'), 'desktopDeviceStatusCardTitle');
assert.equal(card.getAttribute('aria-busy'), 'false');

const title = nodes.find((node) => node.id === 'desktopDeviceStatusCardTitle');
assert.ok(title);
assert.equal(title.textContent, 'Masaüstü cihaz');
const liveStatus = nodes.find((node) => node.getAttribute?.('role') === 'status');
assert.ok(liveStatus);
assert.equal(liveStatus.getAttribute('aria-live'), 'polite');
assert.match(liveStatus.textContent, /ayrıca onay ister/);

const review = nodes.find((node) => node.className === 'desktop-device-review');
assert.ok(review);
assert.equal(review.getAttribute('role'), 'group');
assert.equal(review.getAttribute('aria-label'), 'Cihaz eylemi onayı');
assert.equal(review.hidden, true);

const launcherGroup = nodes.find((node) => node.className === 'desktop-device-launchers');
assert.ok(launcherGroup);
assert.equal(launcherGroup.getAttribute('aria-label'), 'İzin verilen masaüstü açma hedefleri');
assert.equal(launcherGroup.hidden, false);
assert.equal(launcherGroup.children.length, 2);
assert.ok(launcherGroup.children.every((button) => button.type === 'button'));
assert.ok(launcherGroup.children.every((button) => button.title.includes('incele')));

assert.equal(controller.prepareAction('browser', 'https://github.com'), true);
assert.equal(review.hidden, false);
const confirm = nodes.find((node) => node.className.includes('desktop-device-confirm'));
assert.ok(confirm);
assert.equal(confirm.type, 'button');
assert.equal(confirm.disabled, false);
assert.equal(confirm.focused, true, 'review must move focus to the explicit confirmation control');
assert.match(confirm.textContent, /Onayla ve tarayıcıda aç/);

const cancel = nodes.find((node) => node.textContent === 'Vazgeç');
assert.ok(cancel);
assert.equal(cancel.type, 'button');
assert.ok(documentListeners.has('keydown'), 'Escape handler must be active while the card is mounted');

assert.equal(controller.destroy(), true);
assert.equal(documentListeners.has('keydown'), false, 'destroy must remove the document key handler');
assert.equal(card.removed, true);

console.log('desktop device review accessibility tests passed');
