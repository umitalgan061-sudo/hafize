import assert from 'node:assert/strict';
import fs from 'node:fs';

const paths = [
  'public/prompt-library-workspaces.js',
  'public/prompt-library-collections.js',
  'public/prompt-library-packs.js',
  'public/prompt-library-revisions.js',
  'public/prompt-library-smart-insert.js',
  'public/prompt-library-workflows.js',
  'public/prompt-library-batch-editor.js',
  'public/prompt-library-import-review.js',
  'public/prompt-library-audit.js'
];

for (const path of paths) {
  const source = fs.readFileSync(path, 'utf8');
  assert.equal(source.includes('innerHTML'), false, `${path}: raw HTML injection is forbidden`);
  assert.equal(source.includes('outerHTML'), false, `${path}: outerHTML is forbidden`);
  assert.equal(/fetch\s*\(/.test(source), false, `${path}: network fetch is forbidden`);
  assert.equal(source.includes('localStorage'), true, `${path}: local persistence expected`);
}

const insert = fs.readFileSync('public/prompt-library-smart-insert.js', 'utf8');
assert.equal(insert.includes('.submit('), false);
assert.equal(insert.includes('click()'), false);

console.log('prompt workspace security: ok');
