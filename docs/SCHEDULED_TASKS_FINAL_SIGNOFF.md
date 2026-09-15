# Zamanlanmış Görevler — Final Sign-off

## Scope

Scheduled Tasks UI is a client surface over the existing schedule HTTP API.

No second scheduler was introduced.

No second storage engine was introduced.

No client-side execution engine was introduced.

## Core UX

Görevler sidebar item is enabled by the scheduled tasks module.

Dialog uses native HTML controls.

Task creation uses POST `/api/schedules`.

Task listing uses GET `/api/schedules`.

Task cancellation uses DELETE `/api/schedules/:id`.

## Safety

Server authentication remains authoritative.

Server ownership remains authoritative.

Server task validation remains authoritative.

Credential policy remains server-side.

Client does not persist schedule credentials.

## Data handling

Schedule responses are not persisted into browser storage.

Task text is not injected into URL parameters.

Task text is not rendered as HTML.

Raw server error bodies are not injected into DOM.

## Performance

List is bounded to 128 rows.

Task preview is bounded.

Error display is bounded.

Trace display is bounded.

Polling is limited to panel-open state.

Pending request can be aborted.

## Accessibility

Dialog has accessible title.

Form controls have accessible labels.

Status uses aria-live.

Keyboard focus ring is preserved.

Escape closes.

Global shortcut avoids editable controls.

Mobile breakpoint is defined.

Forced colors is defined.

Reduced motion is defined.

## PWA

Static CSS is shell-cached.

Static JS is shell-cached.

Keyboard JS is shell-cached.

Countdown JS is shell-cached.

Cache version is incremented.

API remains network-only.

## Failure behavior

401 -> authentication message.

400 -> validation/planning message.

409 -> non-cancellable message and refresh.

503 -> capacity message.

5xx/network -> generic service message.

Malformed JSON -> safe generic error.

## User feedback

Successful create is announced.

Successful cancel is announced.

Template insertion is announced.

Trace ID can be exposed without secret material.

## Support

Support should request status/error code/Trace ID only when sufficient.

Auth tokens should never be requested.

NVIDIA keys should never be requested.

## Rollback

Client rollback does not delete server schedule records.

Service worker versioning protects static asset transition.

## Future boundaries

Recurring schedules require new API contract.

Edit requires new endpoint.

Retry-now requires explicit backend command.

Notifications require privacy review.

Timezone selection requires explicit model decision.

## Testing

Contract source test.

Client source test.

Security test.

Time/error test.

UI test.

Keyboard test.

PWA test.

Countdown test.

Release regression gate.

## Repository rule compliance

Work was performed on `hafize/auto-scheduled-tasks-0915`.

Changes are delivered through a pull request.

The final diff is measured against the current main base.

No direct self-development merge to main is performed.

## Final gate

Functional behavior reviewed.

Security reviewed.

Accessibility reviewed.

Performance reviewed.

PWA reviewed.

Rollback reviewed.

Support reviewed.

No artificial featureless filler is required for completion.
