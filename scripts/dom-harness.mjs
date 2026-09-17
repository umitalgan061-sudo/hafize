// Kontrol paketleri için küçük ama gerçek bir DOM.
//
// `public/` altındaki arayüz modülleri `mount()` ile sayfaya yazar. Bu davranışı
// doğrulamanın iki yolu var: kaynak dosyada dize aramak, ya da modülü gerçekten
// çalıştırıp ürettiği ağaca bakmak. Birincisi bir değişken adı değişince
// kırılır ve mantık bozulduğunda sessiz kalır; bu dosya ikincisini mümkün kılar.
//
// Kapsam bilinçli olarak dardır: yalnızca bu depodaki modüllerin kullandığı
// yüzey. Tam bir tarayıcı taklidi değildir ve olmaya da çalışmaz — eksik bir
// yöntem sessizce `undefined` dönmek yerine hata verir, böylece paket yanlış
// bir güvence üretmez.
//
// Bu dosya `test-*` deseniyle eşleşmediği için `run-checks.mjs` onu paket
// olarak çalıştırmaz; yalnızca içe aktarılır.

const VOID_TAGS = new Set(['br', 'hr', 'img', 'input', 'link', 'meta']);

/** `data-foo-bar` ↔ `fooBar` dönüşümü. */
const toDatasetKey = (name) => name.replace(/^data-/, '').replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
const toAttributeName = (key) => `data-${key.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`)}`;

class FakeNode {
  constructor(ownerDocument) {
    this.ownerDocument = ownerDocument;
    this.parentNode = null;
    this.childNodes = [];
  }

  get parentElement() {
    return this.parentNode instanceof FakeElement ? this.parentNode : null;
  }

  get children() {
    return this.childNodes.filter((node) => node instanceof FakeElement);
  }

  get firstChild() { return this.childNodes[0] ?? null; }
  get lastChild() { return this.childNodes[this.childNodes.length - 1] ?? null; }

  get nextSibling() {
    const siblings = this.parentNode?.childNodes ?? [];
    return siblings[siblings.indexOf(this) + 1] ?? null;
  }

  contains(node) {
    for (let current = node; current; current = current.parentNode) if (current === this) return true;
    return false;
  }

  remove() {
    const siblings = this.parentNode?.childNodes;
    if (!siblings) return;
    const index = siblings.indexOf(this);
    if (index >= 0) siblings.splice(index, 1);
    this.parentNode = null;
  }
}

class FakeText extends FakeNode {
  constructor(ownerDocument, value) {
    super(ownerDocument);
    this.nodeType = 3;
    this.nodeValue = String(value ?? '');
  }

  get tagName() { return null; }
  get textContent() { return this.nodeValue; }
  set textContent(value) { this.nodeValue = String(value ?? ''); }
}

class FakeClassList {
  constructor(element) { this.element = element; }

  #values() {
    return String(this.element.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
  }

  #write(values) {
    this.element.setAttribute('class', [...new Set(values)].join(' '));
  }

  add(...names) { this.#write([...this.#values(), ...names]); }
  remove(...names) { this.#write(this.#values().filter((name) => !names.includes(name))); }
  contains(name) { return this.#values().includes(name); }
  toggle(name, force) {
    const has = this.contains(name);
    const next = force === undefined ? !has : Boolean(force);
    if (next) this.add(name); else this.remove(name);
    return next;
  }
}

class FakeElement extends FakeNode {
  constructor(ownerDocument, tagName) {
    super(ownerDocument);
    this.nodeType = 1;
    this.tagName = String(tagName).toUpperCase();
    this.attributes = new Map();
    this.listeners = new Map();
    this.classList = new FakeClassList(this);
    // `dataset` doğrudan nitelik haritasına yazar; ikisi ayrışırsa modül
    // `getAttribute('data-x')` ile `dataset.x`i farklı görürdü.
    this.dataset = new Proxy({}, {
      get: (_target, key) => (typeof key === 'string' ? this.attributes.get(toAttributeName(key)) : undefined),
      set: (_target, key, value) => {
        this.attributes.set(toAttributeName(String(key)), String(value));
        return true;
      },
      deleteProperty: (_target, key) => {
        this.attributes.delete(toAttributeName(String(key)));
        return true;
      },
      has: (_target, key) => this.attributes.has(toAttributeName(String(key))),
      ownKeys: () => [...this.attributes.keys()].filter((name) => name.startsWith('data-')).map(toDatasetKey),
      getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true })
    });
  }

  // --- Nitelikler ----------------------------------------------------------
  setAttribute(name, value) { this.attributes.set(String(name), String(value)); }
  getAttribute(name) { return this.attributes.has(String(name)) ? this.attributes.get(String(name)) : null; }
  hasAttribute(name) { return this.attributes.has(String(name)); }
  removeAttribute(name) { this.attributes.delete(String(name)); }

  get className() { return this.getAttribute('class') ?? ''; }
  set className(value) { this.setAttribute('class', value); }

  get id() { return this.getAttribute('id') ?? ''; }
  set id(value) { this.setAttribute('id', value); }

  get hidden() { return this.getAttribute('hidden') === 'true'; }
  set hidden(value) { this.setAttribute('hidden', value ? 'true' : 'false'); }

  get type() { return this.getAttribute('type') ?? ''; }
  set type(value) { this.setAttribute('type', value); }

  get disabled() { return this.hasAttribute('disabled'); }
  set disabled(value) { if (value) this.setAttribute('disabled', ''); else this.removeAttribute('disabled'); }

  // Gerçek DOM'da bu özellikler niteliğe yansır: `input.autocomplete = 'off'`
  // yazan bir modül ile `[autocomplete="off"]` arayan bir seçici aynı şeyi
  // görmeli.
  get autocomplete() { return this.getAttribute('autocomplete') ?? ''; }
  set autocomplete(value) { this.setAttribute('autocomplete', value); }
  get placeholder() { return this.getAttribute('placeholder') ?? ''; }
  set placeholder(value) { this.setAttribute('placeholder', value); }
  get name() { return this.getAttribute('name') ?? ''; }
  set name(value) { this.setAttribute('name', value); }
  get title() { return this.getAttribute('title') ?? ''; }
  set title(value) { this.setAttribute('title', value); }
  get href() { return this.getAttribute('href') ?? ''; }
  set href(value) { this.setAttribute('href', value); }
  get rel() { return this.getAttribute('rel') ?? ''; }
  set rel(value) { this.setAttribute('rel', value); }
  get src() { return this.getAttribute('src') ?? ''; }
  set src(value) { this.setAttribute('src', value); }
  get maxLength() { return Number(this.getAttribute('maxlength') ?? -1); }
  set maxLength(value) { this.setAttribute('maxlength', String(value)); }
  get tabIndex() { return Number(this.getAttribute('tabindex') ?? -1); }
  set tabIndex(value) { this.setAttribute('tabindex', String(value)); }

  // `value` ve `checked` gerçek alanlardır: nitelik değil, canlı durum.
  get value() { return this._value ?? ''; }
  set value(next) { this._value = String(next ?? ''); }
  get checked() { return this._checked === true; }
  set checked(next) { this._checked = Boolean(next); }
  get selectionStart() { return this._selectionStart ?? this.value.length; }
  set selectionStart(next) { this._selectionStart = Number(next); }
  get selectionEnd() { return this._selectionEnd ?? this.selectionStart; }
  set selectionEnd(next) { this._selectionEnd = Number(next); }

  // --- Ağaç ----------------------------------------------------------------
  appendChild(node) {
    if (VOID_TAGS.has(this.tagName.toLowerCase())) throw new Error(`<${this.tagName.toLowerCase()}> çocuk alamaz`);
    node.remove();
    node.parentNode = this;
    this.childNodes.push(node);
    return node;
  }

  append(...nodes) {
    for (const node of nodes) this.appendChild(typeof node === 'string' ? this.ownerDocument.createTextNode(node) : node);
  }

  prepend(...nodes) {
    for (const [offset, node] of nodes.entries()) {
      const child = typeof node === 'string' ? this.ownerDocument.createTextNode(node) : node;
      child.remove();
      child.parentNode = this;
      this.childNodes.splice(offset, 0, child);
    }
  }

  replaceChildren(...nodes) {
    for (const child of this.childNodes.splice(0, this.childNodes.length)) child.parentNode = null;
    this.append(...nodes);
  }

  insertBefore(node, reference) {
    if (!reference) return this.appendChild(node);
    node.remove();
    node.parentNode = this;
    this.childNodes.splice(this.childNodes.indexOf(reference), 0, node);
    return node;
  }

  get textContent() {
    return this.childNodes.map((child) => child.textContent).join('');
  }

  set textContent(value) {
    for (const child of this.childNodes.splice(0, this.childNodes.length)) child.parentNode = null;
    if (value !== '' && value != null) this.appendChild(this.ownerDocument.createTextNode(value));
  }

  // Modüllerin HTML birleştirmesine düşmediğini kanıtlamak için: bir modül
  // `innerHTML` yazmayı denerse paket sessizce geçmez, patlar.
  get innerHTML() { throw new Error('innerHTML bu DOM taklidinde desteklenmez: metin textContent ile yazılmalı'); }
  set innerHTML(_value) { throw new Error('innerHTML yazımı yasaktır: metin textContent ile yazılmalı'); }
  insertAdjacentHTML() { throw new Error('insertAdjacentHTML yasaktır'); }

  // --- Seçiciler -----------------------------------------------------------
  matches(selector) { return matchesSelector(this, selector); }

  closest(selector) {
    for (let node = this; node instanceof FakeElement; node = node.parentNode) {
      if (node.matches(selector)) return node;
    }
    return null;
  }

  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }

  querySelectorAll(selector) {
    const found = [];
    walk(this, (node) => {
      if (node !== this && node instanceof FakeElement && matchesSelector(node, selector)) found.push(node);
    });
    // Gerçek `querySelectorAll` bir NodeList döndürür; `forEach` ve yayılma
    // operatörü kullanan modüller için dizi yeterlidir.
    return found;
  }

  // --- Odak ----------------------------------------------------------------
  focus() { this.ownerDocument.activeElement = this; }
  blur() { if (this.ownerDocument.activeElement === this) this.ownerDocument.activeElement = null; }
  scrollIntoView() { this.scrolledIntoView = true; }
  click() { this.dispatchEvent(new FakeEvent('click', { bubbles: true })); }

  // --- Olaylar -------------------------------------------------------------
  addEventListener(type, handler, options) {
    const capture = options === true || options?.capture === true;
    const key = `${type}:${capture ? 'capture' : 'bubble'}`;
    if (!this.listeners.has(key)) this.listeners.set(key, []);
    this.listeners.get(key).push({ handler, once: options?.once === true });
  }

  removeEventListener(type, handler, options) {
    const capture = options === true || options?.capture === true;
    const entries = this.listeners.get(`${type}:${capture ? 'capture' : 'bubble'}`);
    if (!entries) return;
    const index = entries.findIndex((entry) => entry.handler === handler);
    if (index >= 0) entries.splice(index, 1);
  }

  dispatchEvent(event) {
    event.target ??= this;
    const path = [];
    for (let node = this; node; node = node.parentNode) path.push(node);
    if (this.ownerDocument) path.push(this.ownerDocument);
    if (this.ownerDocument?.defaultView) path.push(this.ownerDocument.defaultView);

    const fire = (node, phase) => {
      const entries = node.listeners?.get(`${event.type}:${phase}`);
      if (!entries?.length) return;
      for (const entry of [...entries]) {
        if (event.immediatelyStopped) return;
        event.currentTarget = node;
        entry.handler.call(node, event);
        if (entry.once) node.removeEventListener(event.type, entry.handler, phase === 'capture');
      }
    };

    for (const node of [...path].reverse()) {
      if (event.stopped) break;
      fire(node, 'capture');
    }
    for (const node of path) {
      if (event.stopped) break;
      fire(node, 'bubble');
      if (!event.bubbles) break;
    }
    return !event.defaultPrevented;
  }
}

class FakeEvent {
  constructor(type, init = {}) {
    this.type = String(type);
    this.bubbles = init.bubbles !== false;
    this.detail = init.detail;
    this.key = init.key;
    this.shiftKey = init.shiftKey === true;
    this.ctrlKey = init.ctrlKey === true;
    this.metaKey = init.metaKey === true;
    this.altKey = init.altKey === true;
    this.target = init.target ?? null;
    this.currentTarget = null;
    this.defaultPrevented = false;
    this.stopped = false;
    this.immediatelyStopped = false;
    Object.assign(this, init.extra ?? {});
  }

  preventDefault() { this.defaultPrevented = true; }
  stopPropagation() { this.stopped = true; }
  stopImmediatePropagation() { this.stopped = true; this.immediatelyStopped = true; }
}

class FakeDocument {
  constructor() {
    this.nodeType = 9;
    this.readyState = 'complete';
    this.activeElement = null;
    this.listeners = new Map();
    this.documentElement = new FakeElement(this, 'html');
    this.head = new FakeElement(this, 'head');
    this.body = new FakeElement(this, 'body');
    this.documentElement.append(this.head, this.body);
    this.childNodes = [this.documentElement];
    this.defaultView = null;
  }

  createElement(tagName) { return new FakeElement(this, tagName); }
  createTextNode(value) { return new FakeText(this, value); }
  createDocumentFragment() { return new FakeElement(this, 'fragment'); }

  getElementById(id) {
    let found = null;
    walk(this.documentElement, (node) => {
      if (!found && node instanceof FakeElement && node.getAttribute('id') === String(id)) found = node;
    });
    return found;
  }

  querySelector(selector) { return this.documentElement.querySelector(selector) ?? (this.documentElement.matches(selector) ? this.documentElement : null); }
  querySelectorAll(selector) { return this.documentElement.querySelectorAll(selector); }

  addEventListener(...args) { return FakeElement.prototype.addEventListener.apply(this, args); }
  removeEventListener(...args) { return FakeElement.prototype.removeEventListener.apply(this, args); }
  dispatchEvent(event) {
    event.target ??= this;
    for (const phase of ['capture', 'bubble']) {
      for (const entry of [...(this.listeners.get(`${event.type}:${phase}`) ?? [])]) {
        event.currentTarget = this;
        entry.handler.call(this, event);
        if (entry.once) this.removeEventListener(event.type, entry.handler, phase === 'capture');
      }
    }
    return !event.defaultPrevented;
  }
}

/**
 * Desteklenen seçici alt kümesi: `tag`, `#id`, `.class`, `[attr]`,
 * `[attr="value"]`, `[attr]:checked`, bunların bileşimi, boşlukla ayrılmış
 * torun zinciri ve virgülle ayrılmış liste.
 *
 * Desteklenmeyen bir sözdizimi sessizce `false` dönmez, hata verir: aksi
 * hâlde yanlış yazılmış bir seçici "hiçbir şey bulunamadı" gibi görünür ve
 * paket yanlışlıkla yeşil kalırdı.
 */
