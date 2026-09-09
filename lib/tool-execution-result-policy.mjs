import { containsPlaintextCredential, isPlaintextCredentialField } from './plaintext-credential-policy.mjs';

const MAX_DEPTH = 8;
const MAX_NODES = 2_000;
const MAX_STRING_LENGTH = 256 * 1024;

export class ToolExecutionResultPolicyError extends Error {
  constructor(code = 'TOOL_RESULT_UNSAFE') {
    super(code);
    this.name = 'ToolExecutionResultPolicyError';
    this.code = code;
    this.status = 403;
  }
}

function inspectString(value) {
  if (value.length > MAX_STRING_LENGTH) throw new ToolExecutionResultPolicyError('TOOL_RESULT_COMPLEXITY_BLOCKED');
  if (containsPlaintextCredential(value)) throw new ToolExecutionResultPolicyError('TOOL_RESULT_CREDENTIAL_BLOCKED');
}

function inspectValue(value, state, depth = 0) {
  // Every inspected value counts toward the node budget, so a wide object full of scalars
  // is bounded exactly like a deep object graph.
  if (++state.nodes > MAX_NODES) throw new ToolExecutionResultPolicyError('TOOL_RESULT_COMPLEXITY_BLOCKED');
  if (value === null || value === undefined) return;
  if (typeof value === 'string') {
    inspectString(value);
    return;
  }
  if (typeof value !== 'object') return;
  if (depth > MAX_DEPTH) throw new ToolExecutionResultPolicyError('TOOL_RESULT_COMPLEXITY_BLOCKED');
  if (state.seen.has(value)) return;
  state.seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) inspectValue(item, state, depth + 1);
    return;
  }
  let prototype;
  let descriptors;
  try {
    prototype = Object.getPrototypeOf(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    throw new ToolExecutionResultPolicyError('TOOL_RESULT_INSPECTION_FAILED');
  }
  if (prototype !== Object.prototype && prototype !== null) throw new ToolExecutionResultPolicyError('TOOL_RESULT_SHAPE_BLOCKED');
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) throw new ToolExecutionResultPolicyError('TOOL_RESULT_ACCESSOR_BLOCKED');
    if (isPlaintextCredentialField(key, descriptor.value)) throw new ToolExecutionResultPolicyError('TOOL_RESULT_CREDENTIAL_FIELD_BLOCKED');
    inspectValue(descriptor.value, state, depth + 1);
  }
}

export function assertSafeToolExecutionValue(value) {
  inspectValue(value, { seen: new Set(), nodes: 0 });
  return value;
}

export function projectSafeToolExecutionResult(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return result;
  if (result.ok !== true) return result;
  try {
    assertSafeToolExecutionValue(result.value);
  } catch (error) {
    if (error instanceof ToolExecutionResultPolicyError) return { ok: false, error: error.code };
    return { ok: false, error: 'TOOL_RESULT_UNSAFE' };
  }
  return result;
}
