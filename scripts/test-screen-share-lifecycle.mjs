import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { mountScreenShare } = require('../public/screen-share.js');

class FakeElement {
  constructor() {
    this.disabled = false;
    this.hidden = false;
    this.textContent = '';
    this.listeners = new Map();
    this.attributes = new Map();
  }
  addEventListener(type, handler) {
    const list = this.listeners.get(type) || [];
    list.push(handler);
    this.listeners.set(type, list);
  }
  removeEventListener(type, handler) {
    const list = this.listeners.get(type) || [];
    this.listeners.set(type, list.filter((entry) => entry !== handler));
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  async emit(type) {
    for (const handler of [...(this.listeners.get(type) || [])]) await handler({ type, target: this });
  }
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function createCaptureStream() {
  let stopped = 0;
  const stream = {
    getVideoTracks: () => [{ kind: 'video' }],
    getTracks: () => [{ stop: () => { stopped += 1; } }]
  };
  return { stream, getStopped: () => stopped };
}

function createHarness({ getDisplayMedia } = {}) {
  const button = new FakeElement();
  const panel = new FakeElement();
  const image = new FakeElement();
  const status = new FakeElement();
  const removeButton = new FakeElement();
  const elements = new Map([
    ['#screenShareBtn', button],
    ['#screenSharePreview', panel],
    ['#screenShareImage', image],
    ['#screenShareStatus', status],
    ['#screenShareRemove', removeButton]
  ]);
  const rootListeners = new Map();
  const events = [];
  const revoked = [];
  let nextUrl = 0;

  const document = {
    querySelector: (selector) => elements.get(selector) || null,
    createElement(tag) {
      if (tag === 'video') {
        return {
          muted: false,
          playsInline: false,
          srcObject: null,
          videoWidth: 800,
          videoHeight: 600,
          play: async () => undefined,
          addEventListener() {},
          removeEventListener() {}
        };
      }
      if (tag === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => ({ drawImage() {} }),
          toBlob: (callback) => callback(new Blob(['jpeg'], { type: 'image/jpeg' }))
        };
      }
      throw new Error(`unexpected tag ${tag}`);
    }
  };

  class FakeCustomEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
    }
  }

  const root = {
    document,
    navigator: { mediaDevices: { getDisplayMedia } },
    URL: {
      createObjectURL() { nextUrl += 1; return `blob:screen-${nextUrl}`; },
      revokeObjectURL(value) { revoked.push(value); }
    },
    CustomEvent: FakeCustomEvent,
    dispatchEvent(event) { events.push(event); },
    addEventListener(type, handler) {
      const list = rootListeners.get(type) || [];
      list.push(handler);
      rootListeners.set(type, list);
    },
    removeEventListener(type, handler) {
      const list = rootListeners.get(type) || [];
      rootListeners.set(type, list.filter((entry) => entry !== handler));
    }
  };

  return { root, button, panel, image, status, removeButton, events, revoked, rootListeners };
}

{
  const captureStream = createCaptureStream();
  const h = createHarness({ getDisplayMedia: async () => captureStream.stream });
  h.button.disabled = false;
  h.button.setAttribute('aria-pressed', 'mixed');
  h.panel.hidden = false;
  h.image.setAttribute('src', 'host:image');
  h.status.textContent = 'Host screen state';

  const mounted = mountScreenShare({ root: h.root });
  assert.ok(mounted);
  const capture = await mounted.requestCapture();
  assert.ok(capture);
  assert.equal(captureStream.getStopped(), 1);
  assert.equal(mounted.getCapture(), capture);
  assert.equal(h.button.getAttribute('aria-pressed'), 'true');
  assert.equal(h.panel.hidden, false);
  assert.equal(h.image.getAttribute('src'), 'blob:screen-1');
  assert.match(h.status.textContent, /Hafize'ye gönderilmedi/);
  assert.equal(h.events.at(-1).type, 'hafize:screen-capture-ready');

  assert.equal(mounted.clearCapture(), true);
  assert.equal(mounted.getCapture(), null);
  assert.equal(h.revoked.at(-1), 'blob:screen-1');
  assert.equal(h.panel.hidden, true);
  assert.equal(h.button.getAttribute('aria-pressed'), 'false');
  assert.equal(h.events.at(-1).type, 'hafize:screen-capture-cleared');

  await mounted.requestCapture();
  mounted.destroy();
  assert.equal(h.revoked.at(-1), 'blob:screen-2');
  assert.equal(h.button.disabled, false);
  assert.equal(h.button.getAttribute('aria-pressed'), 'mixed');
  assert.equal(h.panel.hidden, false);
  assert.equal(h.image.getAttribute('src'), 'host:image');
  assert.equal(h.status.textContent, 'Host screen state');
  assert.equal((h.button.listeners.get('click') || []).length, 0);
  assert.equal((h.removeButton.listeners.get('click') || []).length, 0);
  assert.equal((h.rootListeners.get('pagehide') || []).length, 0);
  assert.equal(mounted.clearCapture(), false);
  assert.equal(mounted.getCapture(), null);
  assert.equal(await mounted.requestCapture(), null);
  mounted.destroy();
}

{
  const gate = deferred();
  const captureStream = createCaptureStream();
  const h = createHarness({ getDisplayMedia: () => gate.promise });
  h.panel.hidden = true;
  h.status.textContent = 'idle';
  h.button.setAttribute('aria-pressed', 'false');

  const mounted = mountScreenShare({ root: h.root });
  const pending = mounted.requestCapture();
  assert.equal(h.button.disabled, true);
  mounted.destroy();
  gate.resolve(captureStream.stream);
  assert.equal(await pending, null);
  assert.equal(captureStream.getStopped(), 1);
  assert.equal(h.events.length, 0, 'destroyed pending capture must not dispatch ready/cleared');
  assert.equal(h.status.textContent, 'idle');
  assert.equal(h.button.disabled, false);
  assert.equal(h.panel.hidden, true);
}

{
  const first = deferred();
  const firstStream = createCaptureStream();
  const secondStream = createCaptureStream();
  let call = 0;
  const h = createHarness({
    getDisplayMedia() {
      call += 1;
      return call === 1 ? first.promise : Promise.resolve(secondStream.stream);
    }
  });
  h.panel.hidden = true;
  h.button.setAttribute('aria-pressed', 'false');

  const mounted = mountScreenShare({ root: h.root });
  const pending = mounted.requestCapture();
  assert.equal(await mounted.requestCapture(), null, 'concurrent capture must be ignored');
  assert.equal(call, 1);
  mounted.clearCapture();
  first.resolve(firstStream.stream);
  assert.equal(await pending, null, 'capture invalidated by clear must not repopulate UI');
  assert.equal(firstStream.getStopped(), 1);
  assert.equal(mounted.getCapture(), null);
  assert.equal(h.panel.hidden, true);
  mounted.destroy();
}

console.log('screen share lifecycle tests passed');
