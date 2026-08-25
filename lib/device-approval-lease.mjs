import { randomUUID } from 'node:crypto';

const ACTIONS_REQUIRING_APPROVAL = new Set(['browser.open', 'app.open']);
const DEFAULT_TTL_MS = 60_000;
const MAX_TTL_MS = 5 * 60_000;
const TRACE_ID_PATTERN = /^[A-Za-z0-9._:-]{8,160}$/;
const TARGET_MAX_LENGTH = 2048;

function fail(error) {
  return { ok: false, error };
}

function normalizeTraceId(value) {
  const traceId = typeof value === 'string' ? value.trim() : '';
  if (!TRACE_ID_PATTERN.test(traceId)) throw new Error('INVALID_DEVICE_APPROVAL_TRACE');
  return traceId;
}

function normalizeAction(value) {
  const action = typeof value === 'string' ? value.trim() : '';
  if (!ACTIONS_REQUIRING_APPROVAL.has(action)) throw new Error('INVALID_DEVICE_APPROVAL_ACTION');
  return action;
}

function normalizeTarget(value) {
  const target = typeof value === 'string' ? value.trim() : '';
  if (!target || target.length > TARGET_MAX_LENGTH) throw new Error('INVALID_DEVICE_APPROVAL_TARGET');
  return target;
}

function normalizeTtl(value) {
  if (value == null) return DEFAULT_TTL_MS;
  if (!Number.isInteger(value) || value < 1 || value > MAX_TTL_MS) {
    throw new Error('INVALID_DEVICE_APPROVAL_TTL');
  }
  return value;
}

export function deviceApprovalTargetForRequest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('INVALID_DEVICE_APPROVAL_REQUEST');
  }
  const action = normalizeAction(input.action);
  if (action === 'browser.open') return normalizeTarget(input.url);
  return normalizeTarget(input.appId).toLowerCase();
}

export function createDeviceApprovalLeaseStore({ now = () => Date.now(), randomId = randomUUID } = {}) {
  if (typeof now !== 'function') throw new Error('INVALID_DEVICE_APPROVAL_STORE:now');
  if (typeof randomId !== 'function') throw new Error('INVALID_DEVICE_APPROVAL_STORE:randomId');

  const leases = new Map();

  function pruneExpired(currentTime = Number(now())) {
    if (!Number.isFinite(currentTime)) throw new Error('INVALID_DEVICE_APPROVAL_STORE:clock');
    let removed = 0;
    for (const [token, lease] of leases) {
      if (lease.expiresAt <= currentTime) {
        leases.delete(token);
        removed += 1;
      }
    }
    return removed;
  }

  function issue({ traceId, action, target, ttlMs } = {}) {
    try {
      const normalizedTraceId = normalizeTraceId(traceId);
      const normalizedAction = normalizeAction(action);
      const normalizedTarget = normalizeTarget(target);
      const ttl = normalizeTtl(ttlMs);
      const issuedAt = Number(now());
      if (!Number.isFinite(issuedAt)) throw new Error('INVALID_DEVICE_APPROVAL_STORE:clock');
      pruneExpired(issuedAt);

      const token = String(randomId());
      if (!token || token.length > 200 || leases.has(token)) throw new Error('INVALID_DEVICE_APPROVAL_TOKEN');
      const lease = Object.freeze({
        token,
        traceId: normalizedTraceId,
        action: normalizedAction,
        target: normalizedTarget,
        issuedAt,
        expiresAt: issuedAt + ttl
      });
      leases.set(token, lease);
      return { ok: true, lease };
    } catch (error) {
      return fail(error.message);
    }
  }

  function consume({ token, traceId, action, target } = {}) {
    try {
      const normalizedToken = typeof token === 'string' ? token.trim() : '';
      if (!normalizedToken) throw new Error('DEVICE_APPROVAL_TOKEN_REQUIRED');
      const normalizedTraceId = normalizeTraceId(traceId);
      const normalizedAction = normalizeAction(action);
      const normalizedTarget = normalizeTarget(target);
      const currentTime = Number(now());
      if (!Number.isFinite(currentTime)) throw new Error('INVALID_DEVICE_APPROVAL_STORE:clock');

      const lease = leases.get(normalizedToken);
      if (!lease) return fail('DEVICE_APPROVAL_NOT_FOUND');

      // Consumption is destructive even on mismatch. A token presented once cannot be replayed.
      leases.delete(normalizedToken);
      if (lease.expiresAt <= currentTime) return fail('DEVICE_APPROVAL_EXPIRED');
      if (lease.traceId !== normalizedTraceId) return fail('DEVICE_APPROVAL_TRACE_MISMATCH');
      if (lease.action !== normalizedAction) return fail('DEVICE_APPROVAL_ACTION_MISMATCH');
      if (lease.target !== normalizedTarget) return fail('DEVICE_APPROVAL_TARGET_MISMATCH');

      return {
        ok: true,
        approval: Object.freeze({
          traceId: lease.traceId,
          action: lease.action,
          target: lease.target,
          issuedAt: lease.issuedAt,
          expiresAt: lease.expiresAt
        })
      };
    } catch (error) {
      return fail(error.message);
    }
  }

  function revoke(token) {
    if (typeof token !== 'string' || !token.trim()) return false;
    return leases.delete(token.trim());
  }

  return Object.freeze({
    issue,
    consume,
    revoke,
    pruneExpired,
    size: () => leases.size
  });
}

export const DEVICE_APPROVAL_LEASE_CONTRACT = Object.freeze({
  actions: Object.freeze([...ACTIONS_REQUIRING_APPROVAL]),
  defaultTtlMs: DEFAULT_TTL_MS,
  maxTtlMs: MAX_TTL_MS,
  singleUse: true,
  boundFields: Object.freeze(['traceId', 'action', 'target'])
});
