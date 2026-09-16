# Collections + Revisions compatibility

## Existing storage

Prompt Library main data remains under `hafize.prompt-library.v1`. Usage Insights remains coupled to its existing `useCount` field. Collections add a reference-only key and revisions add a snapshot-only key.

## Browser support

The modules rely on standard DOM APIs, localStorage, Blob, URL and MutationObserver. Capability checks prevent unsupported APIs from taking down the whole app where practical.

## Multi-tab behavior

The core Prompt Library already reacts to native storage events. Collection and revision surfaces subscribe to their own custom change events and prompt storage changes. Same-tab changes should dispatch explicit events rather than relying on browser storage events that are not delivered to the writing tab.

## Versioning

Both feature storage keys use a `.v1` suffix. Schema changes should use a new key or a documented migration function; silently changing record meaning is not permitted.

## Import compatibility

Collection imports ignore unknown fields and normalize known fields. Revision export is prompt-specific, so it cannot accidentally replace another prompt's history.

## Backward compatibility

When the feature assets are missing, the existing Prompt Library remains functional. Collection/revision storage absence is interpreted as empty state.

## Forward compatibility

Reverting the UI does not erase the storage keys. Future compatible code can migrate or re-read them. A destructive migration needs explicit product approval.

## PWA

Both feature JS and CSS are shell assets. Cache version v36 invalidates older shells after deployment. API endpoints are not cached.

## Accessibility

Existing utility-card semantics are preserved. New headings use labelled sections, native controls and explicit expanded state. Forced-colors and reduced-motion rules avoid dependence on color or motion alone.

## Security compatibility

No OAuth scope, account permission, backend schema, cookie or secret is introduced by these modules.

## Test compatibility

The source contract scripts are additive. Existing typed Vitest suites should remain the authoritative build/type gate for modern frontend code.

## Rollback compatibility

A rollback may remove collection/revision UI without deleting user data. Prompt text and usage count continue to use their established storage contract.

## Upgrade guidance

A future v2 should first define migration invariants, run a bounded dry-run over a copy of the v1 data, and only then write a new storage key. Never mutate the user's only copy before validation.

## Known limitations

The current collection UI uses native prompt dialogs for name/description editing. The revision UI intentionally focuses on content recovery rather than line-level diff visualization. These are isolated future UX improvements, not required for storage safety.
