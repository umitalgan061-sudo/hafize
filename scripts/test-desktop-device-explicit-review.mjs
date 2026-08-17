import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

async function loadUmd(path) {
  const source = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const sandbox = { module: { exports: {} }, exports: {}, URL, globalThis: {} };
  vm.runInNewContext(source, sandbox, { filename: path });
  return sandbox.module.exports;
}

const api = await loadUmd('public/desktop-device-status.js');

assert.equal(api.normalizeBrowserOrigin('https://github.com/'), 'https://github.com');
assert.equal(api.normalizeBrowserOrigin('https://github.com'), 'https://github.com');
assert.equal(api.normalizeBrowserOrigin('http://github.com/'), '');
assert.equal(api.normalizeBrowserOrigin('https://user:pass@github.com/'), '');
assert.equal(api.normalizeBrowserOrigin('https://github.com/path'), '');
assert.equal(api.normalizeBrowserOrigin('https://github.com/?q=x'), '');
assert.equal(api.normalizeBrowserOrigin('https://github.com/#x'), '');
assert.equal(api.normalizeBrowserOrigin('not-a-url'), '');

const capabilities = api.normalizeCapabilities({
  browserOrigins: [
    'https://github.com/',
    'https://github.com',
    'http://unsafe.example/',
    'https://mail.google.com/'
  ],
  appIds: ['calculator', 'calculator', 'bad app', '../shell', 'notes.app']
});
assert.deepEqual([...capabilities.browserOrigins], ['https://github.com', 'https://mail.google.com']);
assert.deepEqual([...capabilities.appIds], ['calculator', 'notes.app']);

const browserAction = api.normalizePendingAction('browser', 'https://github.com/');
assert.equal(browserAction.kind, 'browser');
assert.equal(browserAction.value, 'https://github.com/');
assert.equal(browserAction.label, 'github.com');
const appAction = api.normalizePendingAction('app', 'calculator');
assert.equal(appAction.kind, 'app');
assert.equal(appAction.value, 'calculator');
assert.equal(api.normalizePendingAction('browser', 'javascript:alert(1)'), null);
assert.equal(api.normalizePendingAction('app', '../calculator'), null);
assert.equal(api.normalizePendingAction('shell', 'calculator'), null);

assert.deepEqual(
  { ...api.normalizeSystemInfo({ platform: 'linux', arch: 'x64', appVersion: '1.2.3', cpuCount: 8, totalMemoryMb: 16384 }) },
  { platform: 'linux', arch: 'x64', appVersion: '1.2.3', cpuCount: 8, totalMemoryMb: 16384 }
);
assert.equal(api.normalizeSystemInfo({}), null);
assert.equal(api.formatMemory(512), '512 MB');
assert.equal(api.formatMemory(2048), '2.0 GB');

class FakeNode {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.hidden = false;
    this.disabled = false;
    this.textContent = '';
    this.className = '';
    this.id = '';
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  addEventListener(name, fn) { this.listeners.set(name, fn); }
  removeEventListener(name, fn) { if (this.listeners.get(name) === fn) this.listeners.delete(name); }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = [...items]; }
  remove() { this.removed = true; }
  focus() { this.focused = true; }
}

const rail = new FakeNode('aside');
const documentRef = {
  createElement: (tag) => new FakeNode(tag),
  querySelector: (selector) => selector === '.utility-rail' ? rail : null
};
let browserOpens = 0;
let appOpens = 0;
const bridge = {
  async getSystemInfo() {
    return { ok: true, value: { platform: 'linux', arch: 'x64', appVersion: '0.1.0', cpuCount: 8, totalMemoryMb: 8192 } };
  },
  async getCapabilities() {
    return { ok: true, value: { browserOrigins: ['https://github.com'], appIds: ['calculator'] } };
  },
  async openBrowser(value) {
    browserOpens += 1;
    assert.equal(value, 'https://github.com/');
    return { ok: true };
  },
  async openApp(value) {
    appOpens += 1;
    assert.equal(value, 'calculator');
    return { ok: true };
  }
};

const controller = api.createController({ documentRef, bridge, root: {} });
assert.equal(controller.mount(), true);
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(browserOpens, 0, 'mount/refresh must never open an external target');
assert.equal(appOpens, 0, 'mount/refresh must never open an application');

assert.equal(controller.prepareAction('browser', 'https://github.com'), true);
assert.equal(browserOpens, 0, 'review must not open the browser');
assert.deepEqual({ ...controller.getPendingAction() }, { kind: 'browser', value: 'https://github.com/', label: 'github.com' });
assert.equal(await controller.confirmPendingAction(), true);
assert.equal(browserOpens, 1, 'confirmation must produce exactly one browser open');
assert.equal(appOpens, 0);
assert.equal(controller.getPendingAction(), null);

assert.equal(controller.prepareAction('app', 'calculator'), true);
assert.equal(appOpens, 0, 'review must not open the application');
assert.equal(await controller.confirmPendingAction(), true);
assert.equal(appOpens, 1, 'confirmation must produce exactly one app open');

assert.equal(controller.prepareAction('browser', 'http://unsafe.example'), false);
assert.equal(controller.prepareAction('app', '../shell'), false);
assert.equal(browserOpens, 1);
assert.equal(appOpens, 1);
assert.equal(controller.destroy(), true);

console.log('desktop device explicit review tests passed');
