import assert from 'node:assert/strict';
import { createDeviceActionHttpBoundary, DEVICE_ACTION_HTTP_CONTRACT } from '../lib/device-action-http-boundary.mjs';

const calls = [];
const runtime = {
  async executeReadOnly(agent, request, context) {
    calls.push(['read', agent, request, context]);
    if (!context.principal) return { ok: false, error: 'DEVICE_ACTION_OWNER_REQUIRED' };
    return { ok: true, value: { ok: true, action: 'system.info', info: { platform: 'linux', arch: 'x64' } } };
  },
  async beginReview(agent, request, context) {
    calls.push(['begin', agent, request, context]);
    if (request.appId === 'terminal') return { ok: false, error: 'DEVICE_BRIDGE_APP_NOT_ALLOWED' };
    if (context.principal?.ownerId === 'limited') return { ok: false, error: 'DEVICE_REVIEW_OWNER_LIMIT_REACHED' };
    return {
      ok: true,
      review: {
        id: 'review-123',
        action: request.action,
        title: 'Onay',
        target: request.action === 'browser.open' ? 'https://example.com/private' : request.appId.toLowerCase(),
        detail: request.action === 'browser.open' ? 'Sorgu gizlendi.' : undefined,
        expiresAt: 123456,
        requiresExplicitConfirmation: true
      }
    };
  },
  async confirmAndExecute(agent, request, context) {
    calls.push(['confirm', agent, request, context]);
    if (context.principal?.ownerId === 'other') return { ok: false, error: 'DEVICE_REVIEW_OWNER_MISMATCH' };
    if (request.action === 'browser.open') return { ok: true, value: { ok: true, action: 'browser.open' } };
    return { ok: true, value: { ok: true, action: 'app.open', appId: request.appId.toLowerCase() } };
  },
  async cancelReview(reviewId, context) {
    calls.push(['cancel', reviewId, context]);
    if (context.principal?.ownerId === 'other') return { ok: false, error: 'DEVICE_REVIEW_OWNER_MISMATCH' };
    if (reviewId === 'missing') return { ok: false, error: 'DEVICE_REVIEW_NOT_FOUND' };
    return { ok: true };
  }
};

const api = createDeviceActionHttpBoundary({ runtime });
const agent = { id: 'hafize-general' };
const principal = { ownerId: 'owner-a' };
const traceId = 'trace-http-device-001';

assert.equal(DEVICE_ACTION_HTTP_CONTRACT.approvalTokenExposed, false);
assert.equal(DEVICE_ACTION_HTTP_CONTRACT.principalComesFromTrustedContext, true);
assert.equal(DEVICE_ACTION_HTTP_CONTRACT.traceIdComesFromTrustedContext, true);
assert.equal(DEVICE_ACTION_HTTP_CONTRACT.additionalBodyFieldsAllowed, false);

const info = await api.handle(
  { method: 'POST', pathname: '/api/device/system-info', body: {} },
  { agent, principal, traceId }
);
assert.deepEqual(info, { status: 200, body: { ok: true, action: 'system.info', info: { platform: 'linux', arch: 'x64' } } });
assert.deepEqual(calls[0][3], { principal, traceId });

const unauthenticated = await api.handle(
  { method: 'POST', pathname: '/api/device/system-info', body: {} },
  { agent, traceId }
);
assert.equal(unauthenticated.status, 403);
assert.equal(unauthenticated.body.error, 'DEVICE_ACTION_OWNER_REQUIRED');

const beginBrowser = await api.handle(
  {
    method: 'POST',
    pathname: '/api/device/reviews',
    body: { request: { action: 'browser.open', url: 'https://example.com/private?token=never-return' }, ttlMs: 1000 }
  },
  { agent, principal, traceId }
);
assert.equal(beginBrowser.status, 201);
assert.equal(beginBrowser.body.review.target, 'https://example.com/private');
assert.equal(JSON.stringify(beginBrowser.body).includes('never-return'), false);
assert.equal(JSON.stringify(beginBrowser.body).includes('approvalToken'), false);
assert.equal(calls[2][3].principal, principal);
assert.equal(calls[2][3].traceId, traceId);

const confirmBrowser = await api.handle(
  {
    method: 'POST',
    pathname: '/api/device/reviews/review-123/confirm',
    body: { request: { action: 'browser.open', url: 'https://example.com/private?token=server-only' } }
  },
  { agent, principal, traceId }
);
assert.deepEqual(confirmBrowser, { status: 200, body: { ok: true, action: 'browser.open' } });
assert.equal(JSON.stringify(confirmBrowser).includes('server-only'), false);
assert.equal(calls[3][3].reviewId, 'review-123');

const confirmApp = await api.handle(
  {
    method: 'POST',
    pathname: '/api/device/reviews/review-123/confirm',
    body: { request: { action: 'app.open', appId: 'Browser.Chrome' } }
  },
  { agent, principal, traceId }
);
assert.deepEqual(confirmApp, { status: 200, body: { ok: true, action: 'app.open', appId: 'browser.chrome' } });

