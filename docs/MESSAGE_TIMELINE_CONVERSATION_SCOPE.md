# Message timeline conversation scope

## Problem

`message-timeline.js` previously built one timestamp map for every local conversation and keyed it only by `message.id`. The canonical conversation store guarantees message-id uniqueness inside one conversation, but it does not define message IDs as globally unique across every conversation.

Two conversations could therefore contain the same message ID. When that happened, the timeline could decorate the currently visible message with a timestamp taken from another conversation.

A separate lifecycle risk existed after controller teardown: a MutationObserver/storage callback could already have queued a microtask. `destroy()` removed timeline decorations, but that queued callback could later execute `render()` and add timestamps/day separators back into a controller that was supposed to be inert.

## Contract

Timeline metadata is conversation-scoped.

- The active conversation is resolved from the single active sidebar row.
- After conversation organizer identity tags exist, `data-conversation-organize-id` is authoritative.
- Before any organizer row is tagged, canonical source order may be used as a bounded startup fallback.
- Mixed tagged/untagged row identity, multiple active rows, missing conversation IDs, or malformed IDs fail closed.
- If the active conversation cannot be resolved, no timestamp metadata is shown rather than borrowing metadata from another conversation.
- Only the selected conversation's first 200 canonical message candidates are indexed.
- Raw `hafize.conversations.v1` input is rejected before `JSON.parse` when it exceeds 2 MiB.

The timeline observes both rendered messages and sidebar identity/order changes so organizer startup and later conversation switches trigger revalidation.

## Controller lifecycle

Scheduled renders are generation-scoped. `scheduleRender()` queues work only while the controller is mounted and only once per generation. `destroy()` invalidates the current generation before disconnecting observers and removing decorations.

A queued callback from an older generation checks both the mounted state and the generation token before reading storage or touching DOM. This remains true if the controller is destroyed and immediately remounted before the old callback gets a chance to run. Direct storage callbacks after teardown also cannot queue new work.

The generation token and scheduled flag are RAM-only lifecycle state; they are not persisted and do not alter conversation data.

## Security and privacy boundary

This change adds no storage key, network request, backend endpoint, provider call, agent permission, external write, or secret access. It reduces cross-conversation metadata exposure by refusing ambiguous identity and bounds hostile/accidentally oversized local storage before JSON parsing.

PWA shell cache is advanced because `message-timeline.js` is a cached shell asset. `/api/*` remains network-only.

## Regression coverage

Tests cover duplicate message IDs in different conversations, organizer-tagged identity, pre-organizer source-order fallback, mixed identity fail-closed behavior, ambiguous active rows, invalid IDs, bounded conversation scanning, the 200-message bound, oversized raw storage, schedule→destroy teardown, destroy→remount generation invalidation, observer scheduling, double destroy, and post-destroy storage callbacks.