function matchesSelector(element, selector) {
  const text = String(selector).trim();
  if (!text) return false;
  if (text.includes(',')) return text.split(',').some((part) => matchesSelector(element, part));

  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length > 1) {
    if (!matchesCompound(element, parts[parts.length - 1])) return false;
    let node = element.parentNode;
    let index = parts.length - 2;
    while (index >= 0 && node instanceof FakeElement) {
      if (matchesCompound(node, parts[index])) index -= 1;
      node = node.parentNode;
    }
    return index < 0;
  }
  return matchesCompound(element, text);
}

function matchesCompound(element, compound) {
  if (!(element instanceof FakeElement)) return false;
  const tokens = compound.match(/^[a-zA-Z][\w-]*|#[\w-]+|\.[\w-]+|\[[^\]]+\]|:[\w-]+/g);
  if (!tokens || tokens.join('') !== compound) {
    throw new Error(`dom-harness: desteklenmeyen seçici parçası: ${compound}`);
  }
  for (const token of tokens) {
    if (token.startsWith('#')) {
      if (element.getAttribute('id') !== token.slice(1)) return false;
    } else if (token.startsWith('.')) {
      if (!element.classList.contains(token.slice(1))) return false;
    } else if (token.startsWith('[')) {
      const match = /^\[([\w-]+)(?:([~|^$*]?=)"?([^"\]]*)"?)?\]$/.exec(token);
      if (!match) throw new Error(`dom-harness: desteklenmeyen nitelik seçicisi: ${token}`);
      const [, name, operator, expected] = match;
      const actual = element.getAttribute(name);
      if (actual === null) return false;
      if (operator === '=' && actual !== expected) return false;
      if (operator === '^=' && !actual.startsWith(expected)) return false;
      if (operator === '$=' && !actual.endsWith(expected)) return false;
      if (operator === '*=' && !actual.includes(expected)) return false;
    } else if (token.startsWith(':')) {
      const pseudo = token.slice(1);
      if (pseudo === 'checked') { if (!element.checked) return false; }
      else if (pseudo === 'disabled') { if (!element.disabled) return false; }
      else if (pseudo === 'enabled') { if (element.disabled) return false; }
      else throw new Error(`dom-harness: desteklenmeyen sözde sınıf: ${token}`);
    } else if (element.tagName.toLowerCase() !== token.toLowerCase()) {
      return false;
    }
  }
  return true;
}

