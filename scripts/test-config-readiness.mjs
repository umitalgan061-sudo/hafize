import assert from 'node:assert/strict';
import { evaluateConfigReadiness } from '../lib/config-readiness.mjs';

const ready = evaluateConfigReadiness({ NODE_ENV: 'production', HOST: '127.0.0.1', HAFIZE_AUTH_TOKEN: 'x'.repeat(64), HAFIZE_COOKIE_SECURE: 'true' });
assert.equal(ready.state, 'ready');
assert.equal(ready.production, true);
assert.equal(ready.publicRuntime, false);
assert.equal(ready.authRequired, true);
assert.equal(ready.findings.length, 0);

const blocked = evaluateConfigReadiness({ NODE_ENV: 'production', HOST: '0.0.0.0', HAFIZE_AUTH_TOKEN: 'short' });
assert.equal(blocked.state, 'blocked');
assert.equal(blocked.publicRuntime, true);
assert.equal(blocked.authRequired, true);
assert.equal(blocked.findings[0].code, 'AUTH_SECRET_MISSING');

const publicDevelopment = evaluateConfigReadiness({ NODE_ENV: 'development', HOST: '0.0.0.0' });
assert.equal(publicDevelopment.production, false);
assert.equal(publicDevelopment.publicRuntime, true);
assert.equal(publicDevelopment.authRequired, true);
assert.equal(publicDevelopment.state, 'blocked');
assert.equal(publicDevelopment.findings[0].code, 'AUTH_SECRET_MISSING');

const explicitLocalAuth = evaluateConfigReadiness({ NODE_ENV: 'development', HOST: '127.0.0.1', HAFIZE_AUTH_REQUIRED: 'true' });
assert.equal(explicitLocalAuth.authRequired, true);
assert.equal(explicitLocalAuth.state, 'blocked');
assert.equal(explicitLocalAuth.findings[0].code, 'AUTH_SECRET_MISSING');

const degraded = evaluateConfigReadiness({ NODE_ENV: 'production', HOST: '127.0.0.1', HAFIZE_AUTH_TOKEN: 'x'.repeat(64), HAFIZE_TRUST_PROXY: 'true' });
assert.equal(degraded.state, 'degraded');
assert.equal(degraded.findings.some((item) => item.code === 'PROXY_TRUST_UNDOCUMENTED'), true);

const invalid = evaluateConfigReadiness({ HAFIZE_AUTH_REQUIRED: 'maybe' });
assert.equal(invalid.findings.some((item) => item.code === 'INVALID_BOOLEAN'), true);

const newline = evaluateConfigReadiness({ NVIDIA_API_KEY: 'abc\ndef' });
assert.equal(newline.findings.some((item) => item.code === 'SECRET_CONTAINS_NEWLINE'), true);

assert.equal(Object.isFrozen(ready) && Object.isFrozen(ready.findings) && Object.isFrozen(ready.secretVariables), true);
assert.equal(JSON.stringify(ready).includes('x'.repeat(64)), false);

console.log('config readiness tests passed');
