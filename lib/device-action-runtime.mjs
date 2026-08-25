import { createDeviceApprovalLeaseStore } from './device-approval-lease.mjs';
import { createDeviceApprovalReviewStore } from './device-approval-review.mjs';
import { authorizeDeviceToolRequest, executeDeviceToolRequest } from './device-bridge-tool-boundary.mjs';

const DEFAULT_MAX_ACTIVE_REVIEWS_PER_OWNER = 5;
const MAX_ACTIVE_REVIEWS_PER_OWNER = 20;

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

function cleanOwnerId(value) {
  const ownerId = typeof value === 'string' ? value.trim() : '';
  if (ownerId.length < 1 || ownerId.length > 200) throw new Error('INVALID_DEVICE_ACTION_OWNER');
  return ownerId;
}

function normalizeReviewLimit(value) {
  if (value == null) return DEFAULT_MAX_ACTIVE_REVIEWS_PER_OWNER;
  if (!Number.isInteger(value) || value < 1 || value > MAX_ACTIVE_REVIEWS_PER_OWNER) {
    throw new Error('INVALID_DEVICE_ACTION_RUNTIME:maxActiveReviewsPerOwner');
  }
  return value;
}

function isSideEffect(request) {
  return request?.action === 'browser.open' || request?.action === 'app.open';
}

function allowedAppSet(deviceBridge) {
  if (!Array.isArray(deviceBridge?.allowedApps)) return new Set();
  return new Set(deviceBridge.allowedApps.map((value) => String(value).trim().toLowerCase()).filter(Boolean));
}

