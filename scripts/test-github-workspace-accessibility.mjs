import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const files = [
  'public/github-workspace.ts',
  'public/github-workspace-extra.ts',
  'public/github-workspace-actions.ts',
  'public/github-workspace-details.ts'
].map((name) => fs.readFileSync(path.join(root, name), 'utf8')).join('\n');

for (const value of ['aria-label', 'aria-live', 'aria-labelledby', 'textContent', 'replaceChildren']) assert.match(files, new RegExp(value));
assert.match(files, /noopener noreferrer/);
assert.doesNotMatch(files, /innerHTML/);
console.log('github-workspace-accessibility: ok');
