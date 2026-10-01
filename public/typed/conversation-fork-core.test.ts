import { describe, expect, it } from 'vitest';
import {
  FORK_ERRORS,
  FORK_LIMITS,
  buildForkSnapshot,
  cleanForkText,
  conversationLineage,
  countDirectBranches,
  createFork,
  directChildren,
  getConversationDepth,
  normalizeForkMessage
} from './conversation-fork-core.ts';
import type { CreateForkResult, ForkConversation, ForkMessage, ForkRole } from './conversation-fork-core.ts';

const message = (id: string, role: ForkRole = 'user', content = 'mesaj'): ForkMessage => ({
  id, role, content, at: '2026-09-29T00:00:00.000Z'
});

const conversation = (
  id: string,
  messages: readonly ForkMessage[],
  extra: Partial<ForkConversation> = {}
): ForkConversation => ({
  id,
  title: 'Ana sohbet',
  agentId: 'general',
  toolsEnabled: false,
  createdAt: '2026-09-29T00:00:00.000Z',
  updatedAt: '2026-09-29T00:00:00.000Z',
  messages,
  ...extra
});

function forked(result: CreateForkResult): ForkConversation {
  if (!result.conversation) throw new Error('EXPECTED_FORK_CONVERSATION: ' + String(result.error));
  return result.conversation;
}

