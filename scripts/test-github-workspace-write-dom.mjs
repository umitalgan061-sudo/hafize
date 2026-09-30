import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(process.cwd());
const ui=fs.readFileSync(path.join(root,'public/github-workspace-write.ts'),'utf8');

assert.match(ui,/createElement/);
assert.match(ui,/textContent/);
assert.doesNotMatch(ui,/innerHTML/);
assert.match(ui,/setAttribute\('aria-labelledby'/);
assert.match(ui,/role/);
assert.match(ui,/noopener noreferrer/);
assert.match(ui,/^((?!outerHTML).)*$/ms);
console.log('github-workspace-write-dom: ok');
