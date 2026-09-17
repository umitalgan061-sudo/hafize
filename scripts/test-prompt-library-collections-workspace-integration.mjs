import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync('public/index.html', 'utf8');
const workspace = fs.readFileSync('public/prompt-library-collections-workspace.js', 'utf8');
const collections = fs.readFileSync('public/prompt-library-collections.js', 'utf8');
const revisions = fs.readFileSync('public/prompt-library-revisions.js', 'utf8');

const coreIndex = index.indexOf('/prompt-library-collections.js');
const workspaceIndex = index.indexOf('/prompt-library-collections-workspace.js');
const revisionIndex = index.indexOf('/prompt-library-revisions.js');
assert.ok(coreIndex >= 0);
assert.ok(workspaceIndex > coreIndex);
assert.ok(revisionIndex > workspaceIndex);

assert.match(workspace, /documentRef\.getElementById\('promptLibraryCard'\)/);
assert.match(workspace, /documentRef\.getElementById\(LEGACY_ID\)\?\.remove\(\)/);
assert.match(workspace, /core\(\)\?\.readCollections/);
assert.match(workspace, /core\(\)\?\.saveCollections/);
assert.match(workspace, /core\(\)\?\.createCollection/);
assert.match(workspace, /core\(\)\?\.updateCollection/);
assert.match(workspace, /core\(\)\?\.removeMembers/);
assert.match(workspace, /core\(\)\?\.addMembers/);
assert.match(workspace, /hafize:prompt-library-collections-changed/);
assert.match(workspace, /hafize:prompt-library-collections-workspace-changed/);
assert.match(revisions, /hafize\.prompt-library\.revisions\.v1/);
assert.notEqual(workspace.match(/localStorage/g)?.length, 0);
assert.notEqual(collections.match(/hafize\.prompt-library\.collections\.v1/g)?.length, 0);

console.log('prompt collection workspace integration: ok');
