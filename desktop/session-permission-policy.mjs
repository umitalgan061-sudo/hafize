function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function exactOrigin(value) {
  if (typeof value !== 'string' || !value) fail('INVALID_DESKTOP_PERMISSION_ORIGIN');
  let url;
  try { url = new URL(value); } catch { fail('INVALID_DESKTOP_PERMISSION_ORIGIN'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) fail('INVALID_DESKTOP_PERMISSION_ORIGIN');
  return url.origin;
}

function requestOrigin(details) {
  const raw = details?.requestingUrl || details?.securityOrigin || '';
  try { return new URL(raw).origin; } catch { return ''; }
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
  const origin = exactOrigin(rendererOrigin);

  function isTrustedAudioRequest(requester, permission, details = {}) {
    if (!allowAudioMedia || requester !== webContents || permission !== 'media' || details.isMainFrame !== true) return false;
    if (requestOrigin(details) !== origin) return false;
    return Array.isArray(details.mediaTypes) && details.mediaTypes.length > 0 && details.mediaTypes.every((type) => type === 'audio');
  }

  function isTrustedAudioCheck(requester, permission, requestingOrigin, details = {}) {
    if (!allowAudioMedia || requester !== webContents || permission !== 'media' || details.isMainFrame !== true) return false;
    let checkedOrigin;
    try { checkedOrigin = new URL(requestingOrigin).origin; } catch { return false; }
    return checkedOrigin === origin && details.mediaType === 'audio';
  }

  session.setPermissionRequestHandler((requester, permission, callback, details) => {
    callback(isTrustedAudioRequest(requester, permission, details));
  });
  session.setPermissionCheckHandler((requester, permission, requestingOrigin, details) => (
    isTrustedAudioCheck(requester, permission, requestingOrigin, details)
  ));

  return Object.freeze({
    allowAudioMedia,
    dispose() {
      session.setPermissionRequestHandler((_requester, _permission, callback) => callback(false));
      session.setPermissionCheckHandler(() => false);
    }
  });
}
