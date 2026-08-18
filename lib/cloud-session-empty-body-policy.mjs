function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function valueFor(headers, name) {
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) return { present: false, value: '' };
  const matching = Object.entries(headers).filter(([key]) => key.toLowerCase() === name.toLowerCase());
  if (!matching.length) return { present: false, value: '' };
  if (matching.length !== 1 || Array.isArray(matching[0][1])) fail('CLOUD_SESSION_BODY_NOT_ALLOWED');
  const value = matching[0][1];
  return { present: true, value: value == null ? '' : String(value) };
}

function rejectNonEmpty(headers, name) {
  const header = valueFor(headers, name);
  if (header.present && header.value.trim()) fail('CLOUD_SESSION_BODY_NOT_ALLOWED');
}

export function requireEmptyCloudSessionBody(headers) {
  rejectNonEmpty(headers, 'transfer-encoding');
  rejectNonEmpty(headers, 'expect');
  rejectNonEmpty(headers, 'trailer');

  const contentLength = valueFor(headers, 'content-length');
  if (contentLength.present && contentLength.value !== '0') fail('CLOUD_SESSION_BODY_NOT_ALLOWED');

  const contentEncoding = valueFor(headers, 'content-encoding');
  if (contentEncoding.present) {
    const normalized = contentEncoding.value.trim().toLowerCase();
    if (normalized && normalized !== 'identity') fail('CLOUD_SESSION_BODY_NOT_ALLOWED');
  }

  return true;
}

export function hasCloudSessionBodyFraming(headers) {
  try {
    requireEmptyCloudSessionBody(headers);
    return false;
  } catch (error) {
    if (error?.code === 'CLOUD_SESSION_BODY_NOT_ALLOWED') return true;
    throw error;
  }
}
