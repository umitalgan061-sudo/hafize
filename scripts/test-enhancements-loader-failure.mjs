import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const loader = require('../public/enhancements-loader.js');

class FakeScript {
  constructor() {
    this.dataset = {};
    this.listeners = new Map();
    this.removed = false;
  }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  fire(type) { this.listeners.get(type)?.(); }
  remove() { this.removed = true; }
}

class FailureDocument {
  constructor(failPath) {
    this.failPath = failPath;
    this.scripts = [];
    this.head = {
      append: (script) => {
        this.scripts.push(script);
        queueMicrotask(() => {
          const path = script.dataset.hafizeEnhancementLoader;
          script.fire(path === this.failPath ? 'error' : 'load');
        });
      }
    };
  }
  createElement() { return new FakeScript(); }
  querySelector(selector) {
    const match = selector.match(/="([^"]+)"\]$/);
    const path = match?.[1];
    return path ? this.scripts.find((script) => !script.removed && script.dataset.hafizeEnhancementLoader === path) || null : null;
  }
}

const documentRef = new FailureDocument('/keyboard-shortcuts.js');
const controller = loader.createController(documentRef, { location: { origin: 'https://hafize.example' } }, {
  enhancements: ['/message-copy.js', '/keyboard-shortcuts.js', '/response-fold.js']
});

await assert.rejects(controller.load(), /ENHANCEMENT_LOAD_FAILED:\/keyboard-shortcuts\.js/);
const failed = controller.snapshot();
assert.equal(failed.state, loader.LOAD_STATE.FAILED);
assert.deepEqual(failed.loaded, ['/message-copy.js']);
assert.equal(failed.failedPath, '/keyboard-shortcuts.js');
assert.equal(documentRef.scripts.length, 2, 'loader must stop at first failed dependency');
assert.equal(documentRef.scripts[1].removed, true, 'failed script element must be removed before retry');

await assert.rejects(controller.load(), /ENHANCEMENT_LOAD_FAILED:\/keyboard-shortcuts\.js/);
assert.equal(documentRef.scripts.length, 3, 'retry may retry only after the previous failed element is removed');
assert.equal(documentRef.scripts.filter((script) => script.dataset.hafizeEnhancementLoader === '/response-fold.js').length, 0);

assert.equal(loader.loadEnhancements(null, globalThis), null, 'invalid browser document must fail closed');
console.log('enhancement loader failure boundary passed');
