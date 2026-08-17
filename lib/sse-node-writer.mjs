const DEFAULT_MAX_CHUNK_BYTES = 256 * 1024;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function requireResponse(response) {
  if (!response || typeof response.write !== 'function' || typeof response.end !== 'function') {
    fail('INVALID_SSE_NODE_WRITER_RESPONSE');
  }
  return response;
}

function normalizeMaxChunkBytes(value) {
  if (value == null) return DEFAULT_MAX_CHUNK_BYTES;
  if (!Number.isInteger(value) || value < 1024 || value > 1024 * 1024) {
    fail('INVALID_SSE_NODE_WRITER_MAX_CHUNK_BYTES');
  }
  return value;
}

function chunkByteLength(chunk) {
  if (typeof chunk === 'string') return Buffer.byteLength(chunk, 'utf8');
  if (chunk instanceof Uint8Array) return chunk.byteLength;
  fail('INVALID_SSE_NODE_WRITER_CHUNK');
}

function isWritable(response) {
  return response.destroyed !== true && response.writableEnded !== true && response.writableFinished !== true;
}

function removeListener(target, event, listener) {
  if (typeof target?.off === 'function') target.off(event, listener);
  else if (typeof target?.removeListener === 'function') target.removeListener(event, listener);
}

function waitForDrain(response, signal) {
  if (!isWritable(response) || signal?.aborted) return Promise.resolve(false);
  if (typeof response.once !== 'function') fail('INVALID_SSE_NODE_WRITER_DRAIN_SUPPORT');

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      removeListener(response, 'drain', onDrain);
      removeListener(response, 'close', onClose);
      removeListener(response, 'error', onError);
      signal?.removeEventListener?.('abort', onAbort);
      resolve(value);
    };
    const onDrain = () => finish(isWritable(response) && !signal?.aborted);
    const onClose = () => finish(false);
    const onError = () => finish(false);
    const onAbort = () => finish(false);

    response.once('drain', onDrain);
    response.once('close', onClose);
    response.once('error', onError);
    signal?.addEventListener?.('abort', onAbort, { once: true });

    if (!isWritable(response) || signal?.aborted) finish(false);
  });
}

export function createSseNodeWriter({ response, signal, maxChunkBytes } = {}) {
  const target = requireResponse(response);
  const chunkLimit = normalizeMaxChunkBytes(maxChunkBytes);
  let ended = false;
  let waitingForDrain = false;

  function writable() {
    return !ended && isWritable(target) && signal?.aborted !== true;
  }

  async function write(chunk) {
    if (!writable()) return false;
    const size = chunkByteLength(chunk);
    if (size > chunkLimit) fail('SSE_OUTPUT_CHUNK_TOO_LARGE');
    if (waitingForDrain) fail('SSE_OUTPUT_WRITE_CONCURRENT');

    let accepted;
    try {
      accepted = target.write(chunk);
    } catch (error) {
      if (!writable()) return false;
      throw error;
    }
    if (accepted !== false) return writable();

    waitingForDrain = true;
    try {
      return await waitForDrain(target, signal);
    } finally {
      waitingForDrain = false;
    }
  }

  async function writeEvent(payload, { event } = {}) {
    if (!writable()) return false;
    const prefix = event ? `event: ${String(event)}\n` : '';
    return write(`${prefix}data: ${JSON.stringify(payload)}\n\n`);
  }

  async function writeError(code) {
    if (typeof code !== 'string' || !/^[A-Z0-9_]{1,80}$/.test(code)) fail('INVALID_SSE_ERROR_CODE');
    return writeEvent({ error: code });
  }

  async function pipe(iterable) {
    if (!iterable || typeof iterable[Symbol.asyncIterator] !== 'function') fail('INVALID_SSE_NODE_WRITER_ITERABLE');
    let chunks = 0;
    let bytes = 0;
    for await (const chunk of iterable) {
      const size = chunkByteLength(chunk);
      if (!await write(chunk)) return Object.freeze({ ok: false, aborted: true, chunks, bytes });
      chunks += 1;
      bytes += size;
    }
    return Object.freeze({ ok: true, aborted: false, chunks, bytes });
  }

  function end(chunk) {
    if (ended) return false;
    ended = true;
    if (!isWritable(target)) return false;
    if (chunk !== undefined) {
      const size = chunkByteLength(chunk);
      if (size > chunkLimit) fail('SSE_OUTPUT_CHUNK_TOO_LARGE');
    }
    try {
      target.end(chunk);
      return true;
    } catch {
      return false;
    }
  }

  return Object.freeze({
    maxChunkBytes: chunkLimit,
    writable,
    write,
    writeEvent,
    writeError,
    pipe,
    end
  });
}

export { DEFAULT_MAX_CHUNK_BYTES, chunkByteLength, isWritable, normalizeMaxChunkBytes };
