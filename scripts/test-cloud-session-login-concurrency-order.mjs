import assert from 'node:assert/strict';
import { createCloudSessionHttpApi } from '../lib/cloud-session-http-api.mjs';

const events = [];
let releaseBody;
const bodyReady = new Promise((resolve) => { releaseBody = resolve; });
const api = createCloudSessionHttpApi({
  auth: {
    async login() {
      events.push('auth.login');
      return Object.freeze({ ok: false, error: 'AUTH_REQUIRED' });
    },
    authenticate() { return Object.freeze({ ok: false, error: 'AUTH_REQUIRED' }); },
    logoutCookie() { return 'clear'; }
  },
  allowedOrigin: 'https://hafize.example',
  async readJson() {
    events.push('body.start');
    await bodyReady;
    events.push('body.done');
    return { password: 'valid-shape-password' };
  },
  loginGate() {
    events.push('peer.begin');
    return Object.freeze({
      ok: true,
      complete({ authenticated, countFailure }) {
        events.push(`peer.complete:${authenticated}:${countFailure}`);
        return true;
      }
    });
  },
  verificationGate() {
    events.push('global.begin');
    return Object.freeze({
      ok: true,
      complete() { events.push('global.complete'); return true; }
    });
  }
});

const pending = api.handle({
  request: {},
  method: 'POST',
  pathname: '/api/session/login',
  headers: { origin: 'https://hafize.example', 'content-type': 'application/json' }
});
await Promise.resolve();
assert.deepEqual(events, ['peer.begin', 'body.start']);
assert.equal(events.includes('global.begin'), false, 'slow body must not reserve expensive verification capacity');

releaseBody();
const response = await pending;
assert.equal(response.status, 401);
assert.deepEqual(events, [
  'peer.begin',
  'body.start',
  'body.done',
  'global.begin',
  'auth.login',
  'global.complete',
  'peer.complete:false:true'
]);

const busyEvents = [];
const busyApi = createCloudSessionHttpApi({
  auth: {
    async login() { busyEvents.push('auth.login'); return { ok: false }; },
    authenticate() { return { ok: false }; },
    logoutCookie() { return 'clear'; }
  },
  allowedOrigin: 'https://hafize.example',
  async readJson() { busyEvents.push('body'); return { password: 'valid-shape-password' }; },
  loginGate() {
    return {
      ok: true,
      complete(result) { busyEvents.push(`peer:${result.countFailure}`); return true; }
    };
  },
  verificationGate() {
    busyEvents.push('global.busy');
    return { ok: false, retryAfterSeconds: 99 };
  }
});
const busy = await busyApi.handle({
  request: {},
  method: 'POST',
  pathname: '/api/session/login',
  headers: { origin: 'https://hafize.example', 'content-type': 'application/json' }
});
assert.equal(busy.status, 503);
assert.equal(busy.headers['retry-after'], '60', 'public Retry-After is bounded');
assert.deepEqual(busyEvents, ['body', 'global.busy', 'peer:false']);
assert.equal(busyEvents.includes('auth.login'), false);

process.stdout.write('cloud session login concurrency ordering tests passed\n');
