const DEFAULT_MAX_BYTES = 4 * 1024 * 1024;
const MAX_LIMIT_BYTES = 16 * 1024 * 1024;
const DEFAULT_ERROR_PREVIEW_BYTES = 1200;

function fail(code, status = 502, detail = '') {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  if (detail) error.detail = detail;
  throw error;
}

function normalizeMaxBytes(value = DEFAULT_MAX_BYTES) {
  if (!Number.isSafeInteger(value) || value < 1024 || value > MAX_LIMIT_BYTES) {
    fail('INVALID_NVIDIA_JSON_RESPONSE_LIMIT');
  }
  return value;
}

function normalizePreviewBytes(value = DEFAULT_ERROR_PREVIEW_BYTES) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 4096) {
    fail('INVALID_NVIDIA_JSON_RESPONSE_PREVIEW');
  }
  return value;
}

function contentType(response) {
  const value = response?.headers?.get?.('content-type');
  return typeof value === 'string' ? value.toLowerCase() : '';
}

function isJsonContentType(value) {
  return /^application\/(?:[a-z0-9!#$&^_.+-]+\+)?json(?:\s*;|$)/i.test(value || '');
}

async function cancelBody(body) {
  try {
    await body?.cancel?.();
  } catch {
    // Best-effort cancellation only.
  }
}

async function readBoundedBody(response, maxBytes) {
  const lengthHeader = response?.headers?.get?.('content-length');
  if (typeof lengthHeader === 'string' && /^\d+$/.test(lengthHeader)) {
    const declared = Number(lengthHeader);
    if (Number.isSafeInteger(declared) && declared > maxBytes) {
      await cancelBody(response?.body);
      fail('NVIDIA_RESPONSE_TOO_LARGE');
    }
  }
  const body = response?.body;
  if (!body || typeof body[Symbol.asyncIterator] !== 'function') fail('INVALID_NVIDIA_RESPONSE');

  const chunks = [];
  let total = 0;
  for await (const raw of body) {
    const chunk = raw instanceof Uint8Array ? raw : Buffer.from(raw);
    total += chunk.byteLength;
    if (total > maxBytes) {
      await cancelBody(body);
      fail('NVIDIA_RESPONSE_TOO_LARGE');
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, total).toString('utf8');
}

export async function readNvidiaJsonResponse(response, {
  maxBytes = DEFAULT_MAX_BYTES,
  errorPreviewBytes = DEFAULT_ERROR_PREVIEW_BYTES
} = {}) {
  if (!response || typeof response.ok !== 'boolean') fail('INVALID_NVIDIA_RESPONSE');
  const bodyLimit = normalizeMaxBytes(maxBytes);
  const previewLimit = normalizePreviewBytes(errorPreviewBytes);
  const text = await readBoundedBody(response, bodyLimit);

  if (!response.ok) {
    const preview = Buffer.from(text, 'utf8').subarray(0, previewLimit).toString('utf8');
    fail('NVIDIA_CHAT_ERROR', Number.isInteger(response.status) ? response.status : 502, preview);
  }
  if (!isJsonContentType(contentType(response))) fail('INVALID_NVIDIA_RESPONSE');
  try {
    return JSON.parse(text);
  } catch {
    fail('INVALID_NVIDIA_RESPONSE');
  }
}

export const NVIDIA_JSON_RESPONSE_LIMITS = Object.freeze({
  defaultMaxBytes: DEFAULT_MAX_BYTES,
  maxLimitBytes: MAX_LIMIT_BYTES,
  defaultErrorPreviewBytes: DEFAULT_ERROR_PREVIEW_BYTES
});

export { isJsonContentType, normalizeMaxBytes, normalizePreviewBytes, readBoundedBody };
