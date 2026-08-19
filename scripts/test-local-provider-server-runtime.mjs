import assert from 'node:assert/strict';
import {
  createLocalProviderServerRuntime,
  LOCAL_PROVIDER_SERVER_ENV
} from '../lib/local-provider-server-runtime.mjs';

const encoder = new TextEncoder();

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function sseResponse(chunks = ['data: {"choices":[{"delta":{"content":"ok"}}]}\n\n', 'data: [DONE]\n\n']) {
  return new Response(new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    }
  }), {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' }
  });
}

function hangingSseResponse(signal) {
  return new Response(new ReadableStream({
    start(controller) {
      if (signal?.aborted) {
        controller.error(signal.reason || new DOMException('aborted', 'AbortError'));
        return;
      }
      signal?.addEventListener?.('abort', () => {
        controller.error(signal.reason || new DOMException('aborted', 'AbortError'));
      }, { once: true });
    }
  }), {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' }
  });
}

const nvidiaCalls = [];
const nvidiaComplete = async (payload, signal) => {
  nvidiaCalls.push(['complete', payload, signal]);
  return { choices: [{ message: { role: 'assistant', content: 'nvidia' } }] };
};
const nvidiaStream = async (payload, signal) => {
  nvidiaCalls.push(['stream', payload, signal]);
  return sseResponse(['nvidia']).body;
};
const nvidiaListModels = async (signal) => {
  nvidiaCalls.push(['models', signal]);
  return ['nvidia/a', 'nvidia/a', 'nvidia/b'];
};

assert.deepEqual(LOCAL_PROVIDER_SERVER_ENV, {
  enabled: 'HAFIZE_LOCAL_PROVIDER_ENABLED',
  baseUrl: 'HAFIZE_LOCAL_PROVIDER_BASE_URL'
});

for (const [label, input] of [
  ['nvidiaComplete', { nvidiaStream, nvidiaListModels }],
  ['nvidiaStream', { nvidiaComplete, nvidiaListModels }],
  ['nvidiaListModels', { nvidiaComplete, nvidiaStream }]
]) {
  assert.throws(
    () => createLocalProviderServerRuntime({ env: {}, ...input }),
    new RegExp(`INVALID_LOCAL_PROVIDER_SERVER_RUNTIME:${label}`)
  );
}

for (const value of ['1', 'yes', 'enabled', 'TRUE-ish']) {
  assert.throws(
    () => createLocalProviderServerRuntime({
      env: { HAFIZE_LOCAL_PROVIDER_ENABLED: value },
      nvidiaComplete,
      nvidiaStream,
      nvidiaListModels
    }),
    /INVALID_LOCAL_PROVIDER_ENABLED/
  );
}

assert.throws(
  () => createLocalProviderServerRuntime({
    env: { HAFIZE_LOCAL_PROVIDER_BASE_URL: 'http://127.0.0.1:11434/v1' },
    nvidiaComplete,
    nvidiaStream,
    nvidiaListModels
  }),
  /LOCAL_PROVIDER_BASE_URL_REQUIRES_ENABLE/
);

assert.throws(
  () => createLocalProviderServerRuntime({
    env: {
      HAFIZE_LOCAL_PROVIDER_ENABLED: 'true',
      HAFIZE_LOCAL_PROVIDER_BASE_URL: 'http://192.168.1.10:11434/v1'
    },
    nvidiaComplete,
    nvidiaStream,
    nvidiaListModels
  }),
  /LOCAL_PROVIDER_MUST_BE_LOOPBACK/
);

let disabledNetworkCalls = 0;
const disabled = createLocalProviderServerRuntime({
  env: {},
  nvidiaComplete,
  nvidiaStream,
  nvidiaListModels,
  fetchImpl: async () => {
    disabledNetworkCalls += 1;
    throw new Error('local network should stay disabled');
  }
});
assert.equal(disabled.configured, false);
assert.equal(disabled.defaultProvider, 'nvidia');
assert.equal(disabled.resolve(null, { model: 'nvidia/a' }), 'nvidia');
assert.throws(() => disabled.resolve(null, { model: 'local:qwen' }), /LOCAL_PROVIDER_NOT_ENABLED/);
assert.deepEqual(await disabled.listModels(), ['nvidia/a', 'nvidia/b']);
assert.equal(disabledNetworkCalls, 0);

const disabledController = new AbortController();
const disabledCompletion = await disabled.complete({
  payload: { model: 'nvidia/a', messages: [{ role: 'user', content: 'hi' }] },
  signal: disabledController.signal
});
assert.equal(disabledCompletion.provider, 'nvidia');
assert.equal(disabledCompletion.result.choices[0].message.content, 'nvidia');
assert.equal(nvidiaCalls.at(-1)[2], disabledController.signal);

const localCalls = [];
const localFetch = async (url, init = {}) => {
  localCalls.push({ url: String(url), init });
  if (String(url).endsWith('/models')) {
    return jsonResponse({ data: [{ id: 'qwen2.5' }, { id: 'llama3.2' }] });
  }
  const body = JSON.parse(init.body);
  if (body.stream) return sseResponse();
  return jsonResponse({ choices: [{ message: { role: 'assistant', content: 'local' } }] });
};

const enabled = createLocalProviderServerRuntime({
  env: {
    HAFIZE_LOCAL_PROVIDER_ENABLED: ' TRUE ',
    HAFIZE_LOCAL_PROVIDER_BASE_URL: 'http://localhost:11434/v1/'
  },
  nvidiaComplete,
  nvidiaStream,
  nvidiaListModels,
  fetchImpl: localFetch
});
assert.equal(enabled.configured, true);
assert.equal(enabled.defaultProvider, 'nvidia');
assert.equal(enabled.resolve(null, { model: 'local:qwen2.5' }), 'local');
assert.equal(enabled.resolve(null, { model: 'nvidia/a' }), 'nvidia');

