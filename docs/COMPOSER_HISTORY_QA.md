# Composer History — QA

## Functional

Send a new message.

Verify it appears at the top of history.

Send the same text again.

Verify a duplicate is not retained.

Navigate with ArrowUp.

Navigate back with ArrowDown.

Verify the draft is restored after leaving history navigation.

Open the history panel.

Search for a known phrase.

Use a row.

Delete one row.

Clear all rows after confirmation.

Export history.

Import the exported file.

Verify merge does not duplicate entries.

## Privacy

Disable history.

Send a message.

Verify storage remains absent.

Set retention to 10.

Insert more than 10 messages.

Verify only 10 remain.

Set retention to 0.

Verify the existing history storage is removed.

## Keyboard

Press Ctrl/⌘+Shift+H.

Press Escape.

Press ArrowUp at the middle of text.

Verify normal cursor behavior remains.

Start IME composition and press ArrowUp.

Verify history navigation does not interfere.

## Safety

Inject `<script>` into a history item.

Verify it remains plain text.

Import malformed JSON.

Verify current history remains unchanged.

Import an oversized file.

Verify it is rejected before parsing.

## PWA

Load the app offline after an installation.

Verify history scripts and CSS are shell assets.

Verify `/api/` is not cached.

## Regression

Run all composer history tests.

Run the repository check gate where available.

Record any unavailable browser or hosted checks explicitly.
