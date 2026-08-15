import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { GOOGLE_OAUTH_HTTP_PATHS } from '../lib/google-oauth-node-server-runtime.mjs';
import {
  GOOGLE_OAUTH_NODE_HTTP_PATHS,
  createGoogleOAuthNodeHttpRoute
} from '../lib/google-oauth-node-http-route.mjs';

assert.deepEqual(
  GOOGLE_OAUTH_NODE_HTTP_PATHS,
  GOOGLE_OAUTH_HTTP_PATHS,
  'Node HTTP adapter paths must remain identical to the owner-bound core runtime paths'
);

const routePath = fileURLToPath(new URL('../lib/google-oauth-node-http-route.mjs', import.meta.url));
const source = await readFile(routePath, 'utf8');

for (const forbidden of [
  'process.env',
  'NVIDIA_API_KEY',
  'GITHUB_TOKEN',
  'clientSecret',
  'ownerResolver',
  'tokenStore',
  'createBearerPrincipalAuthenticator',
  'requestContext(',
  'executeNvidiaToolCall',
  'readJson(',
  'fetch('
]) {
  assert.equal(source.includes(forbidden), false, `Node route must not own privileged surface: ${forbidden}`);
}

let observed;
const route = createGoogleOAuthNodeHttpRoute({
  runtime: {
    async handle(input) {
      observed = input;
      return { matched: true, status: 200, body: { linked: true } };
    }
  },
  sendJson(response, status, body) {
    response.status = status;
    response.body = body;
    response.end();
  }
});

assert.deepEqual(Object.keys(route), ['handle']);
const response = {
  writableEnded: false,
  destroyed: false,
  once() {},
  off() {},
  end() { this.writableEnded = true; }
};
const callbackUrl = new URL(`https://hafize.example${GOOGLE_OAUTH_NODE_HTTP_PATHS.callback}?state=s&code=c`);
await route.handle({
  response,
  method: 'GET',
  pathname: GOOGLE_OAUTH_NODE_HTTP_PATHS.callback,
  url: callbackUrl,
  headers: {
    authorization: 'Bearer should-not-cross-public-callback',
    cookie: 'session=should-not-cross-public-callback'
  }
});

assert.deepEqual(observed.headers, {});
assert.equal('request' in observed, false);
assert.equal('body' in observed, false);
assert.equal(response.status, 200);
assert.deepEqual(response.body, { linked: true });

console.log('Google OAuth Node HTTP isolation tests passed');
