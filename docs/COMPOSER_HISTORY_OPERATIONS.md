# Composer History — Operasyon Runbook

## Health check

Feature is healthy when `public/composer-history.js`, panel, backup and settings modules load without throwing.

`public/index.html` must reference every module once.

`public/sw-policy.js` must list every static history asset.

No `/api/` route belongs to history.

## Common issue: history missing

Check browser localStorage access.

Check `hafize.composer-history.settings.v1`.

Check `enabled` and `maxItems`.

Check that `messageInput` exists before modules mount.

Check whether browser storage is blocked.

## Common issue: arrow keys do not work

Confirm composer has focus.

Confirm cursor is at start or end of the textarea.

Confirm an IME composition is not active.

Confirm history is enabled.

Confirm history contains at least one record.

## Common issue: panel empty

Open DevTools storage and inspect `hafize.composer-history.v1`.

Invalid JSON intentionally renders as an empty history.

Confirm the panel controller loaded after core history.

## Common issue: backup import fails

Check file size against 512 KB.

Check valid JSON.

Check payload shape: array or `{ items }`.

Check that current history remains untouched when parsing fails.

## Maintenance

Do not increase limits without a data-size review.

Do not add telemetry to the module without an explicit product/privacy decision.

Do not put secrets or account identifiers into history records.

Do not add HTML templating for history text.

Any new action needs a regression contract.

## Rollback

Remove the new module references and revert the history enhancement files.

Existing chat composer submit behavior must remain functional.

Local history deletion is optional during rollback; the feature can simply stop reading it.
