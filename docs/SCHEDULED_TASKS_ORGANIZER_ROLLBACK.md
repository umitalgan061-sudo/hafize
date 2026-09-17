# Organizer — Rollback Plan

## Scope

Rollback only organizer, actions and dashboard UI assets.

The existing `/api/schedules` endpoints remain unchanged.

Existing schedule records are not deleted by UI rollback.

## Preferred rollback

Revert the organizer feature PR as one unit.

Deploy the reverted service worker so its shell version points to the previous asset set.

## Client state

`hafize.scheduled-tasks.view.v1` contains only view preferences.

`hafize.scheduled-tasks.views.v1` contains only named view presets.

These keys can remain after rollback because the previous UI ignores them.

If cleanup is required, remove only those two view keys from browser storage.

Do not remove schedule server records.

## Cache

A service worker cache version bump ensures stale organizer files are not preferred after rollback.

Old cache entries should be removed by the existing cache cleanup policy.

`/api/` remains network-only in every supported shell version.

## Partial rollback

Removing only CSS is not supported because JS may reference its selectors.

Removing only dashboard JS while leaving dashboard CSS is harmless but incomplete.

Preferred action is an atomic rollback of the related assets.

## Failure recovery

If the panel fails to mount, the existing scheduled task core remains usable.

If organizer fails, core create/list/cancel behavior remains the authority.

If actions fail, the scheduled task panel remains functional.

If dashboard fails, core filtering remains available.

## Verification

Confirm `/api/schedules` still responds.

Confirm scheduled task core opens.

Confirm service worker serves the previous shell.

Confirm no organizer script is referenced by the reverted index.

Confirm no user schedule data was removed.

## Forward fix

After rollback, reproduce the problem in a fresh `hafize/auto-*` branch.

A fix must preserve the same 3000-line turn budget and PR-only merge rule.
