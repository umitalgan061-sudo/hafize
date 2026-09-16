// Minimal DOM stand-in for the Prompt Library panel suites.
//
// The markdown harness models a renderer that only builds nodes; the panels
// also listen, dispatch, focus and intercept. This harness adds exactly that:
// element lookup, a small selector subset, focus tracking and an event
// dispatcher with a real capture phase, so a suite can prove that the import
// preview takes a file selection *before* the library's own handler sees it —
// the one thing the whole feature rests on.
//
// It deliberately stays small: what the panels use, nothing more. (Helper
// module: run-checks only executes `test-*` and `validate-*`.)

class ClassList {
  constructor(element) {
    this.element = element;
  }

  get values() {
    return String(this.element.className || '').split(/\s+/).filter(Boolean);
  }

  contains(name) {
    return this.values.includes(String(name));
  }

  add(name) {
    if (this.contains(name)) return;
    this.element.className = [...this.values, String(name)].join(' ');
  }

  remove(name) {
    this.element.className = this.values.filter((value) => value !== String(name)).join(' ');
  }
}

function matchesSimple(element, selector) {
  const token = selector.trim();
  if (!token) return false;
  if (token.startsWith('#')) return element.id === token.slice(1);
  if (token.startsWith('.')) return element.classList.contains(token.slice(1));
  if (token.startsWith('[')) {
    const body = token.slice(1, -1);
    const [name, rawValue] = body.split('=');
    const value = rawValue ? rawValue.replace(/^["']|["']$/g, '') : null;
    const actual = element.getAttribute(name);
    if (actual === null) return false;
    return value === null || actual === value;
  }
  return element.tagName === token.toUpperCase();
}

function matchesCompound(element, selector) {
  // `.a.b` / `#id` / `button.mini-btn` / `input[type="file"]`
  const parts = selector.match(/(^[a-zA-Z][\w-]*)|(#[\w-]+)|(\.[\w-]+)|(\[[^\]]+\])/g) || [];
  // An unparseable selector matches nothing: `every()` over an empty list
  // would otherwise make every element a match.
  if (!parts.length) return false;
  return parts.every((part) => matchesSimple(element, part));
}

/** Supports `a`, `.a`, `#a`, `[attr]`, `[attr="v"]`, descendants and `,` lists. */
function matchesSelector(element, selector) {
  return selector.split(',').some((group) => {
    const chain = group.trim().split(/\s+/).filter(Boolean);
    if (!chain.length) return false;
    const own = chain[chain.length - 1];
    if (!matchesCompound(element, own)) return false;
    let ancestor = element.parentNode;
    for (let index = chain.length - 2; index >= 0; index -= 1) {
      let found = null;
      while (ancestor) {
        if (ancestor.nodeType === 1 && matchesCompound(ancestor, chain[index])) { found = ancestor; break; }
        ancestor = ancestor.parentNode;
      }
      if (!found) return false;
      ancestor = found.parentNode;
    }
    return true;
  });
}

class FakeText {
  constructor(ownerDocument, value) {
    this.ownerDocument = ownerDocument;
    this.nodeType = 3;
    this.parentNode = null;
    this.data = String(value ?? '');
  }

  get textContent() { return this.data; }
  set textContent(value) { this.data = String(value ?? ''); }
  get childNodes() { return []; }
}

export class FakeElement {
  constructor(ownerDocument, tagName) {
    this.ownerDocument = ownerDocument;
    this.nodeType = 1;
    this.tagName = String(tagName).toUpperCase();
    this.parentNode = null;
    this.childNodes = [];
    this.attributes = new Map();
    this.dataset = {};
    this.listeners = [];
    this.className = '';
    this.id = '';
    this.hidden = false;
    this.disabled = false;
    this.classList = new ClassList(this);
  }

  get children() { return this.childNodes.filter((node) => node.nodeType === 1); }

  setAttribute(name, value) {
    const key = String(name);
    this.attributes.set(key, String(value));
    if (key.startsWith('data-')) {
      const camel = key.slice(5).replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
      this.dataset[camel] = String(value);
    }
  }

  getAttribute(name) {
    return this.attributes.has(String(name)) ? this.attributes.get(String(name)) : null;
  }

  hasAttribute(name) { return this.attributes.has(String(name)); }

  removeAttribute(name) { this.attributes.delete(String(name)); }

  append(...nodes) {
    for (const node of nodes) {
      const child = typeof node === 'string' ? new FakeText(this.ownerDocument, node) : node;
      child.parentNode?.removeChild?.(child);
      child.parentNode = this;
      this.childNodes.push(child);
    }
  }

  prepend(node) {
    node.parentNode = this;
    this.childNodes.unshift(node);
  }

  removeChild(child) {
    const index = this.childNodes.indexOf(child);
    if (index >= 0) this.childNodes.splice(index, 1);
    child.parentNode = null;
    return child;
  }

  remove() { this.parentNode?.removeChild(this); }

  replaceChildren(...nodes) {
    for (const child of this.childNodes.splice(0)) child.parentNode = null;
    this.append(...nodes);
  }

  get textContent() {
    return this.childNodes.map((node) => node.textContent).join('');
  }

  set textContent(value) {
    for (const child of this.childNodes.splice(0)) child.parentNode = null;
    if (value !== '') this.append(new FakeText(this.ownerDocument, value));
  }

  closest(selector) {
    let node = this;
    while (node && node.nodeType === 1) {
      if (matchesSelector(node, selector)) return node;
      node = node.parentNode;
    }
    return null;
  }

  querySelectorAll(selector) {
    const found = [];
    const walk = (node) => {
      for (const child of node.childNodes) {
        if (child.nodeType !== 1) continue;
        if (matchesSelector(child, selector)) found.push(child);
        walk(child);
      }
    };
    walk(this);
    return found;
  }

  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }

  addEventListener(type, handler, options) {
    this.listeners.push({ type: String(type), handler, capture: options === true || options?.capture === true });
  }

  removeEventListener(type, handler, options) {
    const capture = options === true || options?.capture === true;
    const index = this.listeners.findIndex((entry) => entry.type === String(type) && entry.handler === handler && entry.capture === capture);
    if (index >= 0) this.listeners.splice(index, 1);
  }

  focus() {
    if (this.ownerDocument) this.ownerDocument.activeElement = this;
  }

  dispatchEvent(event) { return this.ownerDocument.dispatchEvent({ ...event, target: this }); }
}

class FakeDocument {
  constructor() {
    this.nodeType = 9;
    this.readyState = 'complete';
    this.listeners = [];
    this.parentNode = null;
    this.documentElement = new FakeElement(this, 'html');
    this.body = new FakeElement(this, 'body');
    this.documentElement.append(this.body);
    this.activeElement = this.body;
  }

  createElement(tagName) { return new FakeElement(this, tagName); }

  createTextNode(value) { return new FakeText(this, value); }

  getElementById(id) {
    return this.documentElement.querySelectorAll(`#${id}`)[0] ?? null;
  }

  querySelector(selector) { return this.documentElement.querySelector(selector); }

  querySelectorAll(selector) { return this.documentElement.querySelectorAll(selector); }

  addEventListener(type, handler, options) {
    this.listeners.push({ type: String(type), handler, capture: options === true || options?.capture === true });
  }

  removeEventListener(type, handler, options) {
    const capture = options === true || options?.capture === true;
    const index = this.listeners.findIndex((entry) => entry.type === String(type) && entry.handler === handler && entry.capture === capture);
    if (index >= 0) this.listeners.splice(index, 1);
  }

  /**
   * Walks the real propagation path: capture from the document down to the
   * target, then the target, then bubbling back up. `stopPropagation()` in the
   * capture phase therefore keeps the target's own handlers from running,
   * which is exactly how an interception is meant to work.
   */
  dispatchEvent(event) {
    const target = event.target ?? this;
    const path = [];
    let node = target;
    while (node) {
      path.unshift(node);
      node = node.parentNode;
    }
    if (path[0] !== this) path.unshift(this);

    let propagationStopped = false;
    let immediateStopped = false;
    const dispatched = {
      ...event,
      target,
      defaultPrevented: false,
      preventDefault() { dispatched.defaultPrevented = true; },
      stopPropagation() { propagationStopped = true; },
      stopImmediatePropagation() { propagationStopped = true; immediateStopped = true; }
    };

    const runPhase = (nodes, capture) => {
      for (const current of nodes) {
        if (propagationStopped && current !== target) return;
        dispatched.currentTarget = current;
        const handlers = (current.listeners || []).filter((entry) => entry.type === dispatched.type && entry.capture === capture);
        for (const entry of handlers) {
          entry.handler.call(current, dispatched);
          if (immediateStopped) return;
        }
        if (propagationStopped) return;
      }
    };

    runPhase(path.slice(0, -1), true);
    if (!immediateStopped && !propagationStopped) runPhase([target], true);
    if (!immediateStopped && !propagationStopped) runPhase([target], false);
    if (!immediateStopped && !propagationStopped) runPhase(path.slice(0, -1).reverse(), false);
    return !dispatched.defaultPrevented;
  }
}

/**
 * A window-ish root: the document, storage, the dialogs the panels ask for and
 * the event constructors they use. `confirmResponses` is consumed in order, so
 * a suite can answer the first confirmation and refuse the second.
 */
export function createPanelWindow({ storage = null, confirmResponses = [], promptResponses = [] } = {}) {
  const documentRef = new FakeDocument();
  const confirms = [...confirmResponses];
  const prompts = [...promptResponses];
  const root = {
    document: documentRef,
    localStorage: storage,
    listeners: [],
    nodeType: 9,
    parentNode: null,
    confirmCalls: [],
    dispatched: [],
    confirm(message) {
      root.confirmCalls.push(message);
      return confirms.length ? confirms.shift() : false;
    },
    prompt(message) {
      root.confirmCalls.push(message);
      return prompts.length ? prompts.shift() : null;
    },
    setTimeout: (handler) => { handler(); return 0; },
    clearTimeout: () => {},
    StorageEvent: class StorageEvent {
      constructor(type, init = {}) {
        this.type = type;
        Object.assign(this, init);
      }
    },
    CustomEvent: class CustomEvent {
      constructor(type, init = {}) {
        this.type = type;
        Object.assign(this, init);
      }
    },
    addEventListener(type, handler, options) {
      root.listeners.push({ type: String(type), handler, capture: options === true || options?.capture === true });
    },
    removeEventListener(type, handler) {
      const index = root.listeners.findIndex((entry) => entry.type === String(type) && entry.handler === handler);
      if (index >= 0) root.listeners.splice(index, 1);
    },
    dispatchEvent(event) {
      root.dispatched.push(event);
      for (const entry of [...root.listeners]) if (entry.type === event.type) entry.handler(event);
      return true;
    }
  };
  documentRef.defaultView = root;
  return root;
}

/** A file input the way the Prompt Library builds one, already in the card. */
export function createFileInput(documentRef) {
  const input = documentRef.createElement('input');
  input.type = 'file';
  input.hidden = true;
  input.value = '';
  input.files = [];
  return input;
}

/** A File-ish object: `size` for the ceiling check, `text` for the reader. */
export function createFile(text, { size = null } = {}) {
  return { name: 'backup.json', size: size ?? String(text).length, text: String(text) };
}

/** FileReader stand-in driving `readAsText` from the object above. */
export function createFileReaderClass({ fail = false } = {}) {
  return class FileReader {
    constructor() {
      this.onload = null;
      this.onerror = null;
      this.result = null;
    }

    readAsText(file) {
      if (fail) {
        this.onerror?.(new Error('READ_FAILED'));
        return;
      }
      this.result = file.text;
      this.onload?.();
    }
  };
}
