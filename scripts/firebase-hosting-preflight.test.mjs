import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prepareHostingConfig, prepareRelease } from './firebase-hosting-preflight.mjs';

const project = 'projelerim-8fecd';
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
  for (const raw of ['', '{', '{}', '{"hosting":[]}', '{"hosting":{"public":"."}}',
    '{"hosting":{"public":"../dist"}}', '{"hosting":{"public":"src"}}',
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

test('stages assets in an existing dist Hosting directory without modifying routes', () => {
  const configured = { ...existing, hosting: { ...existing.hosting, public: 'dist' } };
  const actions = [];
  const result = prepareRelease(JSON.stringify(configured), project, site, sha, {
    exists: () => true,
    write: (name, value) => actions.push(['write', name, value]),
    remove: (name) => actions.push(['remove', name]),
    copy: (source, dest) => actions.push(['copy', source, dest])
  });
  assert.deepEqual(result, configured);
  assert.deepEqual(actions.map((a) => a.slice(0, 3).map((v, i) => i === 2 && a[0] === 'write' ? '<content>' : v)), [
    ['write', 'public/release.json', '<content>'],
    ['remove', 'dist'],
    ['copy', 'public', 'dist'],
    ['write', 'firebase.json', '<content>']
  ]);
  assert.equal(JSON.parse(actions[3][2]).hosting.public, 'dist');
  assert.deepEqual(JSON.parse(actions[0][2]), { commit: sha });
});

test('refuses destructive or nested Hosting output folders', () => {
  for (const unsafe of ['.', '..', '../data', '/tmp/out', 'public/typed-build', 'src', 'node_modules', '.github', 'data', '']) {
    const config = JSON.stringify({ hosting: { public: unsafe } });
    assert.throws(() => prepareHostingConfig(config, project, site), /UNSUPPORTED_PUBLIC_DIRECTORY/);
  }
});

test('rejects deploy when staged assets cannot be verified', () => {
  const config = JSON.stringify({ hosting: { public: 'build' } });
  const writes = [];
  assert.throws(() => prepareRelease(config, project, site, sha, {
    exists: name => name.startsWith('public/'),
    write: (name) => writes.push(name),
    remove: () => {},
    copy: () => {}
  }), /STAGED_BUILD_MISSING/);
  assert.deepEqual(writes, ['public/release.json']);
});
