import type { ServerResponse } from 'node:http';

type FailureLike = Error & { status?: number; code?: string };
export const REQUEST_FAILURE_CONTRACT = Object.freeze({ maxNvidiaDetail: 1200, fallbackStatus: 502, clientAbortCodes: Object.freeze(['ECONNRESET', 'EPIPE', 'ERR_STREAM_WRITE_AFTER_END', 'ERR_STREAM_PREMATURE_CLOSE', 'ERR_HTTP2_STREAM_CANCEL', 'ERR_HTTP2_GOAWAY_SESSION']) });
const ABORT_ERROR_NAMES = new Set(['AbortError']);
const ABORT_ERROR_CODES = new Set(REQUEST_FAILURE_CONTRACT.clientAbortCodes);
function closed(res: ServerResponse): boolean { return Boolean(res.destroyed || res.writableEnded || res.closed); }
function sent(res: ServerResponse): boolean { return Boolean(res.headersSent); }
function clientAbort(error: unknown): boolean { const value = error as FailureLike | null; return Boolean(value && (ABORT_ERROR_NAMES.has(value.name) || ABORT_ERROR_CODES.has(value.code || ''))); }
function status(error: unknown): number { const value = Number((error as FailureLike | null)?.status); return Number.isInteger(value) && value >= 400 && value <= 599 ? value : 502; }
function publicError(error: unknown) {
  const message = (error as FailureLike | null)?.message;
  if (message === 'BODY_TOO_LARGE') return { status: 413, error: 'BODY_TOO_LARGE' };
  if (message === 'NVIDIA_NOT_CONFIGURED') return { status: 503, error: 'NVIDIA_NOT_CONFIGURED' };
  if (message === 'NVIDIA_CHAT_ERROR') return { status: status(error), error: 'NVIDIA_CHAT_ERROR' };
  if (message === 'INVALID_NVIDIA_RESPONSE') return { status: 502, error: 'INVALID_NVIDIA_RESPONSE' };
  if (error instanceof SyntaxError) return { status: 400, error: 'INVALID_JSON' };
  return { status: 500, error: 'INTERNAL_ERROR' };
}
function safeWrite(res: ServerResponse, chunk: string): boolean { try { if (closed(res)) return false; res.write(chunk); return true; } catch { return false; } }
function safeHeaders(res: ServerResponse): void { try { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('X-Frame-Options', 'DENY'); res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('Permissions-Policy', 'camera=(), geolocation=(), usb=(), payment=()'); } catch {} }
export function classifyRequestFailure(res: ServerResponse, error: unknown): 'closed' | 'aborted' | 'stream' | 'json' { if (closed(res)) return 'closed'; if (clientAbort(error)) return 'aborted'; if (sent(res)) return 'stream'; return 'json'; }
export function deliverRequestFailure(res: ServerResponse, error: unknown): 'closed' | 'aborted' | 'stream' | 'json' {
  const classification = classifyRequestFailure(res, error);
  if (classification === 'closed' || classification === 'aborted') return classification;
  if (classification === 'stream') { safeWrite(res, `data: ${JSON.stringify({ error: (error as FailureLike)?.message === 'NVIDIA_CHAT_ERROR' ? 'NVIDIA_CHAT_ERROR' : 'STREAM_INTERRUPTED' })}\n\n`); try { if (!closed(res)) res.end('data: [DONE]\n\n'); } catch {} return classification; }
  const response = publicError(error);
  try { if (!closed(res)) { safeHeaders(res); res.writeHead(response.status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(response)); } } catch {}
  return classification;
}
