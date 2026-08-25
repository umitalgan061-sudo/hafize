import assert from 'node:assert/strict';
import { loadAgentRegistry, resolveAgent } from '../lib/agent-runtime.mjs';
import { createDeviceBridge } from '../lib/device-bridge-contract.mjs';
import { createDeviceApprovalLeaseStore } from '../lib/device-approval-lease.mjs';
import { createDeviceApprovalReviewStore } from '../lib/device-approval-review.mjs';
import { createDeviceActionRuntime, DEVICE_ACTION_RUNTIME_CONTRACT } from '../lib/device-action-runtime.mjs';

const registry = await loadAgentRegistry();
const hafize = resolveAgent(registry, 'hafize-general');
const reviewer = resolveAgent(registry, 'agency-code-reviewer');
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
  randomToken: () => `approval-${++tokenNo}`
});
const reviewStore = createDeviceApprovalReviewStore({
  approvalStore,
  now: () => clock,
  randomId: () => `review-${++reviewNo}`
});
const runtime = createDeviceActionRuntime({
  deviceBridge: bridge,
  approvalStore,
  reviewStore,
  auditSink: async (event) => auditEvents.push(event)
});
const traceId = 'trace-device-runtime-001';

assert.equal(DEVICE_ACTION_RUNTIME_CONTRACT.approvalTokenVisibleToCaller, false);
assert.equal(DEVICE_ACTION_RUNTIME_CONTRACT.auditFailureBlocksSideEffect, true);
assert.deepEqual(DEVICE_ACTION_RUNTIME_CONTRACT.reviewedActions, ['browser.open', 'app.open']);

const info = await runtime.executeReadOnly(hafize, { action: 'system.info' }, { traceId });
assert.equal(info.ok, true);
assert.equal(info.value.info.platform, 'linux');
assert.deepEqual(calls, []);
assert.equal((await runtime.executeReadOnly(hafize, { action: 'browser.open', url: 'https://example.com' }, { traceId })).error, 'DEVICE_ACTION_REVIEW_REQUIRED');
assert.equal((await runtime.executeReadOnly(reviewer, { action: 'system.info' }, { traceId })).error, 'DEVICE_TOOL_NOT_AUTHORIZED');
assert.equal((await runtime.executeReadOnly(hafize, { action: 'system.info' }, { traceId: 'short' })).error, 'INVALID_DEVICE_ACTION_TRACE');

const browserRequest = { action: 'browser.open', url: 'https://example.com/private?token=hidden#fragment' };
const browserReview = await runtime.beginReview(hafize, browserRequest, { traceId, ttlMs: 1000 });
assert.equal(browserReview.ok, true);
assert.equal(browserReview.review.target, 'https://example.com/private');
assert.equal(JSON.stringify(browserReview).includes('hidden'), false);
assert.equal(JSON.stringify(browserReview).includes('approval-'), false);
assert.equal(auditEvents.length, 1);
assert.equal(auditEvents[0].stage, 'review_started');
assert.equal(JSON.stringify(auditEvents[0]).includes('hidden'), false);

const browserResult = await runtime.confirmAndExecute(hafize, browserRequest, { reviewId: browserReview.review.id, traceId });
assert.equal(browserResult.ok, true);
assert.deepEqual(calls, [['browser', 'https://example.com/private?token=hidden#fragment']]);
assert.equal(auditEvents.length, 2);
assert.equal(auditEvents[1].stage, 'approval_issued');
assert.equal(JSON.stringify(browserResult).includes('approval-'), false);
assert.equal(approvalStore.size(), 0);

const replay = await runtime.confirmAndExecute(hafize, browserRequest, { reviewId: browserReview.review.id, traceId });
assert.equal(replay.ok, false);
assert.equal(replay.error, 'DEVICE_REVIEW_NOT_FOUND');
assert.equal(calls.length, 1);

const appReview = await runtime.beginReview(hafize, { action: 'app.open', appId: 'Browser.Chrome' }, { traceId });
assert.equal(appReview.ok, true);
assert.equal(appReview.review.target, 'browser.chrome');
const wrongTarget = await runtime.confirmAndExecute(hafize, { action: 'app.open', appId: 'editor.vscode' }, { reviewId: appReview.review.id, traceId });
assert.equal(wrongTarget.ok, false);
assert.equal(wrongTarget.error, 'DEVICE_APPROVAL_TARGET_MISMATCH');
assert.equal(calls.length, 1);

