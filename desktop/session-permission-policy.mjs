const activePolicies = new WeakMap();

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function parseTrustedUrl(value, errorCode = 'INVALID_DESKTOP_PERMISSION_ORIGIN') {
  if (typeof value !== 'string' || !value) fail(errorCode);
  let url;
  try { url = new URL(value); } catch { fail(errorCode); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) fail(errorCode);
  return url;
}

function exactOrigin(value) {
  const url = parseTrustedUrl(value);
  if (url.origin !== value.replace(/\/$/, '')) fail('INVALID_DESKTOP_PERMISSION_ORIGIN');
  return url.origin;
}

function requestOrigin(details) {
  const raw = details?.requestingUrl || details?.securityOrigin || '';
  try { return parseTrustedUrl(raw, 'INVALID_PERMISSION_REQUEST_URL').origin; } catch { return ''; }
}

function checkedOrigin(value) {
  try { return parseTrustedUrl(value, 'INVALID_PERMISSION_CHECK_URL').origin; } catch { return ''; }
}

export function installElectronSessionPermissionPolicy({
  webContents,
  rendererOrigin,
  allowAudioMedia = false
} = {}) {
  const session = webContents?.session;
  if (typeof session?.setPermissionRequestHandler !== 'function' || typeof session?.setPermissionCheckHandler !== 'function') {
    fail('INVALID_DESKTOP_PERMISSION_SESSION');
  }
  if (typeof allowAudioMedia !== 'boolean') fail('INVALID_DESKTOP_PERMISSION_AUDIO_POLICY');
  if (activePolicies.has(session)) fail('DESKTOP_PERMISSION_POLICY_ALREADY_INSTALLED');
  const origin = exactOrigin(rendererOrigin);
  const registration = Object.freeze({ token: Symbol('desktop-permission-policy') });
  let disposed = false;

  function isTrustedAudioRequest(requester, permission, details = {}) {
    if (!allowAudioMedia || requester !== webContents || permission !== 'media' || details.isMainFrame !== true) return false;
    if (requestOrigin(details) !== origin) return false;
    return Array.isArray(details.mediaTypes) && details.mediaTypes.length > 0 && details.mediaTypes.every((type) => type === 'audio');
  }

  function isTrustedAudioCheck(requester, permission, requestingOrigin, details = {}) {
    if (!allowAudioMedia || requester !== webContents || permission !== 'media' || details.isMainFrame !== true) return false;
    return checkedOrigin(requestingOrigin) === origin && details.mediaType === 'audio';
  }

  session.setPermissionRequestHandler((requester, permission, callback, details) => {
    callback(isTrustedAudioRequest(requester, permission, details));
  });
  try {
    session.setPermissionCheckHandler((requester, permission, requestingOrigin, details) => (
      isTrustedAudioCheck(requester, permission, requestingOrigin, details)
    ));
  } catch (error) {
    session.setPermissionRequestHandler((_requester, _permission, callback) => callback(false));
    throw error;
  }
  activePolicies.set(session, registration);

  return Object.freeze({
    allowAudioMedia,
    dispose() {
      if (disposed) return;
      disposed = true;
      if (activePolicies.get(session) !== registration) return;
      activePolicies.delete(session);
      session.setPermissionRequestHandler((_requester, _permission, callback) => callback(false));
      session.setPermissionCheckHandler(() => false);
    }
  });
}
