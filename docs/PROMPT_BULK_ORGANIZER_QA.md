# Prompt Bulk Organizer QA

## Selection

- no selection: action reports the user must select a prompt,
- one selection: one record is updated,
- forty selections: all selected records are updated,
- more than forty: only the bounded selection is considered.

## Tags

### Add
Existing tags remain. New tags are normalized, trimmed and deduplicated case-insensitively for Turkish locale. At most eight tags remain.

### Replace
Existing tags are replaced only after at least one valid incoming tag is supplied. Empty input never clears tags accidentally.

### Remove
Only matching normalized tags are removed. Nonmatching tags remain unchanged.

## Favorites

`keep` preserves current state. `on` marks every selected prompt as favorite. `off` removes favorite state.

## Timestamp

Updated records receive a fresh `updatedAt` so the library's existing updated sorting remains meaningful.

## Failure

Storage write failure leaves the dialog open and reports a short error. Invalid selection does not cause a write.

## Security

Prompt ids are read from dataset attributes produced by the existing library. User-entered tags are never inserted as HTML. No remote request is needed.

## Accessibility

The panel exposes a dialog role, modal state and labelled heading. Escape closes the panel. Inputs have accessible labels.

## Regression

After bulk edit, search, tag filter, favorite filter, Usage Insights and single-item actions must continue to use the same normalized records.
