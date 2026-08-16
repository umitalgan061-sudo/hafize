const MAX_SUBJECT_CHARS = 200;

function normalizePrincipal(value) {
  if (!value || value.authenticated !== true) return null;
  const subject = typeof value.subject === 'string' ? value.subject.trim() : '';
  if (!subject || subject.length > MAX_SUBJECT_CHARS || /[\u0000\r\n]/.test(subject)) return null;
  return Object.freeze({ authenticated: true, subject });
}

function normalizeResult(value) {
  const principal = normalizePrincipal(value?.principal);
  if (!value?.ok || !principal) return Object.freeze({ ok: false, error: 'AUTH_REQUIRED' });
  return Object.freeze({ ok: true, principal });
}

function authenticateWith(authenticator, args) {
  if (typeof authenticator?.authenticate !== 'function') return Object.freeze({ ok: false, error: 'AUTH_REQUIRED' });
  try {
    return normalizeResult(authenticator.authenticate(args));
  } catch {
    return Object.freeze({ ok: false, error: 'AUTH_REQUIRED' });
  }
}

export function createSchedulePrincipalAuthenticator({
  cloudSessionAuthenticator = null,
  bearerAuthenticator = null
} = {}) {
  const hasCloud = typeof cloudSessionAuthenticator?.authenticate === 'function';
  const hasBearer = typeof bearerAuthenticator?.authenticate === 'function';
  if (!hasCloud && !hasBearer) return null;

  function authenticate(args = {}) {
    if (hasCloud) {
      const cloud = authenticateWith(cloudSessionAuthenticator, args);
      if (cloud.ok) return cloud;
    }
    if (hasBearer) {
      const bearer = authenticateWith(bearerAuthenticator, args);
      if (bearer.ok) return bearer;
    }
    return Object.freeze({ ok: false, error: 'AUTH_REQUIRED' });
  }

  return Object.freeze({
    authenticate,
    modes: Object.freeze({ cloudSession: hasCloud, bearer: hasBearer })
  });
}

export const SCHEDULE_PRINCIPAL_AUTH_LIMITS = Object.freeze({ maxSubjectChars: MAX_SUBJECT_CHARS });
