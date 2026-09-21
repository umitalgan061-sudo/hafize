import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const ui = fs.readFileSync(path.join(root, 'public/github-workspace.ts'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public/github-workspace.css'), 'utf8');

for (const label of ['GitHub çalışma alanı', 'Repo', 'Branch', 'Commit', 'PR', 'Dosya', 'Yükle']) assert.match(ui, new RegExp(label));
for (const attr of ['aria-labelledby', 'aria-live', 'aria-pressed', 'noopener noreferrer']) assert.match(ui, new RegExp(attr));
assert.match(ui, /replaceChildren/);
assert.match(ui, /textContent/);
assert.doesNotMatch(ui, /innerHTML/);
assert.match(ui, /Ctrl\/⌘/);
assert.match(css, /max-width:700px/);
assert.match(css, /forced-colors/);
console.log('github-workspace-ui: ok');
