import { authorizeAgentTool } from './agent-runtime.mts';
import { deviceApprovalTargetForRequest } from './device-approval-lease.mts';

const ACTION_POLICY = Object.freeze({
  'system.info': Object.freeze({ permission: 'device.system.info', approvalRequired: false }),
  'browser.open': Object.freeze({ permission: 'device.browser.open', approvalRequired: true }),
  'app.open': Object.freeze({ permission: 'device.app.open', approvalRequired: true })
});

const REQUEST_FIELDS = new Set(['action', 'url', 'appId']);

/**
 * Bu sınırın dönüşleri ayrımlı birleşimdir; `ok` literal olduğu için çağıran
 * taraf tek bir karşılaştırmayla hangi alanların var olduğunu görebilir.
 */
export type DeviceToolFailure = { ok: false; error: string; reason?: string };

export type DeviceToolAuthorization = DeviceToolFailure | { ok: true; request: Record<string, any>; permission: string; approvalRequired: boolean; };

export type DeviceToolExecution = DeviceToolFailure | { ok: true; [key: string]: any };


function fail(error: string, reason?: string): DeviceToolFailure {
  const result: DeviceToolFailure = { ok: false as const, error };
  if (reason) result.reason = reason;
  return result;
}

function normalizeRequest(input: UnvalidatedInput | null | undefined): DeviceToolFailure | { ok: true; request: Record<string, any>; policy: { permission: string; approvalRequired: boolean } } {
  if (!input || Array.isArray(input) || typeof input !== 'object') return fail('INVALID_DEVICE_TOOL_REQUEST');
  for (const key of Object.keys(input)) if (!REQUEST_FIELDS.has(key)) return fail('INVALID_DEVICE_TOOL_REQUEST');
  const action = typeof input.action === 'string' ? input.action.trim() : '';
  const policy = ACTION_POLICY[action];
  if (!policy) return fail('DEVICE_TOOL_ACTION_NOT_ALLOWED');
  if (action === 'system.info') {
    if ('url' in input || 'appId' in input) return fail('INVALID_DEVICE_TOOL_REQUEST');
    return { ok: true as const, request: { action }, policy };
  }
  if (action === 'browser.open') {
    if ('appId' in input || typeof input.url !== 'string') return fail('INVALID_DEVICE_TOOL_REQUEST');
    return { ok: true as const, request: { action, url: input.url }, policy };
  }
  if ('url' in input || typeof input.appId !== 'string') return fail('INVALID_DEVICE_TOOL_REQUEST');
  return { ok: true as const, request: { action, appId: input.appId }, policy };
}

export function listDeviceToolPermissions() {
  return Object.entries(ACTION_POLICY).map(([action, policy]) => ({ action, permission: policy.permission, approvalRequired: policy.approvalRequired }));
}

export function authorizeDeviceToolRequest(agent: UnvalidatedInput, input: UnvalidatedInput | null | undefined, { approvalGranted = false }: { approvalGranted?: boolean } = {}): DeviceToolAuthorization {
  const normalized = normalizeRequest(input);
  if (normalized.ok === false) return normalized;
  const authorization = authorizeAgentTool(agent, normalized.policy.permission, { approvalGranted: Boolean(approvalGranted) });
  if (!authorization.allowed) return fail('DEVICE_TOOL_NOT_AUTHORIZED', authorization.reason);
  if (normalized.policy.approvalRequired && approvalGranted !== true) return fail('DEVICE_TOOL_APPROVAL_REQUIRED', 'approval_required');
  return { ok: true as const, request: normalized.request, permission: normalized.policy.permission, approvalRequired: normalized.policy.approvalRequired };
}

function resolveTrustedApproval(request: Record<string, any>, context: UnvalidatedInput): DeviceToolFailure | { ok: true } {
  if (context.approvalStore && typeof context.approvalStore.consume === 'function') {
    let target;
    try { target = deviceApprovalTargetForRequest(request); } catch { return fail('INVALID_DEVICE_TOOL_REQUEST'); }
    const result = context.approvalStore.consume({ token: context.approvalToken, traceId: context.traceId, action: request.action, target });
    return result?.ok === true ? { ok: true as const } : fail(result?.error || 'DEVICE_TOOL_APPROVAL_REQUIRED', 'approval_required');
  }
  return context.approvalGranted === true ? { ok: true as const } : fail('DEVICE_TOOL_APPROVAL_REQUIRED', 'approval_required');
}

export async function executeDeviceToolRequest(agent: UnvalidatedInput, input: UnvalidatedInput | null | undefined, context: UnvalidatedInput = {}): Promise<DeviceToolExecution> {
  const normalized = normalizeRequest(input);
  if (normalized.ok === false) return normalized;
  let approvalGranted = false;
  if (normalized.policy.approvalRequired) {
    const approval = resolveTrustedApproval(normalized.request, context);
    if (approval.ok === false) return approval;
    approvalGranted = true;
  }
  const authorization = authorizeDeviceToolRequest(agent, normalized.request, { approvalGranted });
  if (authorization.ok === false) return authorization;
  const bridge = context.deviceBridge;
  if (!bridge || typeof bridge.execute !== 'function') return fail('DEVICE_BRIDGE_UNAVAILABLE');
  const command = { ...authorization.request };
  if (authorization.approvalRequired) command.explicitUserIntent = true;
  try {
    const result = await bridge.execute(command);
    if (!result || typeof result !== 'object' || Array.isArray(result)) return fail('DEVICE_BRIDGE_INVALID_RESULT');
    if (result.ok !== true) return fail(typeof result.error === 'string' && result.error ? result.error : 'DEVICE_BRIDGE_EXECUTION_FAILED');
    return { ok: true as const, value: result };
  } catch {
    return fail('DEVICE_BRIDGE_EXECUTION_FAILED');
  }
}

export const DEVICE_TOOL_BOUNDARY = Object.freeze({
  actions: Object.freeze(Object.keys(ACTION_POLICY)),
  requestFields: Object.freeze([...REQUEST_FIELDS]),
  modelMayAssertExplicitUserIntent: false,
  preferredTrustedApproval: 'single-use-trace-action-target-lease',
  defaultDeny: true
});
