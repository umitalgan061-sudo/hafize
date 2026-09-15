# Composer History — Debugging

## Inspect feature state

Use the browser console to inspect `window.HafizeComposerHistory` and `window.HafizeComposerHistoryController`.

Inspect `getItems()` for the current tab state.

Inspect `getSettings()` for enabled state and retention limit.

## Storage checks

Read `hafize.composer-history.v1`.

Read `hafize.composer-history.settings.v1`.

The record key should be a JSON array.

The settings key should be a small object.

## Mount checks

`composer.dataset.historyReady` should be true after a successful mount.

The history toggle should exist once.

The panel id should be unique.

## Keyboard checks

Put the caret at the beginning.

Press ArrowUp.

Put the caret in the middle.

Press ArrowUp and verify normal editing remains.

Start IME composition.

Press ArrowUp and verify no navigation occurs.

## Privacy checks

Disable history.

Confirm history key is removed.

Re-enable history.

Confirm previous history is not restored automatically.

## Import checks

Use malformed JSON.

Use an oversized file.

Use an array payload.

Use a versioned object payload.

Confirm failed import never clears valid existing records.

## Cleanup

Call destroy during diagnostics.

Confirm global controller reference is removed.

Confirm the `historyReady` marker is removed.
