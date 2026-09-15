# Composer History — Migration

## v1 storage

Current history uses `hafize.composer-history.v1`.

Current settings use `hafize.composer-history.settings.v1`.

History records are strings.

Settings are a small object with `enabled` and `maxItems`.

## Forward migration

A future version must read v1 in an isolated adapter.

Do not mutate v1 in place before validation.

Normalize every record before copying it.

Apply the new version's tighter limits before writing.

Preserve user-visible order when possible.

## Duplicate handling

Exact string duplicates collapse to the newest occurrence.

Case is intentionally significant because prompts are user-authored text.

Whitespace-only records are discarded.

## Settings migration

Unknown retention values fall back to 40.

Explicit `enabled:false` is retained.

If a future version removes a setting, its old value must not change unrelated features.

## Import migration

Imported files may be arrays or versioned objects.

Unknown object metadata is ignored.

Only `items` are migrated into local history.

Oversized payloads are rejected before parsing.

## Rollback compatibility

A rollback to v1 should not require server-side migration.

The local history key is disposable convenience state.

A failed migration must leave the original v1 record untouched.

## Test requirements

Migration tests must cover valid v1 data, invalid JSON, malformed items, duplicate entries, empty values, oversize values and unknown metadata.

Tests must also prove that migration never creates a network request.
