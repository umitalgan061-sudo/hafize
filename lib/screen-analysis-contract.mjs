const MAX_MODEL_LENGTH = 200;
const MAX_PROMPT_LENGTH = 4000;
const MAX_IMAGE_BYTES = 1024 * 1024;
const JPEG_PREFIX = 'data:image/jpeg;base64,';

function invalid(reason) {
  return { ok: false, error: 'INVALID_SCREEN_ANALYSIS_REQUEST', reason };
}

function exactKeys(value, allowed) {
  if (!value || Array.isArray(value) || typeof value !== 'object') return false;
  return Object.keys(value).every((key) => allowed.has(key));
}

function decodeJpegDataUrl(value) {
  if (typeof value !== 'string' || !value.startsWith(JPEG_PREFIX)) return null;
  const encoded = value.slice(JPEG_PREFIX.length);
  if (!encoded || encoded.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 8) return null;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length % 4 !== 0) return null;

  let bytes;
  try {
    bytes = Buffer.from(encoded, 'base64');
  } catch {
    return null;
  }
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) return null;
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) return null;
  if (bytes.toString('base64') !== encoded) return null;
  return { dataUrl: value, bytes: bytes.length };
}

export function validateScreenAnalysisRequest(value) {
  const allowed = new Set(['model', 'prompt', 'image', 'explicitUserIntent']);
  if (!exactKeys(value, allowed)) return invalid('invalid_fields');
  if (value.explicitUserIntent !== true) return invalid('explicit_user_intent_required');

  const model = typeof value.model === 'string' ? value.model.trim() : '';
  if (!model || model.length > MAX_MODEL_LENGTH || /[\r\n\0]/.test(model)) return invalid('invalid_model');

  const prompt = typeof value.prompt === 'string' ? value.prompt.trim() : '';
  if (!prompt || prompt.length > MAX_PROMPT_LENGTH) return invalid('invalid_prompt');

  const image = decodeJpegDataUrl(value.image);
  if (!image) return invalid('invalid_jpeg');

  return {
    ok: true,
    value: Object.freeze({ model, prompt, imageDataUrl: image.dataUrl, imageBytes: image.bytes })
  };
}

export const SCREEN_ANALYSIS_LIMITS = Object.freeze({
  maxModelLength: MAX_MODEL_LENGTH,
  maxPromptLength: MAX_PROMPT_LENGTH,
  maxImageBytes: MAX_IMAGE_BYTES,
  mimeType: 'image/jpeg'
});
