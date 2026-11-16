// Where a tap on a phone notice lands. The push itself carries nothing (hafize-worker/src/push.js), so the app decides:
// background work from a chat writes its result into that chat, and scheduled work into a notice chat of its own
// ("bildirim-…"). The tap opens whichever of the two got its result last, not simply the newest notice chat — which
// could be an old, unrelated one while the answer the owner was told about sat in another chat (16 Kasım 2026).

export interface NoticeConversation { id: string; updatedAt?: string }
export interface PlacedResult { id: string; at: number }

/** How long after a tap a result that is still arriving (the page was asleep) may still take the screen. */
export const NOTICE_FOLLOW_MS = 90_000;

/** The chat a tap that names none opens: the latest written-to of the newest notice chat and the last placed result. */
export function noticeTarget<T extends NoticeConversation>(conversations: readonly T[], placed: PlacedResult | null): T | undefined {
  const notice = conversations.find((item) => item.id.startsWith('bildirim-'));
  const written = placed ? conversations.find((item) => item.id === placed.id) : undefined;
  if (!written) return notice;
  if (!notice) return written;
  const noticeAt = Date.parse(notice.updatedAt ?? '') || 0;
  return placed!.at >= noticeAt ? written : notice;
}

/**
 * Whether a result that arrives after a tap should open its chat: only within the follow window, and only while the
 * owner has not moved on — still on the chat the tap opened (or none), not answering, not editing, nothing typed.
 */
export function shouldFollowNotice(state: { now: number; followUntil: number; activeId: string | null; tapOpenedId: string | null; busy: boolean; draft: string }): boolean {
  if (state.now > state.followUntil) return false;
  if (state.busy || state.draft.trim()) return false;
  return state.tapOpenedId === null || state.activeId === state.tapOpenedId;
}
