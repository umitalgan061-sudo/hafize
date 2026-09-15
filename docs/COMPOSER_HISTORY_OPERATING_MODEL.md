# Composer History — Operating Model

## Ownership

The client-side composer owns capture and navigation.

The history panel owns search and manual actions.

The backup layer owns import/export.

The settings layer owns retention and opt-out.

The service worker owns offline asset availability.

No backend component owns history state.

## Lifecycle

Page load mounts the core after the DOM is ready.

Panel and settings mount as progressive enhancements.

Submit creates a record only when enabled.

Storage changes refresh in-memory state.

Destroy removes listeners and temporary UI.

## State model

Core history array is authoritative for navigation in the current tab.

localStorage is the persistent source.

Panel reads through the controller.

Settings changes refresh both persistent and in-memory state.

## Consistency

Same text is deduplicated.

Retention is applied after every write.

A disabled setting removes persisted history.

A reduced limit immediately trims loaded history.

## User control

The user can inspect history.

The user can delete one item.

The user can clear all items.

The user can disable persistence.

The user can choose a retention bound.

The user can export or import manually.

## Boundaries

The feature does not alter conversation storage.

The feature does not alter message workspace records.

The feature does not alter prompt library records.

The feature does not modify server requests.

The feature does not create credentials.
