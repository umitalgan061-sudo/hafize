import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const source = fs.readFileSync(path.join(root, 'public/github-workspace-actions.ts'), 'utf8');

assert.match(source, /hafize\.github-workspace\.history\.v1/);
assert.match(source, /MAX_HISTORY = 6/);
assert.match(source, /sessionStorage/);
assert.match(source, /Görüneni kopyala/);
assert.match(source, /Yenile/);
assert.match(source, /PR durum filtresi/);
assert.match(source, /same-origin/);
assert.match(source, /cache: 'no-store'/);
assert.doesNotMatch(source, /localStorage\.setItem/);
console.log('github-workspace-actions: ok');