/** Ağacı derinlik öncelikli gezer. */
export function walk(node, visit) {
  visit(node);
  for (const child of [...(node.childNodes ?? [])]) walk(child, visit);
}

/** `CSS.escape` karşılığı; modüller seçici kurarken kullanır. */
const cssShim = Object.freeze({
  escape: (value) => String(value).replace(/[^\w-]/g, (ch) => `\\${ch}`)
});

/**
 * Modül mount etmeye hazır bir belge ve pencere üretir.
 *
 * @param {{ readyState?: 'loading' | 'complete'; storage?: Storage }} [options]
 */
export function createEnvironment(options = {}) {
  const document = new FakeDocument();
  document.readyState = options.readyState ?? 'complete';

  const window = {
    document,
    CSS: cssShim,
    // Modüller `event.target instanceof Element` ile daraltma yapar; taklit
    // sınıflar bu adlar altında yayınlanmazsa o kontroller ReferenceError
    // verir ya da sessizce `false` döner.
    Element: FakeElement,
    HTMLElement: FakeElement,
    HTMLInputElement: FakeElement,
    HTMLTextAreaElement: FakeElement,
    HTMLSelectElement: FakeElement,
    HTMLButtonElement: FakeElement,
    Node: FakeNode,
    Text: FakeText,
    Event: FakeEvent,
    CustomEvent: FakeEvent,
    StorageEvent: FakeEvent,
    KeyboardEvent: FakeEvent,
    MouseEvent: FakeEvent,
    listeners: new Map(),
    crypto: { randomUUID: () => `id-${(window.crypto.counter = (window.crypto.counter ?? 0) + 1)}`, counter: 0 },
    localStorage: options.storage ?? createStorage(),
    confirm: () => true,
    addEventListener: (...args) => FakeElement.prototype.addEventListener.apply(window, args),
    removeEventListener: (...args) => FakeElement.prototype.removeEventListener.apply(window, args),
    dispatchEvent: (event) => FakeDocument.prototype.dispatchEvent.call(window, event)
  };
  document.defaultView = window;

  return { window, document, body: document.body };
}

