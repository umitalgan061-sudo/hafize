import assert from 'node:assert/strict';
import { loadAgentRegistry, resolveAgent } from '../lib/agent-runtime.mjs';
import { createDeviceBridge } from '../lib/device-bridge-contract.mjs';
import { createDeviceApprovalLeaseStore } from '../lib/device-approval-lease.mjs';
import { createDeviceApprovalReviewStore } from '../lib/device-approval-review.mjs';
import { createDeviceActionRuntime, DEVICE_ACTION_RUNTIME_CONTRACT } from '../lib/device-action-runtime.mjs';

const registry = await loadAgentRegistry();
const hafize = resolveAgent(registry, 'hafize-general');
const reviewer = resolveAgent(registry, 'agency-code-reviewer');
const ownerResolver = {
  resolve(principal) {
    if (!principal?.ownerId) throw new Error('unauthenticated');
    return { ownerId: principal.ownerId };
  }
};
const ownerA = { ownerId: 'owner-a' };
const ownerB = { ownerId: 'owner-b' };
const calls = [];
const auditEvents = [];
const bridge = createDeviceBridge({
  allowedApps: ['browser.chrome', 'editor.vscode'],
  systemInfo: async () => ({ platform: 'linux', arch: 'x64', release: '6.0', hostname: 'hafize' }),
  openExternal: async (url) => calls.push(['browser', url]),
  openApp: async (appId) => calls.push(['app', appId])
});
let clock = 1000;
let tokenNo = 0;
let reviewNo = 0;
const approvalStore = createDeviceApprovalLeaseStore({
  now: () => clock,
  randomId: () => `approval-${++tokenNo}`
});
const reviewStore = createDeviceApprovalReviewStore({
  approvalStore,
  now: () => clock,
  randomId: () => `review-${++reviewNo}`
});
const runtime = createDeviceActionRuntime({
  deviceBridge: bridge,
  ownerResolver,
  approvalStore,
  reviewStore,
  auditSink: async (event) => auditEvents.push(event),
  now: () => clock,
  maxActiveReviewsPerOwner: 2
});
const traceId = 'trace-device-runtime-001';

assert.equal(DEVICE_ACTION_RUNTIME_CONTRACT.approvalTokenVisibleToCaller, false);
assert.equal(DEVICE_ACTION_RUNTIME_CONTRACT.auditFailureBlocksSideEffect, true);
assert.equal(DEVICE_ACTION_RUNTIME_CONTRACT.ownerBoundReviews, true);
assert.deepEqual(DEVICE_ACTION_RUNTIME_CONTRACT.reviewedActions, ['browser.open', 'app.open']);

const info = await runtime.executeReadOnly(hafize, { action: 'system.info' }, { traceId, principal: ownerA });
assert.equal(info.ok, true);
assert.equal(info.value.info.platform, 'linux');
assert.deepEqual(calls, []);
assert.equal((await runtime.executeReadOnly(hafize, { action: 'browser.open', url: 'https://example.com' }, { traceId, principal: ownerA })).error, 'DEVICE_ACTION_REVIEW_REQUIRED');
assert.equal((await runtime.executeReadOnly(reviewer, { action: 'system.info' }, { traceId, principal: ownerA })).error, 'DEVICE_TOOL_NOT_AUTHORIZED');
assert.equal((await runtime.executeReadOnly(hafize, { action: 'system.info' }, { traceId: 'short', principal: ownerA })).error, 'INVALID_DEVICE_ACTION_TRACE');
assert.equal((await runtime.executeReadOnly(hafize, { action: 'system.info' }, { traceId })).error, 'DEVICE_ACTION_OWNER_REQUIRED');

const browserRequest = { action: 'browser.open', url: 'https://example.com/private?token=hidden#fragment' };
const browserReview = await runtime.beginReview(hafize, browserRequest, { traceId, principal: ownerA, ttlMs: 1000 });
assert.equal(browserReview.ok, true);
assert.equal(browserReview.review.target, 'https://example.com/private');
assert.equal(JSON.stringify(browserReview).includes('hidden'), false);
assert.equal(JSON.stringify(browserReview).includes('approval-'), false);
assert.equal(runtime.activeReviewCount('owner-a'), 1);
assert.equal(auditEvents.length, 1);
assert.equal(auditEvents[0].stage, 'review_started');
assert.equal(JSON.stringify(auditEvents[0]).includes('hidden'), false);

