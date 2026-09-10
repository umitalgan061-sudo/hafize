import assert from 'node:assert/strict';
import { missingReleaseGates } from '../lib/release-manifest.mjs';
import { evaluateRuntimeReadiness, normalizeReadinessReport, updateReadinessComponent, RUNTIME_READINESS_COMPONENTS } from '../lib/runtime-readiness.mjs';

const report = normalizeReadinessReport({ auth: { status: 'ready' }, pwa: { status: 'ready' }, skills: { status: 'ready' }, memory: { status: 'ready' }, schedule: { status: 'warning', detail: 'retry backlog' }, connectors: { status: 'ready' }, model: { status: 'ready' } });
assert.equal(Object.keys(report).length, RUNTIME_READINESS_COMPONENTS.length);
assert.equal(report.schedule.status, 'warning');
// Per docs/RUNTIME_READINESS.md `ready` only tracks blockers and unknowns; a
// warning keeps the runtime running but marks it degraded, and the release gate
// is what refuses to ship a component that is not fully ready.
assert.equal(evaluateRuntimeReadiness(report).ready, true);
assert.equal(evaluateRuntimeReadiness(report).degraded, true);
assert.deepEqual(evaluateRuntimeReadiness(report).warnings, ['schedule']);
assert.deepEqual([...missingReleaseGates(evaluateRuntimeReadiness(report))], ['schedule']);

const blocked = updateReadinessComponent(report, 'auth', 'blocked', 'secret missing', '2026-09-07T12:00:00Z');
const evaluated = evaluateRuntimeReadiness(blocked);
assert.equal(evaluated.ready, false);
assert.equal(evaluated.degraded, false);
assert.deepEqual(evaluated.blocked, ['auth']);
assert.equal(evaluated.components.auth.detail, 'secret missing');

const unknown = evaluateRuntimeReadiness({});
assert.equal(unknown.ready, false);
assert.equal(unknown.unknown.length, RUNTIME_READINESS_COMPONENTS.length);
assert.equal(normalizeReadinessReport({ model: { status: 'nonsense' } }).model.status, 'unknown');
assert.throws(() => normalizeReadinessReport(null), /INVALID_RUNTIME_READINESS_REPORT/);
assert.throws(() => updateReadinessComponent(report, 'unknown', 'ready'), /UNKNOWN_RUNTIME_COMPONENT/);

console.log('runtime readiness tests passed');
