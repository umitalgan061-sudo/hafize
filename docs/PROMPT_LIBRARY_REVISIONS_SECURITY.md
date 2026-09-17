# Revisions security

## Purpose

Revision history improves recoverability without extending the trust boundary.

## Local-only

Revision data stays in `localStorage`. There is no network transport and no backend persistence.

## Snapshot hygiene

Only fields needed to reconstruct a prompt are stored. Variable values are not collected separately. Conversation history is not copied into revisions.

## Size control

Every string is bounded before persistence. Per-prompt and global revision counts are bounded.

## Restore safety

Restore requires explicit confirmation. The current live prompt is captured before replacement so the user has a route back.

## Identity

The revision id and prompt id are separate. Restoring cannot accidentally duplicate or reassign prompt identity.

## DOM safety

Revision title and body previews are inserted with DOM node text APIs. No `innerHTML`, `outerHTML`, or `document.write` is needed.

## Export safety

Revision JSON is created locally as a Blob. The export contains no auth token, connector data, browser credential, or unrelated conversation payload.

## Orphan cleanup

When a prompt disappears, its revision history becomes unreachable and is pruned. This avoids indefinite retention of stale content.

## Failure behavior

Unreadable revision JSON results in an empty history. Failed writes do not trigger storage clearing.

## Review checklist

- explicit restore confirmation
- bounded snapshot
- bounded history
- no remote analytics
- no credential access
- no executable import
- DOM text boundary
- orphan pruning
- safe storage failure
- independent rollback
