const STAGES = new Set(['review_started', 'review_cancelled', 'approval_issued', 'approval_rejected']);
const ACTIONS = new Set(['browser.open', 'app.open']);

function cleanString(value, label, max = 200) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > max) throw new Error(`INVALID_DEVICE_APPROVAL_AUDIT:${label}`);
  return text;
}

function sanitizeBrowserTarget(value) {
  const raw = cleanString(value, 'target', 2048);
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('INVALID_DEVICE_APPROVAL_AUDIT:target');
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    throw new Error('INVALID_DEVICE_APPROVAL_AUDIT:target');
  }
  return {
    displayTarget: `${parsed.origin}${parsed.pathname}`,
    queryRedacted: Boolean(parsed.search || parsed.hash)
  };
}

function sanitizeAppTarget(value) {
  const appId = cleanString(value, 'target', 64).toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{1,63}$/.test(appId)) {
    throw new Error('INVALID_DEVICE_APPROVAL_AUDIT:target');
  }
  return { displayTarget: appId, queryRedacted: false };
}

export function createDeviceApprovalAuditEvent({ stage, traceId, action, target, timestamp = Date.now() } = {}) {
  const normalizedStage = cleanString(stage, 'stage', 40);
  const normalizedAction = cleanString(action, 'action', 40);
  const normalizedTraceId = cleanString(traceId, 'traceId', 160);
  if (!STAGES.has(normalizedStage)) throw new Error('INVALID_DEVICE_APPROVAL_AUDIT:stage');
  if (!ACTIONS.has(normalizedAction)) throw new Error('INVALID_DEVICE_APPROVAL_AUDIT:action');
  if (!Number.isFinite(Number(timestamp))) throw new Error('INVALID_DEVICE_APPROVAL_AUDIT:timestamp');

  const safeTarget = normalizedAction === 'browser.open'
    ? sanitizeBrowserTarget(target)
    : sanitizeAppTarget(target);

  return Object.freeze({
    type: 'device_approval',
    stage: normalizedStage,
    traceId: normalizedTraceId,
    action: normalizedAction,
    target: safeTarget.displayTarget,
    queryRedacted: safeTarget.queryRedacted,
    timestamp: Number(timestamp)
  });
}

export const DEVICE_APPROVAL_AUDIT_CONTRACT = Object.freeze({
  stages: Object.freeze([...STAGES]),
  actions: Object.freeze([...ACTIONS]),
  includesApprovalToken: false,
  includesRawQueryOrFragment: false,
  traceIdRequired: true
});
