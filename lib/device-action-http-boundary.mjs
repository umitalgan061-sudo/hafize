const BASE_PATH = '/api/device';
const REVIEW_ID_PATTERN = /^[A-Za-z0-9._:-]{1,200}$/;
const APP_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{1,63}$/;
const SYSTEM_INFO_FIELDS = new Set(['platform', 'arch', 'release', 'hostname']);
const BEGIN_FIELDS = new Set(['request', 'ttlMs']);
const CONFIRM_FIELDS = new Set(['request']);
const REQUEST_FIELDS = new Set(['action', 'url', 'appId']);

function fail(error, status = 400) {
  return { status, body: { ok: false, error } };
}

function exactObject(value, allowedFields, label) {
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error(`INVALID_DEVICE_HTTP_${label}`);
  for (const key of Object.keys(value)) {
    if (!allowedFields.has(key)) throw new Error(`INVALID_DEVICE_HTTP_${label}`);
  }
  return value;
}

function normalizeRequest(value) {
  const input = exactObject(value, REQUEST_FIELDS, 'REQUEST');
  const action = typeof input.action === 'string' ? input.action.trim() : '';
  if (action === 'browser.open') {
    if (typeof input.url !== 'string' || 'appId' in input) throw new Error('INVALID_DEVICE_HTTP_REQUEST');
    return { action, url: input.url };
  }
  if (action === 'app.open') {
    if (typeof input.appId !== 'string' || 'url' in input) throw new Error('INVALID_DEVICE_HTTP_REQUEST');
    return { action, appId: input.appId };
  }
  throw new Error('INVALID_DEVICE_HTTP_REQUEST');
}

function reviewIdFromPath(pathname, suffix = '') {
  const prefix = `${BASE_PATH}/reviews/`;
  if (typeof pathname !== 'string' || !pathname.startsWith(prefix)) return null;
  let candidate = pathname.slice(prefix.length);
  if (suffix) {
    if (!candidate.endsWith(suffix)) return null;
    candidate = candidate.slice(0, -suffix.length);
  }
  if (!REVIEW_ID_PATTERN.test(candidate)) return null;
  return candidate;
}

function statusForError(error) {
  if (error === 'DEVICE_ACTION_OWNER_REQUIRED' || error === 'DEVICE_TOOL_NOT_AUTHORIZED') return 403;
  if (error === 'DEVICE_REVIEW_NOT_FOUND') return 404;
  if (error === 'DEVICE_REVIEW_OWNER_MISMATCH') return 403;
  if (error === 'DEVICE_REVIEW_OWNER_LIMIT_REACHED') return 429;
  if (error === 'DEVICE_APPROVAL_AUDIT_FAILED' || error === 'DEVICE_BRIDGE_EXECUTION_FAILED' || error === 'DEVICE_BRIDGE_UNAVAILABLE') return 503;
  if (typeof error === 'string' && (error.startsWith('INVALID_') || error.includes('NOT_ALLOWED') || error.includes('REQUIRED'))) return 400;
  if (typeof error === 'string' && (error.includes('MISMATCH') || error.includes('EXPIRED'))) return 409;
  return 400;
}

function publicFailure(result) {
  const error = typeof result?.error === 'string' && result.error.startsWith('DEVICE_')
    ? result.error
    : 'DEVICE_REQUEST_FAILED';
  const body = { ok: false, error };
  if (result?.reason === 'approval_required') body.reason = 'approval_required';
  return { status: statusForError(error), body };
}

function safeReviewTarget(action, value) {
  if (typeof value !== 'string' || !value) throw new Error('INVALID_DEVICE_HTTP_RUNTIME_RESULT');
  if (action === 'app.open') {
    const appId = value.trim().toLowerCase();
    if (!APP_ID_PATTERN.test(appId)) throw new Error('INVALID_DEVICE_HTTP_RUNTIME_RESULT');
    return appId;
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('INVALID_DEVICE_HTTP_RUNTIME_RESULT');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('INVALID_DEVICE_HTTP_RUNTIME_RESULT');
  }
  return `${url.origin}${url.pathname}`;
}

function publicReview(review) {
  if (!review || typeof review !== 'object' || Array.isArray(review)) throw new Error('INVALID_DEVICE_HTTP_RUNTIME_RESULT');
  const id = typeof review.id === 'string' && REVIEW_ID_PATTERN.test(review.id) ? review.id : null;
  const action = review.action === 'browser.open' || review.action === 'app.open' ? review.action : null;
  const title = typeof review.title === 'string' ? review.title.trim() : '';
  const expiresAt = Number(review.expiresAt);
  if (!id || !action || !title || title.length > 200 || !Number.isFinite(expiresAt) || review.requiresExplicitConfirmation !== true) {
    throw new Error('INVALID_DEVICE_HTTP_RUNTIME_RESULT');
  }
  const output = { id, action, title, target: safeReviewTarget(action, review.target), expiresAt, requiresExplicitConfirmation: true };
  if (typeof review.detail === 'string' && review.detail) output.detail = review.detail.slice(0, 500);
  return Object.freeze(output);
}

