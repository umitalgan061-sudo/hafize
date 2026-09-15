# Revision Operations Checklist

## Pre-release

- Branch is `hafize/auto-*`.
- Base commit is fixed.
- Diff remains below 3000 changed lines.
- Revision source is present.
- Checkpoint source is present.

## Storage

- Revision key is versioned.
- Body is bounded.
- Title is bounded.
- Tags are bounded.
- Revision retention is bounded.

## UI

- Geçmiş action appears once.
- Panel opens only on user action.
- Current prompt is shown.
- Revision list is shown.
- Compare surface works.
- Restore surface works.
- Checkpoint surface works.
- Clear requires confirmation.

## Accessibility

- Dialog role is present.
- aria-modal is present.
- aria-labelledby is present.
- Escape closes the dialog.
- Tab remains inside the dialog.
- Previous focus returns on close.

## Security

- User data uses textContent.
- No innerHTML.
- No fetch.
- No XMLHttpRequest.
- No WebSocket.
- No connector API.

## PWA

- Revision source is cached.
- Checkpoint source is cached.
- Cache version advanced.

## Rollback

- Loader can be reverted.
- Checkpoint can be reverted.
- Cache version can be reverted.
- Revision storage is not deleted automatically.

## Support

- Error message is recorded.
- Browser and version are recorded.
- Redacted export may be attached.
