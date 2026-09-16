// A small DOM stand-in for the panel suites.
//
// The frontend panels build their UI with `createElement`, wire listeners with
// `addEventListener` and react to clicks and key presses. Grepping their source
// proves none of that: it only proves how the source is spelled, which is
// exactly the kind of contract that broke when the modules were rewritten. This
// harness implements the slice of the DOM those panels actually use — element
// creation, attributes, `dataset`, `hidden`/`disabled`, a small selector engine,
// focus, and event dispatch with capture, bubbling and
// `stopImmediatePropagation()` — so a suite can mount the real module and click
// the real buttons.
//
// It is deliberately not a browser: anything a panel needs that is missing here
// should be added on purpose, not emulated by accident. (Helper module:
// run-checks only executes `test-*` and `validate-*`.)

const VOID_TEXT = '';

function camelToDataAttribute(name) {
  return `data-${String(name).replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}

function dataAttributeToCamel(name) {
  return String(name).slice(5).replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
}

class FakeEvent {
  constructor(type, options = {}) {
    this.type = String(type);
    this.bubbles = Boolean(options.bubbles);
    this.cancelable = Boolean(options.cancelable);
    this.detail = options.detail;
    this.defaultPrevented = false;
    this.target = null;
    this.currentTarget = null;
    this.eventPhase = 0;
    this._stopped = false;
    this._stoppedImmediately = false;
    Object.assign(this, options.properties || {});
  }

  preventDefault() {
    if (this.cancelable !== false) this.defaultPrevented = true;
  }

  stopPropagation() {
    this._stopped = true;
  }

  stopImmediatePropagation() {
    this._stopped = true;
    this._stoppedImmediately = true;
  }
}

class FakeKeyboardEvent extends FakeEvent {
  constructor(type, options = {}) {
    super(type, { bubbles: true, cancelable: true, ...options });
    this.key = options.key ?? '';
    this.shiftKey = Boolean(options.shiftKey);
    this.ctrlKey = Boolean(options.ctrlKey);
    this.metaKey = Boolean(options.metaKey);
    this.altKey = Boolean(options.altKey);
  }
}

class FakeMouseEvent extends FakeEvent {
  constructor(type, options = {}) {
    super(type, { bubbles: true, cancelable: true, ...options });
  }
}

class EventTargetBase {
  constructor() {
    this._listeners = new Map();
  }

  addEventListener(type, handler, options = false) {
    if (typeof handler !== 'function') return;
    const capture = typeof options === 'object' ? Boolean(options.capture) : Boolean(options);
    const once = typeof options === 'object' ? Boolean(options.once) : false;
    const key = String(type);
    if (!this._listeners.has(key)) this._listeners.set(key, []);
    this._listeners.get(key).push({ handler, capture, once });
  }

  removeEventListener(type, handler, options = false) {
    const capture = typeof options === 'object' ? Boolean(options.capture) : Boolean(options);
    const entries = this._listeners.get(String(type));
    if (!entries) return;
    const index = entries.findIndex((entry) => entry.handler === handler && entry.capture === capture);
    if (index >= 0) entries.splice(index, 1);
  }

  _runListeners(event, capture) {
    const entries = this._listeners.get(event.type);
    if (!entries || !entries.length) return;
    for (const entry of [...entries]) {
      if (entry.capture !== capture) continue;
      if (entry.once) this.removeEventListener(event.type, entry.handler, entry.capture);
      event.currentTarget = this;
      entry.handler.call(this, event);
      if (event._stoppedImmediately) return;
    }
  }

  dispatchEvent(event) {
    const path = [];
    let node = this;
    while (node) {
      path.push(node);
      node = node.parentNode ?? node.ownerDocument ?? null;
      if (path.includes(node)) break;
    }
    event.target = this;
    for (let index = path.length - 1; index > 0; index -= 1) {
      path[index]._runListeners(event, true);
      if (event._stopped) return !event.defaultPrevented;
    }
    this._runListeners(event, true);
    if (event._stopped) return !event.defaultPrevented;
    this._runListeners(event, false);
    if (event._stopped || !event.bubbles) return !event.defaultPrevented;
    for (let index = 1; index < path.length; index += 1) {
      path[index]._runListeners(event, false);
      if (event._stopped) break;
    }
    return !event.defaultPrevented;
  }
}

class FakeText {
  constructor(ownerDocument, value) {
    this.ownerDocument = ownerDocument;
    this.nodeType = 3;
    this.parentNode = null;
    this.data = String(value ?? VOID_TEXT);
  }

  get tagName() { return '#text'; }
  get childNodes() { return []; }
  get textContent() { return this.data; }
  set textContent(value) { this.data = String(value ?? VOID_TEXT); }
}

class FakeElement extends EventTargetBase {
  constructor(ownerDocument, tagName) {
    super();
    this.ownerDocument = ownerDocument;
    this.nodeType = 1;
    this.tagName = String(tagName).toUpperCase();
    this.parentNode = null;
    this.childNodes = [];
    this.attributes = new Map();
    this.value = '';
    this.type = '';
    this.files = null;
    this.maxLength = -1;
    this.selectionStart = null;
    this.disabled = false;
    const element = this;
    this.dataset = new Proxy({}, {
      get(_target, key) {
        const value = element.attributes.get(camelToDataAttribute(key));
        return value === undefined ? undefined : value;
      },
      set(_target, key, value) {
        element.attributes.set(camelToDataAttribute(key), String(value));
        return true;
      },
      deleteProperty(_target, key) {
        element.attributes.delete(camelToDataAttribute(key));
        return true;
      },
      has(_target, key) {
        return element.attributes.has(camelToDataAttribute(key));
      },
      ownKeys() {
        return [...element.attributes.keys()].filter((name) => name.startsWith('data-')).map(dataAttributeToCamel);
      },
      getOwnPropertyDescriptor() {
        return { enumerable: true, configurable: true };
      }
    });
  }

  get hidden() { return this.attributes.get('hidden') === 'true'; }
  set hidden(value) { this.attributes.set('hidden', value ? 'true' : 'false'); }

  get className() { return this.attributes.get('class') ?? VOID_TEXT; }
  set className(value) { this.attributes.set('class', String(value ?? VOID_TEXT)); }

  get id() { return this.attributes.get('id') ?? VOID_TEXT; }
  set id(value) { this.attributes.set('id', String(value ?? VOID_TEXT)); }

  get classList() {
    const element = this;
    return {
      contains: (name) => element.className.split(/\s+/).includes(String(name)),
      add: (name) => {
        const classes = new Set(element.className.split(/\s+/).filter(Boolean));
        classes.add(String(name));
        element.className = [...classes].join(' ');
      },
      remove: (name) => {
        const classes = new Set(element.className.split(/\s+/).filter(Boolean));
        classes.delete(String(name));
        element.className = [...classes].join(' ');
      }
    };
  }

  setAttribute(name, value) { this.attributes.set(String(name), String(value)); }
  getAttribute(name) { return this.attributes.has(String(name)) ? this.attributes.get(String(name)) : null; }
  hasAttribute(name) { return this.attributes.has(String(name)); }
  removeAttribute(name) { this.attributes.delete(String(name)); }

  get children() { return this.childNodes.filter((node) => node.nodeType === 1); }

  get textContent() {
    return this.childNodes.map((node) => node.textContent).join(VOID_TEXT);
  }

  set textContent(value) {
    this.childNodes = [];
    if (value === null || value === undefined || value === VOID_TEXT) return;
    this.appendChild(new FakeText(this.ownerDocument, value));
  }

  appendChild(node) {
    if (!node) return node;
    node.parentNode?.removeChild?.(node);
    node.parentNode = this;
    this.childNodes.push(node);
    return node;
  }

  append(...nodes) {
    for (const node of nodes) {
      this.appendChild(typeof node === 'string' ? new FakeText(this.ownerDocument, node) : node);
    }
  }

  removeChild(node) {
    const index = this.childNodes.indexOf(node);
    if (index >= 0) {
      this.childNodes.splice(index, 1);
      node.parentNode = null;
    }
    return node;
  }

  replaceChildren(...nodes) {
    for (const node of [...this.childNodes]) node.parentNode = null;
    this.childNodes = [];
    this.append(...nodes);
  }

  remove() {
    this.parentNode?.removeChild?.(this);
  }

  get nextElementSibling() {
    const siblings = this.parentNode?.children ?? [];
    return siblings[siblings.indexOf(this) + 1] ?? null;
  }

  focus() {
    if (this.ownerDocument) this.ownerDocument.activeElement = this;
  }

  closest(selector) {
    let node = this;
    while (node && node.nodeType === 1) {
      if (matchesSelector(node, selector)) return node;
      node = node.parentNode;
    }
    return null;
  }

  querySelector(selector) { return querySelectorAll(this, selector)[0] ?? null; }
  querySelectorAll(selector) { return querySelectorAll(this, selector); }
}

/** `tag`, `#id`, `.class`, `[attr="value"]` and any combination of those. */
function matchesSimpleSelector(element, selector) {
  if (element.nodeType !== 1) return false;
  const pattern = /^([a-zA-Z][\w-]*)?((?:[#.][\w-]+|\[[^\]]+\])*)$/.exec(selector.trim());
  if (!pattern) throw new Error(`dom-harness: unsupported selector "${selector}"`);
  const [, tag, rest = ''] = pattern;
  if (tag && element.tagName !== tag.toUpperCase()) return false;
  for (const part of rest.match(/[#.][\w-]+|\[[^\]]+\]/g) ?? []) {
    if (part.startsWith('#')) {
      if (element.id !== part.slice(1)) return false;
    } else if (part.startsWith('.')) {
      if (!element.className.split(/\s+/).includes(part.slice(1))) return false;
    } else {
      const attribute = /^\[([\w-]+)(?:=["']?([^"'\]]*)["']?)?\]$/.exec(part);
      if (!attribute) throw new Error(`dom-harness: unsupported attribute selector "${part}"`);
      const [, name, value] = attribute;
      if (!element.attributes.has(name)) return false;
      if (value !== undefined && element.attributes.get(name) !== value) return false;
    }
  }
  return true;
}

function matchesSelector(element, selector) {
  return selector.split(',').some((candidate) => {
    const parts = candidate.trim().split(/\s+/);
    const last = parts[parts.length - 1];
    if (!matchesSimpleSelector(element, last)) return false;
    let node = element.parentNode;
    for (let index = parts.length - 2; index >= 0; index -= 1) {
      let found = false;
      while (node && node.nodeType === 1) {
        if (matchesSimpleSelector(node, parts[index])) { found = true; node = node.parentNode; break; }
        node = node.parentNode;
      }
      if (!found) return false;
    }
    return true;
  });
}

function descendants(root, output = []) {
  for (const child of root.childNodes ?? []) {
    if (child.nodeType !== 1) continue;
    output.push(child);
    descendants(child, output);
  }
  return output;
}

function querySelectorAll(root, selector) {
  return descendants(root).filter((element) => matchesSelector(element, selector));
}

class FakeDocument extends EventTargetBase {
  constructor() {
    super();
    this.nodeType = 9;
    this.readyState = 'complete';
    this.activeElement = null;
    this.documentElement = new FakeElement(this, 'html');
    this.documentElement.ownerDocument = this;
    this.body = new FakeElement(this, 'body');
    this.documentElement.appendChild(this.body);
    this.parentNode = null;
  }

  createElement(tagName) { return new FakeElement(this, tagName); }
  createTextNode(value) { return new FakeText(this, value); }

  getElementById(id) {
    return descendants(this.documentElement).find((element) => element.id === String(id)) ?? null;
  }

  querySelector(selector) { return querySelectorAll(this.documentElement, selector)[0] ?? null; }
  querySelectorAll(selector) { return querySelectorAll(this.documentElement, selector); }
}

export function createDocument() {
  return new FakeDocument();
}

/** A window-like root with the globals the panels read. */
export function createWindow(documentRef = createDocument(), extras = {}) {
  const listeners = new EventTargetBase();
  const root = {
    document: documentRef,
    Event: FakeEvent,
    CustomEvent: FakeEvent,
    KeyboardEvent: FakeKeyboardEvent,
    MouseEvent: FakeMouseEvent,
    StorageEvent: class StorageEvent extends FakeEvent {
      constructor(type, options = {}) {
        super(type, options);
        this.key = options.key ?? null;
        this.newValue = options.newValue ?? null;
        this.storageArea = options.storageArea ?? null;
      }
    },
    setTimeout: (callback) => { callback(); return 0; },
    clearTimeout: () => {},
    requestAnimationFrame: (callback) => { callback(); return 0; },
    cancelAnimationFrame: () => {},
    addEventListener: (...args) => listeners.addEventListener(...args),
    removeEventListener: (...args) => listeners.removeEventListener(...args),
    dispatchEvent: (event) => listeners.dispatchEvent(event),
    ...extras
  };
  documentRef.defaultView = root;
  return root;
}

/**
 * Installs the constructors a browser module reaches for as globals, so checks
 * like `event.target instanceof Element` work against harness nodes. Each suite
 * runs in its own process, so this only affects the calling suite.
 */
export function installDomGlobals() {
  globalThis.Element = FakeElement;
  globalThis.HTMLElement = FakeElement;
  globalThis.HTMLInputElement = FakeElement;
  globalThis.HTMLButtonElement = FakeElement;
  globalThis.HTMLTextAreaElement = FakeElement;
  globalThis.HTMLSelectElement = FakeElement;
  globalThis.Event = FakeEvent;
  globalThis.CustomEvent = FakeEvent;
  globalThis.KeyboardEvent = FakeKeyboardEvent;
  globalThis.MouseEvent = FakeMouseEvent;
}

export function click(element, options = {}) {
  return element.dispatchEvent(new FakeMouseEvent('click', options));
}

export function keydown(element, key, options = {}) {
  return element.dispatchEvent(new FakeKeyboardEvent('keydown', { key, ...options }));
}

export function change(element, options = {}) {
  return element.dispatchEvent(new FakeEvent('change', { bubbles: true, cancelable: true, ...options }));
}

export function text(node) {
  return node ? node.textContent : null;
}

export { FakeElement, FakeEvent, FakeKeyboardEvent, FakeMouseEvent, FakeText };
