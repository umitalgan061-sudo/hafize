import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source=await readFile('public/connector-hub.js','utf8');
const nav=await readFile('public/workspace-navigation.js','utf8');

assert.match(source,/hafize:workspace-changed/);
assert.match(source,/event\?\.detail\?\.workspace === ['"]connections['"]/);
assert.match(source,/refreshStatus\(\)/);
assert.match(source,/getSnapshot/);
assert.match(nav,/connections:/);
assert.match(nav,/gmailConnectionCard/);

console.log('connector hub workspace event: passed');