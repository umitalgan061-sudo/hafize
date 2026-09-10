import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { classifyRequestFailure, deliverRequestFailure, REQUEST_FAILURE_CONTRACT } from '../lib/request-failure.mjs';

class FakeResponse extends EventEmitter {
  constructor({ headersSent = false, destroyed = false } = {}) {
    super();
    this.headersSent = headersSent;
    this.destroyed = destroyed;
    this.writableEnded = false;
    this.closed = false;
    this.writes = [];
    this.headers = new Map();
    this.statusCode = null;
    this.writeHeadCalls = [];
  }
  setHeader(name, value) { this.headers.set(name, value); }
  writeHead(status, headers = {}) {
    this.statusCode = status;
    this.headersSent = true;
    this.writeHeadCalls.push({ status, headers });
  }
  write(chunk) {
    if (this.destroyed) throw new Error('closed');
    this.writes.push(String(chunk));
    return true;
  }
  end(chunk = '') {
    if (this.destroyed) throw new Error('closed');
    if (chunk) this.writes.push(String(chunk));
    this.writableEnded = true;
  }
}

const closed = new FakeResponse({ destroyed: true });
assert.equal(classifyRequestFailure(closed, new Error('boom')), 'closed');
assert.equal(deliverRequestFailure(closed, new Error('boom')), 'closed');
assert.deepEqual(closed.writes, []);

const aborted = new FakeResponse();
const abortError = Object.assign(new Error('socket gone'), { name: 'AbortError' });
assert.equal(classifyRequestFailure(aborted, abortError), 'aborted');
assert.equal(deliverRequestFailure(aborted, abortError), 'aborted');
assert.deepEqual(aborted.writes, []);
for (const code of REQUEST_FAILURE_CONTRACT.clientAbortCodes) {
  const response = new FakeResponse();
  assert.equal(classifyRequestFailure(response, Object.assign(new Error(code), { code })), 'aborted');
}

const bodyTooLarge = new FakeResponse();
assert.equal(deliverRequestFailure(bodyTooLarge, new Error('BODY_TOO_LARGE')), 'json');
assert.equal(bodyTooLarge.statusCode, 413);
assert.match(bodyTooLarge.writes[0], /BODY_TOO_LARGE/);
assert.equal(bodyTooLarge.headers.get('Cache-Control'), undefined, 'cache policy belongs to writeHead');
assert.equal(bodyTooLarge.writeHeadCalls[0].headers['Cache-Control'], 'no-store');
assert.equal(bodyTooLarge.headers.get('X-Content-Type-Options'), 'nosniff');
assert.equal(bodyTooLarge.headers.get('X-Frame-Options'), 'DENY');
assert.equal(bodyTooLarge.headers.get('Referrer-Policy'), 'no-referrer');
assert.equal(bodyTooLarge.headers.get('Permissions-Policy'), 'camera=(), geolocation=()');

const invalidJson = new FakeResponse();
assert.equal(deliverRequestFailure(invalidJson, new SyntaxError('Unexpected token secret')), 'json');
assert.equal(invalidJson.statusCode, 400);
assert.match(invalidJson.writes[0], /INVALID_JSON/);
assert.doesNotMatch(invalidJson.writes[0], /Unexpected token secret/);

const unavailable = new FakeResponse();
assert.equal(deliverRequestFailure(unavailable, new Error('NVIDIA_NOT_CONFIGURED')), 'json');
assert.equal(unavailable.statusCode, 503);
assert.match(unavailable.writes[0], /NVIDIA_NOT_CONFIGURED/);

const provider = new FakeResponse();
const providerError = Object.assign(new Error('NVIDIA_CHAT_ERROR'), { status: 200, detail: 'x'.repeat(5000) });
assert.equal(deliverRequestFailure(provider, providerError), 'json');
assert.equal(provider.statusCode, 502, 'successful/invalid upstream status must not leak as an error status');
assert.match(provider.writes[0], /NVIDIA_CHAT_ERROR/);
// docs/REQUEST_FAILURE_BOUNDARY.md: JSON yolunda provider detayı 1200 karakterle
// sınırlı olarak taşınır; stream yolunda yalnız stabil hata kodu gönderilir.
assert.equal((provider.writes[0].match(/x/g) || []).length, 1200, 'provider detail must stay bounded');

const jsonFailure = new FakeResponse();
assert.equal(deliverRequestFailure(jsonFailure, new Error('unexpected implementation detail')), 'json');
assert.equal(jsonFailure.statusCode, 500);
assert.match(jsonFailure.writes[0], /INTERNAL_ERROR/);
assert.doesNotMatch(jsonFailure.writes[0], /unexpected implementation detail/);

const stream = new FakeResponse({ headersSent: true });
assert.equal(deliverRequestFailure(stream, new Error('tool failed')), 'stream');
assert.equal(stream.writes.length, 2);
assert.match(stream.writes[0], /STREAM_INTERRUPTED/);
assert.match(stream.writes[1], /DONE/);
assert.equal(stream.writableEnded, true);
assert.equal(stream.writeHeadCalls.length, 0, 'stream failure must never call writeHead again');

const streamProvider = new FakeResponse({ headersSent: true });
assert.equal(deliverRequestFailure(streamProvider, new Error('NVIDIA_CHAT_ERROR')), 'stream');
assert.match(streamProvider.writes.join(''), /NVIDIA_CHAT_ERROR/);
assert.match(streamProvider.writes.join(''), /DONE/);

const alreadyEnded = new FakeResponse({ headersSent: true });
alreadyEnded.writableEnded = true;
assert.equal(deliverRequestFailure(alreadyEnded, new Error('boom')), 'closed');

const writeFailing = new FakeResponse({ headersSent: true });
writeFailing.write = () => { throw new Error('EPIPE'); };
writeFailing.end = () => { throw new Error('EPIPE'); };
assert.equal(deliverRequestFailure(writeFailing, new Error('boom')), 'stream');

console.log('request failure boundary OK: closed/aborted/json/stream paths, safe status handling, security headers, public error redaction and write-failure containment');
