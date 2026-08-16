function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function validAuthenticator(value) {
  return Boolean(value && typeof value.authenticate === 'function');
}

function normalizePrincipal(value) {
  if (!value || value.authenticated !== true) return null;
  const subject = typeof value.subject === 'string' ? value.subject.trim() : '';
  if (!subject || subject.length > 200 || /[\u0000\r\n]/.test(subject)) return null;
  return Object.freeze({ authenticated: true, subject });
}

function authenticateWith(authenticator, input) {
  if (!validAuthenticator(authenticator)) return null;
  try {
    const result = authenticator.authenticate(input);
    if (!result?.ok) return null;
    const principal = normalizePrincipal(result.principal);
    return principal ? Object.freeze({ ok: true, principal }) : null;
  } catch {
    return null;
  }
}

export function createSchedulePrincipalAuthenticator({ cloudSessionAuthenticator = null, bearerAuthenticator = null } = {}) {
  if (!validAuthenticator(cloudSessionAuthenticator) && !validAuthenticator(bearerAuthenticator)) {
    fail('INVALID_SCHEDULE_PRINCIPAL_AUTH:noAuthenticator');
  }

  function authenticate({ headers } = {}) {
    const input = { headers };
    const cloud = authenticateWith(cloudSessionAuthenticator, input);
    if (cloud) return cloud;
    const bearer = authenticateWith(bearerAuthenticator, input);
    if (bearer) return bearer;
    return Object.freeze({ ok: false, error: 'AUTH_REQUIRED' });
  }

  return Object.freeze({ authenticate });
}

export const SCHEDULE_PRINCIPAL_AUTH_LIMITS = Object.freeze({ maxSubjectChars: 200 });
