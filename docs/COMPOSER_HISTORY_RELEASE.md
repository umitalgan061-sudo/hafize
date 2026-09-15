# Composer History — Release

## Pre-release

- Confirm main base is current.
- Confirm all composer history files are present.
- Confirm index references core, panel, backup, help and settings modules.
- Confirm service worker references history assets.
- Confirm cache version advanced for the new shell assets.
- Run composer history source tests.
- Run storage and keyboard tests.
- Run PWA contract tests.
- Verify no `.env` or secrets changed.
- Verify no workflow files changed.

## Functional smoke

Send a message and check history.

Navigate backwards and forwards.

Open and search the panel.

Use a history item.

Delete one item.

Clear all items.

Export and import.

Change retention.

Disable and re-enable history.

Reload and verify expected persistence.

## Security smoke

Use a script-like history value.

Verify inert text rendering.

Use malformed settings.

Verify safe defaults.

Use malformed import.

Verify no existing-data loss.

## Rollback readiness

All feature files are independently identifiable.

Rollback does not require backend migration.

The composer remains usable when the optional modules are missing.
