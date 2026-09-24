import { createDeviceApprovalLeaseStore } from './device-approval-lease.mts';
import { createDeviceApprovalReviewStore } from './device-approval-review.mts';
import { authorizeDeviceToolRequest, executeDeviceToolRequest } from './device-bridge-tool-boundary.mts';

export type DeviceActionFailure = { ok: false; error: string; reason?: string };

export type DeviceActionRequest = { action?: string; [key: string]: any };

export type ReviewSession = { ownerId: string; traceId: string; expiresAt: number };

export type BeginReviewResult = DeviceActionFailure | { ok: true; review: Record<string, any> };

export type ExecutionResult = DeviceActionFailure | { ok: true; [key: string]: any };

export type CancelReviewResult = DeviceActionFailure | { ok: true };


const DEFAULT_MAX_ACTIVE_REVIEWS_PER_OWNER = 5;
const MAX_ACTIVE_REVIEWS_PER_OWNER = 20;

function fail(error: string, reason?: string): DeviceActionFailure {
  const result: DeviceActionFailure = { ok: false as const, error };
  if (reason) result.reason = reason;
  return result;
}

function cleanTraceId(value: unknown): string {
  const traceId = typeof value === 'string' ? value.trim() : '';
  if (traceId.length < 8 || traceId.length > 160) throw new Error('INVALID_DEVICE_ACTION_TRACE');
  return traceId;
}

function cleanOwnerId(value: unknown): string {
  const ownerId = typeof value === 'string' ? value.trim() : '';
  if (ownerId.length < 1 || ownerId.length > 200) throw new Error('INVALID_DEVICE_ACTION_OWNER');
  return ownerId;
}

function normalizeReviewLimit(value: number | null | undefined): number {
  if (value == null) return DEFAULT_MAX_ACTIVE_REVIEWS_PER_OWNER;
  if (!Number.isInteger(value) || value < 1 || value > MAX_ACTIVE_REVIEWS_PER_OWNER) {
    throw new Error('INVALID_DEVICE_ACTION_RUNTIME:maxActiveReviewsPerOwner');
  }
  return value;
}

/**
 * Yan etkili, yani onay gerektiren bir eylem mi?
 */
function isSideEffect(request: DeviceActionRequest | null | undefined) {
  return request?.action === 'browser.open' || request?.action === 'app.open';
}

function allowedAppSet(deviceBridge: { allowedApps?: unknown } | null | undefined): Set<string> {
  if (!Array.isArray(deviceBridge?.allowedApps)) return new Set();
  return new Set(deviceBridge.allowedApps.map((value) => String(value).trim().toLowerCase()).filter(Boolean));
}

function resolveOwnerId(ownerResolver: { resolve: (principal: unknown) => { ownerId?: unknown } | null }, principal: unknown): string {
  try {
    const ownership = ownerResolver.resolve(principal);
    return cleanOwnerId(ownership?.ownerId);
  } catch {
    throw new Error('DEVICE_ACTION_OWNER_REQUIRED');
  }
}

async function emitAudit(auditSink: ((event: unknown) => unknown) | undefined, event: unknown): Promise<{ ok: true } | DeviceActionFailure> {
  if (!event || typeof auditSink !== 'function') return { ok: true as const };
  try {
    await auditSink(event);
    return { ok: true as const };
  } catch {
    return fail('DEVICE_APPROVAL_AUDIT_FAILED');
  }
}

/**
 * Cihaz eylemlerini yürüten runtime.
 * Yalnızca okuma yapan eylemler doğrudan çalışır; yan etkili olanlar önce
 * sahibine bağlı bir onay incelemesinden geçer ve onay jetonu hiçbir zaman
 * çağırana görünmez.
 */
