import assert from 'node:assert/strict';
import fs from 'node:fs';

const files = [
  'public/prompt-library-workspaces.js',
  'public/prompt-library-collections.js',
  'public/prompt-library-revisions.js',
  'public/prompt-library-packs.js',
  'public/prompt-library-smart-insert.js',
  'public/prompt-library-workflows.js',
  'public/prompt-library-batch-editor.js',
  'public/prompt-library-import-review.js',
  'public/prompt-library-audit.js',
  'public/prompt-library-dashboard.js',
  'public/prompt-library-templates.js',
  'public/prompt-library-workspace-diff.js'
];

for (const path of files) assert.equal(fs.existsSync(path), true, `${path} must exist`);
const combined = files.map((path) => fs.readFileSync(path, 'utf8')).join('\n');
assert.equal(combined.includes('localStorage'), true);
assert.equal(combined.includes('textContent'), true);
assert.equal(combined.includes('aria-label'), true);
assert.equal(/fetch\s*\(/.test(combined), false);
assert.equal(/XMLHttpRequest/.test(combined), false);
assert.equal(/WebSocket/.test(combined), false);
assert.equal(combined.includes('submit()'), false);
console.log('prompt workspace acceptance gate: ok');
