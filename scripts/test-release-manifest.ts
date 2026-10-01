import assert from 'node:assert/strict';
import { createReleaseManifest, missingReleaseGates, RELEASE_MANIFEST_GATES } from '../lib/release-manifest.ts';

const readiness = { ready: true, blocked: [], warnings: [], components: Object.fromEntries(RELEASE_MANIFEST_GATES.map((gate) => [gate, { status: 'ready' }])) };
const manifest = createReleaseManifest({
  version: '0.1.0', commit: 'abc123', readiness,
  checks: [{ name: 'typecheck', pass: true }, { name: 'migration-gate', pass: true }]
});
assert.equal(manifest.releaseable, true);
assert.equal(manifest.requiredGates.length, RELEASE_MANIFEST_GATES.length);
assert.equal(missingReleaseGates(readiness).length, 0);

const failed = createReleaseManifest({
  version: '0.1.0', commit: 'abc123', readiness,
  checks: [{ name: 'typecheck', pass: true }, { name: 'smoke', pass: false }]
});
assert.equal(failed.releaseable, false);
assert.throws(() => createReleaseManifest({ version: '', commit: 'abc', readiness }), /INVALID_RELEASE_VERSION/);
assert.throws(() => createReleaseManifest({ version: '0.1', commit: '', readiness }), /INVALID_RELEASE_COMMIT/);
assert.throws(() => createReleaseManifest({ version: '0.1', commit: 'abc', readiness: { ready: false } }), /RELEASE_READINESS_BLOCKED/);
assert.equal(missingReleaseGates({ ready: true, components: { auth: { status: 'blocked' } }}).includes('auth'), true);
console.log('release manifest TypeScript tests passed');
