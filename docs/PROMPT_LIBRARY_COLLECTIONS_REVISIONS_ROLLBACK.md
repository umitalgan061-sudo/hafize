# Collections + Revisions rollback

## Goal

Frontend rollback must not cause automatic user-data destruction.

## Step 1

Revert the HTML entry references for collection and revision assets.

## Step 2

Revert the two CSS assets and the four feature JS assets.

## Step 3

Restore the previous service-worker cache version and remove the new asset paths from the shell list.

## Step 4

Deploy the previous known-good frontend and smoke-test the existing Prompt Library.

## Data policy

Do not delete `hafize.prompt-library.collections.v1` or `hafize.prompt-library.revisions.v1` during a normal UI rollback. This preserves a forward path for the next compatible release.

## Partial rollback

Collections can be disabled independently of revisions. Revisions can be disabled independently of collections. Prompt Library core remains a separate dependency.

## Corrupt data after rollback

Older code that does not understand the new keys will ignore them. A later compatible build can normalize and prune them.

## Restore failure

If a revision restore fails, the live prompt should remain unchanged. The implementation returns null when the prompt or revision cannot be resolved.

## Storage failure

Do not use storage quota exhaustion as a reason to clear all prompt data. Surface the failure and retain recoverable in-memory state where possible.

## PWA rollback

Use a cache version that predates the new entries. Verify `SHELL_ASSETS` and HTML are aligned before production start.

## Verification

Run typecheck, build, test suites and feature source contracts. Verify no stale collection/revision script remains referenced in HTML.

## Incident notes

Record base SHA, release SHA, rollback SHA, browser scope, whether local storage remained intact and whether Prompt Library core was affected.

## Future recovery

If a future release upgrades these schemas, migration must happen in a separate, reviewable change with dry-run validation.
