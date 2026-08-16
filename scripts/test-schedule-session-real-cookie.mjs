import assert from 'node:assert/strict';
import { scryptSync } from 'node:crypto';
import { createCloudSessionAuth } from '../lib/cloud-session-auth.mjs';
import { createScheduleHttpApi } from '../lib/schedule-http-api.mjs';
import { createOptionalScheduleSessionAuthenticator } from '../lib/schedule-session-auth.mjs';

const PASSWORD = 'correct horse battery staple';
const N = 16_384;
const r = 8;
const p = 1;
const salt = Buffer.from('0123456789abcdef', 'utf8');
const digest = scryptSync(PASSWORD, salt, 32, { N, r, p, maxmem: 32 * 1024 * 1024 });
const passwordHash = `scrypt$${N}$${r}$${p}$${salt.toString('base64url')}$${digest.toString('base64url')}`;
const signingKey = Buffer.alloc(32, 7).toString('base64url');
const subject = 'browser-owner';
const ttlMs = 60 * 60 * 1000;
const nowValue = 2_000_000_000_000;
const env = {
  HAFIZE_CLOUD_SESSION_PASSWORD_HASH: passwordHash,
  HAFIZE_CLOUD_SESSION_SIGNING_KEY: signingKey,
  HAFIZE_CLOUD_SESSION_SUBJECT: subject,
  HAFIZE_CLOUD_SESSION_ORIGIN: 'https://hafize.example',
  HAFIZE_CLOUD_SESSION_TTL_MS: String(ttlMs)
};

function authFactory(config) {
  return createCloudSessionAuth({
    ...config,
    now: () => nowValue,
    randomBytesImpl: () => Buffer.alloc(18, 9)
  });
}

const loginAuth = authFactory({ passwordHash, signingKey, subject, ttlMs });
const login = await loginAuth.login({ password: PASSWORD });
assert.equal(login.ok, true);
assert.equal(login.expiresAt, nowValue + ttlMs);
assert.match(login.setCookie, /^__Host-hafize_session=/);
assert.match(login.setCookie, /HttpOnly/);
assert.match(login.setCookie, /Secure/);
assert.match(login.setCookie, /SameSite=Strict/);
const cookie = login.setCookie.split(';', 1)[0];

const sessionAuthenticator = createOptionalScheduleSessionAuthenticator({ env, createAuth: authFactory });
assert.equal(sessionAuthenticator.authenticate({ headers: { cookie } }).ok, true);
assert.equal(sessionAuthenticator.authenticate({ headers: { cookie } }).principal.subject, subject);

const primaryBearer = {
  authenticate({ headers }) {
    return headers?.authorization === 'Bearer server-token'
      ? { ok: true, principal: Object.freeze({ authenticated: true, subject: 'server-owner' }) }
      : { ok: false, error: 'AUTH_REQUIRED' };
  }
};

const calls = [];
const commands = {
  async list({ principal }) {
    calls.push(['list', principal.subject]);
    return { ok: true, schedules: [{ scheduleId: `${principal.subject}-1`, owner: principal.subject }] };
  },
  async create({ principal, input }) {
    calls.push(['create', principal.subject, input.task]);
    return { ok: true, schedule: { scheduleId: `${principal.subject}-2`, owner: principal.subject } };
  },
  async reschedule({ principal, scheduleId, input }) {
    calls.push(['reschedule', principal.subject, scheduleId, input.runAt]);
    return { ok: true, schedule: { scheduleId, owner: principal.subject } };
  },
  async cancel({ principal, scheduleId }) {
    calls.push(['cancel', principal.subject, scheduleId]);
    return { ok: true, schedule: { scheduleId, owner: principal.subject } };
  }
};
const api = createScheduleHttpApi({
  authenticator: primaryBearer,
  sessionAuthenticator,
  commands,
  readJson: async (request) => request.body
});

let response = await api.handle({ method: 'GET', pathname: '/api/schedules', headers: { cookie } });
assert.equal(response.status, 200);
assert.equal(response.body.schedules[0].owner, 'browser-owner');
assert.deepEqual(calls.at(-1), ['list', 'browser-owner']);

response = await api.handle({
  request: { body: { agentId: 'minimal-engineer', task: 'Sabah özeti', runAt: '2030-01-01T07:00:00.000Z' } },
  method: 'POST',
  pathname: '/api/schedules',
  headers: { cookie }
});
assert.equal(response.status, 201);
assert.equal(response.body.schedule.owner, 'browser-owner');
assert.deepEqual(calls.at(-1), ['create', 'browser-owner', 'Sabah özeti']);

response = await api.handle({
  method: 'GET',
  pathname: '/api/schedules',
  headers: { authorization: 'Bearer server-token', cookie }
});
assert.equal(response.status, 200);
assert.equal(response.body.schedules[0].owner, 'server-owner', 'explicit valid bearer keeps server-to-server identity');

const token = cookie.split('=', 2)[1];
const [payload, signature] = token.split('.');
const tamperedSignature = `${signature.slice(0, -1)}${signature.endsWith('A') ? 'B' : 'A'}`;
response = await api.handle({
  method: 'GET',
  pathname: '/api/schedules',
  headers: { cookie: `__Host-hafize_session=${payload}.${tamperedSignature}` }
});
assert.equal(response.status, 401);

const expiredAuthFactory = (config) => createCloudSessionAuth({
  ...config,
  now: () => nowValue + ttlMs + 1,
  randomBytesImpl: () => Buffer.alloc(18, 9)
});
const expiredSession = createOptionalScheduleSessionAuthenticator({ env, createAuth: expiredAuthFactory });
const expiredApi = createScheduleHttpApi({
  authenticator: primaryBearer,
  sessionAuthenticator: expiredSession,
  commands,
  readJson: async () => ({})
});
response = await expiredApi.handle({ method: 'GET', pathname: '/api/schedules', headers: { cookie } });
assert.equal(response.status, 401, 'expired cloud cookie must not reach schedule commands');

const wrongSubjectSession = createOptionalScheduleSessionAuthenticator({
  env: { ...env, HAFIZE_CLOUD_SESSION_SUBJECT: 'different-owner' },
  createAuth: authFactory
});
assert.equal(wrongSubjectSession.authenticate({ headers: { cookie } }).ok, false, 'signed payload is bound to configured subject');

console.log('real cloud-session cookie schedule auth tests passed');
