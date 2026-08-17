import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public/ui-shell.js', import.meta.url), 'utf8');
const sandbox = { module: { exports: {} }, exports: {}, globalThis: {}, URL, Intl, Date };
vm.runInNewContext(source, sandbox, { filename: 'public/ui-shell.js' });
const api = sandbox.module.exports;

function createDocument() {
  const byId = new Map();
  const head = {
    children: [],
    append(node) {
      this.children.push(node);
      if (node.id) byId.set(node.id, node);
    }
  };
  return {
    head,
    createElement(tag) { return { tagName: tag.toUpperCase(), id: '', rel: '', href: '', src: '', async: true }; },
    getElementById(id) { return byId.get(id) || null; },
    querySelector(selector) { return selector === 'head' ? head : null; }
  };
}

const bridge = {
  getSystemInfo() {},
  getCapabilities() {},
  openBrowser() {},
  openApp() {}
};

assert.equal(api.hasDesktopDeviceBridge({}), false);
assert.equal(api.hasDesktopDeviceBridge({ hafizeDevice: {} }), false);
assert.equal(api.hasDesktopDeviceBridge({ hafizeDevice: bridge }), true);

const browserDocument = createDocument();
assert.equal(api.installDesktopDeviceAssets(browserDocument, {}), false, 'normal browser/PWA must not install desktop UI assets');
assert.equal(browserDocument.head.children.length, 0);

const incompleteDocument = createDocument();
assert.equal(api.installDesktopDeviceAssets(incompleteDocument, { hafizeDevice: { getSystemInfo() {} } }), false);
assert.equal(incompleteDocument.head.children.length, 0);

const desktopDocument = createDocument();
assert.equal(api.installDesktopDeviceAssets(desktopDocument, { hafizeDevice: bridge }), true);
assert.equal(desktopDocument.head.children.length, 2);
const [style, script] = desktopDocument.head.children;
assert.equal(style.tagName, 'LINK');
assert.equal(style.id, 'hafizeDesktopDeviceStyle');
assert.equal(style.rel, 'stylesheet');
assert.equal(style.href, '/desktop-device-status.css');
assert.equal(script.tagName, 'SCRIPT');
assert.equal(script.id, 'hafizeDesktopDeviceScript');
assert.equal(script.src, '/desktop-device-status.js');
assert.equal(script.async, false);

assert.equal(api.installDesktopDeviceAssets(desktopDocument, { hafizeDevice: bridge }), true, 'repeat install remains successful');
assert.equal(desktopDocument.head.children.length, 2, 'repeat install must not duplicate assets');

const frozenPaths = [api.DESKTOP_DEVICE_SCRIPT, api.DESKTOP_DEVICE_STYLE];
assert.deepEqual([...frozenPaths], ['/desktop-device-status.js', '/desktop-device-status.css']);
assert.ok(frozenPaths.every((value) => value.startsWith('/') && !value.startsWith('//')));
assert.ok(frozenPaths.every((value) => !value.includes('?') && !value.includes('#') && !value.includes('://')));

console.log('desktop device shell loader tests passed');
