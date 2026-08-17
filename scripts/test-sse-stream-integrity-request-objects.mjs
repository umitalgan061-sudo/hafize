import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/chat-run-controller.js');
const origin = 'https://hafize.test';

{
  const request = new Request('https://hafize.test/api/chat', { method: 'POST' });
  assert.equal(api.requestMethod(request), 'POST');
  assert.equal(api.requestUrl(request), 'https://hafize.test/api/chat');
  assert.equal(api.shouldGuardSseRequest(request, undefined, origin), true);
  assert.equal(api.shouldGuardSseRequest(request, { method: 'GET' }, origin), false, 'init method must override Request method');
}

{
  const request = new Request('https://hafize.test/api/agent/run', { method: 'POST' });
  assert.equal(api.shouldGuardSseRequest(request, undefined, origin), true);
}

for (const url of [
  'https://hafize.test/api/chat?debug=1',
  'https://hafize.test/api/chat#tail',
  'https://hafize.test/api/chat/',
  'https://hafize.test/api/agent/run/extra',
  'https://other.test/api/chat'
]) {
  const request = new Request(url, { method: 'POST' });
  assert.equal(api.shouldGuardSseRequest(request, undefined, origin), false, `${url} must stay outside exact guard`);
}

for (const contentType of [
  'text/event-stream',
  'TEXT/EVENT-STREAM',
  'text/event-stream; charset=utf-8',
  ' Text/Event-Stream ; charset=UTF-8'
]) {
  const response = new Response('data: x\n\n', { headers: { 'Content-Type': contentType } });
  assert.equal(api.isEventStreamResponse(response), true, `${contentType} should be accepted`);
}

for (const contentType of [
  'application/json',
  'text/plain',
  'text/event-streaming',
  'application/x-event-stream',
  ''
]) {
  const response = new Response('data: x\n\n', { headers: contentType ? { 'Content-Type': contentType } : {} });
  assert.equal(api.isEventStreamResponse(response), false, `${contentType || 'missing'} must be rejected`);
}

console.log('SSE stream integrity Request compatibility tests passed');
