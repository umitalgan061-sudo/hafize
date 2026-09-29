import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const files=[
  'public/typed/model-preferences.ts',
  'public/typed/model-preferences-ui.ts'
];
for(const file of files){
  const source=fs.readFileSync(path.join(process.cwd(),file),'utf8');
  assert.doesNotMatch(source,/fetch\s*\(/);
  assert.doesNotMatch(source,/XMLHttpRequest/);
  assert.doesNotMatch(source,/WebSocket/);
}
console.log('model preferences no-network contract ok');
