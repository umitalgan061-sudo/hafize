import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ui=fs.readFileSync(path.join(process.cwd(),'public/typed/model-preferences-ui.ts'),'utf8');
assert.doesNotMatch(ui,/requestSubmit\(/);
assert.doesNotMatch(ui,/submit\(/);
assert.match(ui,/options\.apply\(/);
assert.match(ui,/saveModelPreferences\(/);
console.log('model preferences submit boundary ok');