const ownerMismatch = await api.handle(
  {
    method: 'POST',
    pathname: '/api/device/reviews/review-123/confirm',
    body: { request: { action: 'app.open', appId: 'browser.chrome' } }
  },
  { agent, principal: { ownerId: 'other' }, traceId }
);
assert.equal(ownerMismatch.status, 403);
assert.equal(ownerMismatch.body.error, 'DEVICE_REVIEW_OWNER_MISMATCH');

const limited = await api.handle(
  {
    method: 'POST',
    pathname: '/api/device/reviews',
    body: { request: { action: 'app.open', appId: 'browser.chrome' } }
  },
  { agent, principal: { ownerId: 'limited' }, traceId }
);
assert.equal(limited.status, 429);
assert.equal(limited.body.error, 'DEVICE_REVIEW_OWNER_LIMIT_REACHED');

const deniedApp = await api.handle(
  {
    method: 'POST',
    pathname: '/api/device/reviews',
    body: { request: { action: 'app.open', appId: 'terminal' } }
  },
  { agent, principal, traceId }
);
assert.equal(deniedApp.status, 400);
assert.equal(deniedApp.body.error, 'DEVICE_BRIDGE_APP_NOT_ALLOWED');

const cancelled = await api.handle(
  { method: 'DELETE', pathname: '/api/device/reviews/review-123', body: {} },
  { agent, principal, traceId }
);
assert.deepEqual(cancelled, { status: 204, body: null });

const missing = await api.handle(
  { method: 'DELETE', pathname: '/api/device/reviews/missing', body: {} },
  { agent, principal, traceId }
);
assert.equal(missing.status, 404);
assert.equal(missing.body.error, 'DEVICE_REVIEW_NOT_FOUND');

for (const invalid of [
  { method: 'POST', pathname: '/api/device/reviews', body: { request: { action: 'shell.run' } } },
  { method: 'POST', pathname: '/api/device/reviews', body: { request: { action: 'browser.open', url: 'https://example.com' }, principal: 'forged' } },
  { method: 'POST', pathname: '/api/device/reviews', body: { request: { action: 'app.open', appId: 'browser.chrome', explicitUserIntent: true } } },
  { method: 'POST', pathname: '/api/device/reviews/review-123/confirm', body: { request: { action: 'app.open', appId: 'browser.chrome' }, approvalToken: 'forged' } },
  { method: 'POST', pathname: '/api/device/system-info', body: { traceId: 'forged' } }
]) {
  const response = await api.handle(invalid, { agent, principal, traceId });
  assert.equal(response.status, 400);
  assert.match(response.body.error, /^INVALID_DEVICE_HTTP_/);
}

const route = await api.handle({ method: 'GET', pathname: '/api/device/reviews', body: {} }, { agent, principal, traceId });
assert.deepEqual(route, { status: 404, body: { ok: false, error: 'DEVICE_HTTP_ROUTE_NOT_FOUND' } });

const leakyRuntime = createDeviceActionHttpBoundary({
  runtime: {
    ...runtime,
    async beginReview() {
      return {
        ok: true,
        review: {
          id: 'review-123', action: 'browser.open', title: 'Onay', target: 'https://example.com/safe',
          expiresAt: 1, requiresExplicitConfirmation: true, approvalToken: 'must-not-pass'
        }
      };
    }
  }
});
const sanitized = await leakyRuntime.handle(
  { method: 'POST', pathname: '/api/device/reviews', body: { request: { action: 'browser.open', url: 'https://example.com' } } },
  { agent, principal, traceId }
);
assert.equal(JSON.stringify(sanitized).includes('must-not-pass'), false);

const unsafeRuntimeReview = createDeviceActionHttpBoundary({
  runtime: {
    ...runtime,
    async beginReview() {
      return {
        ok: true,
        review: {
          id: 'review-123', action: 'browser.open', title: 'Onay', target: 'https://example.com/safe?token=leak',
          expiresAt: 1, requiresExplicitConfirmation: true
        }
      };
    }
  }
});
const rejectedRuntimeLeak = await unsafeRuntimeReview.handle(
  { method: 'POST', pathname: '/api/device/reviews', body: { request: { action: 'browser.open', url: 'https://example.com' } } },
  { agent, principal, traceId }
);
assert.deepEqual(rejectedRuntimeLeak, { status: 400, body: { ok: false, error: 'INVALID_DEVICE_HTTP_REQUEST' } });
assert.equal(JSON.stringify(rejectedRuntimeLeak).includes('leak'), false);

const unsafeSystemInfo = createDeviceActionHttpBoundary({
  runtime: {
    ...runtime,
    async executeReadOnly() {
      return { ok: true, value: { ok: true, action: 'system.info', info: { platform: 'linux', arch: 'x64', username: 'secret-user' } } };
    }
  }
});
assert.deepEqual(
  await unsafeSystemInfo.handle({ method: 'POST', pathname: '/api/device/system-info', body: {} }, { agent, principal, traceId }),
  { status: 400, body: { ok: false, error: 'INVALID_DEVICE_HTTP_REQUEST' } }
);

assert.throws(() => createDeviceActionHttpBoundary(), /INVALID_DEVICE_HTTP_BOUNDARY/);
assert.throws(() => createDeviceActionHttpBoundary({ runtime: {} }), /INVALID_DEVICE_HTTP_BOUNDARY/);

console.log('device action HTTP boundary tests passed with trusted principal context, strict bodies, and token-free responses');
