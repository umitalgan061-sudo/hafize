# Composer History — Observability

Composer History has no server-side analytics.

## Local signals

The UI may use `hafize:composer-history-changed` to refresh local components.

The UI may use `hafize:composer-history-settings-changed` for local synchronization.

These events contain only bounded local counts or settings.

They are not sent to an API.

## Debugging

Inspecting localStorage is the primary diagnostic method.

Inspect `hafize.composer-history.v1` for records.

Inspect `hafize.composer-history.settings.v1` for configuration.

Do not copy sensitive history into external bug reports.

## Telemetry policy

No event name may be added to the product analytics layer solely for history usage.

Any future analytics proposal requires a separate privacy review.

## Error reporting

Storage exceptions are handled locally.

Import errors are reported through UI status where applicable.

No raw history text should be included in console error payloads.

## Metrics

The visible panel may calculate total record count and in-memory usage summary.

These values are ephemeral UI data.

They do not imply server telemetry or account analytics.

## Regression

Source tests should reject fetch, XHR, WebSocket and beacon usage in history modules.
