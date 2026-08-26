import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const source = await fs.readFile(new URL('../public/memory-ui.js', import.meta.url), 'utf8');
const html = await fs.readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const swPolicy = await fs.readFile(new URL('../public/sw-policy.js', import.meta.url), 'utf8');

const context = {
  module: { exports: {} },
  URL,
  globalThis: {},
  self: {}
};
vm.runInNewContext(source, context, { filename: 'memory-ui.js' });
const { createMemoryClient, MEMORY_KINDS } = context.module.exports;

assert.deepEqual([...MEMORY_KINDS], ['identity', 'preference', 'project', 'note']);

const calls = [];
const approvalToken = `mw1.payload.${'A'.repeat(43)}`;
const fetchImpl = async (path, init = {}) => {
  calls.push({ path, init });
  const payload = path === '/api/memory/approval/prepare'
    ? { ok: true, approvalToken }
    : { ok: true, authenticated: true, records: [] };
  return {
    ok: true,
    status: 200,
    async json() { return payload; }
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

await client.write({ kind: 'note', content: '  kullanıcı açıkça kaydetti  ' });
const writePrepareCall = calls.at(-2);
assert.equal(writePrepareCall.path, '/api/memory/approval/prepare');
assert.equal(writePrepareCall.init.method, 'POST');
assert.deepEqual(JSON.parse(writePrepareCall.init.body), {
  command: {
    kind: 'write',
    body: {
      kind: 'note',
      content: 'kullanıcı açıkça kaydetti',
      sourceType: 'user_note',
      sensitivity: 'personal',
      explicitUserIntent: true
    }
  }
});
const writeCall = calls.at(-1);
assert.equal(writeCall.path, '/api/memory');
assert.equal(writeCall.init.method, 'POST');
assert.equal(writeCall.init.headers['Content-Type'], 'application/json');
assert.equal(writeCall.init.headers['X-Hafize-Memory-Approval'], approvalToken);
assert.deepEqual(JSON.parse(writeCall.init.body), {
  kind: 'note',
  content: 'kullanıcı açıkça kaydetti',
  sourceType: 'user_note',
  sensitivity: 'personal',
  explicitUserIntent: true
});

await client.remove('memory_abcdefgh');
const deletePrepareCall = calls.at(-2);
assert.equal(deletePrepareCall.path, '/api/memory/approval/prepare');
assert.equal(deletePrepareCall.init.method, 'POST');
assert.deepEqual(JSON.parse(deletePrepareCall.init.body), {
  command: {
    kind: 'delete-one',
    memoryId: 'memory_abcdefgh',
    body: { exactMatch: true, explicitUserIntent: true }
  }
});
const deleteCall = calls.at(-1);
assert.equal(deleteCall.path, '/api/memory/memory_abcdefgh');
assert.equal(deleteCall.init.method, 'DELETE');
assert.equal(deleteCall.init.headers['X-Hafize-Memory-Approval'], approvalToken);
assert.deepEqual(JSON.parse(deleteCall.init.body), {
  exactMatch: true,
  explicitUserIntent: true
});

assert.throws(() => client.search(''), /INVALID_MEMORY_QUERY/);
assert.throws(() => client.search('x', { kind: 'secret' }), /INVALID_MEMORY_KIND/);
assert.throws(() => client.write({ kind: 'note', content: '' }), /INVALID_MEMORY_CONTENT/);
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

for (const forbidden of ['localStorage', 'sessionStorage', 'HAFIZE_CONNECTOR_AUTH_TOKEN', 'SIGNING_KEY', 'PASSWORD_HASH']) {
  assert.equal(source.includes(forbidden), false, `forbidden frontend credential surface: ${forbidden}`);
}
assert.equal(source.includes('innerHTML'), false, 'memory records must not render through innerHTML');
assert.ok(source.includes('explicitUserIntent: true'));
assert.ok(source.includes("sensitivity: 'personal'"));

console.log('personal memory PWA UI tests passed');