# Revision History Acceptance Criteria

## Core behavior

Revision History is successfully integrated when each eligible prompt exposes one `Geçmiş` action and opening it displays only that prompt's revisions.

## Capture

Edit click captures the state before changes are committed. Manual checkpoint explicitly captures the current state. Duplicate content does not create duplicate history.

## Restore

A confirmed restore changes title, body and tags to the selected revision while preserving prompt identity, favorite, useCount and createdAt. updatedAt moves forward.

## Comparison

A confirmed-free compare action displays current and historical body values side by side. Preview content is bounded and rendered as text.

## Deletion

Single revision deletion and complete history clearing both require confirmation and leave the main prompt intact.

## Export

Export produces valid versioned JSON and never uploads data to a service.

## Storage

Malformed data is ignored safely. Storage errors are contained.

## Accessibility

Dialog semantics, focus return, Escape, Tab loop and status announcements are present.

## PWA

Revision assets are present in the shell cache and cache version is advanced.

## Privacy

No analytics, telemetry, connector or network code is introduced for revisions.

## Regression

Existing Prompt Library features remain usable and usage statistics are not altered by restore.

## Release

The feature may merge only after source-contract tests and the repository's normal checks are evaluated. Missing CI results must be reported, not assumed successful.
