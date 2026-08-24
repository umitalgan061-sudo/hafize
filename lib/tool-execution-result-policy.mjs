import {
  containsPlaintextCredential,
  isPlaintextCredentialField
} from './plaintext-credential-policy.mjs';

const MAX_TOOL_RESULT_JSON_BYTES = 384 * 1024;
const MAX_TOOL_RESULT_DEPTH = 12;
const MAX_TOOL_RESULT_NODES = 8192;
const MAX_TOOL_RESULT_KEYS = 512;
const MAX_TOOL_RESULT_ARRAY_ITEMS = 2048;
const MAX_TOOL_ERROR_CODE_CHARS = 120;
const MAX_TOOL_FAILURE_REASON_CHARS = 240;
const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,119}$/;

function policyError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function ownData(value, key) {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return { ok: false, value: undefined };
    return { ok: true, value: descriptor.value };
  } catch {
    return { ok: false, value: undefined };
  }
}

function ownKeys(value) {
  try { return Reflect.ownKeys(value); } catch { throw policyError('TOOL_RESULT_INVALID'); }
}

function prototypeOf(value) {
  try { return Object.getPrototypeOf(value); } catch { throw policyError('TOOL_RESULT_INVALID'); }
}

function cloneJsonValue(value, state, depth) {
  if (depth > MAX_TOOL_RESULT_DEPTH) throw policyError('TOOL_RESULT_TOO_DEEP');
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (containsPlaintextCredential(value)) throw policyError('TOOL_RESULT_PLAINTEXT_CREDENTIAL_BLOCKED');
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw policyError('TOOL_RESULT_INVALID');
    return value;
  }
  if (typeof value !== 'object') throw policyError('TOOL_RESULT_INVALID');

  state.nodes += 1;
  if (state.nodes > MAX_TOOL_RESULT_NODES) throw policyError('TOOL_RESULT_TOO_COMPLEX');
  if (state.active.has(value)) throw policyError('TOOL_RESULT_CIRCULAR');
  state.active.add(value);

  try {
    if (Array.isArray(value)) {
      if (prototypeOf(value) !== Array.prototype) throw policyError('TOOL_RESULT_INVALID');
      if (value.length > MAX_TOOL_RESULT_ARRAY_ITEMS) throw policyError('TOOL_RESULT_TOO_COMPLEX');
      const keys = ownKeys(value);
      if (keys.some((key) => typeof key === 'symbol' || (key !== 'length' && !/^(0|[1-9]\d*)$/.test(key)))) {
        throw policyError('TOOL_RESULT_INVALID');
      }
      const clone = [];
      for (let index = 0; index < value.length; index += 1) {
        const entry = ownData(value, String(index));
        if (!entry.ok) throw policyError('TOOL_RESULT_INVALID');
        clone.push(cloneJsonValue(entry.value, state, depth + 1));
      }
      return Object.freeze(clone);
    }

    const prototype = prototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw policyError('TOOL_RESULT_INVALID');
    const keys = ownKeys(value);
    if (keys.length > MAX_TOOL_RESULT_KEYS || keys.some((key) => typeof key === 'symbol')) {
      throw policyError('TOOL_RESULT_TOO_COMPLEX');
    }
    const clone = {};
    for (const key of keys) {
      const entry = ownData(value, key);
      if (!entry.ok) throw policyError('TOOL_RESULT_INVALID');
      if (isPlaintextCredentialField(key, entry.value)) {
        throw policyError('TOOL_RESULT_PLAINTEXT_CREDENTIAL_BLOCKED');
      }
      Object.defineProperty(clone, key, {
        value: cloneJsonValue(entry.value, state, depth + 1),
        enumerable: true,
        configurable: false,
        writable: false
      });
    }
    return Object.freeze(clone);
  } finally {
    state.active.delete(value);
  }
}

function encodedBytes(value) {
  let encoded;
  try { encoded = JSON.stringify(value); } catch { throw policyError('TOOL_RESULT_INVALID'); }
  if (typeof encoded !== 'string') throw policyError('TOOL_RESULT_INVALID');
  return Buffer.byteLength(encoded, 'utf8');
}