const modelController = new AbortController();
assert.deepEqual(await enabled.listModels({ signal: modelController.signal }), [
  'nvidia/a', 'nvidia/b', 'local:qwen2.5', 'local:llama3.2'
]);
const modelCall = localCalls.find((call) => call.url.endsWith('/models'));
assert.ok(modelCall);
assert.equal(modelCall.init.signal, modelController.signal);
assert.equal('Authorization' in (modelCall.init.headers || {}), false);

const localController = new AbortController();
const localCompletion = await enabled.complete({
  payload: {
    model: 'local:qwen2.5',
    messages: [{ role: 'user', content: 'hello' }],
    stream: false,
    max_tokens: 300
  },
  signal: localController.signal
});
assert.equal(localCompletion.provider, 'local');
assert.equal(localCompletion.result.choices[0].message.content, 'local');
const completionCall = localCalls.find((call) => call.url.endsWith('/chat/completions') && JSON.parse(call.init.body).stream === false);
assert.ok(completionCall);
assert.equal(completionCall.init.signal, localController.signal);
assert.equal(JSON.parse(completionCall.init.body).model, 'qwen2.5');
assert.equal('Authorization' in completionCall.init.headers, false);

const streamController = new AbortController();
const localStreamResult = await enabled.stream({
  payload: {
    model: 'local:llama3.2',
    messages: [{ role: 'user', content: 'stream' }],
    stream: true
  },
  signal: streamController.signal
});
assert.equal(localStreamResult.provider, 'local');
assert.equal(typeof localStreamResult.body[Symbol.asyncIterator], 'function');
const streamCall = localCalls.find((call) => call.url.endsWith('/chat/completions') && JSON.parse(call.init.body).stream === true);
assert.ok(streamCall);
assert.notEqual(streamCall.init.signal, streamController.signal, 'stream must use an owned bounded signal');
assert.equal(streamCall.init.signal.aborted, false);
assert.equal(JSON.parse(streamCall.init.body).model, 'llama3.2');
const streamChunks = [];
for await (const chunk of localStreamResult.body) streamChunks.push(Buffer.from(chunk).toString('utf8'));
assert.equal(streamChunks.some((chunk) => chunk.includes('[DONE]')), true);

const cancelledStreamController = new AbortController();
let cancelledOwnedSignal = null;
const cancelledRuntime = createLocalProviderServerRuntime({
  env: { HAFIZE_LOCAL_PROVIDER_ENABLED: 'true' },
  nvidiaComplete,
  nvidiaStream,
  nvidiaListModels,
  streamTimeoutMs: 5_000,
  async fetchImpl(_url, init = {}) {
    cancelledOwnedSignal = init.signal;
    return hangingSseResponse(init.signal);
  }
});
const cancelledStream = await cancelledRuntime.stream({
  payload: { model: 'local:qwen', messages: [{ role: 'user', content: 'cancel' }] },
  signal: cancelledStreamController.signal
});
const cancelledNext = cancelledStream.body[Symbol.asyncIterator]().next();
cancelledStreamController.abort(new DOMException('caller cancelled', 'AbortError'));
await assert.rejects(cancelledNext, (error) => error.code === 'LOCAL_PROVIDER_CANCELLED' && error.status === 499);
assert.equal(cancelledOwnedSignal.aborted, true, 'caller cancellation must propagate to the owned fetch signal');

let timeoutOwnedSignal = null;
const timeoutRuntime = createLocalProviderServerRuntime({
  env: { HAFIZE_LOCAL_PROVIDER_ENABLED: 'true' },
  nvidiaComplete,
  nvidiaStream,
  nvidiaListModels,
  streamTimeoutMs: 1_000,
  async fetchImpl(_url, init = {}) {
    timeoutOwnedSignal = init.signal;
    return hangingSseResponse(init.signal);
  }
});
const timedStream = await timeoutRuntime.stream({
  payload: { model: 'local:qwen', messages: [{ role: 'user', content: 'timeout' }] }
});
await assert.rejects(timedStream.body[Symbol.asyncIterator]().next(), (error) => {
  assert.equal(error.code, 'LOCAL_PROVIDER_STREAM_TIMEOUT');
  assert.equal(error.status, 504);
  return true;
});
assert.equal(timeoutOwnedSignal.aborted, true, 'deadline must abort the local provider fetch signal');

const beforeToolGate = localCalls.length;
await assert.rejects(
  () => enabled.complete({
    payload: { model: 'local:qwen2.5', messages: [{ role: 'user', content: 'tool' }] },
    toolsRequired: true
  }),
  /LOCAL_PROVIDER_TOOLS_UNSUPPORTED/
);
await assert.rejects(
  () => enabled.complete({
    payload: {
      model: 'local:qwen2.5',
      messages: [{ role: 'user', content: 'tool payload' }],
      tools: [{ type: 'function', function: { name: 'write_external' } }]
    }
  }),
  /LOCAL_PROVIDER_TOOLS_UNSUPPORTED/
);
assert.equal(localCalls.length, beforeToolGate, 'tool-gated local requests must not reach fetch');

const explicitNvidia = await enabled.complete({
  provider: 'nvidia',
  payload: { model: 'nvidia/b', messages: [{ role: 'user', content: 'stay remote' }] }
});
assert.equal(explicitNvidia.provider, 'nvidia');
assert.equal(explicitNvidia.result.choices[0].message.content, 'nvidia');

console.log('local provider server runtime tests passed: NVIDIA default, owned stream deadline/cancellation, loopback-only local routing, and tool default-deny verified');
