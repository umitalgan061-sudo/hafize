function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function rawHeader(headers, name) {
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) return '';
  const value = headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()];
  if (Array.isArray(value)) return value.map((item) => String(item)).join(',');
  return value == null ? '' : String(value);
}

function hasHeader(headers, name) {
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) return false;
  return Object.keys(headers).some((key) => key.toLowerCase() === name.toLowerCase());
}

export function requireEmptyCloudSessionBody(headers) {
  const transferEncoding = rawHeader(headers, 'transfer-encoding').trim();
  if (transferEncoding) fail('CLOUD_SESSION_BODY_NOT_ALLOWED');

  if (hasHeader(headers, 'content-length')) {
    const rawLength = rawHeader(headers, 'content-length');
    if (rawLength !== '0') fail('CLOUD_SESSION_BODY_NOT_ALLOWED');
  }

  const contentEncoding = rawHeader(headers, 'content-encoding').trim();
  if (contentEncoding && contentEncoding.toLowerCase() !== 'identity') {
    fail('CLOUD_SESSION_BODY_NOT_ALLOWED');
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
