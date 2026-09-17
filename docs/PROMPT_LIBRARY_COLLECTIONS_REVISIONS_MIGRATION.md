# Collections + Revisions migration policy

No automatic migration is required for existing Prompt Library data.

Collections use `hafize.prompt-library.collections.v1` and reference existing prompt ids.

Revisions use `hafize.prompt-library.revisions.v1` and copy bounded snapshots only when content changes.

On first read, invalid records are discarded through normalization.

On normal writes, collection members are pruned against live prompt ids.

Revision orphan records are pruned against live prompt ids.

Import operations generate new collection ids and reject duplicate names.

No migration copies prompt bodies into collection records.

No migration sends data to the server.

A future schema version must use a new storage key or an explicit, tested migration function.

Migration must be reversible, bounded, and covered by a dry-run test.

Destructive storage clearing is not part of this feature.

Rollback preserves both storage keys.

Compatibility is maintained by keeping the base Prompt Library key unchanged.
