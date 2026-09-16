# Collections release checklist

## Source

- [x] Local collection module added.
- [x] Bounded schema.
- [x] Duplicate names rejected.
- [x] Membership references only.
- [x] Orphan pruning.
- [x] Local import/export.

## UX

- [x] Search.
- [x] Filter.
- [x] Create/edit/delete.
- [x] Assign/remove members.
- [x] Hide/show panel.
- [x] Mobile wrapping.
- [x] Forced-colors styling.

## Security

- [x] No backend calls.
- [x] No telemetry.
- [x] No prompt body in collection export.
- [x] Confirmation before collection deletion.
- [x] DOM text boundary.
- [x] Import bounded.

## PWA

- [x] Shell CSS cached.
- [x] Shell JS cached.
- [x] Cache version incremented.
- [x] API routes remain network-only.

## Tests

Run source contracts, runtime stub tests, membership tests, bounds tests, DOM checks and PWA asset checks. The repository's typed frontend suite remains required.

## Rollback

Revert the collection CSS/JS and entry references. Do not delete local storage automatically. A later release can preserve the key for forward compatibility.

## Release note

This feature is additive. Existing prompt records, usage counters, Smart Fill, Command Palette and chat history use independent storage and runtime boundaries.
