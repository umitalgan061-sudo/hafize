# Composer History — Rollback

## Scope

Rollback removes the local composer history enhancement.

Existing chat send behavior remains unchanged.

## Steps

1. Revert the composer history feature commit set.
2. Remove shell references for history assets.
3. Bump or restore service worker cache consistently with the resulting shell.
4. Deploy the resulting main branch.

## Client state

Rollback does not require a backend migration.

Existing `hafize.composer-history.v1` data may remain in browser storage.

Because the code no longer reads it, the data is inert.

A future cleanup may explicitly remove the key.

## Failure case

Do not delete unrelated conversation history keys.

Do not modify prompt library storage during rollback.

Do not remove settings or credentials used by unrelated features.

## Verification

Open a fresh session.

Verify the composer accepts text.

Verify send works.

Verify no history UI is mounted.

Verify no console boot error is introduced.

Verify PWA shell loads the remaining assets.

## Partial rollback

Panel, backup and privacy controls can be disabled independently when diagnosing a client issue.

The core history module may also be disabled without changing backend contracts.