const deniedApp = await runtime.beginReview(hafize, { action: 'app.open', appId: 'terminal' }, { traceId });
assert.deepEqual(deniedApp, { ok: false, error: 'DEVICE_BRIDGE_APP_NOT_ALLOWED' });
assert.equal(reviewStore.size(), 0);

const deniedAgent = await runtime.beginReview(reviewer, browserRequest, { traceId });
assert.equal(deniedAgent.ok, false);
assert.equal(deniedAgent.error, 'DEVICE_TOOL_NOT_AUTHORIZED');

const wrongTraceReview = await runtime.beginReview(hafize, { action: 'app.open', appId: 'browser.chrome' }, { traceId });
assert.equal(wrongTraceReview.ok, true);
const wrongTrace = await runtime.confirmAndExecute(hafize, { action: 'app.open', appId: 'browser.chrome' }, {
  reviewId: wrongTraceReview.review.id,
  traceId: 'trace-device-runtime-999'
});
assert.equal(wrongTrace.ok, false);
assert.equal(wrongTrace.error, 'DEVICE_REVIEW_TRACE_MISMATCH');
assert.equal(calls.length, 1);

const expiring = await runtime.beginReview(hafize, { action: 'app.open', appId: 'browser.chrome' }, { traceId, ttlMs: 5 });
clock += 6;
const expired = await runtime.confirmAndExecute(hafize, { action: 'app.open', appId: 'browser.chrome' }, {
  reviewId: expiring.review.id,
  traceId
});
assert.equal(expired.ok, false);
assert.equal(expired.error, 'DEVICE_REVIEW_EXPIRED');

const cancelled = await runtime.beginReview(hafize, { action: 'app.open', appId: 'browser.chrome' }, { traceId });
assert.equal((await runtime.cancelReview(cancelled.review.id)).ok, true);
assert.equal((await runtime.cancelReview(cancelled.review.id)).error, 'DEVICE_REVIEW_NOT_FOUND');

const auditFailApproval = createDeviceApprovalLeaseStore({ randomToken: () => 'audit-fail-token' });
const auditFailReviews = createDeviceApprovalReviewStore({
  approvalStore: auditFailApproval,
  randomId: () => 'audit-fail-review'
});
const auditFailRuntime = createDeviceActionRuntime({
  deviceBridge: bridge,
  approvalStore: auditFailApproval,
  reviewStore: auditFailReviews,
  auditSink: async () => { throw new Error('sink down'); }
});
const blockedReview = await auditFailRuntime.beginReview(hafize, browserRequest, { traceId });
assert.deepEqual(blockedReview, { ok: false, error: 'DEVICE_APPROVAL_AUDIT_FAILED' });
assert.equal(auditFailReviews.size(), 0);

let auditCall = 0;
const confirmAuditApproval = createDeviceApprovalLeaseStore({ randomToken: () => 'confirm-audit-token' });
const confirmAuditReviews = createDeviceApprovalReviewStore({
  approvalStore: confirmAuditApproval,
  randomId: () => 'confirm-audit-review'
});
const confirmAuditRuntime = createDeviceActionRuntime({
  deviceBridge: bridge,
  approvalStore: confirmAuditApproval,
  reviewStore: confirmAuditReviews,
  auditSink: async () => {
    auditCall += 1;
    if (auditCall === 2) throw new Error('sink down');
  }
});
const prepared = await confirmAuditRuntime.beginReview(hafize, { action: 'app.open', appId: 'browser.chrome' }, { traceId });
assert.equal(prepared.ok, true);
const blockedExecution = await confirmAuditRuntime.confirmAndExecute(hafize, { action: 'app.open', appId: 'browser.chrome' }, {
  reviewId: prepared.review.id,
  traceId
});
assert.deepEqual(blockedExecution, { ok: false, error: 'DEVICE_APPROVAL_AUDIT_FAILED' });
assert.equal(confirmAuditApproval.size(), 0);
assert.equal(calls.length, 1);

for (const invalid of [
  {},
  { deviceBridge: {} },
  { deviceBridge: bridge, approvalStore: {} },
  { deviceBridge: bridge, auditSink: true }
]) {
  assert.throws(() => createDeviceActionRuntime(invalid), /INVALID_DEVICE_ACTION_RUNTIME/);
}

console.log('device action runtime tests passed with internal approvals, explicit reviews, allowlists, and fail-closed audit');
