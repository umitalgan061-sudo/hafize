import assert from 'node:assert/strict';
import { createDeviceBridgeHandler } from '../desktop/device-bridge-contract.mjs';

function createHandler({ allowedBrowserOrigins = [], openExternal } = {}) {
  const opened = [];
  const handler = createDeviceBridgeHandler({
    allowedBrowserOrigins,
    async getSystemInfo() {
      return { platform: 'linux', arch: 'x64', appVersion: '1.0.0', cpuCount: 4, totalMemoryMb: 4096 };
    },
    async openExternal(url) {
      opened.push(url);
      if (openExternal) await openExternal(url);
    }
  });
  return { handler, opened };
}

let nextActionId = 0;
function browser(url, explicitUserIntent = true) {
  nextActionId += 1;
  const actionId = `00000000-0000-4000-8000-${nextActionId.toString(16).padStart(12, '0')}`;
  return { operation: 'browser.open', args: { url, explicitUserIntent, actionId } };
}

const empty = createHandler();
assert.deepEqual(empty.handler.allowedBrowserOrigins, []);
assert.deepEqual(await empty.handler.handle(browser('https://example.com/')), {
  ok: false,
  error: 'DEVICE_BROWSER_ORIGIN_NOT_ALLOWED'
});
assert.deepEqual(empty.opened, [], 'empty allowlist must fail closed');

const configured = createHandler({
  allowedBrowserOrigins: [
    'https://docs.example.com',
    'https://support.example.com/',
    'https://docs.example.com'
  ]
});
assert.deepEqual(configured.handler.allowedBrowserOrigins, [
  'https://docs.example.com',
  'https://support.example.com'
]);

for (const url of [
  'https://docs.example.com/',
  'https://docs.example.com/help/getting-started',
  'https://docs.example.com/search?q=hafize',
  'https://support.example.com/tickets/123#reply'
]) {
  assert.deepEqual(await configured.handler.handle(browser(url)), {
    ok: true,
    value: { opened: true, kind: 'browser' }
  });
}
assert.deepEqual(configured.opened, [
  'https://docs.example.com/',
  'https://docs.example.com/help/getting-started',
  'https://docs.example.com/search?q=hafize',
  'https://support.example.com/tickets/123#reply'
]);

const openedBeforeBlocked = configured.opened.length;
for (const url of [
  'https://example.com/',
  'https://evil.example/',
  'https://sub.docs.example.com/',
  'https://docs.example.com.evil.test/',
  'https://support.example.com:444/'
]) {
  assert.deepEqual(await configured.handler.handle(browser(url)), {
    ok: false,
    error: 'DEVICE_BROWSER_ORIGIN_NOT_ALLOWED'
  }, `unexpected browser permission for ${url}`);
}
assert.equal(configured.opened.length, openedBeforeBlocked, 'blocked origins must not call openExternal');

assert.deepEqual(await configured.handler.handle(browser('https://xn--docs-9za.example.com/')), {
  ok: false,
  error: 'INVALID_DEVICE_URL'
}, 'IDN/punycode targets must fail URL normalization before origin policy');
assert.equal(configured.opened.length, openedBeforeBlocked, 'rejected URLs must not call openExternal');

assert.deepEqual(await configured.handler.handle(browser('https://docs.example.com/private', false)), {
  ok: false,
  error: 'DEVICE_ACTION_REQUIRES_EXPLICIT_USER_INTENT'
});
assert.equal(configured.opened.length, openedBeforeBlocked);

const portBound = createHandler({ allowedBrowserOrigins: ['https://localhost:9443'] });
assert.deepEqual(await portBound.handler.handle(browser('https://localhost:9443/help')), {
  ok: true,
  value: { opened: true, kind: 'browser' }
});
assert.deepEqual(await portBound.handler.handle(browser('https://localhost/help')), {
  ok: false,
  error: 'DEVICE_BROWSER_ORIGIN_NOT_ALLOWED'
});
assert.deepEqual(portBound.opened, ['https://localhost:9443/help']);

for (const invalid of [
  null,
  {},
  'https://example.com',
  ['http://example.com'],
  ['file:///tmp/help'],
  ['https://user:pass@example.com'],
  ['https://example.com/help'],
  ['https://example.com/?q=1'],
  ['https://example.com/#fragment'],
  ['https://example.com:443'],
  ['HTTPS://EXAMPLE.COM']
]) {
  assert.throws(
    () => createHandler({ allowedBrowserOrigins: invalid }),
    /INVALID_DEVICE_BROWSER_ORIGIN|INVALID_DEVICE_BROWSER_ORIGINS/
  );
}

assert.throws(
  () => createHandler({ allowedBrowserOrigins: Array.from({ length: 33 }, (_, index) => `https://host-${index}.example.com`) }),
  /INVALID_DEVICE_BROWSER_ORIGINS/
);

const maxConfigured = createHandler({
  allowedBrowserOrigins: Array.from({ length: 32 }, (_, index) => `https://host-${index}.example.com`)
});
assert.equal(maxConfigured.handler.allowedBrowserOrigins.length, 32);
assert.deepEqual(await maxConfigured.handler.handle(browser('https://host-31.example.com/path')), {
  ok: true,
  value: { opened: true, kind: 'browser' }
});

let providerDetail = 'not exposed';
const sanitized = createHandler({
  allowedBrowserOrigins: ['https://docs.example.com'],
  async openExternal() {
    throw new Error(providerDetail);
  }
});
const failure = await sanitized.handler.handle(browser('https://docs.example.com/help'));
assert.deepEqual(failure, { ok: false, error: 'DEVICE_ACTION_FAILED' });
assert.equal(JSON.stringify(failure).includes(providerDetail), false);

console.log('device browser origin allowlist tests passed');
