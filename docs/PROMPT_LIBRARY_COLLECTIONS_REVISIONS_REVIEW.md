# Collections + Revisions engineering review

## Architecture

Collections own only group metadata and prompt ids. Revisions own immutable-ish snapshots for recovery. Neither becomes a second prompt database.

## Separation

The prompt library remains authoritative for live prompt records. Collections read prompt ids. Revisions copy only bounded prompt fields needed for recovery.

## Data flow

User action -> local normalization -> bounded storage -> custom change event -> local UI refresh. There is no browser -> backend transition.

## Mutation safety

Create/update/delete are explicit. Collection deletion has confirmation. Revision restore has confirmation and captures the current state first.

## Storage safety

Invalid JSON is treated as empty. Storage exceptions are caught. Records are normalized before being surfaced.

## Identity safety

Collection ids and revision ids are generated independently. Prompt ids remain stable across revision restore.

## UX

The feature is embedded in the existing Prompt Library utility card. It does not alter the chat submission path. Collection filters only affect the visible prompt list; revision restore updates stored prompt state but does not auto-send a message.

## Accessibility

Sections are labelled. Selects and buttons have explicit names. Hide/show buttons expose expanded state. Dynamic data uses text nodes.

## Performance

Lists are bounded. Collection lists cap at 40; membership caps at 120. Revision history caps at 600 total and 20 per prompt. Rendering is local and bounded by visible records.

## PWA

New assets enter the shell cache. Cache version changes from v35 to v36. API endpoints remain network-only.

## Security

No credentials, OAuth scopes, network transport, analytics, telemetry or HTML injection path is introduced.

## Testing

Source contracts, runtime storage tests, bounds, import/export, orphan, lifecycle, UI and cross-feature regression checks should all be green before release.

## Rollback

Remove the entry references and assets. Preserve data keys unless an explicit destructive migration is approved.

## Known limitations

Current create/edit collection dialogs use native prompts. Revision history does not yet render a line-by-line textual diff. Both are isolated UI improvements and do not weaken data safety.
