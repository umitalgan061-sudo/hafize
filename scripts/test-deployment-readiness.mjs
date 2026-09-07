import assert from 'node:assert/strict';
import { assertDeploymentReleaseable, evaluateDeploymentReadiness, summarizeDeploymentReadiness } from '../lib/deployment-readiness.mjs';

const ready = evaluateDeploymentReadiness({ runtime: { state: 'ready' }, config: { state: 'ready' }, release: { state: 'ready' } });
assert.equal(ready.state, 'ready');
assert.equal(ready.releaseable, true);
assert.equal(ready.blockerCount, 0);
assert.equal(ready.degradedCount, 0);
assert.equal(ready.unknownCount, 0);
assert.equal(summarizeDeploymentReadiness(ready), 'runtime:ready,config:ready,release:ready');
assert.equal(assertDeploymentReleaseable(ready), ready);

const degraded = evaluateDeploymentReadiness({
  runtime: { state: 'ready' },
  config: { state: 'degraded', findings: [{ code: 'PROXY_TRUST_UNDOCUMENTED', detail: 'document proxy' }] },
  release: { state: 'ready' }
});
assert.equal(degraded.state, 'degraded');
assert.equal(degraded.releaseable, false);
assert.equal(degraded.degradedCount, 1);
assert.throws(() => assertDeploymentReleaseable(degraded), /DEPLOYMENT_NOT_RELEASEABLE/);

const blocked = evaluateDeploymentReadiness({
  runtime: { state: 'blocked', findings: [{ code: 'AUTH_REQUIRED' }] },
  config: { state: 'ready' },
  release: { state: 'ready' }
});
assert.equal(blocked.state, 'blocked');
assert.equal(blocked.blockerCount, 1);
assert.equal(blocked.releaseable, false);

const unknown = evaluateDeploymentReadiness({ runtime: { state: 'unknown' }, config: { state: 'ready' }, release: { state: 'ready' } });
assert.equal(unknown.state, 'unknown');
assert.equal(unknown.unknownCount, 1);
assert.equal(unknown.releaseable, false);

const invalid = evaluateDeploymentReadiness({ runtime: { state: 'ready' }, config: { state: 'impossible' }, release: { state: 'ready' } });
assert.equal(invalid.state, 'unknown');
assert.equal(invalid.components[1].state, 'unknown');
assert.equal(invalid.components[1].findings[0].code, 'INVALID_COMPONENT_STATE');

assert.throws(() => evaluateDeploymentReadiness({ requiredComponents: [] }), /INVALID_DEPLOYMENT_REQUIRED_COMPONENTS/);
assert.throws(() => evaluateDeploymentReadiness({ requiredComponents: ['runtime', 'runtime'], runtime: { state: 'ready' } }), /DUPLICATE_DEPLOYMENT_COMPONENT/);
assert.throws(() => evaluateDeploymentReadiness({ requiredComponents: [''] }), /INVALID_DEPLOYMENT_COMPONENT_NAME/);

const bounded = evaluateDeploymentReadiness({ runtime: { state: 'blocked', findings: [{ code: 'X', detail: 'a'.repeat(500) }] }, config: { state: 'ready' }, release: { state: 'ready' } });
assert.equal(bounded.components[0].findings[0].detail.length, 160);
assert.equal(JSON.stringify(blocked).includes('token'), false);

console.log('deployment readiness tests passed');
