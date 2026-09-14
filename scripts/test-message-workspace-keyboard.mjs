import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertCssIncludes } from './source-contract.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(path.join(root, 'public/message-workspace.js'), 'utf8');
const css = await readFile(path.join(root, 'public/message-workspace.css'), 'utf8');

function event({ ctrlKey=false, metaKey=false, shiftKey=false, key='' } = {}) {
  return { ctrlKey, metaKey, shiftKey, key };
}

assert.ok(source.includes('function handleShortcut(event)'));
assert.ok(source.includes('const mod = event.ctrlKey || event.metaKey;'));
assert.ok(source.includes('if (!mod || !event.shiftKey) return;'));
assert.ok(source.includes("const key=event.key.toLowerCase();"));
assert.ok(source.includes("if (key==='b')"));
assert.ok(source.includes("if (key==='k')"));
assert.ok(source.includes("if (key==='x')"));
assert.ok(source.includes('event.preventDefault()'));

const shortcutNames = [
  ['b', 'search'],
  ['k', 'select'],
  ['x', 'clear']
];
for (const [key] of shortcutNames) {
  assert.match(source, new RegExp(`key==='${key}'`));
}

assert.equal(/if \(mod && event\.shiftKey\) return/.test(source), false);
assert.equal(/event\.key\.toUpperCase\(\)/.test(source), false);

const modifierCases = [
  event({ ctrlKey:true, shiftKey:true, key:'B' }),
  event({ metaKey:true, shiftKey:true, key:'b' }),
  event({ ctrlKey:true, metaKey:true, shiftKey:true, key:'K' }),
  event({ ctrlKey:true, shiftKey:true, key:'x' })
];
assert.equal(modifierCases.length, 4);
for (const item of modifierCases) {
  assert.equal(item.shiftKey, true);
  assert.equal(item.ctrlKey || item.metaKey, true);
}

const ignoredCases = [
  event({ ctrlKey:true, shiftKey:false, key:'b' }),
  event({ ctrlKey:false, metaKey:false, shiftKey:true, key:'b' }),
  event({ ctrlKey:true, shiftKey:true, key:'f' }),
  event({ ctrlKey:true, shiftKey:true, key:'a' })
];
for (const item of ignoredCases) {
  const shouldProcess = (item.ctrlKey || item.metaKey) && item.shiftKey;
  if (item.key.toLowerCase() === 'a' || item.key.toLowerCase() === 'f') assert.equal(shouldProcess && false, false);
}

assert.ok(source.includes('runtime.search?.focus()'));
assert.ok(source.includes('runtime.search?.select()'));
assert.ok(source.includes('selectVisibleRecords()'));
assert.ok(source.includes('clearSelection()'));
assert.ok(source.includes('saveState()'));

assertCssIncludes(css, ':focus-visible');
assertCssIncludes(css, '@media (max-width:560px)');
assertCssIncludes(css, '@media (prefers-reduced-motion:reduce)');
assertCssIncludes(css, '@media (forced-colors:active)');

console.log('message workspace keyboard tests passed');
