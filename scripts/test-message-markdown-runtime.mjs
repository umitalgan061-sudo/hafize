import assert from 'node:assert/strict';
import markdown from '../public/message-markdown.js';

class Node {
  constructor(tag = '#fragment', text = '') { this.tagName = tag === '#fragment' ? undefined : tag.toUpperCase(); this.nodeType = tag === '#fragment' ? 11 : tag === '#text' ? 3 : 1; this.children = []; this.childNodes = this.children; this.parentNode = null; this.attributes = new Map(); this.dataset = {}; this._text = text; }
  append(...nodes) { for (const node of nodes) { if (node?.nodeType === 11) this.append(...node.childNodes); else if (node) { this.children.push(node); node.parentNode = this; } } }
  appendChild(node) { this.append(node); return node; }
  replaceChildren(...nodes) { this.children = []; this.childNodes = this.children; this.append(...nodes); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  get textContent() { return this.nodeType === 3 ? this._text : this.children.length ? this.children.map((node) => node.textContent).join('') : this._text; }
  set textContent(value) { this.children = []; this.childNodes = this.children; this._text = String(value ?? ''); }
  querySelectorAll(selector) {
    const allowed = selector.split(',').map((value) => value.trim().toUpperCase()); const result = [];
    const visit = (node) => { for (const child of node.children) { if (allowed.includes(child.tagName)) result.push(child); visit(child); } };
    visit(this); return result;
  }
}
class Document {
  createElement(tag) { return new Node(tag); }
  createTextNode(text) { return new Node('#text', text); }
  createDocumentFragment() { return new Node(); }
}

const doc = new Document();
const assertText = (root, text) => assert.equal(root.textContent, text);

assert.equal(markdown.safeUrl('javascript:alert(1)'), '');
assert.match(markdown.safeUrl('https://example.com/path') || '', /^https:\/\//);
assert.match(markdown.safeUrl('mailto:test@example.com') || '', /^mailto:/);

let root = markdown.render(doc, '# Merhaba\n\n**Kalın** ve *italik*');
assert.equal(root.children[0].tagName, 'H1');
assert.equal(root.children[0].textContent, 'Merhaba');
assert.equal(root.children[1].tagName, 'P');
assert.ok(root.children[1].querySelectorAll('STRONG,EM').length >= 2);

root = markdown.render(doc, '- [x] Tamam\n- [ ] Bekliyor');
const boxes = root.querySelectorAll('INPUT');
assert.equal(boxes.length, 2);
assert.equal(boxes[0].checked, true);
assert.equal(boxes[0].disabled, true);
assert.equal(boxes[1].checked, false);

root = markdown.render(doc, '| Alan | Değer |\n| --- | --- |\n| Model | NVIDIA |');
assert.equal(root.children[0].tagName, 'TABLE');
assert.equal(root.children[0].querySelectorAll('TH').length, 2);
assert.equal(root.children[0].querySelectorAll('TD').length, 2);
assertText(root.children[0], 'AlanDeğerModelNVIDIA');

root = markdown.render(doc, '```js\nconst x = "<script>";\n```');
assert.equal(root.children[0].tagName, 'PRE');
assert.equal(root.children[0].children[0].tagName, 'CODE');
assert.equal(root.children[0].children[0].dataset.language, 'js');
assert.equal(root.children[0].textContent, 'const x = "<script>";');

root = markdown.render(doc, '[safe](https://example.com) [unsafe](javascript:alert(1))');
assert.equal(root.querySelectorAll('A').length, 1);
assert.ok(root.textContent.includes('[unsafe](javascript:alert(1))'));

const huge = 'a'.repeat(50000);
root = markdown.render(doc, huge);
assert.ok(root.textContent.length <= 24000);
console.log('message markdown runtime contract ok');
