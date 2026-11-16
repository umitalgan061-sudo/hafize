import { describe, expect, it } from 'vitest';
import { NOTICE_FOLLOW_MS, noticeTarget, shouldFollowNotice } from './notice-target.ts';

// Conversations are kept newest-updated first, as app-shell sorts them.
const chats = [
  { id: 'c-proje', updatedAt: '2026-11-16T10:05:00Z' },
  { id: 'bildirim-result_aa', updatedAt: '2026-11-16T08:00:00Z' },
  { id: 'c-eski', updatedAt: '2026-11-15T10:00:00Z' },
  { id: 'bildirim-result_old', updatedAt: '2026-11-14T10:00:00Z' },
];

describe('noticeTarget', () => {
  it('opens the chat where background work just wrote its result, not an older notice chat', () => {
    expect(noticeTarget(chats, { id: 'c-proje', at: Date.parse('2026-11-16T10:05:00Z') })?.id).toBe('c-proje');
  });

  it('keeps the newest notice chat when it is newer than the last placed result', () => {
    expect(noticeTarget(chats, { id: 'c-eski', at: Date.parse('2026-11-15T10:00:00Z') })?.id).toBe('bildirim-result_aa');
  });

  it('falls back to the newest notice chat with nothing placed, or a placed chat that was deleted', () => {
    expect(noticeTarget(chats, null)?.id).toBe('bildirim-result_aa');
    expect(noticeTarget(chats, { id: 'silindi', at: Date.now() })?.id).toBe('bildirim-result_aa');
  });

  it('opens the placed chat when there is no notice chat at all, and nothing when there is neither', () => {
    const plain = [{ id: 'c-proje', updatedAt: '2026-11-16T10:05:00Z' }];
    expect(noticeTarget(plain, { id: 'c-proje', at: 1 })?.id).toBe('c-proje');
    expect(noticeTarget(plain, null)).toBeUndefined();
  });

  it('a notice chat with an unreadable date never wins over a real placed result', () => {
    expect(noticeTarget([{ id: 'bildirim-x', updatedAt: 'bozuk' }, { id: 'c-1' }], { id: 'c-1', at: 1 })?.id).toBe('c-1');
  });
});

describe('shouldFollowNotice', () => {
  const base = { now: 1_000, followUntil: 1_000 + NOTICE_FOLLOW_MS, activeId: 'bildirim-x', tapOpenedId: 'bildirim-x', busy: false, draft: '' };

  it('follows a result arriving soon after the tap while the owner is still where the tap left them', () => {
    expect(shouldFollowNotice(base)).toBe(true);
    expect(shouldFollowNotice({ ...base, tapOpenedId: null, activeId: 'c-1' })).toBe(true);
  });

  it('never takes the screen once the owner moved on, is typing, editing or waiting for an answer, or after the window', () => {
    expect(shouldFollowNotice({ ...base, activeId: 'c-baska' })).toBe(false);
    expect(shouldFollowNotice({ ...base, draft: 'yazıyorum' })).toBe(false);
    expect(shouldFollowNotice({ ...base, busy: true })).toBe(false);
    expect(shouldFollowNotice({ ...base, now: base.followUntil + 1 })).toBe(false);
    expect(shouldFollowNotice({ ...base, followUntil: 0 })).toBe(false);
  });
});
