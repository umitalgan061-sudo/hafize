const ABORT_ERROR_NAMES = new Set(['AbortError']);
const ABORT_ERROR_CODES = new Set(['ECONNRESET', 'EPIPE', 'ERR_STREAM_WRITE_AFTER_END', 'ERR_STREAM_PREMATURE_CLOSE', 'ERR_HTTP2_STREAM_CANCEL', 'ERR_HTTP2_GOAWAY_SESSION']);
const MAX_NVIDIA_DETAIL = 1200;

function isResponseClosed(res) {
  return Boolean(res?.destroyed || res?.writableEnded || res?.closed);
}

function headersSent(res) {
  return Boolean(res?.headersSent);
}

function isClientAbort(error) {
  return Boolean(
    error && (
      ABORT_ERROR_NAMES.has(error.name) ||
      ABORT_ERROR_CODES.has(error.code)
    )
  );
}

function safeStatus(error) {
  const status = Number(error?.status);
  return Number.isInteger(status) && status >= 400 && status <= 599 ? status : 502;
}

function publicError(error) {
  if (error?.message === 'BODY_TOO_LARGE') return { status: 413, error: 'BODY_TOO_LARGE' };
  if (error?.message === 'NVIDIA_NOT_CONFIGURED') return { status: 503, error: 'NVIDIA_NOT_CONFIGURED' };
  if (error?.message === 'NVIDIA_CHAT_ERROR') {
    return {
      status: safeStatus(error),
      error: 'NVIDIA_CHAT_ERROR',
      detail: typeof error.detail === 'string' ? error.detail.slice(0, MAX_NVIDIA_DETAIL) : ''
    };
  }
  if (error?.message === 'INVALID_NVIDIA_RESPONSE') return { status: 502, error: 'INVALID_NVIDIA_RESPONSE' };
  if (error instanceof SyntaxError) return { status: 400, error: 'INVALID_JSON' };
  return { status: 500, error: 'INTERNAL_ERROR' };
}

function safeWrite(res, chunk) {
  try {
    if (isResponseClosed(res)) return false;
    res.write(chunk);
    return true;
  } catch {
    return false;
  }
}

export function classifyRequestFailure(res, error) {
  if (isResponseClosed(res)) return 'closed';
  if (isClientAbort(error)) return 'aborted';
  if (headersSent(res)) return 'stream';
  return 'json';
}

export function deliverRequestFailure(res, error) {
  const classification = classifyRequestFailure(res, error);
  if (classification === 'closed' || classification === 'aborted') return classification;

  if (classification === 'stream') {
    const payload = error?.message === 'NVIDIA_CHAT_ERROR'
      ? { error: 'NVIDIA_CHAT_ERROR' }
      : { error: 'STREAM_INTERRUPTED' };
    safeWrite(res, `data: ${JSON.stringify(payload)}\n\n`);
    try { if (!isResponseClosed(res)) res.end('data: [DONE]\n\n'); } catch {}
    return classification;
  }

  const response = publicError(error);
  try {
    if (!isResponseClosed(res)) {
      res.writeHead(response.status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
      });
      res.end(JSON.stringify(response));
    }
  } catch {}
  return classification;
}

export const REQUEST_FAILURE_CONTRACT = Object.freeze({
  maxNvidiaDetail: MAX_NVIDIA_DETAIL,
  fallbackStatus: 502,
  clientAbortCodes: Object.freeze([...ABORT_ERROR_CODES])
});
