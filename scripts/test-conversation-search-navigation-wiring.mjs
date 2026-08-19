import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const shell = require('../public/ui-shell.js');
const sw = require('../public/sw-policy.js');

assert.equal(shell.CONVERSATION_SEARCH_SCRIPT, '/conversation-search.js');
assert.equal(shell.CONVERSATION_SEARCH_SNIPPETS_SCRIPT, '/conversation-search-snippets.js');
assert.equal(shell.CONVERSATION_SEARCH_NAVIGATION_SCRIPT, '/conversation-search-navigation.js');
assert.equal(sw.CURRENT_CACHE, 'hafize-shell-v103');
assert.equal(sw.SHELL_ASSETS.includes('/conversation-search.js'), true);
assert.equal(sw.SHELL_ASSETS.includes('/conversation-search-snippets.js'), true);
assert.equal(sw.SHELL_ASSETS.includes('/conversation-search-navigation.js'), true);

const appended = [];
const ids = new Set();
const head = { append(node) { appended.push(node); ids.add(node.id); } };
const documentRef = {
  head,
  createElement(tag) { return { tag, id: '', src: '', async: true }; },
  getElementById(id) { return ids.has(id) ? { id } : null; },
  querySelector(selector) { return selector === 'head' ? head : null; }
};

assert.equal(shell.installConversationSearch(documentRef), true);
assert.equal(shell.installConversationSearchSnippets(documentRef), true);
assert.equal(shell.installConversationSearchNavigation(documentRef), true);
assert.deepEqual(appended.map((node) => node.src), [
  '/conversation-search.js',
  '/conversation-search-snippets.js',
  '/conversation-search-navigation.js'
]);
assert.equal(appended.every((node) => node.async === false), true);

assert.equal(shell.installConversationSearch(documentRef), false);
assert.equal(shell.installConversationSearchSnippets(documentRef), false);
assert.equal(shell.installConversationSearchNavigation(documentRef), false);
assert.equal(appended.length, 3);

const apiRequest = { method: 'GET', url: 'https://hafize.test/api/chat', mode: 'cors', headers: { get: () => '' } };
assert.equal(sw.classifyRequest(apiRequest, 'https://hafize.test'), 'network-only');
const navAsset = { method: 'GET', url: 'https://hafize.test/conversation-search-navigation.js', mode: 'cors', headers: { get: () => '' } };
assert.equal(sw.classifyRequest(navAsset, 'https://hafize.test'), 'shell');

console.log('conversation search navigation wiring tests passed');
