import assert from 'node:assert/strict';

export class FakeElement {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.listeners = new Map();
    this.hidden = false;
    this.disabled = false;
    this.title = '';
    this.id = '';
    this.className = '';
    this.focused = false;
    this.clickCount = 0;
  }

  append(...nodes) {
    for (const node of nodes) {
      node.parentNode = this;
      this.children.push(node);
    }
  }

  insertBefore(node, reference) {
    node.parentNode = this;
    const index = this.children.indexOf(reference);
    if (index < 0) this.children.push(node);
    else this.children.splice(index, 0, node);
  }

  insertAdjacentElement(_where, node) {
    if (!this.parentNode) return;
    const index = this.parentNode.children.indexOf(this);
    node.parentNode = this.parentNode;
    this.parentNode.children.splice(index + 1, 0, node);
  }

  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((node) => node !== this);
    this.parentNode = null;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  addEventListener(type, listener, capture = false) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push({ listener, capture: Boolean(capture) });
  }

  removeEventListener(type, listener, capture = false) {
    const entries = this.listeners.get(type) || [];
    this.listeners.set(
      type,
      entries.filter((entry) => entry.listener !== listener || entry.capture !== Boolean(capture))
    );
  }

  focus() {
    this.focused = true;
  }

  click() {
    this.clickCount += 1;
    dispatch(this, 'click', { isTrusted: false });
  }

  querySelector(selector) {
    if (selector.startsWith('#') && this.id === selector.slice(1)) return this;
    for (const child of this.children) {
      const result = child.querySelector?.(selector);
      if (result) return result;
    }
    return null;
  }
}

export function dispatch(target, type, extra = {}) {
  let prevented = false;
  let stopped = false;
  const event = {
    type,
    isTrusted: false,
    preventDefault() {
      prevented = true;
    },
    stopImmediatePropagation() {
      stopped = true;
    },
    ...extra
  };

  for (const entry of [...(target.listeners.get(type) || [])]) {
    entry.listener(event);
    if (stopped) break;
  }
  return Object.freeze({ event, prevented, stopped });
}

export function findByClass(root, className) {
  if (root.className?.split(/\s+/).includes(className)) return root;
  for (const child of root.children || []) {
    const result = findByClass(child, className);
    if (result) return result;
  }
  return null;
}

export function createConsentFixture(api, {
  now = 1_000,
  secure = true,
  hidden = false,
  collision = false,
  setTimeoutImpl,
  clearTimeoutImpl,
  failMount = false
} = {}) {
  const body = new FakeElement('body');
  const wrapper = new FakeElement('div');
  body.append(wrapper);

  const toggle = new FakeElement('button');
  toggle.id = 'handsFreeToggle';
  toggle.setAttribute('aria-pressed', 'false');
  const indicator = new FakeElement('div');
  indicator.id = 'handsFreeIndicator';
  wrapper.append(toggle, indicator);

  if (failMount) {
    indicator.insertAdjacentElement = () => {};
    wrapper.insertBefore = () => {};
  }

  if (collision) {
    const existing = new FakeElement('div');
    existing.id = api.REVIEW_ID;
    wrapper.append(existing);
  }

  const documentListeners = new Map();
  const documentRef = {
    hidden,
    body,
    createElement: (tag) => new FakeElement(tag),
    querySelector(selector) {
      return body.querySelector(selector);
    },
    getElementById(id) {
      return body.querySelector(`#${id}`);
    },
    addEventListener(type, listener) {
      if (!documentListeners.has(type)) documentListeners.set(type, []);
      documentListeners.get(type).push(listener);
    },
    removeEventListener(type, listener) {
      const entries = documentListeners.get(type) || [];
      documentListeners.set(type, entries.filter((entry) => entry !== listener));
    }
  };

  let nowValue = now;
  let nextTimer = 1;
  const timers = new Map();
  const root = {
    isSecureContext: secure,
    Date: { now: () => nowValue },
    setTimeout: setTimeoutImpl || ((callback, delay) => {
      const id = nextTimer++;
      timers.set(id, { callback, delay });
      return id;
    }),
    clearTimeout: clearTimeoutImpl || ((id) => timers.delete(id))
  };

  return Object.freeze({
    body,
    wrapper,
    toggle,
    indicator,
    documentRef,
    documentListeners,
    root,
    timers,
    setNow(value) {
      nowValue = value;
    },
    fireTimer(id) {
      const timer = timers.get(id);
      if (!timer) return false;
      timers.delete(id);
      timer.callback();
      return true;
    },
    documentEvent(type) {
      const listeners = documentListeners.get(type) || [];
      assert.ok(listeners.length, `${type} listener should exist`);
      return listeners[0];
    }
  });
}

export function reviewControls(api, fixture) {
  const panel = fixture.body.querySelector(`#${api.REVIEW_ID}`);
  assert.ok(panel, 'consent review should be mounted');
  const confirm = findByClass(panel, 'hands-free-consent-confirm');
  const cancel = findByClass(panel, 'hands-free-consent-cancel');
  assert.ok(confirm, 'confirm control should exist');
  assert.ok(cancel, 'cancel control should exist');
  return Object.freeze({ panel, confirm, cancel });
}