const crossOwner = await runtime.confirmAndExecute(hafize, browserRequest, {
  reviewId: browserReview.review.id,
  traceId,
  principal: ownerB
});
assert.deepEqual(crossOwner, { ok: false, error: 'DEVICE_REVIEW_OWNER_MISMATCH' });
assert.equal(runtime.activeReviewCount('owner-a'), 1);
assert.equal(calls.length, 0);

const browserResult = await runtime.confirmAndExecute(hafize, browserRequest, {
  reviewId: browserReview.review.id,
  traceId,
  principal: ownerA
});
assert.equal(browserResult.ok, true);
assert.deepEqual(calls, [['browser', 'https://example.com/private?token=hidden#fragment']]);
assert.equal(auditEvents.length, 2);
assert.equal(auditEvents[1].stage, 'approval_issued');
assert.equal(JSON.stringify(browserResult).includes('approval-'), false);
assert.equal(approvalStore.size(), 0);
assert.equal(runtime.activeReviewCount('owner-a'), 0);

const replay = await runtime.confirmAndExecute(hafize, browserRequest, {
  reviewId: browserReview.review.id,
  traceId,
  principal: ownerA
});
assert.equal(replay.ok, false);
assert.equal(replay.error, 'DEVICE_REVIEW_NOT_FOUND');
assert.equal(calls.length, 1);

const appReview = await runtime.beginReview(hafize, { action: 'app.open', appId: 'Browser.Chrome' }, { traceId, principal: ownerA });
assert.equal(appReview.ok, true);
assert.equal(appReview.review.target, 'browser.chrome');
const wrongTarget = await runtime.confirmAndExecute(hafize, { action: 'app.open', appId: 'editor.vscode' }, {
  reviewId: appReview.review.id,
  traceId,
  principal: ownerA
});
assert.equal(wrongTarget.ok, false);
assert.equal(wrongTarget.error, 'DEVICE_APPROVAL_TARGET_MISMATCH');
assert.equal(calls.length, 1);

const deniedApp = await runtime.beginReview(hafize, { action: 'app.open', appId: 'terminal' }, { traceId, principal: ownerA });
assert.deepEqual(deniedApp, { ok: false, error: 'DEVICE_BRIDGE_APP_NOT_ALLOWED' });

const deniedAgent = await runtime.beginReview(reviewer, browserRequest, { traceId, principal: ownerA });
assert.equal(deniedAgent.ok, false);
assert.equal(deniedAgent.error, 'DEVICE_TOOL_NOT_AUTHORIZED');

const limitOne = await runtime.beginReview(hafize, { action: 'app.open', appId: 'browser.chrome' }, { traceId, principal: ownerA });
const limitTwo = await runtime.beginReview(hafize, { action: 'app.open', appId: 'editor.vscode' }, { traceId, principal: ownerA });
assert.equal(limitOne.ok, true);
assert.equal(limitTwo.ok, true);
assert.equal(runtime.activeReviewCount('owner-a'), 2);
const limited = await runtime.beginReview(hafize, browserRequest, { traceId, principal: ownerA });
assert.deepEqual(limited, { ok: false, error: 'DEVICE_REVIEW_OWNER_LIMIT_REACHED' });
const ownerBReview = await runtime.beginReview(hafize, browserRequest, { traceId, principal: ownerB });
assert.equal(ownerBReview.ok, true);
assert.equal(runtime.activeReviewCount('owner-b'), 1);

const cancelWrongOwner = await runtime.cancelReview(ownerBReview.review.id, { principal: ownerA });
assert.deepEqual(cancelWrongOwner, { ok: false, error: 'DEVICE_REVIEW_OWNER_MISMATCH' });
assert.equal((await runtime.cancelReview(ownerBReview.review.id, { principal: ownerB })).ok, true);
assert.equal(runtime.activeReviewCount('owner-b'), 0);

clock += 31_000;
assert.ok(runtime.pruneExpiredReviews() >= 2);
assert.equal(runtime.activeReviewCount('owner-a'), 0);

