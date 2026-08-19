import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const nav = require('../public/conversation-search-navigation.js');

assert.equal(nav.hasQuery({ value: '  hedef  ' }), true);
assert.equal(nav.hasQuery({ value: '   ' }), false);
assert.equal(nav.hasQuery(null), false);

assert.equal(nav.nextIndex(-1, 3, 1), 0);
assert.equal(nav.nextIndex(-1, 3, -1), 2);
assert.equal(nav.nextIndex(0, 3, 1), 1);
assert.equal(nav.nextIndex(2, 3, 1), 0);
assert.equal(nav.nextIndex(0, 3, -1), 2);
assert.equal(nav.nextIndex(0, 0, 1), -1);

const focused = [];
function makeRow(id, hidden = false, hasButton = true) {
  const button = hasButton ? { id, focus: () => focused.push(id) } : null;
  return {
    hidden,
    querySelector(selector) { return selector === '.conversation-open' ? button : null; }
  };
}
const list = {
  querySelectorAll(selector) {
    assert.equal(selector, '.conversation-row');
    return [makeRow('a'), makeRow('b', true), makeRow('c'), makeRow('d', false, false)];
  }
};
const targets = nav.visibleTargets(list);
assert.equal(targets.length, 2);
targets[0].focus();
targets[1].focus();
assert.deepEqual(focused, ['a', 'c']);

console.log('conversation search navigation helper tests passed');
