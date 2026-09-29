import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const html=fs.readFileSync(path.join(process.cwd(),'public/index.html'),'utf8');
const shell=fs.readFileSync(path.join(process.cwd(),'public/typed/app-shell.ts'),'utf8');
assert.match(html,/type="module" src="\/typed-build\/app-shell\.js"/);
assert.match(shell,/from '\.\/model-preferences-ui\.ts'/);
assert.match(shell,/from '\.\/model-preferences\.ts'/);
assert.doesNotMatch(html,/typed\/model-preferences-ui\.ts/);
assert.doesNotMatch(html,/typed\/model-preferences\.ts/);
console.log('model preferences entrypoint ok');
