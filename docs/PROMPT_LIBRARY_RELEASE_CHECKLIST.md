# Prompt Library Release Checklist

## Code

- import preview module loads after the base Prompt Library,
- diagnostics module detects malformed local data,
- bulk organizer uses existing selection semantics,
- all user text is rendered safely,
- no secret or credential storage is introduced.

## PWA

- new CSS and JS assets are added to shell cache policy,
- cache version changes when the shell contract changes,
- `/api/` remains network-only.

## QA

- import valid/invalid/oversize cases,
- duplicate id and capacity cases,
- diagnostics healthy/invalid/orphan cases,
- bulk tag/favorite cases,
- Escape and Tab behavior,
- mobile and forced-colors layout.

## Rollback

- revert the trust workflow commit,
- preserve existing prompt storage,
- avoid deleting user localStorage during rollback.

## Acceptance

Release is accepted only when the base Prompt Library continues to work with the new modules unavailable. Any failing test must be recorded rather than hidden.
