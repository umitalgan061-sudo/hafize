# Conversation fork contract

Hafize can create a new local conversation from a completed assistant turn without mutating the source conversation.

## User intent

The action is exposed only on rendered assistant messages as **Bu noktadan dallan**. It is a direct, non-destructive user action: no message is submitted automatically and no backend/provider request is made by the fork operation.

Forking is blocked while a response is streaming. It is also blocked when the composer contains an unsent draft so a page reload cannot silently discard user text.

## Data boundary

The source is re-read from canonical `hafize.conversations.v1` at click time through `HafizeConversationStorageGuard`. The clicked assistant message ID must resolve to exactly one canonical conversation. A fork contains only messages from the beginning of that conversation through the selected assistant response.

Every copied message receives a new bounded ID. The new conversation also receives a new ID, current timestamps, the source agent ID, and the source `toolsEnabled` boolean. The source conversation remains unchanged. The title receives the bounded ` · dal` suffix.

All persistence goes through the existing guarded conversation write boundary, so count/content limits and concurrent-tab reconciliation remain authoritative. Unknown fields or secrets cannot be introduced by the fork module.

## Model preference

If a valid per-conversation model preference exists in `hafize.conversation-models.v1`, the preference is copied best-effort to the new conversation through `HafizeConversationModelState`. Failure to copy a UI preference does not roll back or corrupt a successfully canonicalized transcript fork.

## Activation

The new fork has the newest `updatedAt`, so canonical conversation ordering places it first. After persistence verification Hafize reloads once, allowing the normal core bootstrap to activate the newest conversation. No session marker or hidden persistent navigation state is introduced.

## Security invariants

- No new API endpoint, fetch/XHR/WebSocket, provider call, or external side effect.
- No auto-submit or synthetic send-button click.
- No credential, cookie, owner ID, trace ID, or connector data is copied intentionally.
- Backend tool permissions remain model-independent and default-deny.
- External write/send/merge operations still require their existing explicit approvals.
- No `.env`, credential file, generated/vendor content, or GitHub workflow is changed.
- PWA shell v94 includes the fixed same-origin `/conversation-fork.js` asset; `/api/*` remains network-only.
