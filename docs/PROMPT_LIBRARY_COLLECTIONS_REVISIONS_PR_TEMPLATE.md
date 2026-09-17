# PR evidence template

## What

Local Prompt Library Collections + Revisions.

## Why

Group reusable prompts without duplicating their bodies and recover previous prompt states locally.

## Scope

Browser-local storage, native DOM controls, PWA shell assets, bounded JSON import/export and regression tests.

## Not in scope

Backend persistence, analytics, telemetry, OAuth, connector access, automatic chat submission.

## Testing

Runtime storage stubs, source contracts, bounds, security, lifecycle, UI and release smoke tests are included.

## Limitations

Full repository `npm run typecheck`, `npm run build`, `npm run test` and `npm run check` could not be executed without a local checkout in this session.

## Rollback

Revert feature entry assets and preserve local storage keys.

## Diff

Base-to-head changed lines are measured with GitHub compare before merge.
