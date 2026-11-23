import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prepareHostingConfig, prepareRelease } from './firebase-hosting-preflight.mjs';

const project = 'projelerim-8fecd';
const site = 'hafize-ua';
const sha = '2eea6e257727163e788df61e78bfa64b14a94235';
const existing = {
  hosting: {
    public: 'dist/client',
    site,
    rewrites: [
      { source: '/api/**', run: { serviceId: 'hafize-backend', region: 'europe-west1' } },
      { source: '**', destination: '/index.html' }
    ],
    headers: [{ source: '**', headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }] }],
    redirects: [{ source: '/old', destination: '/', type: 301 }]
  }
};

test('only remaps the local build root; preserves api rewrites, headers, redirects and site', () => {
  const configured = prepareHostingConfig(JSON.stringify(existing), project, site);
  assert.deepEqual(configured, { ...existing, hosting: { ...existing.hosting, public: 'public' } });
  assert.equal(existing.hosting.public, 'dist/client');
});

test('targets specified Hosting site and preserves all other config', () => {
  const configured = prepareHostingConfig(JSON.stringify({
    hosting: { public: 'build', rewrites: existing.hosting.rewrites },
    emulators: { hosting: { port: 5000 } }
  }), project, site);
  assert.deepEqual(configured, {
    hosting: { public: 'public', site, rewrites: existing.hosting.rewrites },
    emulators: { hosting: { port: 5000 } }
  });
});

test('blocks missing config, wrong site, missing public property, targets and invalid project', () => {
  for (const raw of ['', '{', '{}', '{"hosting":[]}', '{"hosting":{}}',
    '{"hosting":{"public":""}}', '{"hosting":{"public":42}}',
    '{"hosting":{"public":"public","target":"default"}}',
    '{"hosting":{"public":"public","site":"another-site"}}']) {
    assert.throws(() => prepareHostingConfig(raw, project, site), /FIREBASE_/);
  }
  assert.throws(() => prepareHostingConfig(JSON.stringify(existing), '', site), /FIREBASE_PROJECT/);
  assert.throws(() => prepareHostingConfig(JSON.stringify(existing), project, ''), /FIREBASE_SITE/);
});

test('refuses missing output before writing any release files', () => {
  const written = [];
  assert.throws(() => prepareRelease(JSON.stringify(existing), project, site, sha, {
    exists: () => false, write: (...args) => written.push(args)
  }), /BUILD_MISSING/);
  assert.equal(written.length, 0);
});

test('uses existing public build without copies or destructive removal', () => {
  const written = [];
  const prepared = prepareRelease(JSON.stringify(existing), project, site, sha, {
    exists: () => true,
    write: (name, value) => written.push([name, JSON.parse(value)]),
    copy: () => { throw new Error('copy forbidden'); },
    remove: () => { throw new Error('remove forbidden'); }
  });
  assert.equal(written.length, 2);
  assert.equal(written[0][0], 'public/release.json');
  assert.deepEqual(written[0][1], { commit: sha });
  assert.equal(written[1][0], 'firebase.json');
  assert.deepEqual(written[1][1], prepared);
  assert.equal(prepared.hosting.public, 'public');
  assert.deepEqual(prepared.hosting.rewrites, existing.hosting.rewrites);
});

test('rejects anything but a full git commit SHA', () => {
  assert.throws(() => prepareRelease(JSON.stringify(existing), project, site, 'main', {
    exists: () => true, write: () => {}
  }), /COMMIT_SHA/);
});
