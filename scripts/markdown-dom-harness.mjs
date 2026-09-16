// Minimal DOM stand-in for the markdown renderer suites.
//
// The renderer only ever uses `createElement`, `createTextNode`,
// `createDocumentFragment`, `appendChild`, `replaceChildren`, `setAttribute`,
// `removeAttribute` and `textContent`. Implementing exactly that surface lets
// the suites assert on the real node tree the browser would get, instead of
// grepping the source. (Helper module: run-checks only executes `test-*` and
// `validate-*`.)

class FakeText {
  constructor(ownerDocument, value) {
    this.ownerDocument = ownerDocument;
    this.nodeType = 3;
    this.parentNode = null;
    this.data = String(value ?? '');
  }

  get tagName() {
    return '#text';
  }

  get childNodes() {
    return [];
  }

  get textContent() {
    return this.data;
  }

  set textContent(value) {
    this.data = String(value ?? '');
  }
}

class FakeElement {
  constructor(ownerDocument, tagName) {
    this.ownerDocument = ownerDocument;
    this.nodeType = tagName === '#fragment' ? 11 : 1;
    this.tagName = tagName === '#fragment' ? '#fragment' : String(tagName).toUpperCase();
    this.parentNode = null;
    this.childNodes = [];
    this.attributes = new Map();
  }

  setAttribute(name, value) {
    this.attributes.set(String(name), String(value));
  }

  getAttribute(name) {
    return this.attributes.has(String(name)) ? this.attributes.get(String(name)) : null;
  }

  hasAttribute(name) {
    return this.attributes.has(String(name));
  }

  removeAttribute(name) {
    this.attributes.delete(String(name));
  }

  appendChild(node) {
    if (!node) return node;
    if (node.nodeType === 11) {
      for (const child of [...node.childNodes]) this.appendChild(child);
      node.childNodes = [];
      return node;
    }
    node.parentNode = this;
    this.childNodes.push(node);
    return node;
  }

  replaceChildren(...nodes) {
    for (const child of this.childNodes) child.parentNode = null;
    this.childNodes = [];
    for (const node of nodes) this.appendChild(node);
  }

  get className() {
    return this.getAttribute('class') ?? '';
  }

  get textContent() {
    return this.childNodes.map((child) => child.textContent).join('');
  }

  set textContent(value) {
    for (const child of this.childNodes) child.parentNode = null;
    this.childNodes = [];
    const text = String(value ?? '');
    if (text) this.appendChild(new FakeText(this.ownerDocument, text));
  }
}

class FakeDocument {
  createElement(tagName) {
    return new FakeElement(this, tagName);
  }

  createTextNode(value) {
    return new FakeText(this, value);
  }

  createDocumentFragment() {
    return new FakeElement(this, '#fragment');
  }
}

export function createDocument() {
  return new FakeDocument();
}

export function createContainer(documentRef = createDocument()) {
  const container = documentRef.createElement('div');
  container.setAttribute('class', 'content');
  return container;
}

/** Depth-first walk over the element tree, root first. */
export function walk(node, visit) {
  visit(node);
  for (const child of node.childNodes ?? []) walk(child, visit);
}

/** Every element with the given tag name, in document order. */
export function findAll(node, tagName) {
  const wanted = String(tagName).toUpperCase();
  const found = [];
  walk(node, (current) => {
    if (current.nodeType === 1 && current.tagName === wanted) found.push(current);
  });
  return found;
}

export function find(node, tagName) {
  return findAll(node, tagName)[0] ?? null;
}

/** Every element carrying the given class token. */
export function findAllByClass(node, className) {
  const found = [];
  walk(node, (current) => {
    if (current.nodeType !== 1) return;
    if ((current.getAttribute('class') ?? '').split(/\s+/).includes(className)) found.push(current);
  });
  return found;
}

export function findByClass(node, className) {
  return findAllByClass(node, className)[0] ?? null;
}

/** Compact `tag.class[attr=value]` outline, for readable structural asserts. */
export function outline(node) {
  const parts = [];
  walk(node, (current) => {
    if (current.nodeType !== 1 || current.tagName === '#fragment') return;
    const className = current.getAttribute('class');
    parts.push(className ? `${current.tagName.toLowerCase()}.${className.split(' ')[0]}` : current.tagName.toLowerCase());
  });
  return parts.join(' ');
}
