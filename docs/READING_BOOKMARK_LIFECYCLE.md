# Reading bookmark lifecycle

## Storage boundary

`hafize.reading-focus.v1` stores only two local UI preferences: global `focusMode` and a bounded list of message bookmark IDs. Bookmark state is capped at 200 IDs; raw parsing is capped at 48 KiB.

## Canonical ownership

A bookmark may survive only while its message ID exists in canonical `hafize.conversations.v1`. Reading Focus derives the valid message-ID set from `HafizeConversationStorageGuard.sanitizeStoredValue()` and removes stale bookmark IDs after delete, retention eviction, clear-history, or cross-tab conversation changes.

If the canonical storage guard is unavailable, bookmark compaction fails closed and does not delete user state. Focus mode is not conversation-owned and is preserved even when every conversation is removed.

## Clear-history undo

Conversation clear can legitimately compact all bookmarks to an empty list before the user presses `Geri al`. The 12-second session-only undo therefore snapshots only the old canonical bookmark IDs in RAM alongside the existing organize/model/lineage companions.

When conversations are restored, bookmark IDs are revalidated against the final canonical message set before being written back. The current focus-mode preference wins and is never rolled back by conversation undo. The snapshot does not contain message text, titles, tokens, credentials, `ownerId`, `traceId`, connector state, or tool output.

## Cross-tab behavior

A storage event for either `hafize.reading-focus.v1` or `hafize.conversations.v1` triggers bounded revalidation. Canonical no-op state is not rewritten, avoiding storage-event ping-pong.

## Security invariants

This lifecycle fix introduces no new persistent key, backend endpoint, network request, provider/tool permission, agent context field, or external write/send/merge action. `/api/*` remains network-only in the PWA service-worker policy.