function resolveOwnerId(ownerResolver, principal) {
  try {
    const ownership = ownerResolver.resolve(principal);
    return cleanOwnerId(ownership?.ownerId);
  } catch {
    throw new Error('DEVICE_ACTION_OWNER_REQUIRED');
  }
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
  ownerResolver,
  approvalStore = createDeviceApprovalLeaseStore(),
  reviewStore,
  auditSink,
  now = () => Date.now(),
  maxActiveReviewsPerOwner
} = {}) {
  if (!deviceBridge || typeof deviceBridge.execute !== 'function') throw new Error('INVALID_DEVICE_ACTION_RUNTIME:deviceBridge');
  if (!ownerResolver || typeof ownerResolver.resolve !== 'function') throw new Error('INVALID_DEVICE_ACTION_RUNTIME:ownerResolver');
  if (!approvalStore || typeof approvalStore.issue !== 'function' || typeof approvalStore.consume !== 'function' || typeof approvalStore.revoke !== 'function') {
    throw new Error('INVALID_DEVICE_ACTION_RUNTIME:approvalStore');
  }
  if (auditSink !== undefined && typeof auditSink !== 'function') throw new Error('INVALID_DEVICE_ACTION_RUNTIME:auditSink');
  if (typeof now !== 'function') throw new Error('INVALID_DEVICE_ACTION_RUNTIME:now');

  const reviewLimit = normalizeReviewLimit(maxActiveReviewsPerOwner);
  const reviews = reviewStore || createDeviceApprovalReviewStore({ approvalStore, now });
  if (!reviews || typeof reviews.begin !== 'function' || typeof reviews.confirm !== 'function' || typeof reviews.cancel !== 'function') {
    throw new Error('INVALID_DEVICE_ACTION_RUNTIME:reviewStore');
  }
  const appAllowlist = allowedAppSet(deviceBridge);
  const reviewOwners = new Map();

  function pruneReviewOwners(currentTime = Number(now())) {
    if (!Number.isFinite(currentTime)) throw new Error('INVALID_DEVICE_ACTION_RUNTIME:clock');
    let removed = 0;
    for (const [reviewId, session] of reviewOwners) {
      if (session.expiresAt <= currentTime) {
        reviewOwners.delete(reviewId);
        removed += 1;
      }
    }
    if (typeof reviews.pruneExpired === 'function') reviews.pruneExpired(currentTime);
    return removed;
  }

  function activeReviewCount(ownerId) {
    let count = 0;
    for (const session of reviewOwners.values()) if (session.ownerId === ownerId) count += 1;
    return count;
  }

  async function executeReadOnly(agent, request, { traceId, principal } = {}) {
    try {
      cleanTraceId(traceId);
      resolveOwnerId(ownerResolver, principal);
    } catch (error) {
      return fail(error.message);
    }
    if (!request || request.action !== 'system.info') return fail('DEVICE_ACTION_REVIEW_REQUIRED', 'approval_required');
    return executeDeviceToolRequest(agent, request, { deviceBridge });
  }

  async function beginReview(agent, request, { traceId, principal, ttlMs } = {}) {
    let normalizedTraceId;
    let ownerId;
    try {
      normalizedTraceId = cleanTraceId(traceId);
      ownerId = resolveOwnerId(ownerResolver, principal);
      pruneReviewOwners();
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
    if (activeReviewCount(ownerId) >= reviewLimit) return fail('DEVICE_REVIEW_OWNER_LIMIT_REACHED');

    const begun = reviews.begin({ traceId: normalizedTraceId, request: authorization.request, ttlMs });
    if (!begun?.ok) return fail(begun?.error || 'DEVICE_REVIEW_BEGIN_FAILED');

    const audit = await emitAudit(auditSink, begun.audit);
    if (!audit.ok) {
      reviews.cancel(begun.review.id);
      return audit;
    }

    reviewOwners.set(begun.review.id, Object.freeze({
      ownerId,
      traceId: normalizedTraceId,
      expiresAt: begun.review.expiresAt
    }));
    return { ok: true, review: begun.review };
  }

  async function confirmAndExecute(agent, request, { reviewId, traceId, principal } = {}) {
    let normalizedTraceId;
    let ownerId;
    try {
      normalizedTraceId = cleanTraceId(traceId);
      ownerId = resolveOwnerId(ownerResolver, principal);
      pruneReviewOwners();
    } catch (error) {
      return fail(error.message);
    }
    if (!isSideEffect(request)) return fail('DEVICE_ACTION_NOT_REVIEWABLE');

    const authorization = authorizeDeviceToolRequest(agent, request, { approvalGranted: true });
    if (!authorization.ok) return authorization;

    const session = reviewOwners.get(reviewId);
    if (!session) return fail('DEVICE_REVIEW_NOT_FOUND');
    if (session.ownerId !== ownerId) return fail('DEVICE_REVIEW_OWNER_MISMATCH');
    reviewOwners.delete(reviewId);

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

  async function cancelReview(reviewId, { principal } = {}) {
    let ownerId;
    try {
      ownerId = resolveOwnerId(ownerResolver, principal);
      pruneReviewOwners();
    } catch (error) {
      return fail(error.message);
    }
    const session = reviewOwners.get(reviewId);
    if (!session) return fail('DEVICE_REVIEW_NOT_FOUND');
    if (session.ownerId !== ownerId) return fail('DEVICE_REVIEW_OWNER_MISMATCH');
    reviewOwners.delete(reviewId);
    const cancelled = reviews.cancel(reviewId);
    return cancelled ? { ok: true } : fail('DEVICE_REVIEW_NOT_FOUND');
  }

  return Object.freeze({
    executeReadOnly,
    beginReview,
    confirmAndExecute,
    cancelReview,
    pruneExpiredReviews: pruneReviewOwners,
    activeReviewCount
  });
}

export const DEVICE_ACTION_RUNTIME_CONTRACT = Object.freeze({
  readOnlyActions: Object.freeze(['system.info']),
  reviewedActions: Object.freeze(['browser.open', 'app.open']),
  approvalTokenVisibleToCaller: false,
  explicitConfirmationRequired: true,
  ownerBoundReviews: true,
  maxActiveReviewsPerOwner: DEFAULT_MAX_ACTIVE_REVIEWS_PER_OWNER,
  auditFailureBlocksSideEffect: true,
  appAllowlistCheckedBeforeReview: true,
  providerIndependent: true
});
