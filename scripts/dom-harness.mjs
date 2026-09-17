// A small DOM stand-in for suites that mount a `public/*.js` panel in Node.
//
// `markdown-dom-harness.mjs` covers the node-building surface the renderer uses;
// a panel needs more than that: ids, classes, datasets, `hidden`/`disabled`,
// event listeners with capture and bubbling, `closest`, `focus` and a handful of
// CSS selectors. Implementing exactly that much lets a suite drive the real
// mount path — the dialog, the focus trap, the disabled confirm button — instead
// of grepping the source for the strings that would have built them.
//
// It is deliberately not a browser: layout, CSS and the parser are absent, and
// `querySelector` understands only the selector shapes the panels actually use.
// (Helper module: run-checks only executes `test-*` and `validate-*`.)

const VOID_TEXT = (value) => (value === null || value === undefined ? '' : String(value));

/** Parses `tag#id.class[attr="value"]` into the parts `matches()` compares. */
function parseCompound(source) {
  const compound = { tag: '', id: '', classes: [], attributes: [] };
  const pattern = /(^[a-zA-Z][\w-]*)|#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:([~^$*|]?=)"([^"]*)")?\]/g;
  let match;
  let consumed = 0;
  while ((match = pattern.exec(source)) !== null) {
    consumed = pattern.lastIndex;
    if (match[1]) compound.tag = match[1].toUpperCase();
    else if (match[2]) compound.id = match[2];
    else if (match[3]) compound.classes.push(match[3]);
    else if (match[4]) compound.attributes.push({ name: match[4], value: match[6] });
  }
  if (consumed !== source.length) throw new Error(`dom-harness: unsupported selector "${source}"`);
  return compound;
}

function parseSelector(selector) {
  return String(selector)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.split(/\s+/).map(parseCompound));
}

class ClassList {
  constructor(element) {
    this.element = element;
  }

  get tokens() {
    return this.element.className.split(/\s+/).filter(Boolean);
  }

  contains(value) {
    return this.tokens.includes(String(value));
  }

  add(...values) {
    const next = new Set(this.tokens);
    for (const value of values) next.add(String(value));
    this.element.className = [...next].join(' ');
  }

  remove(...values) {
    const drop = new Set(values.map(String));
    this.element.className = this.tokens.filter((token) => !drop.has(token)).join(' ');
  }

  toggle(value, force) {
    const on = force === undefined ? !this.contains(value) : Boolean(force);
    if (on) this.add(value);
    else this.remove(value);
    return on;
  }
}

class FakeEvent {
  constructor(type, options = {}) {
    this.type = String(type);
    this.bubbles = options.bubbles !== false;
    this.target = null;
    this.currentTarget = null;
    this.defaultPrevented = false;
    this.propagationStopped = false;
    this.immediatePropagationStopped = false;
    Object.assign(this, options.detail ? { detail: options.detail } : {});
    for (const [key, value] of Object.entries(options)) {
      if (['bubbles', 'detail'].includes(key)) continue;
      this[key] = value;
    }
  }

  preventDefault() {
    this.defaultPrevented = true;
  }

  stopPropagation() {
    this.propagationStopped = true;
  }

  stopImmediatePropagation() {
    this.propagationStopped = true;
    this.immediatePropagationStopped = true;
  }
}

class FakeNode {
  constructor(ownerDocument) {
    this.ownerDocument = ownerDocument;
    this.parentNode = null;
    this.childNodes = [];
    this.listeners = new Map();
  }

  addEventListener(type, handler, options) {
    const capture = options === true || (options && options.capture === true);
    const key = `${type}:${capture ? 'capture' : 'bubble'}`;
    if (!this.listeners.has(key)) this.listeners.set(key, []);
    this.listeners.get(key).push(handler);
  }

  removeEventListener(type, handler, options) {
    const capture = options === true || (options && options.capture === true);
    const key = `${type}:${capture ? 'capture' : 'bubble'}`;
    const list = this.listeners.get(key);
    if (!list) return;
    const index = list.indexOf(handler);
    if (index >= 0) list.splice(index, 1);
  }

