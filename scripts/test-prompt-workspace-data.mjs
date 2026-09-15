import assert from 'node:assert/strict';
import fs from 'node:fs';

const workspace = fs.readFileSync('public/prompt-library-workspaces.js', 'utf8');
const collections = fs.readFileSync('public/prompt-library-collections.js', 'utf8');
const revisions = fs.readFileSync('public/prompt-library-revisions.js', 'utf8');
const workflows = fs.readFileSync('public/prompt-library-workflows.js', 'utf8');
const packs = fs.readFileSync('public/prompt-library-packs.js', 'utf8');

assert.match(workspace, /MAX_WORKSPACES\s*=\s*16/);
assert.match(workspace, /MAX_SELECTED\s*=\s*40/);
assert.match(workspace, /MAX_NAME\s*=\s*56/);
assert.match(collections, /MAX_COLLECTIONS\s*=\s*24/);
assert.match(collections, /MAX_ASSIGNMENTS\s*=\s*120/);
assert.match(collections, /MAX_SELECTION\s*=\s*40/);
assert.match(revisions, /MAX_PER_PROMPT\s*=\s*8/);
assert.match(revisions, /MAX_REVISIONS\s*=\s*240/);
assert.match(workflows, /MAX_WORKFLOWS\s*=\s*24/);
assert.match(workflows, /MAX_STEPS\s*=\s*8/);
assert.match(packs, /MAX_BYTES\s*=\s*1_500_000/);
assert.match(packs, /MAX_ITEMS\s*=\s*120/);
console.log('prompt workspace data bounds: ok');
