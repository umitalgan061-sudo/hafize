import assert from 'node:assert/strict';
import { createGmailReadToolBoundary } from '../lib/gmail-read-tool-boundary.mjs';

function createFixture() {
  const calls = [];
  const principal = Object.freeze({ authenticated: true, subject: 'user:opaque' });
  const ownerResolver = {
    resolve(received) {
      calls.push(['resolve', received]);
      return { ownerId: 'owner_opaque' };
    }
  };
  const readClient = {
    async read(input) {
      calls.push(['read', input]);
      return { ok: true };
    }
  };
  return { calls, principal, boundary: createGmailReadToolBoundary({ readClient, ownerResolver }) };
}

{
  const { calls, principal, boundary } = createFixture();
  const controller = new AbortController();
  const result = await boundary.execute(
    { operation: 'message.list', params: { query: 'is:unread', maxResults: 5 } },
    { principal, signal: controller.signal }
  );
  assert.deepEqual(result, { ok: true });
  assert.deepEqual(calls[0], ['resolve', principal]);
  assert.equal(calls[1][0], 'read');
  assert.equal(calls[1][1].ownerId, 'owner_opaque');
  assert.equal(calls[1][1].operation, 'message.list');
  assert.deepEqual(calls[1][1].params, { query: 'is:unread', maxResults: 5 });
  assert.equal(calls[1][1].signal, controller.signal, 'validated signal is forwarded by identity');
}

{
  const { calls, principal, boundary } = createFixture();
  await boundary.execute({ operation: 'profile.get' }, { principal });
  assert.deepEqual(
    calls[1],
    ['read', { ownerId: 'owner_opaque', operation: 'profile.get', params: undefined }],
    'no-signal compatibility must not add a new enumerable field'
  );
}

{
  const { calls, principal, boundary } = createFixture();
  const controller = new AbortController();
  controller.abort('already-cancelled');
  await assert.rejects(
    boundary.execute({ operation: 'profile.get' }, { principal, signal: controller.signal }),
    (error) => error?.code === 'GMAIL_READ_FAILED:cancelled'
  );
  assert.deepEqual(calls, [], 'pre-abort must fail before owner resolution or read-client access');
}

{
  const calls = [];
  const principal = Object.freeze({ authenticated: true, subject: 'user:opaque' });
  const controller = new AbortController();
  const boundary = createGmailReadToolBoundary({
    ownerResolver: {
      resolve(received) {
        calls.push(['resolve', received]);
        controller.abort('cancel-during-owner-resolution');
        return { ownerId: 'owner_opaque' };
      }
    },
    readClient: {
      async read(input) {
        calls.push(['read', input]);
        return { ok: true };
      }
    }
  });

  await assert.rejects(
    boundary.execute({ operation: 'profile.get' }, { principal, signal: controller.signal }),
    (error) => error?.code === 'GMAIL_READ_FAILED:cancelled'
  );
  assert.deepEqual(calls, [['resolve', principal]], 'abort after ownership resolution must stop before token/read access');
}

{
  const { calls, principal, boundary } = createFixture();
  for (const signal of [
    true,
    'signal',
    {},
    { aborted: false, addEventListener() {}, removeEventListener: null }
  ]) {
    await assert.rejects(
      boundary.execute({ operation: 'profile.get' }, { principal, signal }),
      /INVALID_GMAIL_READ_TOOL:signal/
    );
  }
  assert.equal(calls.length, 0, 'invalid signals must fail before owner resolution');
}

{
  const { calls, principal, boundary } = createFixture();
  const controller = new AbortController();
  const args = { operation: 'message.list', params: { query: 'label:inbox' } };
  const promise = boundary.execute(args, { principal, signal: controller.signal });
  args.params.query = 'after-call-mutation';
  await promise;
  assert.equal(calls[1][1].params.query, 'label:inbox', 'tool arguments remain cloned before delegation');
}

console.log('gmail read tool cancellation boundary tests passed');