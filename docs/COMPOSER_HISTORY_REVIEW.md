# Composer History — Review Checklist

## Architecture

- Feature remains client-side.
- History has a bounded storage key.
- Settings are separately namespaced.
- No backend endpoint is introduced.
- No workflow file is changed.

## Data

- Records are strings.
- Null bytes are removed.
- Maximum record length is enforced.
- Maximum record count is enforced.
- Duplicate values are collapsed.

## UX

- Arrow navigation does not hijack mid-text editing.
- IME input is protected.
- Current draft can be restored.
- Panel search is bounded.
- Use action does not send.

## Privacy

- Disable mode removes persisted history.
- Zero retention removes history.
- Export is manual.
- Import is bounded.
- No telemetry is emitted.

## DOM safety

- User text uses textContent or form values.
- History values are never parsed as HTML.
- Export file name is constant.
- Download object URLs are short-lived.

## PWA

- Each static asset is referenced by index and service worker.
- Cache version reflects the changed shell.
- API requests remain network-only.

## Lifecycle

- Each event listener has a matching cleanup path.
- Destroy is idempotent enough for repeated application cleanup.
- Optional enhancement modules do not block composer startup.
