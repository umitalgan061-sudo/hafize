# Composer History — Incident Runbook

## Severity: feature unavailable

Confirm the main chat composer still works.

If composer works and history does not, treat the issue as a local enhancement failure.

Inspect browser console for module exceptions.

Inspect localStorage access.

## Severity: data not persisting

Check whether history is disabled.

Check `maxItems` setting.

Check storage quota errors.

Do not ask the user to modify unrelated application storage.

## Severity: old history visible after opt-out

Confirm `enabled:false`.

Verify `hafize.composer-history.v1` is absent.

Reload the page and inspect controller `getItems()` only during diagnostics.

If storage is present after opt-out, reproduce before release.

## Severity: panel causes submission

Confirm panel code only assigns `composer.value`.

Confirm no `submit()` invocation exists in history modules.

Disable panel module temporarily if necessary.

## Severity: import removes data

Reproduce with a malformed JSON fixture.

Expected behavior is a rejected import with current records preserved.

Do not manually clear storage as a first response.

## Recovery

Feature modules are progressive enhancements.

Removing their script references should restore the base composer.

No backend migration or server rollback is required.

## Evidence

Record browser, cache version, local storage state and exact feature module version.

Do not include raw user history content in tickets unless the user explicitly supplies a sanitized reproduction.
