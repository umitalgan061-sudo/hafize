import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const state=fs.readFileSync(path.join(process.cwd(),'public/typed/model-preferences.ts'),'utf8');
const ui=fs.readFileSync(path.join(process.cwd(),'public/typed/model-preferences-ui.ts'),'utf8');
assert.match(state,/toolsEnabled: boolean/);
assert.match(state,/toolsEnabled: source\.toolsEnabled === true/);
assert.match(ui,/toolsEnabled: profile\.toolsEnabled/);
assert.match(ui,/Araçlar açık/);
assert.match(ui,/Araçlar kapalı/);
console.log('model preferences tool mode ok');
