import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const source = await fs.readFile(new URL('../public/memory-ui.js', import.meta.url), 'utf8');
const html = await fs.readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const swPolicy = await fs.readFile(new URL('../public/sw-policy.js', import.meta.url), 'utf8');

const context = { module: { exports: {} }, URL, globalThis: {}, self: {} };
vm.runInNewContext(source, context, { filename: 'memory-ui.js' });
const { createMemoryClient, MEMORY_KINDS } = context.module.exports;
assert.deepEqual([...MEMORY_KINDS], ['identity', 'preference', 'project', 'note']);

const calls = [];
const fetchImpl = async (path, init = {}) => {
  calls.push({ path, init });
  return {
    ok: true,
    status: 200,
    async json() {
      if (path === '/api/memory/approval') {
        return { ok: true, approvalReceipt: 'receipt.from.server', expiresAt: Date.now() + 120_000 };
      }
      return { ok: true, authenticated: true, records: [] };
    }
  };
};
const client = createMemoryClient({ fetchImpl });

await client.sessionStatus();
assert.equal(calls.at(-1).path, '/api/session/status');
assert.equal(calls.at(-1).init.method, 'GET');
assert.equal(calls.at(-1).init.credentials, 'same-origin');
assert.equal(calls.at(-1).init.cache, 'no-store');

await client.search('tenis', { kind: 'preference', limit: 10 });
const searchCall = calls.at(-1);
assert.match(searchCall.path, /^\/api\/memory\?/);
const searchUrl = new URL(searchCall.path, 'https://hafize.invalid');
assert.equal(searchUrl.searchParams.get('query'), 'tenis');
assert.equal(searchUrl.searchParams.get('kinds'), 'preference');
assert.equal(searchUrl.searchParams.get('limit'), '10');
assert.equal(searchCall.init.method, 'GET');

const beforeWrite = calls.length;
await client.write({ kind: 'note', content: '  kullanıcı açıkça kaydetti  ' });
assert.equal(calls.length, beforeWrite + 2);
const approvalCall = calls.at(-2);
assert.equal(approvalCall.path, '/api/memory/approval');
assert.equal(approvalCall.init.method, 'POST');
assert.deepEqual(JSON.parse(approvalCall.init.body), {
  kind: 'note',
  content: 'kullanıcı açıkça kaydetti',
  sourceType: 'user_note',
  sensitivity: 'personal',
  explicitUserIntent: true
});
const writeCall = calls.at(-1);
assert.equal(writeCall.path, '/api/memory');
assert.equal(writeCall.init.method, 'POST');
assert.deepEqual(JSON.parse(writeCall.init.body), {
  kind: 'note',
  content: 'kullanıcı açıkça kaydetti',
  sourceType: 'user_note',
  sensitivity: 'personal',
  approvalReceipt: 'receipt.from.server'
});
assert.equal(Object.hasOwn(JSON.parse(writeCall.init.body), 'explicitUserIntent'), false);

const deniedCalls = [];
const deniedClient = createMemoryClient({
  fetchImpl: async (path, init = {}) => {
    deniedCalls.push({ path, init });
    return { ok: false, status: 403, async json() { return { error: 'ORIGIN_REQUIRED' }; } };
  }
});
const denied = await deniedClient.write({ kind: 'note', content: 'kaydet' });
assert.equal(denied.status, 403);
assert.equal(deniedCalls.length, 1);
assert.equal(deniedCalls[0].path, '/api/memory/approval');

const malformedCalls = [];
const malformedClient = createMemoryClient({
  fetchImpl: async (path, init = {}) => {
    malformedCalls.push({ path, init });
    return { ok: true, status: 200, async json() { return { ok: true }; } };
  }
});
const malformed = await malformedClient.write({ kind: 'note', content: 'kaydet' });
assert.equal(malformed.status, 502);
assert.equal(malformed.payload.error, 'MEMORY_WRITE_APPROVAL_INVALID');
assert.equal(malformedCalls.length, 1);

await client.remove('memory_abcdefgh');
const deleteCall = calls.at(-1);
assert.equal(deleteCall.path, '/api/memory/memory_abcdefgh');
assert.equal(deleteCall.init.method, 'DELETE');
assert.deepEqual(JSON.parse(deleteCall.init.body), { exactMatch: true, explicitUserIntent: true });

assert.throws(() => client.search(''), /INVALID_MEMORY_QUERY/);
assert.throws(() => client.search('x', { kind: 'secret' }), /INVALID_MEMORY_KIND/);
await assert.rejects(() => client.write({ kind: 'note', content: '' }), /INVALID_MEMORY_CONTENT/);
assert.throws(() => client.remove('../oops'), /INVALID_MEMORY_ID/);

for (const id of [
  'memoryCard', 'memoryStatus', 'memorySearchForm', 'memoryQuery', 'memoryKindFilter',
  'memorySearchBtn', 'memoryResults', 'memoryWriteForm', 'memoryWriteKind',
  'memoryContent', 'memoryWriteBtn'
]) {
  assert.ok(html.includes(`id="${id}"`), `missing memory DOM id: ${id}`);
}
assert.ok(html.includes('/memory-ui.css'));
assert.ok(html.includes('/memory-ui.js'));
assert.ok(swPolicy.includes("'/memory-ui.css'"));
assert.ok(swPolicy.includes("'/memory-ui.js'"));
assert.ok(swPolicy.includes("pathname.startsWith('/api/')"));
assert.ok(swPolicy.includes("return 'network-only'"));

const forbidden = [
  'localStorage',
  'sessionStorage',
  ['HAFIZE', 'CONNECTOR', 'AUTH', 'TOKEN'].join('_'),
  ['SIGNING', 'KEY'].join('_'),
  ['PASSWORD', 'HASH'].join('_')
];
for (const value of forbidden) {
  assert.equal(source.includes(value), false, `forbidden frontend credential surface: ${value}`);
}
assert.equal(source.includes('innerHTML'), false, 'memory records must not render through innerHTML');
assert.ok(source.includes("MEMORY_APPROVAL_PATH = '/api/memory/approval'"));
assert.ok(source.includes('explicitUserIntent: true'));
assert.ok(source.includes('approvalReceipt'));
assert.ok(source.includes("sensitivity: 'personal'"));

console.log('personal memory PWA UI tests passed');