import { timingSafeEqual } from 'node:crypto';

export type AuthPrincipal = Readonly<{ authenticated: true; subject: string }>;
export type AuthenticationResult = Readonly<{ ok: true; principal: AuthPrincipal }> | Readonly<{ ok: false; error: 'AUTH_REQUIRED' }>;
export type HeaderBag = Readonly<Record<string, string | string[] | undefined>>;
export type BearerAuthenticator = Readonly<{ authenticate(input?: { headers?: HeaderBag }): AuthenticationResult }>;
const MIN_TOKEN_LENGTH = 32;
const MAX_TOKEN_LENGTH = 4096;

function cleanSubject(value: unknown): string { const subject = typeof value === 'string' ? value.trim() : ''; if (!subject || subject.length > 200) throw new Error('INVALID_SERVER_AUTH:subject'); return subject; }
function cleanToken(value: unknown): string { const token = typeof value === 'string' ? value.trim() : ''; if (token.length < MIN_TOKEN_LENGTH || token.length > MAX_TOKEN_LENGTH || /\s/.test(token)) throw new Error('INVALID_SERVER_AUTH:token'); return token; }
function readAuthorization(headers?: HeaderBag): string { const value = headers?.authorization ?? headers?.Authorization; return typeof value === 'string' ? value.trim() : Array.isArray(value) ? String(value[0] || '').trim() : ''; }
function constantTimeTokenEquals(candidate: string, expected: string): boolean { const left = Buffer.from(candidate); const right = Buffer.from(expected); if (left.length !== right.length) { const padded = Buffer.alloc(right.length); left.copy(padded, 0, 0, Math.min(left.length, right.length)); timingSafeEqual(padded, right); return false; } return timingSafeEqual(left, right); }

export function createBearerPrincipalAuthenticator(input: { token: unknown; subject: unknown }): BearerAuthenticator {
  const expectedToken = cleanToken(input.token); const principalSubject = cleanSubject(input.subject);
  return Object.freeze({ authenticate({ headers } = {}) {
    const authorization = readAuthorization(headers); const match = /^Bearer ([^\s]+)$/i.exec(authorization); if (!match) return { ok: false, error: 'AUTH_REQUIRED' as const };
    try { if (!constantTimeTokenEquals(match[1], expectedToken)) return { ok: false, error: 'AUTH_REQUIRED' as const }; } catch { return { ok: false, error: 'AUTH_REQUIRED' as const }; }
    return { ok: true as const, principal: Object.freeze({ authenticated: true as const, subject: principalSubject }) };
  } });
}
