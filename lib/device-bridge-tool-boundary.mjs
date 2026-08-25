import { authorizeAgentTool } from './agent-runtime.mjs';

const ACTION_POLICY = Object.freeze({
  'system.info': Object.freeze({ permission: 'device.system.info', approvalRequired: false }),
  'browser.open': Object.freeze({ permission: 'device.browser.open', approvalRequired: true }),
  'app.open': Object.freeze({ permission: 'device.app.open', approvalRequired: true })
});

const REQUEST_FIELDS = new Set(['action', 'url', 'appId']);

function fail(error, reason) {
  const result = { ok: false, error };
  if (reason) result.reason = reason;
  return result;
}

function normalizeRequest(input) {
  if (!input || Array.isArray(input) || typeof input !== 'object') {
    return fail('INVALID_DEVICE_TOOL_REQUEST');
  }

  for (const key of Object.keys(input)) {
    if (!REQUEST_FIELDS.has(key)) return fail('INVALID_DEVICE_TOOL_REQUEST');
  }

  const action = typeof input.action === 'string' ? input.action.trim() : '';
  const policy = ACTION_POLICY[action];
  if (!policy) return fail('DEVICE_TOOL_ACTION_NOT_ALLOWED');

  if (action === 'system.info') {
    if ('url' in input || 'appId' in input) return fail('INVALID_DEVICE_TOOL_REQUEST');
    return { ok: true, request: { action }, policy };
  }

  if (action === 'browser.open') {
    if ('appId' in input || typeof input.url !== 'string') return fail('INVALID_DEVICE_TOOL_REQUEST');
    return { ok: true, request: { action, url: input.url }, policy };
  }

  if ('url' in input || typeof input.appId !== 'string') return fail('INVALID_DEVICE_TOOL_REQUEST');
  return { ok: true, request: { action, appId: input.appId }, policy };
}

export function listDeviceToolPermissions() {
  return Object.entries(ACTION_POLICY).map(([action, policy]) => ({
    action,
    permission: policy.permission,
    approvalRequired: policy.approvalRequired
  }));
}

export function authorizeDeviceToolRequest(agent, input, { approvalGranted = false } = {}) {
  const normalized = normalizeRequest(input);
  if (!normalized.ok) return normalized;

  const authorization = authorizeAgentTool(agent, normalized.policy.permission, {
    approvalGranted: Boolean(approvalGranted)
  });
  if (!authorization.allowed) {
    return fail('DEVICE_TOOL_NOT_AUTHORIZED', authorization.reason);
  }

  if (normalized.policy.approvalRequired && approvalGranted !== true) {
    return fail('DEVICE_TOOL_APPROVAL_REQUIRED', 'approval_required');
  }

  return {
    ok: true,
    request: normalized.request,
    permission: normalized.policy.permission,
    approvalRequired: normalized.policy.approvalRequired
  };
}

export async function executeDeviceToolRequest(agent, input, context = {}) {
  const authorization = authorizeDeviceToolRequest(agent, input, {
    approvalGranted: context.approvalGranted === true
  });
  if (!authorization.ok) return authorization;

  const bridge = context.deviceBridge;
  if (!bridge || typeof bridge.execute !== 'function') {
    return fail('DEVICE_BRIDGE_UNAVAILABLE');
  }

  const command = { ...authorization.request };
  if (authorization.approvalRequired) {
    // This flag is derived exclusively from trusted backend approval state.
    // It is intentionally absent from the model/user-shaped request contract.
    command.explicitUserIntent = true;
  }

  try {
    const result = await bridge.execute(command);
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      return fail('DEVICE_BRIDGE_INVALID_RESULT');
    }
    if (result.ok !== true) {
      return fail(typeof result.error === 'string' && result.error ? result.error : 'DEVICE_BRIDGE_EXECUTION_FAILED');
    }
    return { ok: true, value: result };
  } catch {
    return fail('DEVICE_BRIDGE_EXECUTION_FAILED');
  }
}

export const DEVICE_TOOL_BOUNDARY = Object.freeze({
  actions: Object.freeze(Object.keys(ACTION_POLICY)),
  requestFields: Object.freeze([...REQUEST_FIELDS]),
  modelMayAssertExplicitUserIntent: false,
  defaultDeny: true
});
