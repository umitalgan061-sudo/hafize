import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createScheduledNvidiaCompletion } from '../lib/scheduled-nvidia-completion.mjs';

let requestSeenResolve;
const requestSeen = new Promise((resolve) => { requestSeenResolve = resolve; });
let requestClosedResolve;
const requestClosed = new Promise((resolve) => { requestClosedResolve = resolve; });

const server = createServer((req, res) => {
  assert.equal(req.method, 'POST');
  requestSeenResolve();
  req.once('close', () => requestClosedResolve());
  // Intentionally keep the response open. The client AbortSignal must tear this request down.
  res.setHeader('Content-Type', 'application/json');
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
assert.equal(typeof address, 'object');
const url = `http://127.0.0.1:${address.port}/chat/completions`;

const complete = createScheduledNvidiaCompletion({
  timeoutMs: 60_000,
  async complete(payload, signal) {
    const response = await fetch(url, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return response.json();
  }
});

const caller = new AbortController();
const pending = complete({ model: 'nvidia/test-model', messages: [] }, caller.signal);
await requestSeen;
caller.abort(new Error('worker shutdown'));
await assert.rejects(
  () => pending,
  (error) => error?.code === 'SCHEDULE_AGENT_RUN_CANCELLED'
);
await Promise.race([
  requestClosed,
  new Promise((_, reject) => setTimeout(() => reject(new Error('provider request did not close')), 2_000))
]);

await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
process.stdout.write('scheduled NVIDIA real HTTP abort passed\n');
