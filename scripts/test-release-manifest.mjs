import assert from 'node:assert/strict';
import { createReleaseManifest, missingReleaseGates, RELEASE_MANIFEST_GATES } from '../lib/release-manifest.mjs';

const readiness = {
  ready: true,
  blocked: [],
  warnings: [],
  components: Object.fromEntries(RELEASE_MANIFEST_GATES.map((gate) => [gate, { status: 'ready' }]))
};
const manifest = createReleaseManifest({
  version: '1.0.0',
  commit: 'abc123',
  readiness,
  checks: [{ name: 'unit', pass: true }, { name: 'security', pass: true }]
});
assert.equal(manifest.releaseable, true);
assert.equal(manifest.version, '1.0.0');
assert.deepEqual(missingReleaseGates(readiness), []);
const partial = { ...readiness, components: { ...readiness.components, pwa: { status: 'warning' } } };
assert.deepEqual(missingReleaseGates(partial), ['pwa']);
assert.throws(() => createReleaseManifest({ version: '1', commit: 'abc', readiness: { ready: false } }), /RELEASE_READINESS_BLOCKED/);
assert.throws(() => createReleaseManifest({ version: '', commit: 'abc', readiness }), /INVALID_RELEASE_VERSION/);
assert.equal(createReleaseManifest({ version: '1', commit: 'abc', readiness, checks: [{ name: 'security', pass: false }] }).releaseable, false);

console.log('release manifest tests passed');
