import { createDeviceApprovalLeaseStore } from './device-approval-lease.mjs';
import { createDeviceApprovalReviewStore } from './device-approval-review.mjs';
import { authorizeDeviceToolRequest, executeDeviceToolRequest } from './device-bridge-tool-boundary.mjs';

function fail(error, reason) {
  const result = { ok: false, error };
  if (reason) result.reason = reason;
  return result;
}

function cleanTraceId(value) {
  const traceId = typeof value === 'string' ? value.trim() : '';
  if (traceId.length < 8 || traceId.length > 160) throw new Error('INVALID_DEVICE_ACTION_TRACE');
  return traceId;
}

function isSideEffect(request) {
  return request?.action === 'browser.open' || request?.action === 'app.open';
}

function allowedAppSet(deviceBridge) {
  if (!Array.isArray(deviceBridge?.allowedApps)) return new Set();
  return new Set(deviceBridge.allowedApps.map((value) => String(value).trim().toLowerCase()).filter(Boolean));
}

async function emitAudit(auditSink, event) {
  if (!event || typeof auditSink !== 'function') return { ok: true };
  try {
    await auditSink(event);
    return { ok: true };
  } catch {
    return fail('DEVICE_APPROVAL_AUDIT_FAILED');
  }
}

export function createDeviceActionRuntime({
  deviceBridge,
  approvalStore = createDeviceApprovalLeaseStore(),
  reviewStore,
  auditSink
} = {}) {
  if (!deviceBridge || typeof deviceBridge.execute !== 'function') throw new Error('INVALID_DEVICE_ACTION_RUNTIME:deviceBridge');
  if (!approvalStore || typeof approvalStore.issue !== 'function' || typeof approvalStore.consume !== 'function' || typeof approvalStore.revoke !== 'function') {
    throw new Error('INVALID_DEVICE_ACTION_RUNTIME:approvalStore');
  }
  if (auditSink !== undefined && typeof auditSink !== 'function') throw new Error('INVALID_DEVICE_ACTION_RUNTIME:auditSink');

  const reviews = reviewStore || createDeviceApprovalReviewStore({ approvalStore });
  if (!reviews || typeof reviews.begin !== 'function' || typeof reviews.confirm !== 'function' || typeof reviews.cancel !== 'function') {
    throw new Error('INVALID_DEVICE_ACTION_RUNTIME:reviewStore');
  }
  const appAllowlist = allowedAppSet(deviceBridge);

  async function executeReadOnly(agent, request, { traceId } = {}) {
    try {
      cleanTraceId(traceId);
    } catch (error) {
      return fail(error.message);
    }
    if (!request || request.action !== 'system.info') return fail('DEVICE_ACTION_REVIEW_REQUIRED', 'approval_required');
    return executeDeviceToolRequest(agent, request, { deviceBridge });
  }

  async function beginReview(agent, request, { traceId, ttlMs } = {}) {
    let normalizedTraceId;
    try {
      normalizedTraceId = cleanTraceId(traceId);
    } catch (error) {
      return fail(error.message);
    }
    if (!isSideEffect(request)) return fail('DEVICE_ACTION_NOT_REVIEWABLE');

    const authorization = authorizeDeviceToolRequest(agent, request, { approvalGranted: true });
    if (!authorization.ok) return authorization;

    if (authorization.request.action === 'app.open') {
      const appId = String(authorization.request.appId).trim().toLowerCase();
      if (!appAllowlist.has(appId)) return fail('DEVICE_BRIDGE_APP_NOT_ALLOWED');
    }

    const begun = reviews.begin({ traceId: normalizedTraceId, request: authorization.request, ttlMs });
    if (!begun?.ok) return fail(begun?.error || 'DEVICE_REVIEW_BEGIN_FAILED');

    const audit = await emitAudit(auditSink, begun.audit);
    if (!audit.ok) {
      reviews.cancel(begun.review.id);
      return audit;
    }

    return { ok: true, review: begun.review };
  }

  async function confirmAndExecute(agent, request, { reviewId, traceId } = {}) {
    let normalizedTraceId;
    try {
      normalizedTraceId = cleanTraceId(traceId);
    } catch (error) {
      return fail(error.message);
    }
    if (!isSideEffect(request)) return fail('DEVICE_ACTION_NOT_REVIEWABLE');

    const authorization = authorizeDeviceToolRequest(agent, request, { approvalGranted: true });
    if (!authorization.ok) return authorization;

    const confirmed = reviews.confirm({ reviewId, traceId: normalizedTraceId });
    if (!confirmed?.ok) return fail(confirmed?.error || 'DEVICE_REVIEW_CONFIRM_FAILED');

    const token = confirmed.approval?.token;
    if (typeof token !== 'string' || !token) return fail('DEVICE_REVIEW_APPROVAL_INVALID');

    const audit = await emitAudit(auditSink, confirmed.audit);
    if (!audit.ok) {
      approvalStore.revoke(token);
      return audit;
    }

    const result = await executeDeviceToolRequest(agent, authorization.request, {
      deviceBridge,
      approvalStore,
      approvalToken: token,
      traceId: normalizedTraceId
    });

    return result?.ok === true ? result : fail(result?.error || 'DEVICE_ACTION_EXECUTION_FAILED', result?.reason);
  }

  async function cancelReview(reviewId) {
    const cancelled = reviews.cancel(reviewId);
    return cancelled ? { ok: true } : fail('DEVICE_REVIEW_NOT_FOUND');
  }

  return Object.freeze({
    executeReadOnly,
    beginReview,
    confirmAndExecute,
    cancelReview
  });
}

export const DEVICE_ACTION_RUNTIME_CONTRACT = Object.freeze({
  readOnlyActions: Object.freeze(['system.info']),
  reviewedActions: Object.freeze(['browser.open', 'app.open']),
  approvalTokenVisibleToCaller: false,
  explicitConfirmationRequired: true,
  auditFailureBlocksSideEffect: true,
  appAllowlistCheckedBeforeReview: true,
  providerIndependent: true
});
