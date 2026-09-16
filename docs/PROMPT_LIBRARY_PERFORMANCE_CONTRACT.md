# Prompt Library Performance Contract

## Bounded work

Import preview parses one selected file and immediately rejects files over 1 MB. Prompt normalization uses bounded slices. Diagnostics scan bounded prompt and orphan sets.

## Rendering

Preview shows a small sample of incoming records rather than constructing an unbounded DOM tree. Diagnostics render summary counters rather than full prompt bodies. Bulk organizer renders only controls needed for current selection.

## Event behavior

Import preview registers listeners only while the panel is open. Modal close removes its DOM. Base Prompt Library keeps its existing event lifecycle.

## Storage

Writes occur only after validation and explicit confirmation. The implementation does not repeatedly serialize the same payload during a single confirmed import.

## Large library

At 120 prompts, search and normalization remain bounded by the existing library cap. Bulk selection is capped at 40. Tag normalization is capped at 8.

## Offline

New static modules do not depend on a remote service. Service-worker shell caching may serve them offline after the cache version is refreshed.

## Regression watch

Performance regressions should be checked for MutationObserver churn, duplicate listeners, unnecessary complete-panel rerenders and repeated JSON serialization.

## DoD

No new dependency is introduced. No timer loop is required for import, diagnostics or bulk editing. Cleanup paths must stop observers and remove modal nodes.
