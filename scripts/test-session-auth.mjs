import assert from 'node:assert/strict';
import { createSessionAuth } from '../lib/session-auth.mjs';

const secret = 'x'.repeat(64);
const auth = createSessionAuth({ secret, subject: 'umit', ttlSeconds: 3 });

assert.equal(auth.verifyCredential(secret), true);
assert.equal(auth.verifyCredential(`${secret}x`), false);
assert.equal(auth.verifyCredential('short'), false);

const session = auth.issueSession();
const verified = auth.verifySessionCookie(session);
assert.equal(verified.ok, true);
assert.equal(verified.principal.subject, 'umit');
assert.equal(typeof verified.csrf, 'string');
assert.ok(verified.csrf.length > 20);

const cookie = auth.sessionCookieHeader(session);
assert.match(cookie, /^hafize_session=/);
assert.match(cookie, /HttpOnly/);
assert.match(cookie, /SameSite=Strict/);
assert.match(cookie, /Max-Age=3/);

const request = auth.authenticate({ cookie: cookie.split(';')[0] });
assert.equal(request.ok, true);
assert.equal(request.csrf, verified.csrf);

const tampered = `${session.slice(0, -1)}${session.endsWith('a') ? 'b' : 'a'}`;
assert.equal(auth.verifySessionCookie(tampered).ok, false);
assert.equal(auth.clearCookieHeader().includes('Max-Age=0'), true);

await new Promise((resolve) => setTimeout(resolve, 3_200));
assert.equal(auth.verifySessionCookie(session).ok, false);

console.log('session auth tests passed');
