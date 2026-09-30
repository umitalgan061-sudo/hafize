import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const smart = fs.readFileSync(path.join(process.cwd(), 'public/prompt-library-smart-fill.ts'), 'utf8');
const core = fs.readFileSync(path.join(process.cwd(), 'public/typed/prompt-library.ts'), 'utf8');
assert.match(smart, /hafize\.prompt-library\.smart-fill\.v1/);
assert.match(core, /hafize\.prompt-library\.v1/);
assert.doesNotMatch(smart, /hafize\.prompt-library\.v1'\s*=/);
// Bumping `useCount` is smart-fill's job, but it must go through the library
// API rather than writing the prompt store's key itself.
assert.match(smart, /api\.saveItems\(store, next\)/);
assert.doesNotMatch(smart, /setItem\('hafize\.prompt-library\.v1'/);
assert.doesNotMatch(smart, /exportPayload\(/);
assert.match(smart, /keyForPrompt\(promptId\)/);
assert.match(smart, /localStorage/);
console.log('prompt smart-fill storage isolation: ok');
