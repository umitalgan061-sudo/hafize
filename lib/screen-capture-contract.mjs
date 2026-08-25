const ALLOWED_FIELDS = new Set([
  'explicitUserIntent', 'mimeType', 'byteLength', 'width', 'height'
]);
const ALLOWED_MIME_TYPES = new Set(['image/jpeg']);
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_WIDTH = 1280;
const MAX_HEIGHT = 720;

function fail(error) {
  return { ok: false, error };
}

function requireObject(input) {
  if (!input || Array.isArray(input) || typeof input !== 'object') {
    throw new Error('INVALID_SCREEN_CAPTURE_METADATA:input');
  }
  for (const key of Object.keys(input)) {
    if (!ALLOWED_FIELDS.has(key)) throw new Error('INVALID_SCREEN_CAPTURE_METADATA:field');
  }
}

function positiveInt(value, label, max) {
  if (!Number.isInteger(value) || value < 1 || value > max) {
    throw new Error(`INVALID_SCREEN_CAPTURE_METADATA:${label}`);
  }
  return value;
}

export function normalizeScreenCaptureMetadata(input) {
  try {
    requireObject(input);
    if (input.explicitUserIntent !== true) {
      throw new Error('SCREEN_CAPTURE_REQUIRES_EXPLICIT_USER_INTENT');
    }
    if (!ALLOWED_MIME_TYPES.has(input.mimeType)) {
      throw new Error('INVALID_SCREEN_CAPTURE_METADATA:mimeType');
    }
    return {
      ok: true,
      metadata: {
        mimeType: input.mimeType,
        byteLength: positiveInt(input.byteLength, 'byteLength', MAX_BYTES),
        width: positiveInt(input.width, 'width', MAX_WIDTH),
        height: positiveInt(input.height, 'height', MAX_HEIGHT)
      }
    };
  } catch (error) {
    return fail(error.message);
  }
}

export const SCREEN_CAPTURE_CONTRACT = Object.freeze({
  allowedMimeTypes: Object.freeze([...ALLOWED_MIME_TYPES]),
  maxBytes: MAX_BYTES,
  maxWidth: MAX_WIDTH,
  maxHeight: MAX_HEIGHT
});
