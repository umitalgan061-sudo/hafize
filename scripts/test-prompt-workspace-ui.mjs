import assert from 'node:assert/strict';
import fs from 'node:fs';

const uiFiles = {
  workspaces: 'public/prompt-library-workspaces.js',
  collections: 'public/prompt-library-collections.js',
  packs: 'public/prompt-library-packs.js',
  workflows: 'public/prompt-library-workflows.js',
  batch: 'public/prompt-library-batch-editor.js',
  review: 'public/prompt-library-import-review.js',
  dashboard: 'public/prompt-library-dashboard.js',
  audit: 'public/prompt-library-audit.js'
};

for (const [name, path] of Object.entries(uiFiles)) {
  const source = fs.readFileSync(path, 'utf8');
  assert.equal(source.includes('role'), true, `${name}: accessibility role contract expected`);
  assert.equal(source.includes('aria-'), true, `${name}: aria contract expected`);
  assert.equal(source.includes('keydown'), true, `${name}: keyboard handling expected`);
  assert.equal(source.includes('Escape'), true, `${name}: escape handling expected`);
}

const css = fs.readFileSync('public/prompt-workspace.css', 'utf8');
assert.equal(css.includes('@media (max-width:700px)'), true);
assert.equal(css.includes('@media (forced-colors:active)'), true);
assert.equal(css.includes('prompt-workspace-toolbar'), true);
console.log('prompt workspace UI contracts: ok');