export function createDeviceActionRuntime({ deviceBridge, ownerResolver, approvalStore = createDeviceApprovalLeaseStore(), reviewStore, auditSink, now = () => Date.now(), maxActiveReviewsPerOwner }: { deviceBridge?: any; ownerResolver?: any; approvalStore?: any; reviewStore?: any; auditSink?: (event: unknown) => unknown; now?: () => number; maxActiveReviewsPerOwner?: number; } = {}) {
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
  /* @type Map<string, Readonly<ReviewSession>> */
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

  function activeReviewCount(ownerId: string) {
    let count = 0;
    for (const session of reviewOwners.values()) if (session.ownerId === ownerId) count += 1;
    return count;
  }

  async function executeReadOnly(agent: any, request: DeviceActionRequest | null, { traceId, principal }: { traceId?: string; principal?: unknown } = {}): Promise<ExecutionResult> {
    try {
      cleanTraceId(traceId);
      resolveOwnerId(ownerResolver, principal);
    } catch (error) {
      return fail(error.message);
    }
    if (!request || request.action !== 'system.info') return fail('DEVICE_ACTION_REVIEW_REQUIRED', 'approval_required');
    return executeDeviceToolRequest(agent, request, { deviceBridge });
  }

  async function beginReview(agent: any, request: DeviceActionRequest | null, { traceId, principal, ttlMs }: { traceId?: string; principal?: unknown; ttlMs?: number } = {}): Promise<BeginReviewResult> {
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
    if (authorization.ok === false) return authorization;
    if (authorization.request.action === 'app.open') {
      const appId = String(authorization.request.appId).trim().toLowerCase();
      if (!appAllowlist.has(appId)) return fail('DEVICE_BRIDGE_APP_NOT_ALLOWED');
    }
    if (activeReviewCount(ownerId) >= reviewLimit) return fail('DEVICE_REVIEW_OWNER_LIMIT_REACHED');

    const begun = reviews.begin({ traceId: normalizedTraceId, request: authorization.request, ttlMs });
    if (!begun?.ok) return fail(begun?.error || 'DEVICE_REVIEW_BEGIN_FAILED');
    const audit = await emitAudit(auditSink, begun.audit);
    if (audit.ok === false) {
      reviews.cancel(begun.review.id);
      return audit;
    }
    reviewOwners.set(begun.review.id, Object.freeze({ ownerId, traceId: normalizedTraceId, expiresAt: begun.review.expiresAt }));
    return { ok: true as const, review: begun.review };
  }

  async function confirmAndExecute(agent: any, request: DeviceActionRequest | null, { reviewId, traceId, principal }: { reviewId?: string; traceId?: string; principal?: unknown } = {}): Promise<ExecutionResult> {
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
    if (authorization.ok === false) return authorization;

    const session = reviewOwners.get(reviewId);
    if (!session) return fail('DEVICE_REVIEW_NOT_FOUND');
    if (session.ownerId !== ownerId) return fail('DEVICE_REVIEW_OWNER_MISMATCH');
    reviewOwners.delete(reviewId);

    const confirmed = reviews.confirm({ reviewId, traceId: normalizedTraceId });
    if (!confirmed?.ok) return fail(confirmed?.error || 'DEVICE_REVIEW_CONFIRM_FAILED');
    const token = confirmed.approval?.token;
    if (typeof token !== 'string' || !token) return fail('DEVICE_REVIEW_APPROVAL_INVALID');

    const audit = await emitAudit(auditSink, confirmed.audit);
    if (audit.ok === false) {
      approvalStore.revoke(token);
      return audit;
    }
    const result = await executeDeviceToolRequest(agent, authorization.request, { deviceBridge, approvalStore, approvalToken: token, traceId: normalizedTraceId });
    return result?.ok === true ? result : fail(result?.error || 'DEVICE_ACTION_EXECUTION_FAILED', result?.reason);
  }

  async function cancelReview(reviewId: string, { principal }: { principal?: unknown } = {}): Promise<CancelReviewResult> {
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
    return cancelled ? { ok: true as const } : fail('DEVICE_REVIEW_NOT_FOUND');
  }

  return Object.freeze({ executeReadOnly, beginReview, confirmAndExecute, cancelReview, pruneExpiredReviews: pruneReviewOwners, activeReviewCount });
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
