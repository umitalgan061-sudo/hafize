import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const activity = require('../public/github-write-activity.js');

assert.equal(activity.REPOSITORY, 'umitalgan061-sudo/hafize');
assert.equal(activity.MAX_ITEMS, 12);
assert.equal(activity.MAX_BRANCH_CHARS, 120);
assert.equal(activity.MAX_PATH_CHARS, 400);
assert.equal(activity.MAX_PR_NUMBER, 10_000_000);
assert.equal(activity.MOUNT_TIMEOUT_MS, 10_000);
assert.deepEqual(activity.EVENT_NAMES, [
  'hafize:github-branch-created',
  'hafize:github-draft-pr-created',
  'hafize:github-file-updated'
]);

assert.equal(activity.normalizeBranch(' hafize/test-one '), 'hafize/test-one');
assert.equal(activity.normalizeBranch('main'), null);
assert.equal(activity.normalizeBranch('hafize/a..b'), null);
assert.equal(activity.normalizeBranch('hafize/a//b'), null);
assert.equal(activity.normalizeBranch(`hafize/${'a'.repeat(120)}`), null);

assert.equal(activity.normalizePath(' public/app.js '), 'public/app.js');
assert.equal(activity.normalizePath('/public/app.js'), null);
assert.equal(activity.normalizePath('../secret'), null);
assert.equal(activity.normalizePath('public//app.js'), null);
assert.equal(activity.normalizePath('public/app.js/'), null);
assert.equal(activity.normalizePath('public/a b.js'), null);

assert.equal(activity.normalizePrNumber(123), 123);
assert.equal(activity.normalizePrNumber('456'), 456);
assert.equal(activity.normalizePrNumber(0), null);
assert.equal(activity.normalizePrNumber(10_000_001), null);
assert.equal(activity.normalizePrNumber(1.5), null);

const branch = activity.normalizeEvent('hafize:github-branch-created', { branch: 'hafize/x' }, 1000);
assert.deepEqual(branch, { kind: 'branch', branch: 'hafize/x', at: 1000 });

const pr = activity.normalizeEvent('hafize:github-draft-pr-created', { prNumber: 237 }, 2000);
assert.deepEqual(pr, { kind: 'pr', prNumber: 237, at: 2000 });

const file = activity.normalizeEvent('hafize:github-file-updated', {
  branch: 'hafize/x',
  path: 'public/app.js',
  blobSha: 'should-not-be-copied',
  content: 'should-not-be-copied'
}, 3000);
assert.deepEqual(file, { kind: 'file', branch: 'hafize/x', path: 'public/app.js', at: 3000 });
assert.equal(JSON.stringify(file).includes('should-not-be-copied'), false);

assert.equal(activity.normalizeEvent('hafize:github-file-updated', { branch: 'main', path: 'public/app.js' }, 1), null);
assert.equal(activity.normalizeEvent('hafize:github-draft-pr-created', { prNumber: -1 }, 1), null);
assert.equal(activity.normalizeEvent('unknown', {}, 1), null);
assert.equal(activity.normalizeEvent('hafize:github-branch-created', { branch: 'hafize/x' }, Number.NaN), null);

let items = [];
items = activity.appendItem(items, branch);
items = activity.appendItem(items, pr);
items = activity.appendItem(items, file);
assert.deepEqual(items.map((item) => item.kind), ['file', 'pr', 'branch']);

items = activity.appendItem(items, activity.normalizeEvent('hafize:github-file-updated', {
  branch: 'hafize/x',
  path: 'public/app.js'
}, 4000));
assert.equal(items.length, 3);
assert.equal(items[0].at, 4000, 'same safe activity key should move to newest position');

for (let index = 1; index <= 20; index += 1) {
  items = activity.appendItem(items, activity.normalizeEvent('hafize:github-draft-pr-created', { prNumber: index }, 5000 + index));
}
assert.equal(items.length, activity.MAX_ITEMS);
assert.equal(items[0].prNumber, 20);
assert.equal(items.at(-1).prNumber, 9);

assert.equal(activity.formatLabel(branch), 'Branch oluşturuldu · hafize/x');
assert.equal(activity.formatLabel(pr), 'Draft PR oluşturuldu · #237');
assert.equal(activity.formatLabel(file), 'Dosya güncellendi · public/app.js');
assert.equal(activity.formatContext(file), 'hafize/x');
assert.equal(activity.formatContext(pr), activity.REPOSITORY);
assert.equal(typeof activity.formatTime(Date.now()), 'string');
assert.equal(activity.formatTime(Number.NaN), '');

console.log('github write activity helper tests passed');