describe('conversation fork core', () => {
  it('normalizes copied messages without accepting invalid roles', () => {
    expect(normalizeForkMessage(message('a'))?.role).toBe('user');
    expect(normalizeForkMessage({ role: 'system', content: 'x' })).toBeNull();
    expect(cleanForkText('  uzun metin  ', 4)).toBe('uzun');
  });

  it('copies the conversation only through the selected message', () => {
    const source = conversation('root', [
      message('m1'),
      message('m2', 'assistant', 'cevap'),
      message('m3')
    ]);
    const ids = ['new-conversation'];
    const result = createFork(source, 'm2', [source], {
      idFactory: () => ids.shift() || 'copied',
      now: () => '2026-09-29T01:00:00.000Z'
    });
    expect(result.error).toBeUndefined();
    expect(forked(result).messages.map((item) => item.id)).toEqual(['m1', 'm2']);
    expect(forked(result).forkOf).toBe('root');
    expect(forked(result).forkMessageId).toBe('m2');
  });

  it('rejects unknown messages and empty forks', () => {
    const source = conversation('root', [message('m1')]);
    expect(createFork(source, 'missing', [source])).toEqual({ error: FORK_ERRORS.messageNotFound });
    expect(createFork(conversation('root', []), 'm1', [source]).error).toBe(FORK_ERRORS.messageNotFound);
    expect(createFork(null, 'm1', [source]).error).toBe(FORK_ERRORS.messageNotFound);

    const blank = conversation('root', [{ ...message('m1'), content: '   ' }]);
    expect(createFork(blank, 'm1', [blank]).error).toBe(FORK_ERRORS.emptyFork);
  });

  it('treats the registry list as the limit source, not as the message source', () => {
    const source = conversation('root', [message('m1')]);
    const result = createFork(source, 'm1', [], { idFactory: () => 'fork-id', now: () => '2026-09-29T04:00:00Z' });
    expect(forked(result).forkOf).toBe('root');
    expect(forked(result).messages).toHaveLength(1);
  });

  it('enforces direct branch and total conversation limits', () => {
    const source = conversation('root', [message('m1')]);
    const children = Array.from({ length: FORK_LIMITS.maxBranchesPerParent }, (_, i) =>
      conversation('child-' + i, [message('x')], { forkOf: 'root', forkDepth: 1 })
    );
    expect(countDirectBranches('root', [source, ...children])).toBe(8);
    expect(createFork(source, 'm1', [source, ...children]).error).toBe(FORK_ERRORS.branchLimit);
    const full = Array.from({ length: FORK_LIMITS.maxConversations }, (_, i) => conversation('c-' + i, []));
    expect(createFork(source, 'm1', full).error).toBe(FORK_ERRORS.conversationLimit);
  });

  it('caps fork depth and detects cycles', () => {
    const root = conversation('root', [message('m1')]);
    const branch1 = conversation('b1', [message('m1')], { forkOf: 'root', forkDepth: 1 });
    const branch2 = conversation('b2', [message('m1')], { forkOf: 'b1', forkDepth: 2 });
    const branch3 = conversation('b3', [message('m1')], { forkOf: 'b2', forkDepth: 3 });
    const branch4 = conversation('b4', [message('m1')], { forkOf: 'b3', forkDepth: 4 });
    expect(getConversationDepth(branch4, [root, branch1, branch2, branch3, branch4])).toBe(4);
    expect(createFork(branch4, 'm1', [root, branch1, branch2, branch3, branch4]).error).toBe(FORK_ERRORS.depthLimit);
    const a = conversation('a', [message('m1')], { forkOf: 'b' });
    const b = conversation('b', [message('m1')], { forkOf: 'a' });
    expect(getConversationDepth(a, [a, b])).toBeGreaterThan(FORK_LIMITS.maxDepth);
  });

  it('accepts a bounded custom branch title', () => {
    const source = conversation('root', [message('m1')]);
    const result = createFork(source, 'm1', [source], {
      title: '  Özel araştırma dalı  ',
      idFactory: () => 'fork-id',
      now: () => '2026-09-29T03:00:00Z'
    });
    expect(forked(result).title).toBe('Özel araştırma dalı');
  });

  it('trims unsafe control bytes and enforces fork title bounds', () => {
    const value = cleanForkText('  abc' + String.fromCharCode(0) + 'def  ', 5);
    expect(value).toBe('abcde');
    expect(cleanForkText('a\u0007b\u007fc', 10)).toBe('abc');
    const source = conversation('root', [message('m1')]);
    const result = createFork(source, 'm1', [source], {
      title: 'x'.repeat(500),
      idFactory: () => 'fork-id',
      now: () => '2026-09-29T03:00:00Z'
    });
    expect(forked(result).title.length).toBeLessThanOrEqual(FORK_LIMITS.maxTitle);
  });

  it('returns updated direct children and lineage root-to-current', () => {
    const root = conversation('root', [message('m1')]);
    const older = conversation('older', [message('m1')], { forkOf: 'root', updatedAt: '2026-09-28T00:00:00Z' });
    const newer = conversation('newer', [message('m1')], { forkOf: 'root', updatedAt: '2026-09-29T00:00:00Z' });
    expect(directChildren('root', [root, older, newer]).map((item) => item.id)).toEqual(['newer', 'older']);
    expect(conversationLineage(newer, [root, older, newer]).map((item) => item.id)).toEqual(['root', 'newer']);
  });

  it('does not reorder the caller list while listing direct children', () => {
    const root = conversation('root', [message('m1')]);
    const older = conversation('older', [message('m1')], { forkOf: 'root', updatedAt: '2026-09-28T00:00:00Z' });
    const newer = conversation('newer', [message('m1')], { forkOf: 'root', updatedAt: '2026-09-29T00:00:00Z' });
    const all = [root, older, newer];
    directChildren('root', all);
    expect(all.map((item) => item.id)).toEqual(['root', 'older', 'newer']);
  });

  it('builds a recovery snapshot without mutating the conversation', () => {
    const source = conversation('root', [message('m1')]);
    const before = JSON.stringify(source);
    const snapshot = buildForkSnapshot(source, '2026-09-29T02:00:00Z');
    expect(snapshot.type).toBe('hafize-conversation-fork');
    expect(snapshot.conversation).toBe(source);
    expect(JSON.stringify(source)).toBe(before);
  });

  it('bounded copies preserve metadata categories', () => {
    const source = {
      ...message('m1', 'assistant', 'cevap'),
      feedback: 'positive',
      alternates: ['a', 'b', 'c', 'd'],
      toolActivities: Array.from({ length: 10 }, (_, i) => ({ label: 'tool-' + i, state: 'success' })),
      generation: { model: 'm', agentId: 'a', toolsEnabled: true, generatedAt: 'now', durationMs: 44 }
    };
    const copy = normalizeForkMessage(source, () => 'copy');
    expect(copy?.feedback).toBe('positive');
    expect(copy?.alternates).toHaveLength(3);
    expect(copy?.toolActivities).toHaveLength(4);
    expect(copy?.generation?.durationMs).toBe(44);
  });

  it('drops metadata that is not shaped like fork metadata', () => {
    const copy = normalizeForkMessage({
      id: 'm1',
      role: 'assistant',
      content: 'cevap',
      at: '2026-09-29T00:00:00.000Z',
      feedback: 'maybe',
      alternates: 'not-an-array',
      toolActivities: [{ state: 'running' }],
      generation: { model: 'm', durationMs: -5 }
    });
    expect(copy?.feedback).toBeUndefined();
    expect(copy?.alternates).toBeUndefined();
    expect(copy?.toolActivities).toEqual([]);
    expect(copy?.generation?.durationMs).toBeNull();
  });
});
