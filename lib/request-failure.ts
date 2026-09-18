import type { ServerResponse } from 'node:http';
import type { RequestFailureClassification } from './runtime-contracts.ts';

type FailureError = Error & { readonly status?: unknown; readonly code?: unknown };

const ABORT_ERROR_NAMES = new Set(['AbortError']);
const ABORT_ERROR_CODES = new Set([
  'ECONNRESET','EPIPE','ERR_STREAM_WRITE_AFTER_END','ERR_STREAM_PREMATURE_CLOSE',
  'ERR_HTTP2_STREAM_CANCEL','ERR_HTTP2_GOAWAY_SESSION'
]);

function closed(res: ServerResponse): boolean {
  return Boolean(res.destroyed || res.writableEnded || res.closed);
}

function aborted(error: unknown): boolean {
  const value = error as FailureError | null;
  return Boolean(value && (
    (typeof value.name === 'string' && ABORT_ERROR_NAMES.has(value.name)) ||
    (typeof value.code === 'string' && ABORT_ERROR_CODES.has(value.code))
  ));
}

function safeStatus(error: unknown): number {
  const status = Number((error as FailureError | null)?.status);
  return Number.isInteger(status) && status >= 400 && status <= 599 ? status : 502;
}

function publicError(error: unknown): { readonly status: number; readonly error: string } {
  const value = error as FailureError | null;
  if (value?.message === 'BODY_TOO_LARGE') return { status: 413, error: 'BODY_TOO_LARGE' };
  if (value?.message === 'NVIDIA_NOT_CONFIGURED') return { status: 503, error: 'NVIDIA_NOT_CONFIGURED' };
  if (value?.message === 'NVIDIA_CHAT_ERROR') return { status: safeStatus(error), error: 'NVIDIA_CHAT_ERROR' };
  if (value?.message === 'INVALID_NVIDIA_RESPONSE') return { status: 502, error: 'INVALID_NVIDIA_RESPONSE' };
  if (error instanceof SyntaxError) return { status: 400, error: 'INVALID_JSON' };
  return { status: 500, error: 'INTERNAL_ERROR' };
}

export function classifyRequestFailure(res: ServerResponse, error: unknown): RequestFailureClassification {
  if (closed(res)) return 'closed';
  if (aborted(error)) return 'aborted';
  if (res.headersSent) return 'stream';
  return 'json';
}

export function deliverRequestFailure(res: ServerResponse, error: unknown): RequestFailureClassification {
  const classification = classifyRequestFailure(res, error);
  if (classification === 'closed' || classification === 'aborted') return classification;

  if (classification === 'stream') {
    const value = error as FailureError | null;
    const payload = value?.message === 'NVIDIA_CHAT_ERROR'
      ? { error: 'NVIDIA_CHAT_ERROR' }
      : { error: 'STREAM_INTERRUPTED' };
    try {
      if (!closed(res)) {
        res.write('data: ' + JSON.stringify(payload) + '\n\n');
        res.end('data: [DONE]\n\n');
      }
    } catch {}
    return classification;
  }

  const response = publicError(error);
  try {
    if (!closed(res)) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('Referrer-Policy', 'no-referrer');
      res.setHeader('Permissions-Policy', 'camera=(), geolocation=()');
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
  fallbackStatus: 502,
  clientAbortCodes: Object.freeze([...ABORT_ERROR_CODES])
});
