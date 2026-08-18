import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const guard = require('../public/conversation-storage-guard.js');

class StorageMock {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(String(key), String(value)); }
}

const local = new StorageMock();
const session = new StorageMock();
Object.preventExtensions(local);

const boundary = guard.installWriteBoundary(local);
assert.ok(boundary);
assert.equal(boundary.mode, 'prototype');

local.setItem(guard.STORAGE_KEY, '{bad json');
assert.equal(local.getItem(guard.STORAGE_KEY), '[]');

session.setItem(guard.STORAGE_KEY, '{bad json');
assert.equal(session.getItem(guard.STORAGE_KEY), '{bad json', 'prototype fallback must not alter other Storage instances');

session.setItem('other', 'session-value');
local.setItem('other', 'local-value');
assert.equal(session.getItem('other'), 'session-value');
assert.equal(local.getItem('other'), 'local-value');

assert.equal(guard.installWriteBoundary(local), boundary, 'fallback installation remains idempotent');

console.log('conversation storage prototype fallback: ok');
