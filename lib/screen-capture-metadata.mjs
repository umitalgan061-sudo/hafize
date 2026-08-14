const FIELDS = new Set(['explicitUserIntent', 'mimeType', 'byteLength', 'width', 'height']);
const LIMITS = Object.freeze({ bytes: 2 * 1024 * 1024, width: 1280, height: 720 });

function fail(error) { return { ok: false, error }; }

export function normalizeScreenCaptureMetadata(input) {
  if (!input || Array.isArray(input) || typeof input !== 'object') return fail('INVALID_SCREEN_CAPTURE:input');
  for (const key of Object.keys(input)) {
    if (!FIELDS.has(key)) return fail('INVALID_SCREEN_CAPTURE:field');
  }
  if (input.explicitUserIntent !== true) return fail('SCREEN_CAPTURE_REQUIRES_EXPLICIT_USER_INTENT');
  if (input.mimeType !== 'image/jpeg') return fail('SCREEN_CAPTURE_UNSUPPORTED_MIME');
  if (!Number.isInteger(input.byteLength) || input.byteLength < 1 || input.byteLength > LIMITS.bytes) {
    return fail('SCREEN_CAPTURE_INVALID_SIZE');
  }
  if (!Number.isInteger(input.width) || input.width < 1 || input.width > LIMITS.width) {
    return fail('SCREEN_CAPTURE_INVALID_DIMENSIONS');
  }
  if (!Number.isInteger(input.height) || input.height < 1 || input.height > LIMITS.height) {
    return fail('SCREEN_CAPTURE_INVALID_DIMENSIONS');
  }
  return { ok: true, metadata: Object.freeze({
    mimeType: input.mimeType,
    byteLength: input.byteLength,
    width: input.width,
    height: input.height
  }) };
}

export const SCREEN_CAPTURE_LIMITS = LIMITS;
