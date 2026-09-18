import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const index = fs.readFileSync(path.join(process.cwd(), 'public/index.html'), 'utf8');
const sw = fs.readFileSync(path.join(process.cwd(), 'public/sw-policy.js'), 'utf8');
for (const asset of ['prompt-library-smart-fill.css','prompt-library-smart-fill.js','prompt-library-command-palette.css','prompt-library-command-palette.js']) {
  assert.match(index, new RegExp(asset.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')));
  assert.match(sw, new RegExp(asset.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')));
}
for (const asset of ['prompt-library-fill.css','prompt-library-fill.js','prompt-library-fill-presets.js','prompt-library-fill-keyboard.js','prompt-library-fill-backup.js']) {
  assert.match(sw, new RegExp(asset.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')));
}
assert.match(sw, /CURRENT_CACHE.*v37/);
assert.match(sw, /pathname\.startsWith\('\/api\/'\)/);
console.log('prompt smart-fill PWA wiring: ok');
