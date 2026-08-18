import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const policy = require('../public/sw-policy.js');

assert.equal(policy.CURRENT_CACHE, 'hafize-shell-v97');
assert.equal(policy.SHELL_ASSETS.includes('/message-edit.js'), true, 'edit branch runtime must ship in offline shell');
assert.equal(policy.SHELL_ASSETS.includes('/response-retry.js'), true, 'retry branch runtime must ship in offline shell');
assert.equal(new Set(policy.SHELL_ASSETS).size, policy.SHELL_ASSETS.length, 'shell asset list must remain duplicate-free');

const origin = 'https://hafize.example';
const request = (path, init = {}) => ({
  url: `${origin}${path}`,
  method: init.method || 'GET',
  mode: init.mode || 'cors',
  headers: { get(name) { return init.headers?.[name.toLowerCase()] || ''; } }
});

assert.equal(policy.classifyRequest(request('/message-edit.js'), origin), 'shell');
assert.equal(policy.classifyRequest(request('/response-retry.js'), origin), 'shell');
assert.equal(policy.classifyRequest(request('/api/chat'), origin), 'network-only');
assert.equal(policy.classifyRequest(request('/api/agent/run'), origin), 'network-only');
assert.equal(policy.classifyRequest(request('/api/chat', { method: 'POST' }), origin), 'ignore');
assert.equal(policy.classifyRequest({ ...request('/message-edit.js'), url: 'https://evil.example/message-edit.js' }, origin), 'ignore');

const editSource = await readFile(new URL('../public/message-edit.js', import.meta.url), 'utf8');
const retrySource = await readFile(new URL('../public/response-retry.js', import.meta.url), 'utf8');
assert.equal(editSource.includes('requestSubmit'), false, 'edit branch must never submit automatically');
assert.equal(retrySource.includes('requestSubmit'), false, 'retry branch must never submit automatically');
assert.match(editSource, /DRAFT_HANDOFF_KEY/);
assert.match(retrySource, /getRenderedPairs/);

console.log('conversation branch PWA contract tests passed');
