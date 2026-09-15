import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('public/local-data-center.js', 'utf8');
const context = { globalThis: null, TextEncoder, console };
context.globalThis = context;
vm.runInNewContext(source, context);
const api = context.HafizeLocalDataCenter;
const snapshot = api.inspect({ length: 0, getItem() { return null; } });
const manifest = JSON.parse(api.buildManifest(snapshot, ['hafize.unknown.v9']));
assert.equal(manifest.version, 1);
assert.equal(manifest.source, 'hafize-local-data-center');
assert.equal(Array.isArray(manifest.stores), true);
assert.equal(manifest.stores.every((item) => !Object.hasOwn(item, 'raw')), true);
assert.deepEqual(manifest.unmanagedHafizeKeys, ['hafize.unknown.v9']);
assert.equal(Object.hasOwn(manifest, 'messages'), false);
console.log('local data center manifest: ok');
