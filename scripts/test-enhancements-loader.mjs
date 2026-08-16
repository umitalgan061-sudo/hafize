import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const loader = require('../public/enhancements-loader.js');

assert.ok(loader.ENHANCEMENTS.length >= 20);
assert.equal(new Set(loader.ENHANCEMENTS).size, loader.ENHANCEMENTS.length, 'allowlist entries must be unique');
assert.equal(loader.isAllowedEnhancement('/message-copy.js'), true);
assert.equal(loader.isAllowedEnhancement('/response-fold.js'), true);
assert.equal(loader.isAllowedEnhancement('/voice-output.js'), false, 'core voice runtime must not be loaded twice');
assert.equal(loader.isAllowedEnhancement('https://evil.example/x.js'), false);
assert.equal(loader.isAllowedEnhancement('/api/chat'), false);
assert.equal(loader.resolveAllowedUrl('/message-copy.js', { location: { origin: 'https://hafize.example' } }), 'https://hafize.example/message-copy.js');
assert.equal(loader.resolveAllowedUrl('/message-copy.js?x=1', { location: { origin: 'https://hafize.example' } }), '');
assert.equal(loader.resolveAllowedUrl('//evil.example/message-copy.js', { location: { origin: 'https://hafize.example' } }), '');
assert.equal(loader.resolveAllowedUrl('/message-copy.js', {}), '/message-copy.js');

class FakeScript {
  constructor() {
    this.dataset = {};
    this.listeners = new Map();
    this.removed = false;
    this.src = '';
    this.defer = false;
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  fire(type) {
    this.listeners.get(type)?.();
  }

  remove() {
    this.removed = true;
  }
}

class FakeDocument {
  constructor() {
    this.scripts = [];
    this.head = {
      append: (script) => {
        this.scripts.push(script);
        queueMicrotask(() => script.fire('load'));
      }
    };
  }

  createElement(tag) {
    assert.equal(tag, 'script');
    return new FakeScript();
  }

  querySelector(selector) {
    const match = selector.match(/="([^"]+)"\]$/);
    const path = match?.[1];
    return path ? this.scripts.find((script) => script.dataset.hafizeEnhancementLoader === path) || null : null;
  }
}

const documentRef = new FakeDocument();
const root = { location: { origin: 'https://hafize.example' } };
const controller = loader.createController(documentRef, root, {
  enhancements: ['/message-copy.js', '/keyboard-shortcuts.js', '/response-fold.js']
});
assert.deepEqual(controller.snapshot(), {
  state: loader.LOAD_STATE.IDLE,
  loaded: [],
  failedPath: '',
  total: 3
});

const first = await controller.load();
assert.equal(first.state, loader.LOAD_STATE.READY);
assert.deepEqual(first.loaded, ['/message-copy.js', '/keyboard-shortcuts.js', '/response-fold.js']);
assert.equal(documentRef.scripts.length, 3);
assert.ok(documentRef.scripts.every((script) => script.defer === true));
assert.deepEqual(documentRef.scripts.map((script) => script.src), [
  'https://hafize.example/message-copy.js',
  'https://hafize.example/keyboard-shortcuts.js',
  'https://hafize.example/response-fold.js'
]);

const second = await controller.load();
assert.equal(second.state, loader.LOAD_STATE.READY);
assert.equal(documentRef.scripts.length, 3, 'repeated load must be idempotent');

await loader.appendScript(documentRef, root, '/message-copy.js');
assert.equal(documentRef.scripts.length, 3, 'existing allowlisted scripts must not be duplicated');

await assert.rejects(
  loader.appendScript(documentRef, root, 'https://evil.example/x.js'),
  /INVALID_ENHANCEMENT_LOADER_INPUT/
);
assert.throws(
  () => loader.createController(documentRef, root, { enhancements: ['/message-copy.js', '/api/chat'] }),
  /INVALID_ENHANCEMENT_ALLOWLIST/
);

console.log(`enhancement loader policy passed: ${first.loaded.length} allowlisted modules loaded sequentially`);
