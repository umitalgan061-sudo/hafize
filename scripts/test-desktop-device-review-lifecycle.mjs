import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public/desktop-device-status.js', import.meta.url), 'utf8');
const sandbox = { module: { exports: {} }, exports: {}, URL, globalThis: {} };
vm.runInNewContext(source, sandbox, { filename: 'public/desktop-device-status.js' });
const api = sandbox.module.exports;

class NodeStub {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.listeners = new Map();
    this.attributes = new Map();
    this.hidden = false;
    this.disabled = false;
    this.textContent = '';
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  addEventListener(name, fn) { this.listeners.set(name, fn); }
  removeEventListener(name, fn) { if (this.listeners.get(name) === fn) this.listeners.delete(name); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = [...nodes]; }
  remove() { this.removed = true; }
  focus() { this.focused = true; }
}

function makeDocument() {
  const rail = new NodeStub('aside');
  const listeners = new Map();
  return {
    rail,
    createElement: (tag) => new NodeStub(tag),
    querySelector: (selector) => selector === '.utility-rail' ? rail : null,
    addEventListener(name, fn) { listeners.set(name, fn); },
    removeEventListener(name, fn) { if (listeners.get(name) === fn) listeners.delete(name); },
    dispatchKey(key) {
      let prevented = false;
      listeners.get('keydown')?.({ key, preventDefault() { prevented = true; } });
      return prevented;
    },
    hasListener(name) { return listeners.has(name); }
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const documentRef = makeDocument();
let infoCalls = 0;
let capabilityCalls = 0;
let appCalls = 0;
let browserCalls = 0;
let nextBrowserResult = Promise.resolve({ ok: true });
const bridge = {
  async getSystemInfo() {
    infoCalls += 1;
    return { ok: true, value: { platform: 'darwin', arch: 'arm64', appVersion: '0.1.0', cpuCount: 10, totalMemoryMb: 16384 } };
  },
  async getCapabilities() {
    capabilityCalls += 1;
    return { ok: true, value: { browserOrigins: ['https://github.com'], appIds: ['calculator'] } };
  },
  openBrowser(value) {
    browserCalls += 1;
    assert.equal(value, 'https://github.com/');
    return nextBrowserResult;
  },
  async openApp(value) {
    appCalls += 1;
    assert.equal(value, 'calculator');
    return { ok: false, error: 'APP_OPEN_FAILED' };
  }
};

const controller = api.createController({ documentRef, bridge, root: {} });
assert.equal(controller.mount(), true);
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(infoCalls, 1);
assert.equal(capabilityCalls, 1);
assert.equal(documentRef.hasListener('keydown'), true, 'mounted card must install bounded Escape handling');

assert.equal(controller.prepareAction('browser', 'https://github.com'), true);
assert.ok(controller.getPendingAction());
assert.equal(documentRef.dispatchKey('Escape'), true, 'Escape must consume a pending review');
assert.equal(controller.getPendingAction(), null);
assert.equal(browserCalls, 0, 'Escape cancellation must never open the browser');

assert.equal(controller.prepareAction('app', 'calculator'), true);
assert.equal(await controller.confirmPendingAction(), false, 'bridge policy rejection must be reported as failure');
assert.equal(appCalls, 1);
assert.equal(controller.getPendingAction(), null);

assert.equal(controller.prepareAction('browser', 'https://github.com'), true);
const gate = deferred();
nextBrowserResult = gate.promise;
const firstConfirm = controller.confirmPendingAction();
const secondConfirm = await controller.confirmPendingAction();
assert.equal(secondConfirm, false, 'actionBusy must suppress duplicate confirmation');
assert.equal(browserCalls, 1, 'double confirmation must produce exactly one bridge call');
assert.equal(documentRef.dispatchKey('Escape'), false, 'Escape must not mutate an action already in flight');
gate.resolve({ ok: true });
assert.equal(await firstConfirm, true);
assert.equal(browserCalls, 1);

assert.equal(controller.prepareAction('browser', 'https://github.com'), true);
assert.ok(controller.getPendingAction());
assert.equal(await controller.refresh(), true);
assert.equal(controller.getPendingAction(), null, 'refresh must invalidate stale pending review');
assert.equal(browserCalls, 1);

const failingDocument = makeDocument();
const failureBridge = {
  async getSystemInfo() { throw new Error('private detail must not escape'); },
  async getCapabilities() { return { ok: true, value: { browserOrigins: ['https://github.com'] } }; },
  async openBrowser() { throw new Error('provider secret-shaped failure'); },
  async openApp() { return { ok: true }; }
};
const failureController = api.createController({ documentRef: failingDocument, bridge: failureBridge, root: {} });
assert.equal(failureController.mount(), true);
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(failureController.prepareAction('browser', 'https://github.com'), true);
assert.equal(await failureController.confirmPendingAction(), false, 'bridge exception must fail closed');
assert.equal(failureController.getPendingAction(), null);
assert.equal(failureController.destroy(), true);
assert.equal(failingDocument.hasListener('keydown'), false, 'destroy must remove key listener');
assert.equal(await failureController.confirmPendingAction(), false, 'destroyed controller must never open targets');

assert.equal(controller.destroy(), true);
assert.equal(documentRef.hasListener('keydown'), false);
assert.equal(controller.prepareAction('browser', 'https://github.com'), false);
assert.equal(await controller.confirmPendingAction(), false);
assert.equal(browserCalls, 1);
assert.equal(appCalls, 1);

console.log('desktop device review lifecycle tests passed');
