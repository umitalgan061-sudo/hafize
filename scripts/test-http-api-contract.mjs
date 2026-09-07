import assert from 'node:assert/strict';
import { classifyHttpResponse, normalizeHttpRequest, securityHeaders, shouldRequireJsonBody } from '../lib/http-api-contract.mjs';

const request = normalizeHttpRequest({ method: 'post', path: '/api/agent/run', requestId: 'req-1', contentType: 'application/json', bodyBytes: 42 });
assert.equal(request.method, 'POST');
assert.equal(request.hasBody, true);
assert.equal(shouldRequireJsonBody(request), true);
assert.equal(normalizeHttpRequest({ method: 'GET', path: '/api/models' }).hasBody, false);
assert.throws(() => normalizeHttpRequest({ method: 'TRACE', path: '/' }), /INVALID_HTTP_METHOD/);
assert.throws(() => normalizeHttpRequest({ method: 'GET', path: 'api/models' }), /INVALID_HTTP_PATH/);
assert.throws(() => normalizeHttpRequest({ method: 'POST', path: '/', bodyBytes: -1 }), /INVALID_HTTP_BODY_SIZE/);

const response = classifyHttpResponse({ status: 429, cacheControl: 'public, max-age=100', sensitive: true });
assert.equal(response.retryable, true);
assert.equal(response.cacheControl, 'no-store');
assert.equal(response.success, false);
assert.equal(classifyHttpResponse({ status: 204, sensitive: false }).success, true);
assert.throws(() => classifyHttpResponse({ status: 700 }), /INVALID_HTTP_STATUS/);

const headers = securityHeaders({ allowCredentials: true });
assert.equal(headers['Cache-Control'], 'no-store');
assert.equal(headers['X-Frame-Options'], 'DENY');
assert.equal(headers.Vary, 'Cookie, Authorization');

console.log('http api contract tests passed');
