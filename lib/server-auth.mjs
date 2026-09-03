import { timingSafeEqual } from 'node:crypto';
import { optionsOf } from './boundary-input.mjs';

const MIN_TOKEN_LENGTH = 32;
const MAX_TOKEN_LENGTH = 4096;

function cleanSubject(value) {
  const subject = typeof value === 'string' ? value.trim() : '';
  if (!subject || subject.length > 200) throw new Error('INVALID_SERVER_AUTH:subject');
  return subject;
}

function cleanToken(value) {
  const token = typeof value === 'string' ? value.trim() : '';
  if (token.length < MIN_TOKEN_LENGTH || token.length > MAX_TOKEN_LENGTH || /\s/.test(token)) {
    throw new Error('INVALID_SERVER_AUTH:token');
  }
  return token;
}

function readAuthorization(headers) {
  if (!headers || typeof headers !== 'object') return '';
  const value = headers.authorization ?? headers.Authorization;
  return typeof value === 'string' ? value.trim() : '';
}

function constantTimeTokenEquals(candidate, expected) {
  const left = Buffer.from(candidate, 'utf8');
  const right = Buffer.from(expected, 'utf8');
  if (left.length !== right.length) {
    const padded = Buffer.alloc(right.length);
    left.copy(padded, 0, 0, Math.min(left.length, right.length));
    timingSafeEqual(padded, right);
    return false;
  }
  return timingSafeEqual(left, right);
}

export function createBearerPrincipalAuthenticator(options) {
  const { token, subject } = optionsOf(options);
  const expectedToken = cleanToken(token);
  const principalSubject = cleanSubject(subject);

  function authenticate(request) {
    // Eksik/bozuk istek nesnesi kimlik doğrulamayı çökertmez, reddeder.
    const authorization = readAuthorization(optionsOf(request).headers);
    const match = /^Bearer ([^\s]+)$/i.exec(authorization);
    if (!match) return { ok: false, error: 'AUTH_REQUIRED' };

    let valid = false;
    try {
      valid = constantTimeTokenEquals(match[1], expectedToken);
    } catch {
      return { ok: false, error: 'AUTH_REQUIRED' };
    }
    if (!valid) return { ok: false, error: 'AUTH_REQUIRED' };

    return {
      ok: true,
      principal: Object.freeze({ authenticated: true, subject: principalSubject })
    };
  }

  return Object.freeze({ authenticate });
}
