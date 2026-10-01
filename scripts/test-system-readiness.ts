import assert from 'node:assert/strict';
import { buildSystemReadiness } from '../lib/system-readiness.ts';

const ready = buildSystemReadiness({
  env: { HOST: '127.0.0.1', NODE_ENV: 'development' },
  pwaReady: true,
  releaseReady: true,
  releaseChecksPass: true,
  runtime: {
    auth: { status: 'ready' }, pwa: { status: 'ready' }, skills: { status: 'ready' },
    memory: { status: 'warning' }, schedule: { status: 'ready' }, connectors: { status: 'ready' }, model: { status: 'ready' }
  }
});
assert.equal(ready.state, 'degraded');
assert.equal(ready.releaseable, false);
assert.equal(ready.components.pwa, 'ready');
assert.equal(ready.components.memory, 'warning');
assert.equal(ready.summary.total, 8);
assert.equal(ready.summary.warning, 1);
assert.equal(ready.deployment.state, 'degraded');

const blocked = buildSystemReadiness({
  env: { HOST: '0.0.0.0', NODE_ENV: 'production' },
  pwaReady: true,
  releaseReady: true,
  runtime: {
    auth: { status: 'ready' }, pwa: { status: 'ready' }, skills: { status: 'ready' },
    memory: { status: 'ready' }, schedule: { status: 'ready' }, connectors: { status: 'ready' }, model: { status: 'blocked' }
  }
});
assert.equal(blocked.state, 'blocked');
assert.equal(blocked.components.auth, 'blocked');
assert.equal(blocked.components.model, 'blocked');
assert.ok(blocked.summary.blocked >= 1);

assert.equal(JSON.stringify(ready).includes('password'), false);
assert.equal(JSON.stringify(ready).includes('token'), false);
console.log('system readiness TypeScript tests passed');
