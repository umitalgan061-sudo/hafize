import assert from 'node:assert/strict';
import { test } from 'node:test';
import { attachCloudRunRewrite, backendRouteActivated, HAFIZE_CLOUD_RUN } from './hafize-cloud-run-route.mjs';
import { prepareRelease } from './firebase-hosting-preflight.mjs';

const projectId = HAFIZE_CLOUD_RUN.projectId;
const siteId = HAFIZE_CLOUD_RUN.siteId;
const sha = '1234567890abcdef1234567890abcdef12345678';
const original = {
  hosting: {
    site: siteId,
    public: 'public',
    rewrites: [
      { source: '/api/**', destination: '/index.html' },
      { source: '**', destination: '/index.html' }
    ],
    redirects: [{ source: '/old', destination: '/', type: 301 }],
    headers: [{ source: '**', headers: [{ key: 'X-Frame-Options', value: 'DENY' }] }]
  },
  emulators: { hosting: { port: 5000 } }
};

test('preserves non-API routing, headers and redirects with exactly one Cloud Run rewrite', () => {
  const patched = attachCloudRunRewrite(original);
  assert.deepEqual(patched.hosting.rewrites, [
    { source: '/api/**', run: { serviceId: 'hafize-backend', region: 'europe-west1' } },
    { source: '**', destination: '/index.html' }
  ]);
  assert.deepEqual(patched.hosting.redirects, original.hosting.redirects);
  assert.deepEqual(patched.hosting.headers, original.hosting.headers);
  assert.deepEqual(patched.emulators, original.emulators);
  assert.equal(original.hosting.rewrites[0].destination, '/index.html');
});

test('refuses to rewrite a different Hosting site', () => {
  assert.throws(() => attachCloudRunRewrite({ hosting: { site: 'wrong-site' } }), /WRONG_HOSTING_SITE/);
});

test('activation marker must match exact project, site, region and service', () => {
  assert.equal(backendRouteActivated(() => JSON.stringify({ ...HAFIZE_CLOUD_RUN, activated: true })), true);
  assert.equal(backendRouteActivated(() => JSON.stringify({ ...HAFIZE_CLOUD_RUN, activated: false })), false);
  assert.equal(backendRouteActivated(() => JSON.stringify({ ...HAFIZE_CLOUD_RUN, projectId: 'other', activated: true })), false);
  assert.equal(backendRouteActivated(() => { throw new Error('missing'); }), false);
});

test('Hosting preflight activates rewrite only after confirmed backend or valid marker', () => {
  const writes = [];
  prepareRelease(JSON.stringify(original), projectId, siteId, sha, {
    activateCloudRun: true,
    exists: () => true,
    write: (path, value) => writes.push([path, JSON.parse(value)])
  });
  assert.equal(writes[1][1].hosting.rewrites[0].run.serviceId, 'hafize-backend');

  const safeWrites = [];
  prepareRelease(JSON.stringify(original), projectId, siteId, sha, {
    activateCloudRun: false,
    exists: () => true,
    write: (path, value) => safeWrites.push([path, JSON.parse(value)])
  });
  assert.deepEqual(safeWrites[1][1].hosting.rewrites, original.hosting.rewrites);
});
