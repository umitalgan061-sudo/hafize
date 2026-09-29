import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'public/model-preferences.css'),'utf8');
assert.match(html,/id="modelSelect"/);
assert.match(html,/id="agentSelect"/);
assert.match(html,/id="toolModeBtn"/);
assert.match(html,/model-preferences\.css/);
assert.match(css,/model-preferences-panel/);
assert.match(css,/max-width/);
assert.match(css,/max-height/);
assert.match(css,/prefers-reduced-motion/);
assert.match(css,/forced-colors/);
console.log('model preferences browser contract ok');
