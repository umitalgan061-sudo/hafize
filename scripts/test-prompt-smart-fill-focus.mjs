import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const text = fs.readFileSync(path.join(process.cwd(), 'public/prompt-library-smart-fill.ts'), 'utf8');
assert.match(text, /lastFocus = documentRef\.activeElement/);
// Typed migration replaced the optional-call chain with an instance check
// before focusing; the restore itself is unchanged.
assert.match(text, /lastFocus instanceof HTMLElement\) lastFocus\.focus\(\)/);
assert.match(text, /lastFocus = null/);
assert.match(text, /dialog\.addEventListener\('keydown'/);
assert.match(text, /event\.key === 'Escape'/);
assert.match(text, /event\.key !== 'Tab'/);
assert.match(text, /focusables = \[/);
console.log('prompt smart-fill focus contract: ok');