  /** Runs one phase's listeners, honouring `stopImmediatePropagation`. */
  fire(event, capture) {
    const list = this.listeners.get(`${event.type}:${capture ? 'capture' : 'bubble'}`);
    if (!list) return;
    event.currentTarget = this;
    for (const handler of [...list]) {
      handler.call(this, event);
      if (event.immediatePropagationStopped) return;
    }
  }

  dispatchEvent(event) {
    event.target = event.target ?? this;
    const path = [];
    for (let node = this.parentNode; node; node = node.parentNode) path.unshift(node);
    for (const node of path) {
      node.fire(event, true);
      if (event.propagationStopped) return !event.defaultPrevented;
    }
    this.fire(event, true);
    if (event.propagationStopped) return !event.defaultPrevented;
    this.fire(event, false);
    if (!event.bubbles) return !event.defaultPrevented;
    for (const node of [...path].reverse()) {
      if (event.propagationStopped) break;
      node.fire(event, false);
    }
    return !event.defaultPrevented;
  }
}

class FakeText extends FakeNode {
  constructor(ownerDocument, value) {
    super(ownerDocument);
    this.nodeType = 3;
    this.data = VOID_TEXT(value);
  }

  get textContent() {
    return this.data;
  }

  set textContent(value) {
    this.data = VOID_TEXT(value);
  }
}

class FakeElement extends FakeNode {
  constructor(ownerDocument, tagName) {
    super(ownerDocument);
    this.nodeType = 1;
    this.tagName = String(tagName).toUpperCase();
    this.attributes = new Map();
    this.dataset = {};
    this.className = '';
    this.id = '';
    this.hidden = false;
    this.disabled = false;
    this.value = '';
    this.files = null;
    this.focused = false;
  }

  get classList() {
    return new ClassList(this);
  }

  get children() {
    return this.childNodes.filter((node) => node.nodeType === 1);
  }

  setAttribute(name, value) {
    this.attributes.set(String(name), VOID_TEXT(value));
    if (name === 'id') this.id = VOID_TEXT(value);
    if (name === 'class') this.className = VOID_TEXT(value);
  }

  getAttribute(name) {
    if (name === 'id' && this.id) return this.id;
    if (name === 'class' && this.className) return this.className;
    return this.attributes.has(String(name)) ? this.attributes.get(String(name)) : null;
  }

  hasAttribute(name) {
    return this.getAttribute(name) !== null;
  }

  removeAttribute(name) {
    this.attributes.delete(String(name));
  }

  adopt(node) {
    const child = typeof node === 'string' ? new FakeText(this.ownerDocument, node) : node;
    child.parentNode?.remove?.call?.(child.parentNode, child);
    if (child.parentNode) {
      const index = child.parentNode.childNodes.indexOf(child);
      if (index >= 0) child.parentNode.childNodes.splice(index, 1);
    }
    child.parentNode = this;
    return child;
  }

  append(...nodes) {
    for (const node of nodes) this.childNodes.push(this.adopt(node));
  }

  prepend(...nodes) {
    for (const [offset, node] of nodes.entries()) this.childNodes.splice(offset, 0, this.adopt(node));
  }

  appendChild(node) {
    this.append(node);
    return node;
  }

  after(...nodes) {
    const parent = this.parentNode;
    if (!parent) return;
    const index = parent.childNodes.indexOf(this);
    for (const [offset, node] of nodes.entries()) parent.childNodes.splice(index + 1 + offset, 0, parent.adopt(node));
  }

  replaceChildren(...nodes) {
    for (const child of this.childNodes) child.parentNode = null;
    this.childNodes = [];
    this.append(...nodes);
  }

  remove() {
    const parent = this.parentNode;
    if (!parent) return;
    const index = parent.childNodes.indexOf(this);
    if (index >= 0) parent.childNodes.splice(index, 1);
    this.parentNode = null;
  }

  focus() {
    this.focused = true;
    this.ownerDocument.activeElement = this;
  }

  get textContent() {
    return this.childNodes.map((node) => node.textContent).join('');
  }

  set textContent(value) {
    for (const child of this.childNodes) child.parentNode = null;
    this.childNodes = VOID_TEXT(value) === '' ? [] : [this.adopt(new FakeText(this.ownerDocument, value))];
  }

