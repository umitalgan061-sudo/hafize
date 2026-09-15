import assert from 'node:assert/strict';
import fs from 'node:fs';

const paths = [
  'public/prompt-library-workspaces.js',
  'public/prompt-library-collections.js',
  'public/prompt-library-revisions.js',
  'public/prompt-library-packs.js',
  'public/prompt-library-smart-insert.js',
  'public/prompt-library-workflows.js',
  'public/prompt-library-audit.js',
  'public/prompt-library-batch-editor.js',
  'public/prompt-library-import-review.js',
  'public/prompt-library-dashboard.js'
];

for (const path of paths) {
  const source = fs.readFileSync(path, 'utf8');
  assert.equal(source.includes('(function'), true, `${path}: IIFE boundary missing`);
  assert.equal(source.includes("'use strict'"), true, `${path}: strict mode missing`);
  assert.equal(source.includes('textContent'), true, `${path}: DOM text should use textContent`);
  assert.equal(source.includes('fetch('), false, `${path}: no direct fetch`);
  assert.equal(source.includes('XMLHttpRequest'), false, `${path}: no xhr`);
  assert.equal(source.includes('WebSocket'), false, `${path}: no websocket`);
  assert.equal(source.includes('localStorage'), true, `${path}: expected local persistence`);
}

console.log('prompt workspace source contracts: ok');
