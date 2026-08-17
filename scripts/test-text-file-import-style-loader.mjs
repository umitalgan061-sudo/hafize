import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const sourcePath = fileURLToPath(new URL('../public/text-file-import-style.js', import.meta.url));
const source = await readFile(sourcePath, 'utf8');

function createDocument() {
  const links = [];
  return {
    links,
    head: {
      append(node) { links.push(node); }
    },
    querySelector(selector) {
      if (selector !== 'link[data-hafize-text-file-import-style]') return null;
      return links.find((link) => link.attributes?.['data-hafize-text-file-import-style'] === '1') || null;
    },
    createElement(tag) {
      assert.equal(tag, 'link');
      return {
        rel: '',
        href: '',
        attributes: {},
        setAttribute(name, value) { this.attributes[name] = value; }
      };
    }
  };
}

const documentRef = createDocument();
const context = vm.createContext({ globalThis: { document: documentRef }, self: { document: documentRef } });
vm.runInContext(source, context);
assert.equal(documentRef.links.length, 1);
assert.equal(documentRef.links[0].rel, 'stylesheet');
assert.equal(documentRef.links[0].href, '/text-file-import.css');
assert.equal(documentRef.links[0].attributes['data-hafize-text-file-import-style'], '1');

vm.runInContext(source, context);
assert.equal(documentRef.links.length, 1, 'style loader must be idempotent');

const noHead = vm.createContext({ globalThis: { document: {} }, self: { document: {} } });
assert.doesNotThrow(() => vm.runInContext(source, noHead));

console.log('text file import style loader tests passed');
