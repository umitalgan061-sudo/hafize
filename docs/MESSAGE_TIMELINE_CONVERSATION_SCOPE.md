# Message timeline conversation scope

## Problem

`message-timeline.js` previously built one timestamp map for every local conversation and keyed it only by `message.id`. The canonical conversation store guarantees message-id uniqueness inside one conversation, but it does not define message IDs as globally unique across every conversation.

Two conversations could therefore contain the same message ID. When that happened, the timeline could decorate the currently visible message with a timestamp taken from another conversation.

## Contract

Timeline metadata is conversation-scoped.

- The active conversation is resolved from the single active sidebar row.
- After conversation organizer identity tags exist, `data-conversation-organize-id` is authoritative.
- Before any organizer row is tagged, canonical source order may be used as a bounded startup fallback.
- Mixed tagged/untagged row identity, multiple active rows, missing conversation IDs, or malformed IDs fail closed.
- If the active conversation cannot be resolved, no timestamp metadata is shown rather than borrowing metadata from another conversation.
- Only the selected conversation's first 200 canonical message candidates are indexed.

The timeline observes both rendered messages and sidebar identity/order changes so organizer startup and later conversation switches trigger revalidation.

## Security and privacy boundary

This change adds no storage key, network request, backend endpoint, provider call, agent permission, external write, or secret access. It reduces cross-conversation metadata exposure by refusing ambiguous identity.

PWA shell cache is advanced because `message-timeline.js` is a cached shell asset. `/api/*` remains network-only.

## Regression coverage

Tests cover duplicate message IDs in different conversations, organizer-tagged identity, pre-organizer source-order fallback, mixed identity fail-closed behavior, ambiguous active rows, invalid IDs, bounded conversation scanning, and the 200-message bound.
