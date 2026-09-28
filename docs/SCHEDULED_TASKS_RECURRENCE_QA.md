# Recurrence QA Planı

## Test katmanları
Pure recurrence math.
Store state transition.
Persistence snapshot.
Command boundary.
HTTP mapping.
Browser source contracts.
PWA cache contract.

## Math
Daily interval and missed windows.
Weekly one day.
Weekly multiple days.
Weekly interval >1.
Monthly 28/29/30/31.
Month rollover.
Leap year.
Long-horizon bounded generation.

## Store
Create recurring.
Create legacy one-shot.
Complete recurring.
Fail recurring.
Retry recurring.
Defer lease busy.
Cancel recurring.
Capacity at 128.

## Persistence
Save recurring.
Reload recurring.
Corrupted history.
Corrupted recurrence.
Unknown snapshot fields.
Legacy snapshot.

## Browser
Form visibility.
Recurrence payload.
Weekly checkbox selection.
Monthly day.
History toggle.
Preset create/use/delete.
Import/export.
Mobile CSS.
Forced colors.
Keyboard focus.

## Security
Credential-bearing task denied.
Unknown recurrence field denied.
Oversized interval normalized.
Invalid weekday denied.
DOM text injection denied.
Cross-owner operations denied.

## Regression
One-shot schedule request must not gain recurrence accidentally.
Existing filter statuses remain.
Service worker API network-only remains.
No remote analytics is added.

## Release evidence
Record exact base SHA.
Record exact head SHA.
Record compare additions/deletions.
Record local test limitations.
Record rollback commit.
