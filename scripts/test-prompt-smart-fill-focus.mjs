import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const text = fs.readFileSync(path.join(process.cwd(), 'public/prompt-library-smart-fill.js'), 'utf8');
assert.match(text, /previousFocus = documentRef\.activeElement/);
assert.match(text, /previousFocus\?\.focus\?\.\(\)/);
assert.match(text, /previousFocus = null/);
assert.match(text, /dialog\.addEventListener\('keydown'/);
assert.match(text, /event\.key === 'Escape'/);
assert.match(text, /event\.key !== 'Tab'/);
assert.match(text, /focusables = \[/);

// Closing restores focus to whatever opened the dialog, except after an insert:
// there focus was just placed in the composer on purpose, and restoring it would
// pull the caret back out to the "Kullan" button.
assert.match(text, /function closeDialog\(\{ restoreFocus = true \} = \{\}\)/, 'closing can skip the focus restore');
assert.match(text, /if \(restoreFocus\) previousFocus\?\.focus\?\.\(\)/, 'the restore is conditional');
assert.match(text, /composer\.focus\(\);[\s\S]{0,120}closeDialog\(\{ restoreFocus: false \}\)/, 'the insert path keeps focus in the composer');

console.log('prompt smart-fill focus contract: ok');
