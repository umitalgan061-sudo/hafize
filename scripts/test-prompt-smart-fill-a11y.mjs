import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const text = fs.readFileSync(path.join(process.cwd(), 'public/prompt-library-smart-fill.js'), 'utf8');

for (const value of ['role', 'aria-modal', 'aria-labelledby', 'aria-describedby', 'aria-live', 'aria-label', 'Escape', 'Tab']) {
  assert.match(text, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}
assert.match(text, /setAttribute\('aria-modal'/);
assert.match(text, /setAttribute\('aria-live'/);
assert.match(text, /dialog\.addEventListener\('keydown'/);
assert.match(text, /if \(event\.key === 'Escape'\)/);
assert.match(text, /event\.key !== 'Tab'/);
assert.match(text, /focus\(\)/);
assert.match(text, /previousFocus/);
console.log('prompt smart-fill accessibility contracts: ok');
