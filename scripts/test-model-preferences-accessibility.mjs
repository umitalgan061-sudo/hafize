import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const source = fs.readFileSync(path.join(root, 'public/typed/model-preferences-ui.ts'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public/model-preferences.css'), 'utf8');

assert.match(source, /role', 'dialog'/);
assert.match(source, /aria-modal', 'false'/);
assert.match(source, /aria-labelledby/);
assert.match(source, /aria-controls/);
assert.match(source, /aria-expanded/);
assert.match(source, /Escape/);
assert.match(source, /event\.key === 'Tab'/);
assert.match(source, /shiftKey/);
assert.match(source, /dialog\.close\.focus\(\)/);
assert.match(source, /previousTrigger\?\.focus\(\)/);
assert.match(css, /:focus-visible/);
assert.match(css, /prefers-reduced-motion/);
assert.match(css, /forced-colors/);
console.log('model preferences accessibility contract ok');
