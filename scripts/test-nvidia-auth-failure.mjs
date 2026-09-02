// An invalid NVIDIA key is the most common setup mistake, and it is invisible
// until a message is sent: NVIDIA serves /models without auth, so the model
// dropdown fills normally. These checks lock the distinct error code that lets
// the client say "the key was rejected" instead of a generic upstream failure.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (relative) => readFile(new URL(`../${relative}`, import.meta.url), 'utf8');
const [server, app] = await Promise.all([read('server.mjs'), read('public/app.js')]);

// Only 401/403 are auth failures; a 500 or 429 upstream must stay generic.
assert.match(server, /function isNvidiaAuthFailure\(status\) \{\s*return status === 401 \|\| status === 403;/);

// Every path that reaches NVIDIA must classify the failure, not just one.
const classified = server.match(/isNvidiaAuthFailure\(upstream\.status\)/g) || [];
assert.equal(classified.length, 3, `expected 3 classified upstream paths, found ${classified.length}`);

// The dedicated code must survive to the client with an auth status, not a 502.
assert.match(server, /error\?\.message === 'NVIDIA_AUTH_FAILED'/);
assert.match(server, /error: 'NVIDIA_AUTH_FAILED', detail: error\.detail \|\| ''/);

// The client must name the variable and point at the setup guide.
assert.match(app, /error\?\.message === 'NVIDIA_AUTH_FAILED'/);
assert.match(app, /NVIDIA_API_KEY geçersiz veya süresi dolmuş/);
assert.match(app, /error\?\.message === 'NVIDIA_NOT_CONFIGURED'/);
const authBranch = app.slice(app.indexOf('NVIDIA_AUTH_FAILED'), app.indexOf('NVIDIA_AUTH_FAILED') + 400);
assert.match(authBranch, /docs\/KURULUM\.md/);

// The upstream body may echo request context, so it must not reach the message
// the user sees; only the error code selects the wording.
assert.equal(/NVIDIA anahtarı reddedildi[^`']*\$\{/.test(app), false, 'auth message must not interpolate upstream detail');

console.log('nvidia auth failure tests passed');
