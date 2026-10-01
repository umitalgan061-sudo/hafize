import assert from 'node:assert/strict';
import { assertDeploymentReleaseable, evaluateDeploymentReadiness, summarizeDeploymentReadiness } from '../lib/deployment-readiness.ts';

const ready = evaluateDeploymentReadiness({ runtime: { state: 'ready' }, config: { state: 'ready' }, release: { state: 'ready' } });
assert.equal(ready.state, 'ready');
assert.equal(ready.releaseable, true);
assert.equal(summarizeDeploymentReadiness(ready), 'runtime:ready,config:ready,release:ready');
assert.equal(assertDeploymentReleaseable(ready), ready);

const degraded = evaluateDeploymentReadiness({
  runtime: { state: 'ready' },
  config: { state: 'degraded', findings: [{ code: 'PROXY_TRUST_UNDOCUMENTED', detail: 'document proxy' }] },
  release: { state: 'ready' }
});
assert.equal(degraded.state, 'degraded');
assert.throws(() => assertDeploymentReleaseable(degraded), /DEPLOYMENT_NOT_RELEASEABLE/);

const blocked = evaluateDeploymentReadiness({
  runtime: { state: 'blocked', findings: [{ code: 'AUTH_REQUIRED' }] },
  config: { state: 'ready' },
  release: { state: 'ready' }
});
assert.equal(blocked.state, 'blocked');
assert.equal(blocked.blockerCount, 1);

const unknown = evaluateDeploymentReadiness({ runtime: { state: 'unknown' }, config: { state: 'ready' }, release: { state: 'ready' } });
assert.equal(unknown.state, 'unknown');
assert.equal(unknown.releaseable, false);

assert.throws(() => evaluateDeploymentReadiness({ requiredComponents: [] }), /INVALID_DEPLOYMENT_REQUIRED_COMPONENTS/);
assert.throws(() => evaluateDeploymentReadiness({ requiredComponents: ['runtime', 'runtime'] }), /DUPLICATE_DEPLOYMENT_COMPONENT/);
assert.throws(() => evaluateDeploymentReadiness({ requiredComponents: [''] }), /INVALID_DEPLOYMENT_COMPONENT_NAME/);
console.log('deployment readiness TypeScript tests passed');
