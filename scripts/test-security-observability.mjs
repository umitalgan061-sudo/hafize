import assert from 'node:assert/strict';
import { createSecurityEventLogger, SECURITY_OBSERVABILITY_LIMITS } from '../lib/security-observability.mjs';

const events = [];
const logger = createSecurityEventLogger({ sink: (line) => events.push(line), now: () => Date.parse('2026-09-07T12:00:00.000Z') });
const result = logger.record({
  event: 'auth.denied',
  route: '/api/agent/run',
  method: 'post',
  outcome: 'blocked',
  metadata: {
    provider: 'session',
    authToken: 'secret-value',
    Authorization: 'Bearer hidden',
    visible: 'kept',
    count: 3,
    ok: true,
    dropped: null
  }
});

assert.equal(result.event, 'auth.denied');
assert.equal(result.method, 'POST');
assert.equal(result.timestamp, '2026-09-07T12:00:00.000Z');
assert.match(result.requestId, /^[0-9a-f-]{36}$/);
assert.equal(result.metadata.visible, 'kept');
assert.equal(result.metadata.count, 3);
assert.equal(result.metadata.ok, true);
assert.equal('authToken' in result.metadata, false);
assert.equal('Authorization' in result.metadata, false);
assert.equal(events.length, 1);
assert.equal(events[0].includes('secret-value'), false);
assert.equal(events[0].includes('Bearer hidden'), false);
assert.equal(events[0].includes('visible'), true);

const supplied = logger.record({
  event: 'request.finished',
  requestId: ' client-request-1 ',
  route: '/api/chat?token=should-not-be-parsed',
  method: 'get',
  outcome: 'success'
});
assert.equal(supplied.requestId, 'client-request-1');
assert.equal(supplied.route, '/api/chat?token=should-not-be-parsed');

const principalA = logger.classifyPrincipal('primary-user');
const principalB = logger.classifyPrincipal('primary-user');
const principalC = logger.classifyPrincipal('other-user');
assert.match(principalA, /^[0-9a-f]{16}$/);
assert.equal(principalA, principalB);
assert.notEqual(principalA, principalC);
assert.equal(logger.classifyPrincipal(''), '');

assert.throws(() => logger.record({ event: 'INVALID EVENT!' }), /INVALID_SECURITY_EVENT_TYPE/);
assert.throws(() => createSecurityEventLogger({ sink: null }), /INVALID_SECURITY_EVENT_SINK/);
assert.throws(() => createSecurityEventLogger({ now: null }), /INVALID_SECURITY_EVENT_CLOCK/);

const empty = logger.record({ event: 'auth.allowed', metadata: null });
assert.equal(empty.metadata && Object.keys(empty.metadata).length, 0);
assert.ok(Object.isFrozen(result));
assert.ok(Object.isFrozen(result.metadata));
assert.equal(SECURITY_OBSERVABILITY_LIMITS.fingerprintLength, 16);
assert.ok(SECURITY_OBSERVABILITY_LIMITS.maxRouteLength >= 200);

console.log('security observability tests passed');
