import assert from 'node:assert/strict';
import { createRedisOAuthFlowStore } from '../lib/redis-oauth-flow-store.mjs';

const FLOW = {
  state: 's'.repeat(43), verifier: 'v'.repeat(64), provider: 'google',
  redirectUri: 'https://hafize.example.test/oauth/callback', scopes: ['openid']
};

for (const scenario of ['timer-arm', 'protocol-reply']) {
  let evals = 0;
  let destroys = 0;
  const client = {
    isReady: true,
    async eval() { evals += 1; return 'not-an-expiry'; },
    destroy() { destroys += 1; this.isReady = false; }
  };
  const options = { client };
  if (scenario === 'timer-arm') options.setTimer = () => { throw new Error('timer unavailable'); };
  const store = createRedisOAuthFlowStore(options);
  await assert.rejects(() => store.issue(FLOW), (error) => error?.code === 'OAUTH_FLOW_STORE_UNAVAILABLE');
  assert.equal(destroys, 1, `${scenario} must retire the client`);
  assert.equal(evals, scenario === 'timer-arm' ? 0 : 1,
    'command must not start without a deadline; malformed replies must be rejected after one command');
  await assert.rejects(() => store.consume(FLOW.state), (error) => error?.code === 'OAUTH_FLOW_STORE_UNAVAILABLE');
}

console.log('Redis OAuth flow store failure tests passed');
