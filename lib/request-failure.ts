import type { ServerResponse } from 'node:http';
import type { RequestFailureClassification } from './runtime-contracts.ts';
type FailureError = Error & { status?: unknown; code?: unknown };
const ABORT_ERROR_NAMES = new Set(['AbortError']);
const ABORT_ERROR_CODES = new Set(['ECONNRESET','EPIPE','ERR_STREAM_WRITE_AFTER_END','ERR_STREAM_PREMATURE_CLOSE','ERR_HTTP2_STREAM_CANCEL','ERR_HTTP2_GOAWAY_SESSION']);
const MAX_NVIDIA_DETAIL = 1200;
function isResponseClosed(res: ServerResponse): boolean { return Boolean(res.destroyed || res.writableEnded || res.closed); }
function headersSent(res: ServerResponse): boolean { return Boolean(res.headersSent); }
function isClientAbort(error: unknown): boolean {
  const candidate = error as FailureError | null;
  return Boolean(candidate && ((typeof candidate.name === 'string' && ABORT_ERROR_NAMES.has(candidate.name)) || (typeof candidate.code === 'string' && ABORT_ERROR_CODES.has(candidate.code))));
}
function safeStatus(error: unknown): number {
  const status = Number((error as FailureError | null)?.status);
  return Number.isInteger(status) && status >= 400 && status <= 599 ? status : 502;
}
function publicError(error: unknown): { readonly status: number; readonly error: string } {
  const candidate = error as FailureError | null;
  if (candidate?.message === 'BODY_TOO_LARGE') return { status: 413, error: 'BODY_TOO_LARGE' };
  if (candidate?.message === 'NVIDIA_NOT_CONFIGURED') return { status: 503, error: 'NVIDIA_NOT_CONFIGURED' };
  if (candidate?.message === 'NVIDIA_CHAT_ERROR') return { status: safeStatus(error), error: 'NVIDIA_CHAT_ERROR' };
  if (candidate?.message === 'INVALID_NVIDIA_RESPONSE') return { status: 502, error: 'INVALID_NVIDIA_RESPONSE' };
  if (error instanceof SyntaxError) return { status: 400, error: 'INVALID_JSON' };
  return { status: 500, error: 'INTERNAL_ERROR' };
}
function safeWrite(res: ServerResponse, chunk: string): boolean {
  try { if (isResponseClosed(res)) return false; res.write(chunk); return true; } catch { return false; }
}
function setSafeJsonHeaders(res: ServerResponse): void {
  try {
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Permissions-Policy','camera=(), geolocation=()');
  } catch {}
}
export function classifyRequestFailure(res: ServerResponse, error: unknown): RequestFailureClassification {
  if (isResponseClosed(res)) return 'closed';
  if (isClientAbort(error)) return 'aborted';
  if (headersSent(res)) return 'stream';
  return 'json';
}
export function deliverRequestFailure(res: ServerResponse, error: unknown): RequestFailureClassification {
  const classification = classifyRequestFailure(res, error);
  if (classification === 'closed' || classification === 'aborted') return classification;
  if (classification === 'stream') {
    const candidate = error as FailureError | null;
    safeWrite(res, JSON.stringify(candidate?.message === 'NVIDIA_CHAT_ERROR' ? { error: 'NVIDIA_CHAT_ERROR' } : { error: 'STREAM_INTERRUPTED' }) + '\n');
    try { if (!isResponseClosed(res)) res.end('data: [DONE]\n\n'); } catch {}
    return classification;
  }
  const response = publicError(error);
  try {
    if (!isResponseClosed(res)) {
      setSafeJsonHeaders(res);
      res.writeHead(response.status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
      res.end(JSON.stringify(response));
    }
  } catch {}
  return classification;
}
export const REQUEST_FAILURE_CONTRACT = Object.freeze({ maxNvidiaDetail: MAX_NVIDIA_DETAIL, fallbackStatus: 502, clientAbortCodes: Object.freeze([...ABORT_ERROR_CODES]) });