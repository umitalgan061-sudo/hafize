// Capacity rules are enforced by `createFork` in the shared fork core, so this
// suite drives the real function instead of grepping the UI module for the
// literal comparisons it used to contain.
import assert from 'node:assert/strict';

import { FORK_ERRORS, FORK_LIMITS, createFork } from '../public/typed/conversation-fork-core.ts';

let counter = 0;
const idFactory = () => 'id-' + (counter += 1);
const now = () => '2026-01-01T00:00:00.000Z';
const options = { idFactory, now };

function conversation(id, { forkOf = null, depth = 0 } = {}) {
  return {
    id,
    title: 'Sohbet ' + id,
    messages: [{ id: id + '-m1', role: 'user', content: 'merhaba' }],
    ...(forkOf ? { forkOf, forkDepth: depth } : {})
  };
}

// A fork of a healthy conversation succeeds and keeps the parent link.
{
  const source = conversation('root');
  const result = createFork(source, 'root-m1', [source], options);
  assert.equal(result.error, undefined);
  assert.equal(result.conversation.forkOf, 'root');
  assert.equal(result.conversation.forkMessageId, 'root-m1');
  assert.equal(result.conversation.forkDepth, 1);
}

// The device-local conversation cap is refused before anything is written.
{
  const source = conversation('root');
  const all = [source, ...Array.from({ length: FORK_LIMITS.maxConversations - 1 }, (_, index) => conversation('filler-' + index))];
  assert.equal(all.length, FORK_LIMITS.maxConversations);
  assert.equal(createFork(source, 'root-m1', all, options).error, FORK_ERRORS.conversationLimit);
}

// A parent may only carry `maxBranchesPerParent` direct branches.
{
  const source = conversation('root');
  const branches = Array.from({ length: FORK_LIMITS.maxBranchesPerParent }, (_, index) =>
    conversation('branch-' + index, { forkOf: 'root', depth: 1 }));
  const all = [source, ...branches];
  assert.equal(createFork(source, 'root-m1', all, options).error, FORK_ERRORS.branchLimit);
  // One branch below the cap the fork is allowed again.
  assert.equal(createFork(source, 'root-m1', all.slice(0, -1), options).error, undefined);
}

// Fork depth is capped so a chain cannot grow without bound.
{
  const chain = [conversation('level-0')];
  for (let level = 1; level <= FORK_LIMITS.maxDepth; level += 1) {
    chain.push(conversation('level-' + level, { forkOf: 'level-' + (level - 1), depth: level }));
  }
  const deepest = chain.at(-1);
  assert.equal(createFork(deepest, deepest.id + '-m1', chain, options).error, FORK_ERRORS.depthLimit);
  const shallower = chain[FORK_LIMITS.maxDepth - 1];
  assert.equal(createFork(shallower, shallower.id + '-m1', chain, options).error, undefined);
}

// An unknown message id never produces a conversation.
{
  const source = conversation('root');
  assert.equal(createFork(source, 'missing', [source], options).error, FORK_ERRORS.messageNotFound);
}

console.log('conversation fork capacity: ok');
