# Conversation content search contract

Hafize sidebar search is a local, read-only navigation aid for the bounded conversation history already stored by the application. It is not a backend search API and it does not grant any agent or connector capability.

## User-visible behavior

- The existing **Son sohbetler** search field matches both conversation titles and canonical `user` / `assistant` message text.
- Search remains bounded to at most 120 query characters.
- Clearing the field restores every rendered conversation row.
- When the canonical storage guard is unavailable or storage cannot be read safely, search falls back to title-only matching instead of reading unvalidated raw data.
- Same-tab conversation renders and cross-tab `storage` changes refresh the in-memory search index.
- Search state is session-only. The query is not written to localStorage, sessionStorage, IndexedDB, cookies, clipboard, memory APIs, or any backend endpoint.

## Canonical data boundary

`public/conversation-storage-guard.js` remains authoritative for conversation persistence. Content search reads `hafize.conversations.v1` only through `HafizeConversationStorageGuard.sanitizeStoredValue()` and builds an index only from the returned canonical value.

The index accepts:

- a bounded conversation ID,
- the canonical conversation title,
- canonical messages whose role is exactly `user` or `assistant`.

It does not index unknown fields, inherited fields, `system` / `developer` / `tool` messages, tool activity payloads, owner IDs, trace IDs, provider metadata, access tokens, refresh tokens, credentials, or future storage fields that the guard does not explicitly admit.

## Resource limits

The search layer mirrors the current conversation persistence envelope and additionally refuses to exceed these local indexing bounds:

- 30 conversations,
- 120,000 indexed characters per conversation,
- 1,200,000 indexed characters total,
- 120 query characters.

These are defensive UI limits, not a new persistence schema. If the conversation storage guard becomes stricter, the search layer receives only the stricter canonical output.

## Network and permission policy

Conversation search must not introduce `fetch`, XHR, WebSocket, EventSource, sendBeacon, direct provider calls, connector calls, or new `/api/*` routes. It must not alter model selection or tool permissions. Backend default-deny tool authorization and explicit approval for external write/send/merge operations remain unchanged.

The PWA caches the static `conversation-search.js` shell asset, but `/api/*` remains network-only under `sw-policy.js`; no search result or conversation payload is written to the service-worker cache by this feature.

## Startup ordering

`ui-shell.js` loads the conversation storage guard before `conversation-search.js` using fixed same-origin script paths and `async=false`. The search implementation still fails closed to title-only search if the guard is unavailable at the moment it reads the index.

## Regression expectations

Tests should cover canonical message matching, title matching, hostile/unknown field redaction, role filtering, ID validation, index/query bounds, storage failures, cross-tab refresh, merged-storage refresh, fixed startup wiring, PWA versioning, no network/storage writes, and cleanup of event listeners on destroy.