export function normalizeToolValue(value) {
  const clone = cloneJsonValue(value, { active: new Set(), nodes: 0 }, 0);
  if (encodedBytes(clone) > MAX_TOOL_RESULT_JSON_BYTES) throw policyError('TOOL_RESULT_TOO_LARGE');
  return clone;
}

function normalizeErrorCode(value, fallback = 'TOOL_EXECUTION_FAILED') {
  const code = typeof value === 'string' ? value.trim() : '';
  return ERROR_CODE_PATTERN.test(code) && code.length <= MAX_TOOL_ERROR_CODE_CHARS ? code : fallback;
}

function normalizeStatus(value) {
  return Number.isInteger(value) && value >= 400 && value <= 599 ? value : null;
}

function normalizeReason(value) {
  if (typeof value !== 'string') return null;
  const reason = value.trim();
  if (!reason || reason.length > MAX_TOOL_FAILURE_REASON_CHARS || /[\u0000-\u001f\u007f]/.test(reason)) return null;
  if (containsPlaintextCredential(reason)) return null;
  return reason;
}

export function createToolSuccessResult(value) {
  try {
    return Object.freeze({ ok: true, value: normalizeToolValue(value) });
  } catch (error) {
    return Object.freeze({ ok: false, error: normalizeErrorCode(error?.code, 'TOOL_RESULT_INVALID') });
  }
}

export function createToolFailureResult(code, { status = null, reason = null } = {}) {
  const result = { ok: false, error: normalizeErrorCode(code) };
  const cleanStatus = normalizeStatus(status);
  const cleanReason = normalizeReason(reason);
  if (cleanStatus !== null) result.status = cleanStatus;
  if (cleanReason !== null) result.reason = cleanReason;
  return Object.freeze(result);
}

export function createToolFailureFromError(error) {
  const code = ownData(error, 'code');
  const status = ownData(error, 'status');
  return createToolFailureResult(code.ok ? code.value : 'TOOL_EXECUTION_FAILED', {
    status: status.ok ? status.value : null
  });
}

export function normalizeToolExecutionResult(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return createToolFailureResult('TOOL_RESULT_INVALID');
  }
  const ok = ownData(result, 'ok');
  if (!ok.ok || typeof ok.value !== 'boolean') return createToolFailureResult('TOOL_RESULT_INVALID');
  if (ok.value === true) {
    const keys = ownKeys(result);
    if (keys.length !== 2 || !keys.includes('ok') || !keys.includes('value')) {
      return createToolFailureResult('TOOL_RESULT_INVALID');
    }
    const value = ownData(result, 'value');
    return value.ok ? createToolSuccessResult(value.value) : createToolFailureResult('TOOL_RESULT_INVALID');
  }

  const keys = ownKeys(result);
  const allowed = new Set(['ok', 'error', 'status', 'reason']);
  if (keys.some((key) => typeof key !== 'string' || !allowed.has(key))) {
    return createToolFailureResult('TOOL_RESULT_INVALID');
  }
  const error = ownData(result, 'error');
  if (!error.ok) return createToolFailureResult('TOOL_RESULT_INVALID');
  const status = ownData(result, 'status');
  const reason = ownData(result, 'reason');
  return createToolFailureResult(error.value, {
    status: status.ok ? status.value : null,
    reason: reason.ok ? reason.value : null
  });
}

export const TOOL_EXECUTION_RESULT_POLICY = Object.freeze({
  maxJsonBytes: MAX_TOOL_RESULT_JSON_BYTES,
  maxDepth: MAX_TOOL_RESULT_DEPTH,
  maxNodes: MAX_TOOL_RESULT_NODES,
  maxKeys: MAX_TOOL_RESULT_KEYS,
  maxArrayItems: MAX_TOOL_RESULT_ARRAY_ITEMS,
  maxErrorCodeChars: MAX_TOOL_ERROR_CODE_CHARS,
  maxFailureReasonChars: MAX_TOOL_FAILURE_REASON_CHARS
});
