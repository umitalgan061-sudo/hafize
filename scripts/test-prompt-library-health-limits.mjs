import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(path.join(root, 'public', 'prompt-library-health.js'), 'utf8');

assert.match(source, /MAX_PROMPTS\s*=\s*120/);
assert.match(source, /MAX_COLLECTIONS\s*=\s*40/);
assert.match(source, /MAX_REVISIONS\s*=\s*600/);
assert.match(source, /MAX_ISSUES\s*=\s*240/);
assert.match(source, /LONG_BODY\s*=\s*7000/);
assert.match(source, /STALE_DAYS\s*=\s*180/);
assert.match(source, /slice\(0, MAX_PROMPTS \* 2\)/);
assert.match(source, /slice\(0, MAX_COLLECTIONS \* 2\)/);
assert.match(source, /slice\(0, MAX_REVISIONS \* 2\)/);
assert.match(source, /issues\.slice\(0, MAX_ISSUES\)/);
assert.match(source, /slice\(0, 80\)/);
assert.match(source, /MAX_REPORT/);
console.log('prompt library health limits: ok');
