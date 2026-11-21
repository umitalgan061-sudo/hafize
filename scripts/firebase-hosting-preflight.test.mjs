import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prepareHostingConfig, prepareRelease } from './firebase-hosting-preflight.mjs';

const project = 'hafize-ua';
const site = 'hafize-ua';
const sha = '2eea6e257727163e788df61e78bfa64b14a94235';
const existing = {
  hosting: {
    public: 'public',
    site,
    rewrites: [
      { source: '/api/**', run: { serviceId: 'hafize-backend', region: 'europe-west1' } },
      { source: '**', destination: '/index.html' }
    ],
    headers: [{ source: '**', headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }] }],
    redirects: [{ source: '/old', destination: '/', type: 301 }]
  }
};

test('preserves existing api rewrites, headers, redirects and all matching hosting settings', () => {
  const config = prepareHostingConfig(JSON.stringify(existing), project, site);
  assert.deepEqual(config, existing);
  assert.notEqual(config.hosting, existing.hosting);
});

test('restricts a default-site config to the explicitly configured site', () => {
  const config = prepareHostingConfig(JSON.stringify({ hosting: { public: 'public' } }), project, site);
  assert.equal(config.hosting.site, site);
});

test('refuses to guess a missing Hosting config or wrong destination', () => {
  for (const raw of ['', '{', '{}', '{"hosting":[]}', '{"hosting":{"public":"dist"}}',
    '{"hosting":{"public":"public","target":"default"}}',
    '{"hosting":{"public":"public","site":"another-site"}}']) {
    assert.throws(() => prepareHostingConfig(raw, project, site), /FIREBASE_/);
  }
  assert.throws(() => prepareHostingConfig(JSON.stringify(existing), '', site), /FIREBASE_PROJECT/);
  assert.throws(() => prepareHostingConfig(JSON.stringify(existing), project, ''), /FIREBASE_SITE/);
});

test('does not create any release file if build is absent', () => {
  const written = [];
  assert.throws(() => prepareRelease(JSON.stringify(existing), project, site, sha, {
    exists: () => false, write: (...a) => written.push(a)
  }), /BUILD_MISSING/);
  assert.equal(written.length, 0);
});

test('prepares deployable firebase.json and a verifiable release marker only for built output', () => {
  const written = [];
  prepareRelease(JSON.stringify(existing), project, site, sha, {
    exists: () => true,
    write: (name, value) => written.push([name, JSON.parse(value)])
  });
  assert.equal(written.length, 2);
  assert.equal(written[0][0], 'firebase.json');
  assert.deepEqual(written[0][1], existing);
  assert.equal(written[1][0], 'public/release.json');
  assert.deepEqual(written[1][1], { commit: sha });
});

test('rejects anything other than a full sha for release verification', () => {
  assert.throws(() => prepareRelease(JSON.stringify(existing), project, site, 'main', {
    exists: () => true, write: () => {}
  }), /COMMIT_SHA/);
});
