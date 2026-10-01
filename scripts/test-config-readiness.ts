import assert from 'node:assert/strict';
import { evaluateConfigReadiness, type ConfigEnv } from '../lib/config-readiness.ts';

const env=(values: Record<string,string>): ConfigEnv=>values;
const ready = evaluateConfigReadiness(env({ NODE_ENV: 'production', HOST: '127.0.0.1', HAFIZE_AUTH_TOKEN: 'x'.repeat(64), HAFIZE_COOKIE_SECURE: 'true' }));
assert.equal(ready.state, 'ready');
assert.equal(ready.production, true);
assert.equal(ready.publicRuntime, false);
assert.equal(ready.authRequired, true);
assert.equal(ready.findings.length, 0);

const blocked = evaluateConfigReadiness(env({ NODE_ENV: 'production', HOST: '0.0.0.0', HAFIZE_AUTH_TOKEN: 'short' }));
assert.equal(blocked.state, 'blocked');
assert.equal(blocked.publicRuntime, true);
assert.equal(blocked.findings[0]?.code, 'AUTH_SECRET_MISSING');

const explicitLocalAuth = evaluateConfigReadiness(env({ NODE_ENV: 'development', HOST: '127.0.0.1', HAFIZE_AUTH_REQUIRED: 'true' }));
assert.equal(explicitLocalAuth.state, 'blocked');
assert.equal(explicitLocalAuth.authRequired, true);

const degraded = evaluateConfigReadiness(env({ NODE_ENV: 'production', HOST: '127.0.0.1', HAFIZE_AUTH_TOKEN: 'x'.repeat(64), HAFIZE_TRUST_PROXY: 'true' }));
assert.equal(degraded.state, 'degraded');
assert.equal(degraded.findings.some((item) => item.code === 'PROXY_TRUST_UNDOCUMENTED'), true);

const invalid = evaluateConfigReadiness(env({ HAFIZE_AUTH_REQUIRED: 'maybe' }));
assert.equal(invalid.findings.some((item) => item.code === 'INVALID_BOOLEAN'), true);

const newline = evaluateConfigReadiness(env({ NVIDIA_API_KEY: 'abc\ndef' }));
assert.equal(newline.findings.some((item) => item.code === 'SECRET_CONTAINS_NEWLINE'), true);
assert.equal(JSON.stringify(ready).includes('x'.repeat(64)), false);
assert.ok(Object.isFrozen(ready));
console.log('config readiness TypeScript tests passed');
