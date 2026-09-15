# Composer History — Bağımlılık Sınırı

Composer History intentionally depends on browser primitives only.

## Required

DOM `createElement` and event listeners.

`localStorage` for persistence.

Textarea selection state for keyboard navigation.

`FileReader` for manual import.

`Blob` and object URLs for manual export.

## Optional

`crypto.randomUUID` is not required because history identifiers are not persisted; the feature uses plain text records.

No npm package is required.

No backend service is required.

No OAuth dependency is required.

No analytics SDK is required.

## Compatibility

Missing optional browser APIs must degrade the affected history action rather than the composer itself.

A storage failure must not prevent the application from rendering.

An import feature failure must not disable sending.

An export failure must not disable navigation.

## Maintenance

Do not add a package for a browser primitive already available in the target browsers.

Any new dependency requires size, security and license review.
