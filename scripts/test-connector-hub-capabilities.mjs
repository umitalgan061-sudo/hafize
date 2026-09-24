import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source=await readFile('public/connector-hub.js','utf8');
assert.match(source,/CAPABILITIES/);
for (const capability of [
  'repository.read',
  'directory.read',
  'compare.read',
  'commit.read',
  'pull.read',
  'gmail.read',
  'profile.read',
  'asset.read',
  'design.meta.read',
  'design.content.read'
]) assert.match(source,new RegExp(capability.replaceAll('.','\\.')));

assert.match(source,/İzinli yetenekler/);
assert.match(source,/renderCapabilities/);
assert.match(source,/connector-hub-capability/);

console.log('connector hub capabilities: passed');