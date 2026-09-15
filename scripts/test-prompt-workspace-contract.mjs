import assert from 'node:assert/strict';
import fs from 'node:fs';

const files = {
  workspace: 'public/prompt-library-workspaces.js',
  collections: 'public/prompt-library-collections.js',
  revisions: 'public/prompt-library-revisions.js',
  packs: 'public/prompt-library-packs.js',
  workflows: 'public/prompt-library-workflows.js',
  insert: 'public/prompt-library-smart-insert.js',
  batch: 'public/prompt-library-batch-editor.js',
  review: 'public/prompt-library-import-review.js',
  audit: 'public/prompt-library-audit.js',
  dashboard: 'public/prompt-library-dashboard.js'
};

for (const [name, path] of Object.entries(files)) {
  assert.equal(fs.existsSync(path), true, `${name} module missing`);
  const source = fs.readFileSync(path, 'utf8');
  assert.equal(source.includes("'use strict'"), true, `${name} should be strict`);
  assert.equal(source.includes('localStorage'), true, `${name} should remain local`);
  assert.equal(/https?:\/\//.test(source), false, `${name} must not embed remote URLs`);
}

console.log('prompt workspace contract: ok');
