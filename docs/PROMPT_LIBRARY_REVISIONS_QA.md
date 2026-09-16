# Revision QA plan

## Capture

- create operation records one snapshot
- identical content does not duplicate history
- changed body records a new snapshot
- changed title records a new snapshot
- changed tags records a new snapshot
- changed favorite records a new snapshot

## Ordering

Newest revision sorts first.
Malformed dates do not crash rendering.
Unknown reason values remain bounded text.

## Restore

Restore requires explicit confirmation.
Missing prompt returns null.
Missing revision returns null.
Live prompt id remains stable.
Live creation time remains stable.
Live usage count remains stable.
Current state is captured before restore.
Restored state receives a fresh update timestamp.

## Bounds

20 revisions per prompt.
600 revisions globally.
8000 body characters.
100 title characters.
8 tags.
24 characters per tag.
160 reason characters.

## Orphans

Deleted prompts lose inaccessible revision history after pruning. Pruning does not alter existing prompt records.

## Export

Export envelope has version, source and prompt id. Export is JSON. Export is generated locally.

## DOM

Titles and previews use textContent. Buttons are native buttons. Select has an accessible label. Hidden state uses aria-expanded.

## Lifecycle

Observer is disconnected by destroy. Storage listener is removed by destroy. Panel DOM node is removed. No permanent interval remains.

## Security

No fetch. No XHR. No WebSocket. No beacon. No cookie write. No Authorization header. No eval. No Function constructor. Imported JSON is data only.

## Regression

Existing Prompt Library storage key remains unchanged. Usage count remains visible to the Usage Insights module. Smart Fill and Command Palette entries remain separate.
