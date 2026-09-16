# Collections operations runbook

## Health

Collection health is derived from localStorage. There is no server health endpoint for this feature.

## Normal state

The storage key exists or is absent. An absent key means an empty collection list. Invalid JSON is treated as empty rather than executed.

## Storage quota

If storage writes fail, the UI reports a bounded status message. Existing state is not intentionally cleared to recover from quota errors.

## Corrupt collection data

On next read, each record is normalized. Invalid records are discarded. Duplicate collection ids are removed. Duplicate member ids are removed.

## Orphan remediation

Before writes, member ids are filtered against current prompt ids. A missing prompt never becomes a synthetic record.

## Import incident

If an import file is invalid, no partial collection should be claimed as successfully imported. The parser is wrapped in a failure-safe path.

## Duplicate names

Names compare using Turkish locale lowercasing. A same-name import is counted as skipped rather than merged into an existing collection.

## Delete incident

Collection delete requires user confirmation. Only collection storage changes. Prompt storage remains untouched.

## PWA incident

If the UI is stale after deployment, verify shell cache v36 and the two new collection/revision assets. API routes remain network-only.

## Rollback

Revert collection panel assets and HTML references. Do not add cleanup code that deletes `hafize.prompt-library.collections.v1`.

## Support evidence

Capture: browser, app version, storage key presence, approximate collection count, failing operation and whether storage writes are available. Never request prompt bodies or secrets.

## Monitoring

There is intentionally no remote telemetry. Operational evidence is user-provided local behavior and source-level regression tests.

## DoD

- bounds checked
- storage failure checked
- orphan pruning checked
- import safety checked
- delete confirmation checked
- no network primitive
- no secret access
- PWA cache version checked