function publicExecution(result) {
  const value = result?.value;
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.ok !== true) {
    throw new Error('INVALID_DEVICE_HTTP_RUNTIME_RESULT');
  }
  if (value.action === 'system.info') {
    const info = value.info;
    if (!info || typeof info !== 'object' || Array.isArray(info)) throw new Error('INVALID_DEVICE_HTTP_RUNTIME_RESULT');
    const safeInfo = {};
    for (const [key, fieldValue] of Object.entries(info)) {
      if (!SYSTEM_INFO_FIELDS.has(key) || typeof fieldValue !== 'string' || !fieldValue || fieldValue.length > 200) {
        throw new Error('INVALID_DEVICE_HTTP_RUNTIME_RESULT');
      }
      safeInfo[key] = fieldValue;
    }
    if (!safeInfo.platform || !safeInfo.arch) throw new Error('INVALID_DEVICE_HTTP_RUNTIME_RESULT');
    return { ok: true, action: 'system.info', info: safeInfo };
  }
  if (value.action === 'browser.open') return { ok: true, action: 'browser.open' };
  if (value.action === 'app.open' && typeof value.appId === 'string' && APP_ID_PATTERN.test(value.appId)) {
    return { ok: true, action: 'app.open', appId: value.appId };
  }
  throw new Error('INVALID_DEVICE_HTTP_RUNTIME_RESULT');
}

export function createDeviceActionHttpBoundary({ runtime } = {}) {
  if (!runtime || typeof runtime.executeReadOnly !== 'function' || typeof runtime.beginReview !== 'function' ||
      typeof runtime.confirmAndExecute !== 'function' || typeof runtime.cancelReview !== 'function') {
    throw new Error('INVALID_DEVICE_HTTP_BOUNDARY:runtime');
  }

  async function handle({ method, pathname, body } = {}, { agent, principal, traceId } = {}) {
    try {
      const verb = typeof method === 'string' ? method.toUpperCase() : '';
      if (verb === 'POST' && pathname === `${BASE_PATH}/system-info`) {
        exactObject(body ?? {}, new Set(), 'BODY');
        const result = await runtime.executeReadOnly(agent, { action: 'system.info' }, { principal, traceId });
        return result?.ok === true ? { status: 200, body: publicExecution(result) } : publicFailure(result);
      }

      if (verb === 'POST' && pathname === `${BASE_PATH}/reviews`) {
        const input = exactObject(body, BEGIN_FIELDS, 'BODY');
        const request = normalizeRequest(input.request);
        const result = await runtime.beginReview(agent, request, { principal, traceId, ttlMs: input.ttlMs });
        return result?.ok === true
          ? { status: 201, body: { ok: true, review: publicReview(result.review) } }
          : publicFailure(result);
      }

      const confirmId = reviewIdFromPath(pathname, '/confirm');
      if (verb === 'POST' && confirmId) {
        const input = exactObject(body, CONFIRM_FIELDS, 'BODY');
        const request = normalizeRequest(input.request);
        const result = await runtime.confirmAndExecute(agent, request, { reviewId: confirmId, principal, traceId });
        return result?.ok === true ? { status: 200, body: publicExecution(result) } : publicFailure(result);
      }

      const cancelId = reviewIdFromPath(pathname);
      if (verb === 'DELETE' && cancelId) {
        exactObject(body ?? {}, new Set(), 'BODY');
        const result = await runtime.cancelReview(cancelId, { principal });
        return result?.ok === true ? { status: 204, body: null } : publicFailure(result);
      }

      return fail('DEVICE_HTTP_ROUTE_NOT_FOUND', 404);
    } catch (error) {
      return fail(error?.message?.startsWith('INVALID_DEVICE_HTTP_') ? error.message : 'INVALID_DEVICE_HTTP_REQUEST');
    }
  }

  return Object.freeze({ handle });
}

export const DEVICE_ACTION_HTTP_CONTRACT = Object.freeze({
  basePath: BASE_PATH,
  routes: Object.freeze([
    'POST /api/device/system-info',
    'POST /api/device/reviews',
    'POST /api/device/reviews/:reviewId/confirm',
    'DELETE /api/device/reviews/:reviewId'
  ]),
  approvalTokenExposed: false,
  principalComesFromTrustedContext: true,
  traceIdComesFromTrustedContext: true,
  additionalBodyFieldsAllowed: false
});
