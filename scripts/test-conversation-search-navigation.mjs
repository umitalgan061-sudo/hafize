import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const nav = require('../public/conversation-search-navigation.js');

assert.equal(nav.INPUT_ID, 'conversationSearchInput');
assert.equal(nav.CONTROL_ID, 'conversationSearchControl');
assert.equal(nav.LIST_ID, 'conversationList');
assert.equal(nav.NAV_ID, 'conversationSearchNavigation');
assert.equal(nav.STATUS_ID, 'conversationSearchNavigationStatus');
assert.equal(nav.STYLE_ID, 'hafize-conversation-search-navigation-style');
assert.equal(typeof nav.createController, 'function');
assert.equal(typeof nav.createOwnedStyle, 'function');
assert.equal(typeof nav.createOwnedNavigation, 'function');

assert.equal(nav.hasQuery({ value: '  hedef  ' }), true);
assert.equal(nav.hasQuery({ value: '\n\thedef\t' }), true);
assert.equal(nav.hasQuery({ value: '   ' }), false);
assert.equal(nav.hasQuery({ value: '' }), false);
assert.equal(nav.hasQuery({ value: 42 }), false);
assert.equal(nav.hasQuery(null), false);

assert.equal(nav.nextIndex(-1, 3, 1), 0);
assert.equal(nav.nextIndex(-1, 3, -1), 2);
assert.equal(nav.nextIndex(0, 3, 1), 1);
assert.equal(nav.nextIndex(2, 3, 1), 0);
assert.equal(nav.nextIndex(0, 3, -1), 2);
assert.equal(nav.nextIndex(0, 0, 1), -1);
assert.equal(nav.nextIndex(0, -1, 1), -1);
assert.equal(nav.nextIndex(0, 1.5, 1), -1);
assert.equal(nav.nextIndex(99, 3, 1), 0);
assert.equal(nav.nextIndex(99, 3, -1), 2);

const focused = [];
function makeRow(id, hidden = false, hasButton = true) {
  const button = hasButton ? { id, focus: () => focused.push(id) } : null;
  return {
    hidden,
    querySelector(selector) { return selector === '.conversation-open' ? button : null; }
  };
}
const rows = [makeRow('a'), makeRow('b', true), makeRow('c'), makeRow('d', false, false)];
const list = {
  querySelectorAll(selector) {
    assert.equal(selector, '.conversation-row');
    return rows;
  }
};
const targets = nav.visibleTargets(list);
assert.equal(targets.length, 2);
assert.deepEqual(targets.map((target) => target.id), ['a', 'c']);
targets[0].focus();
targets[1].focus();
assert.deepEqual(focused, ['a', 'c']);
assert.deepEqual(nav.visibleTargets(null), []);

const input = { value: 'query' };
const navSurface = {
  contains(target) { return target?.area === 'navigation'; }
};
assert.equal(nav.isKeyboardNavigationTarget(input, input, navSurface, list), true);
assert.equal(nav.isKeyboardNavigationTarget({ area: 'navigation' }, input, navSurface, list), true);
assert.equal(nav.isKeyboardNavigationTarget(targets[0], input, navSurface, list), true);
assert.equal(nav.isKeyboardNavigationTarget(rows[1].querySelector('.conversation-open'), input, navSurface, list), false,
  'hidden conversation target is not keyboard navigable');
assert.equal(nav.isKeyboardNavigationTarget({ area: 'outside' }, input, navSurface, list), false);
assert.equal(nav.isKeyboardNavigationTarget(null, input, navSurface, list), false);

const hostStyle = { id: nav.STYLE_ID };
const styleDocument = {
  head: { append() { throw new Error('must not append when style already exists'); } },
  getElementById(id) { return id === nav.STYLE_ID ? hostStyle : null; },
  createElement() { throw new Error('must not create when style already exists'); }
};
assert.equal(nav.createOwnedStyle(styleDocument), null, 'pre-existing style remains host-owned');
assert.equal(nav.createOwnedStyle(null), null);

const foreignNavigation = { id: nav.NAV_ID };
const navigationDocument = {
  getElementById(id) { return id === nav.NAV_ID ? foreignNavigation : null; },
  createElement() { throw new Error('foreign navigation must not be replaced'); }
};
assert.equal(nav.createOwnedNavigation(navigationDocument, { append() {} }), null,
  'pre-existing navigation surface is never adopted or replaced');
assert.equal(nav.createOwnedNavigation(null, null), null);

console.log('conversation search navigation helper tests passed');
