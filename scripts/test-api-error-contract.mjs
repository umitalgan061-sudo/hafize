import assert from 'node:assert/strict';
import { API_ERROR_CONTRACT, isRetryableApiError, mapToolFailureToApiError, normalizeApiError } from '../lib/api-error-contract.mjs';

assert.deepEqual(normalizeApiError({ code: 'AUTH_REQUIRED', status: 401, message: ' giriş gerekli ', requestId: 'req-1' }), { error: 'AUTH_REQUIRED', status: 401, message: 'giriş gerekli', requestId: 'req-1' });
assert.equal(normalizeApiError({ code: 'UNKNOWN', status: 700 }).error, 'INTERNAL_ERROR');
assert.equal(normalizeApiError({ code: 'RATE_LIMITED', status: 429 }).status, 429);
assert.equal(normalizeApiError({ code: 'AUTH_REQUIRED', status: 401, message: 'a\nb' }).message, 'a b');
assert.equal(isRetryableApiError({ code: 'NVIDIA_CHAT_ERROR', status: 502 }), true);
assert.equal(isRetryableApiError({ code: 'AUTH_REQUIRED', status: 401 }), false);
assert.deepEqual(mapToolFailureToApiError({ error: 'TOOL_NOT_AUTHORIZED' }, 'r1'), { error: 'TOOL_NOT_AUTHORIZED', status: 403, message: '', requestId: 'r1' });
assert.deepEqual(mapToolFailureToApiError({ error: 'UPSTREAM', status: 504 }), { error: 'INTERNAL_ERROR', status: 504, message: '', requestId: 'r1' });
assert.equal(API_ERROR_CONTRACT.maxMessageLength, 500);
assert.ok(Object.isFrozen(API_ERROR_CONTRACT));

console.log('api error contract tests passed');