const wrongTraceReview = await runtime.beginReview(hafize, { action: 'app.open', appId: 'browser.chrome' }, { traceId, principal: ownerA });
assert.equal(wrongTraceReview.ok, true);
const wrongTrace = await runtime.confirmAndExecute(hafize, { action: 'app.open', appId: 'browser.chrome' }, {
  reviewId: wrongTraceReview.review.id,
  traceId: 'trace-device-runtime-999',
  principal: ownerA
});
assert.equal(wrongTrace.ok, false);
assert.equal(wrongTrace.error, 'DEVICE_REVIEW_TRACE_MISMATCH');
assert.equal(calls.length, 1);

const expiring = await runtime.beginReview(hafize, { action: 'app.open', appId: 'browser.chrome' }, { traceId, principal: ownerA, ttlMs: 5 });
clock += 6;
runtime.pruneExpiredReviews();
const expired = await runtime.confirmAndExecute(hafize, { action: 'app.open', appId: 'browser.chrome' }, {
  reviewId: expiring.review.id,
  traceId,
  principal: ownerA
});
assert.equal(expired.ok, false);
assert.equal(expired.error, 'DEVICE_REVIEW_NOT_FOUND');

const cancelled = await runtime.beginReview(hafize, { action: 'app.open', appId: 'browser.chrome' }, { traceId, principal: ownerA });
assert.equal((await runtime.cancelReview(cancelled.review.id, { principal: ownerA })).ok, true);
assert.equal((await runtime.cancelReview(cancelled.review.id, { principal: ownerA })).error, 'DEVICE_REVIEW_NOT_FOUND');

const auditFailApproval = createDeviceApprovalLeaseStore({ randomId: () => 'audit-fail-token' });
const auditFailReviews = createDeviceApprovalReviewStore({
  approvalStore: auditFailApproval,
  randomId: () => 'audit-fail-review'
});
const auditFailRuntime = createDeviceActionRuntime({
  deviceBridge: bridge,
  ownerResolver,
  approvalStore: auditFailApproval,
  reviewStore: auditFailReviews,
  auditSink: async () => { throw new Error('sink down'); }
});
const blockedReview = await auditFailRuntime.beginReview(hafize, browserRequest, { traceId, principal: ownerA });
assert.deepEqual(blockedReview, { ok: false, error: 'DEVICE_APPROVAL_AUDIT_FAILED' });
assert.equal(auditFailReviews.size(), 0);

let auditCall = 0;
const confirmAuditApproval = createDeviceApprovalLeaseStore({ randomId: () => 'confirm-audit-token' });
const confirmAuditReviews = createDeviceApprovalReviewStore({
  approvalStore: confirmAuditApproval,
  randomId: () => 'confirm-audit-review'
});
const confirmAuditRuntime = createDeviceActionRuntime({
  deviceBridge: bridge,
  ownerResolver,
  approvalStore: confirmAuditApproval,
  reviewStore: confirmAuditReviews,
  auditSink: async () => {
    auditCall += 1;
    if (auditCall === 2) throw new Error('sink down');
  }
});
const prepared = await confirmAuditRuntime.beginReview(hafize, { action: 'app.open', appId: 'browser.chrome' }, { traceId, principal: ownerA });
assert.equal(prepared.ok, true);
const blockedExecution = await confirmAuditRuntime.confirmAndExecute(hafize, { action: 'app.open', appId: 'browser.chrome' }, {
  reviewId: prepared.review.id,
  traceId,
  principal: ownerA
});
assert.deepEqual(blockedExecution, { ok: false, error: 'DEVICE_APPROVAL_AUDIT_FAILED' });
assert.equal(confirmAuditApproval.size(), 0);
assert.equal(calls.length, 1);

for (const invalid of [
  {},
  { deviceBridge: bridge },
  { deviceBridge: {}, ownerResolver },
  { deviceBridge: bridge, ownerResolver, approvalStore: {} },
  { deviceBridge: bridge, ownerResolver, auditSink: true },
  { deviceBridge: bridge, ownerResolver, maxActiveReviewsPerOwner: 0 }
]) {
  assert.throws(() => createDeviceActionRuntime(invalid), /INVALID_DEVICE_ACTION_RUNTIME/);
}

console.log('device action runtime tests passed with owner isolation, bounded reviews, internal approvals, and fail-closed audit');
