import { createSseNodeWriter } from './sse-node-writer.mjs';

const SSE_HEADERS = Object.freeze({
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive'
});

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function requireResponse(response) {
  if (!response || typeof response.writeHead !== 'function' || typeof response.end !== 'function') {
    fail('INVALID_AGENT_SSE_RESPONSE');
  }
  return response;
}

function isOutputFailure(error) {
  return typeof error?.code === 'string'
    && (error.code.startsWith('SSE_OUTPUT_') || error.code.startsWith('INVALID_SSE_'));
}

function normalizePublicErrorCode(value) {
  return typeof value === 'string' && /^[A-Z0-9_]{1,80}$/.test(value) ? value : 'STREAM_INTERRUPTED';
}

function contentFrame(content) {
  if (typeof content !== 'string') fail('INVALID_AGENT_SSE_CONTENT');
  return {
    choices: [{ delta: { content } }]
  };
}

export function createAgentSseNodeSession({
  response,
  signal,
  setSecurityHeaders,
  createWriter = createSseNodeWriter,
  maxChunkBytes,
  drainTimeoutMs
} = {}) {
  const target = requireResponse(response);
  if (typeof createWriter !== 'function') fail('INVALID_AGENT_SSE_WRITER_FACTORY');
  if (setSecurityHeaders != null && typeof setSecurityHeaders !== 'function') {
    fail('INVALID_AGENT_SSE_SECURITY_HEADERS');
  }

  let started = false;
  let ended = false;
  let writer = null;

  function start() {
    if (started) return writer;
    if (ended || target.destroyed === true || target.writableEnded === true || signal?.aborted) return null;
    setSecurityHeaders?.(target);
    target.writeHead(200, SSE_HEADERS);
    writer = createWriter({ response: target, signal, maxChunkBytes, drainTimeoutMs });
    started = true;
    return writer;
  }

  function writable() {
    if (ended || signal?.aborted) return false;
    if (!started) return target.destroyed !== true && target.writableEnded !== true;
    return writer?.writable?.() === true;
  }

  async function guardedWrite(operation) {
    if (!writable()) return Object.freeze({ ok: false, aborted: true, error: 'SSE_OUTPUT_CLOSED' });
    let activeWriter = null;
    try {
      activeWriter = start();
      if (!activeWriter) return Object.freeze({ ok: false, aborted: true, error: 'SSE_OUTPUT_CLOSED' });
      const accepted = await operation(activeWriter);
      if (accepted === false) return Object.freeze({ ok: false, aborted: true, error: 'SSE_OUTPUT_CLOSED' });
      return Object.freeze({ ok: true, aborted: false, error: null });
    } catch (error) {
      const aborted = signal?.aborted === true || target.destroyed === true || target.writableEnded === true
        || activeWriter?.writable?.() === false;
      return Object.freeze({
        ok: false,
        aborted,
        error: isOutputFailure(error) ? error.code : aborted ? 'SSE_OUTPUT_CLOSED' : 'STREAM_INTERRUPTED'
      });
    }
  }

  async function writeToolActivity(activity) {
    if (!activity || typeof activity !== 'object') return Object.freeze({ ok: true, aborted: false, error: null });
    return guardedWrite((activeWriter) => activeWriter.writeEvent(activity, { event: 'hafize-tool-activity' }));
  }

  async function writePublicError(code) {
    const safeCode = normalizePublicErrorCode(code);
    return guardedWrite((activeWriter) => activeWriter.writeError(safeCode));
  }

  async function sendContent(content) {
    const frame = contentFrame(content);
    if (content) {
      const contentResult = await guardedWrite((activeWriter) => activeWriter.writeEvent(frame));
      if (!contentResult.ok) return contentResult;
    }
    return guardedWrite((activeWriter) => activeWriter.write('data: [DONE]\n\n'));
  }

  async function pipe(iterable) {
    if (!iterable || typeof iterable[Symbol.asyncIterator] !== 'function') {
      return Object.freeze({ ok: false, aborted: false, error: 'INVALID_UPSTREAM_STREAM', chunks: 0, bytes: 0 });
    }
    if (!writable()) {
      return Object.freeze({ ok: false, aborted: true, error: 'SSE_OUTPUT_CLOSED', chunks: 0, bytes: 0 });
    }
    let activeWriter;
    try {
      activeWriter = start();
    } catch (error) {
      return Object.freeze({
        ok: false,
        aborted: signal?.aborted === true || target.destroyed === true || target.writableEnded === true,
        error: isOutputFailure(error) ? error.code : 'STREAM_INTERRUPTED',
        chunks: 0,
        bytes: 0
      });
    }
    if (!activeWriter) {
      return Object.freeze({ ok: false, aborted: true, error: 'SSE_OUTPUT_CLOSED', chunks: 0, bytes: 0 });
    }
    try {
      const result = await activeWriter.pipe(iterable);
      return Object.freeze({ ...result, error: result.ok ? null : 'SSE_OUTPUT_CLOSED' });
    } catch (error) {
      if (isOutputFailure(error) || signal?.aborted || !activeWriter.writable()) {
        return Object.freeze({
          ok: false,
          aborted: signal?.aborted === true || !activeWriter.writable(),
          error: isOutputFailure(error) ? error.code : 'SSE_OUTPUT_CLOSED',
          chunks: 0,
          bytes: 0
        });
      }
      const reported = await writePublicError('STREAM_INTERRUPTED');
      return Object.freeze({
        ok: false,
        aborted: !reported.ok && reported.aborted,
        error: 'STREAM_INTERRUPTED',
        chunks: 0,
        bytes: 0
      });
    }
  }

  function end() {
    if (ended) return false;
    ended = true;
    if (writer) return writer.end();
    if (target.destroyed === true || target.writableEnded === true) return false;
    try {
      target.end();
      return true;
    } catch {
      return false;
    }
  }

  return Object.freeze({
    start,
    writable,
    writeToolActivity,
    writePublicError,
    sendContent,
    pipe,
    end,
    isStarted: () => started,
    isEnded: () => ended
  });
}

export { SSE_HEADERS, contentFrame, isOutputFailure, normalizePublicErrorCode };
