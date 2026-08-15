import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import {
  GOOGLE_OAUTH_NODE_HTTP_PATHS,
  createGoogleOAuthNodeHttpRoute
} from '../lib/google-oauth-node-http-route.mjs';

function responseDouble() {
  const emitter = new EventEmitter();
  emitter.writableEnded = false;
  emitter.destroyed = false;
  emitter.end = () => { emitter.writableEnded = true; };
  return emitter;
}

function writerLog() {
  const calls = [];
  return {
    calls,
    sendJson(response, status, body) {
      calls.push({ response, status, body });
      response.end();
    }
  };
}

const START = GOOGLE_OAUTH_NODE_HTTP_PATHS.start;
const CALLBACK = GOOGLE_OAUTH_NODE_HTTP_PATHS.callback;
const callbackUrl = new URL('https://hafize.example/api/connectors/gmail/oauth/callback?state=abc&code=code-123');

{
  let runtimeCalls = 0;
  const writer = writerLog();
  const route = createGoogleOAuthNodeHttpRoute({
    runtime: { async handle() { runtimeCalls += 1; return { matched: true, status: 200, body: {} }; } },
    sendJson: writer.sendJson
  });
  const response = responseDouble();
  const result = await route.handle({ response, method: 'GET', pathname: '/api/health' });
  assert.deepEqual(result, { matched: false });
  assert.equal(runtimeCalls, 0, 'unrelated paths must never enter OAuth runtime');
  assert.equal(writer.calls.length, 0);
}

{
  let received;
  const writer = writerLog();
  const route = createGoogleOAuthNodeHttpRoute({
    runtime: {
      async handle(input) {
        received = input;
        return { matched: true, status: 200, body: { authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?...' } };
      }
    },
    sendJson: writer.sendJson
  });
  const response = responseDouble();
  const result = await route.handle({
    response,
    method: 'POST',
    pathname: START,
    url: new URL(`https://hafize.example${START}`),
    headers: {
      authorization: 'Bearer test-token',
      cookie: 'session=must-not-cross-boundary',
      'x-forwarded-for': '203.0.113.5',
      'x-internal-secret': 'must-not-cross-boundary'
    }
  });
  assert.equal(result.status, 200);
  assert.deepEqual(received.headers, { authorization: 'Bearer test-token' });
  assert.equal('request' in received, false, 'raw request/body surface must not be forwarded');
  assert.equal(received.pathname, START);
  assert.equal(received.method, 'POST');
  assert.equal(received.signal instanceof AbortSignal, true);
  assert.equal(writer.calls.length, 1);
  assert.equal(writer.calls[0].status, 200);
  assert.deepEqual(writer.calls[0].body, { authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?...' });
}

{
  let received;
  const writer = writerLog();
  const route = createGoogleOAuthNodeHttpRoute({
    runtime: {
      async handle(input) {
        received = input;
        return { matched: true, status: 200, body: { linked: true, provider: 'google' } };
      }
    },
    sendJson: writer.sendJson
  });
  const response = responseDouble();
  await route.handle({
    response,
    method: 'GET',
    pathname: CALLBACK,
    url: callbackUrl,
    headers: {
      authorization: 'Bearer must-not-enter-public-callback',
      cookie: 'oauth-cookie=must-not-enter-runtime'
    }
  });
  assert.deepEqual(received.headers, {}, 'public callback must not receive request credentials');
  assert.strictEqual(received.url, callbackUrl);
  assert.equal('request' in received, false);
  assert.equal(writer.calls.length, 1);
}

{
  const writer = writerLog();
  const route = createGoogleOAuthNodeHttpRoute({
    runtime: {
      async handle({ method, pathname }) {
        assert.equal(pathname, START);
        assert.equal(method, 'GET');
        return { matched: true, status: 405, body: { error: 'METHOD_NOT_ALLOWED' } };
      }
    },
    sendJson: writer.sendJson
  });
  const response = responseDouble();
  const result = await route.handle({ response, method: 'GET', pathname: START, headers: {} });
  assert.equal(result.status, 405);
  assert.deepEqual(writer.calls[0].body, { error: 'METHOD_NOT_ALLOWED' });
}

{
  let resolveRuntime;
  let observedSignal;
  const gate = new Promise((resolve) => { resolveRuntime = resolve; });
  const writer = writerLog();
  const response = responseDouble();
  const route = createGoogleOAuthNodeHttpRoute({
    runtime: {
      async handle({ signal }) {
        observedSignal = signal;
        await gate;
        return { matched: true, status: 200, body: { linked: true } };
      }
    },
    sendJson: writer.sendJson
  });
  const pending = route.handle({ response, method: 'GET', pathname: CALLBACK, url: callbackUrl });
  await Promise.resolve();
  response.emit('close');
  assert.equal(observedSignal.aborted, true, 'response close must abort the route signal');
  resolveRuntime();
  const result = await pending;
  assert.deepEqual(result, { matched: true, aborted: true });
  assert.equal(writer.calls.length, 0, 'closed response must never receive OAuth result');
}

{
  let runtimeCalls = 0;
  const writer = writerLog();
  const response = responseDouble();
  response.destroyed = true;
  const route = createGoogleOAuthNodeHttpRoute({
    runtime: { async handle() { runtimeCalls += 1; return { matched: true, status: 200, body: {} }; } },
    sendJson: writer.sendJson
  });
  const result = await route.handle({ response, method: 'POST', pathname: START });
  assert.deepEqual(result, { matched: true, aborted: true });
  assert.equal(runtimeCalls, 0, 'already-closed response must short-circuit runtime work');
}

for (const invalid of [
  null,
  {},
  { matched: true },
  { matched: true, status: 99, body: {} },
  { matched: true, status: 600, body: {} },
  { matched: true, status: 200, body: null },
  { matched: true, status: 200, body: [] },
  { matched: true, status: 200, body: 'secret' }
]) {
  const route = createGoogleOAuthNodeHttpRoute({
    runtime: { async handle() { return invalid; } },
    sendJson() {}
  });
  const response = responseDouble();
  if (!invalid?.matched) {
    assert.deepEqual(await route.handle({ response, method: 'POST', pathname: START }), { matched: false });
  } else {
    await assert.rejects(
      () => route.handle({ response, method: 'POST', pathname: START }),
      (error) => error?.code === 'INVALID_GOOGLE_OAUTH_NODE_HTTP_RESPONSE'
    );
  }
}

assert.throws(
  () => createGoogleOAuthNodeHttpRoute({ runtime: null, sendJson() {} }),
  (error) => error?.code === 'INVALID_GOOGLE_OAUTH_NODE_HTTP:runtime'
);
assert.throws(
  () => createGoogleOAuthNodeHttpRoute({ runtime: { handle() {} }, sendJson: null }),
  (error) => error?.code === 'INVALID_GOOGLE_OAUTH_NODE_HTTP:sendJson'
);

{
  const route = createGoogleOAuthNodeHttpRoute({ runtime: { async handle() {} }, sendJson() {} });
  await assert.rejects(
    () => route.handle({ response: {}, method: 'POST', pathname: START }),
    (error) => error?.code === 'INVALID_GOOGLE_OAUTH_NODE_HTTP:response'
  );
  await assert.rejects(
    () => route.handle({ response: responseDouble(), method: 'GET', pathname: CALLBACK, url: null }),
    (error) => error?.code === 'INVALID_GOOGLE_OAUTH_NODE_HTTP:url'
  );
}

console.log('Google OAuth Node HTTP route tests passed');
