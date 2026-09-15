import assert from 'node:assert/strict';
import fs from 'node:fs';

const usage = fs.readFileSync('public/prompt-library-usage.js', 'utf8');
const sw = fs.readFileSync('public/sw-policy.js', 'utf8');
const css = fs.readFileSync('public/prompt-workspace.css', 'utf8');

assert.equal(usage.includes('/prompt-library-workspaces.js'), true);
assert.equal(usage.includes('/prompt-library-collections.js'), true);
assert.equal(usage.includes('/prompt-library-packs.js'), true);
assert.equal(usage.includes('/prompt-library-workflows.js'), true);
assert.equal(usage.includes('/prompt-library-batch-editor.js'), true);
assert.equal(usage.includes('/prompt-library-import-review.js'), true);
assert.equal(usage.includes('/prompt-library-dashboard.js'), true);
assert.equal(usage.includes('/prompt-workspace.css'), true);
assert.equal(sw.includes("pathname.startsWith('/api/')"), true);
assert.equal(css.includes('forced-colors'), true);
console.log('prompt workspace PWA bootstrap: ok');
