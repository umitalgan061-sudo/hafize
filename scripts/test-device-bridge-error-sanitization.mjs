import assert from 'node:assert/strict';
import { createDeviceBridgeHandler } from '../desktop/device-bridge-contract.mjs';

const bridge = createDeviceBridgeHandler({
  async getSystemInfo() { throw new Error('secret host path /Users/private'); },
  async openExternal() { throw new Error('browser integration secret detail'); },
  appOpeners: { spotify: async () => { throw new Error('local executable path leaked'); } },
  allowedBrowserOrigins: ['https://example.com']
});

for (const request of [
  { operation: 'system.info', args: {} },
  { operation: 'browser.open', args: { url: 'https://example.com', explicitUserIntent: true, actionId: '11111111-1111-4111-8111-111111111111' } },
  { operation: 'app.open', args: { appId: 'spotify', explicitUserIntent: true, actionId: '22222222-2222-4222-8222-222222222222' } }
]) {
  const result = await bridge.handle(request);
  assert.deepEqual(result, { ok: false, error: 'DEVICE_ACTION_FAILED' });
  const text = JSON.stringify(result);
  assert.equal(text.includes('secret'), false);
  assert.equal(text.includes('/Users/'), false);
  assert.equal(text.includes('executable'), false);
}
console.log('device bridge error sanitization tests passed');
