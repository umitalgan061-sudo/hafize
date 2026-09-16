# Revision release checklist

## Implementation

- [x] Separate revision storage key.
- [x] Snapshot normalization.
- [x] Duplicate suppression.
- [x] Per-prompt history cap.
- [x] Global history cap.
- [x] Restore confirmation.
- [x] Before-restore capture.
- [x] Orphan pruning.

## UI

- [x] Prompt selector.
- [x] Refresh action.
- [x] Restore action.
- [x] JSON export.
- [x] Hide/show control.
- [x] Accessible labels.
- [x] Mobile layout.
- [x] Forced-colors support.

## Security

- [x] Local-only storage.
- [x] No remote transport.
- [x] No credentials.
- [x] No telemetry.
- [x] No executable import.
- [x] Explicit restore confirmation.
- [x] Safe storage failure.

## PWA

- [x] JS cached.
- [x] CSS cached.
- [x] cache version increment.

## Tests

Run revision runtime, bounds, lifecycle, security, restore and cross-feature regression tests. Run the typed frontend suite from the current repository checkout.

## Rollback

Revert revision entry and assets. Preserve storage for a future compatible release unless a deliberate data-reset migration is separately approved.

## Acceptance

No backend schema migration is required. Existing prompt records remain usable when revision UI is unavailable.