/** Gerçek `localStorage` yüzeyinin bellek içi karşılığı. */
export function createStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(String(key)) ? data.get(String(key)) : null),
    setItem: (key, value) => { data.set(String(key), String(value)); },
    removeItem: (key) => { data.delete(String(key)); },
    clear: () => data.clear(),
    key: (index) => [...data.keys()][index] ?? null,
    get length() { return data.size; }
  };
}

/** Bir ağaçtaki tüm elemanları sınıf adına göre toplar. */
export function findByClass(root, className) {
  const found = [];
  walk(root, (node) => {
    if (node instanceof FakeElement && node.classList.contains(className)) found.push(node);
  });
  return found;
}

/** Ağacın etiket/sınıf taslağını okunur bir dize olarak verir. */
export function outline(node, depth = 0) {
  const lines = [];
  walk(node, () => {});
  const visit = (current, level) => {
    if (current instanceof FakeElement) {
      const cls = current.className ? `.${current.className.split(/\s+/).join('.')}` : '';
      lines.push(`${'  '.repeat(level)}${current.tagName.toLowerCase()}${cls}`);
    } else if (current.textContent.trim()) {
      lines.push(`${'  '.repeat(level)}"${current.textContent.trim()}"`);
    }
    for (const child of current.childNodes ?? []) visit(child, level + 1);
  };
  visit(node, depth);
  return lines.join('\n');
}

export { FakeDocument, FakeElement, FakeEvent, FakeNode, FakeText };
