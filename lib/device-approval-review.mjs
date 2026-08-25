import { randomUUID } from 'node:crypto';
import { deviceApprovalTargetForRequest } from './device-approval-lease.mjs';

const REVIEW_TTL_MS = 30_000;
const MAX_REVIEW_TTL_MS = 60_000;
const REVIEW_ACTIONS = new Set(['browser.open', 'app.open']);

function fail(error) {
  return { ok: false, error };
}

function normalizeTraceId(value) {
  const traceId = typeof value === 'string' ? value.trim() : '';
  if (traceId.length < 8 || traceId.length > 160) throw new Error('INVALID_DEVICE_REVIEW_TRACE');
  return traceId;
}

function normalizeReviewTtl(value) {
  if (value == null) return REVIEW_TTL_MS;
  if (!Number.isInteger(value) || value < 1 || value > MAX_REVIEW_TTL_MS) {
    throw new Error('INVALID_DEVICE_REVIEW_TTL');
  }
  return value;
}

function normalizeRequest(input) {
  if (!input || Array.isArray(input) || typeof input !== 'object') throw new Error('INVALID_DEVICE_REVIEW_REQUEST');
  const action = typeof input.action === 'string' ? input.action.trim() : '';
  if (!REVIEW_ACTIONS.has(action)) throw new Error('INVALID_DEVICE_REVIEW_ACTION');

  if (action === 'browser.open') {
    if (typeof input.url !== 'string' || 'appId' in input) throw new Error('INVALID_DEVICE_REVIEW_REQUEST');
    const url = new URL(input.url);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('INVALID_DEVICE_REVIEW_URL');
    const request = { action, url: url.toString() };
    return {
      request,
      target: deviceApprovalTargetForRequest(request),
      presentation: {
        action,
        title: 'Tarayıcıda bağlantı açılsın mı?',
        target: `${url.origin}${url.pathname}`,
        detail: url.search || url.hash ? 'Sorgu ve fragment değerleri güvenlik için onay ekranında gizlenir.' : null
      }
    };
  }

  if (typeof input.appId !== 'string' || 'url' in input) throw new Error('INVALID_DEVICE_REVIEW_REQUEST');
  const appId = input.appId.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{1,63}$/.test(appId)) throw new Error('INVALID_DEVICE_REVIEW_APP');
  const request = { action, appId };
  return {
    request,
    target: deviceApprovalTargetForRequest(request),
    presentation: {
      action,
      title: 'Uygulama açılsın mı?',
      target: appId,
      detail: null
    }
  };
}

export function createDeviceApprovalReviewStore({
  approvalStore,
  now = () => Date.now(),
  randomId = randomUUID
} = {}) {
  if (!approvalStore || typeof approvalStore.issue !== 'function') throw new Error('INVALID_DEVICE_REVIEW_STORE:approvalStore');
  if (typeof now !== 'function') throw new Error('INVALID_DEVICE_REVIEW_STORE:now');
  if (typeof randomId !== 'function') throw new Error('INVALID_DEVICE_REVIEW_STORE:randomId');

  const reviews = new Map();

  function pruneExpired(currentTime = Number(now())) {
    if (!Number.isFinite(currentTime)) throw new Error('INVALID_DEVICE_REVIEW_STORE:clock');
    let removed = 0;
    for (const [reviewId, entry] of reviews) {
      if (entry.expiresAt <= currentTime) {
        reviews.delete(reviewId);
        removed += 1;
      }
    }
    return removed;
  }

  function begin({ traceId, request, ttlMs } = {}) {
    try {
      const normalizedTraceId = normalizeTraceId(traceId);
      const normalized = normalizeRequest(request);
      const issuedAt = Number(now());
      if (!Number.isFinite(issuedAt)) throw new Error('INVALID_DEVICE_REVIEW_STORE:clock');
      const ttl = normalizeReviewTtl(ttlMs);
      pruneExpired(issuedAt);
      const reviewId = String(randomId());
      if (!reviewId || reviewId.length > 200 || reviews.has(reviewId)) throw new Error('INVALID_DEVICE_REVIEW_ID');
      const expiresAt = issuedAt + ttl;
      reviews.set(reviewId, Object.freeze({
        reviewId,
        traceId: normalizedTraceId,
        action: normalized.request.action,
        target: normalized.target,
        issuedAt,
        expiresAt
      }));
      return {
        ok: true,
        review: Object.freeze({
          id: reviewId,
          ...normalized.presentation,
          detail: normalized.presentation.detail || undefined,
          expiresAt,
          requiresExplicitConfirmation: true
        })
      };
    } catch (error) {
      return fail(error.message);
    }
  }

  function confirm({ reviewId, traceId } = {}) {
    try {
      const id = typeof reviewId === 'string' ? reviewId.trim() : '';
      if (!id) throw new Error('DEVICE_REVIEW_ID_REQUIRED');
      const normalizedTraceId = normalizeTraceId(traceId);
      const currentTime = Number(now());
      if (!Number.isFinite(currentTime)) throw new Error('INVALID_DEVICE_REVIEW_STORE:clock');
      const entry = reviews.get(id);
      if (!entry) return fail('DEVICE_REVIEW_NOT_FOUND');

      reviews.delete(id);
      if (entry.expiresAt <= currentTime) return fail('DEVICE_REVIEW_EXPIRED');
      if (entry.traceId !== normalizedTraceId) return fail('DEVICE_REVIEW_TRACE_MISMATCH');

      const approval = approvalStore.issue({
        traceId: entry.traceId,
        action: entry.action,
        target: entry.target
      });
      if (!approval?.ok) return fail('DEVICE_REVIEW_APPROVAL_ISSUE_FAILED');
      return { ok: true, approval: approval.lease };
    } catch (error) {
      return fail(error.message);
    }
  }

  function cancel(reviewId) {
    if (typeof reviewId !== 'string' || !reviewId.trim()) return false;
    return reviews.delete(reviewId.trim());
  }

  return Object.freeze({ begin, confirm, cancel, pruneExpired, size: () => reviews.size });
}

export const DEVICE_APPROVAL_REVIEW_CONTRACT = Object.freeze({
  actions: Object.freeze([...REVIEW_ACTIONS]),
  defaultTtlMs: REVIEW_TTL_MS,
  maxTtlMs: MAX_REVIEW_TTL_MS,
  singleUseReview: true,
  queryValuesVisible: false,
  explicitConfirmationRequired: true
});