  matchesCompound(compound) {
    if (compound.tag && compound.tag !== this.tagName) return false;
    if (compound.id && compound.id !== this.id) return false;
    for (const name of compound.classes) if (!this.classList.contains(name)) return false;
    for (const { name, value } of compound.attributes) {
      const key = name.startsWith('data-')
        ? name.slice(5).replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase())
        : null;
      const actual = key && key in this.dataset ? this.dataset[key] : this.getAttribute(name);
      if (actual === null || actual === undefined) return false;
      if (value !== undefined && actual !== value) return false;
    }
    return true;
  }

  matches(selector) {
    return parseSelector(selector).some((chain) => {
      if (!chain.length) return false;
      if (!this.matchesCompound(chain[chain.length - 1])) return false;
      let node = this.parentNode;
      for (let index = chain.length - 2; index >= 0; index -= 1) {
        while (node && !(node.nodeType === 1 && node.matchesCompound(chain[index]))) node = node.parentNode;
        if (!node) return false;
        node = node.parentNode;
      }
      return true;
    });
  }

  closest(selector) {
    for (let node = this; node; node = node.parentNode) {
      if (node.nodeType === 1 && node.matches(selector)) return node;
    }
    return null;
  }

  descendants() {
    const output = [];
    const visit = (node) => {
      for (const child of node.childNodes) {
        if (child.nodeType !== 1) continue;
        output.push(child);
        visit(child);
      }
    };
    visit(this);
    return output;
  }

  querySelectorAll(selector) {
    return this.descendants().filter((node) => node.matches(selector));
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  scrollIntoView() {}
}

class FakeDocument extends FakeNode {
  constructor() {
    super(null);
    this.ownerDocument = this;
    this.nodeType = 9;
    this.readyState = 'complete';
    this.documentElement = new FakeElement(this, 'html');
    this.documentElement.parentNode = this;
    this.body = new FakeElement(this, 'body');
    this.head = new FakeElement(this, 'head');
    this.documentElement.append(this.head, this.body);
    this.childNodes = [this.documentElement];
    this.activeElement = this.body;
  }

  createElement(tagName) {
    return new FakeElement(this, tagName);
  }

  createTextNode(value) {
    return new FakeText(this, value);
  }

  getElementById(id) {
    return this.documentElement.descendants().find((node) => node.id === String(id)) ?? null;
  }

  querySelector(selector) {
    return this.documentElement.matches(selector) ? this.documentElement : this.documentElement.querySelector(selector);
  }

  querySelectorAll(selector) {
    const own = this.documentElement.matches(selector) ? [this.documentElement] : [];
    return [...own, ...this.documentElement.querySelectorAll(selector)];
  }
}

/** A window-like root carrying the document, timers and the dialog prompts. */
export function createWindow({ storage = null, confirmAnswer = true } = {}) {
  const documentRef = new FakeDocument();
  const root = new FakeNode(documentRef);
  root.document = documentRef;
  root.Event = FakeEvent;
  root.StorageEvent = class StorageEvent extends FakeEvent {
    constructor(type, init = {}) {
      super(type, init);
      this.key = init.key ?? null;
      this.newValue = init.newValue ?? null;
      this.storageArea = init.storageArea ?? null;
    }
  };
  root.confirms = [];
  root.confirm = (message) => {
    root.confirms.push(message);
    return typeof confirmAnswer === 'function' ? confirmAnswer(message) : confirmAnswer;
  };
  root.prompts = [];
  root.prompt = (message, value) => {
    root.prompts.push(message);
    return value ?? '';
  };
  root.setTimeout = (fn) => { fn(); return 0; };
  root.clearTimeout = () => {};
  root.requestAnimationFrame = (fn) => { fn(); return 0; };
  root.cancelAnimationFrame = () => {};
  if (storage) root.localStorage = storage;
  return root;
}

/** A `FileReader` stand-in that yields `text` (or fails) on `readAsText`. */
export function createFileReader(text, { fail = false } = {}) {
  return class FileReader {
    readAsText() {
      if (fail) this.onerror?.(new Error('read failed'));
      else {
        this.result = text;
        this.onload?.();
      }
    }
  };
}

/** A `File` stand-in: only `size` is read before the file is opened. */
export function createFile(text) {
  return { size: Buffer.byteLength(String(text), 'utf8'), name: 'backup.json' };
}

export { FakeDocument, FakeElement, FakeEvent, FakeText };
