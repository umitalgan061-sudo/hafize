import assert from 'node:assert/strict';
import fs from 'node:fs';

const workspace = fs.readFileSync('public/prompt-library-workspaces.js', 'utf8');
const collections = fs.readFileSync('public/prompt-library-collections.js', 'utf8');
const revisions = fs.readFileSync('public/prompt-library-revisions.js', 'utf8');
const packs = fs.readFileSync('public/prompt-library-packs.js', 'utf8');

assert.match(workspace, /version: 1/);
assert.match(workspace, /activeId/);
assert.match(workspace, /selectedIds/);
assert.match(collections, /version: 1/);
assert.match(revisions, /version/);
assert.match(packs, /packVersion/);
assert.equal(packs.includes('normalizePack'), true);
assert.equal(packs.includes('mergePrompts'), true);
assert.equal(revisions.includes('capture'), true);
assert.equal(workspace.includes('saveCurrent'), true);
console.log('prompt workspace migration: ok');
