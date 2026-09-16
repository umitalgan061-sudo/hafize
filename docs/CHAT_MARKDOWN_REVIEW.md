# Chat Markdown — Release Review

## Product

- [x] Assistant-only formatting
- [x] Plain-text source remains canonical
- [x] Code block copy action
- [x] Streaming repaint lifecycle
- [x] Mobile and theme-aware presentation

## Security

- [x] No HTML string execution
- [x] No `eval` or `new Function`
- [x] Link scheme allowlist
- [x] No automatic network requests from rendered content
- [x] Bounded parsing

## Integration

- [x] Existing `app.js` remains authoritative for conversation persistence
- [x] Downstream copy/workspace/voice consumers keep source text
- [x] Optional bootstrap preserves fallback when Markdown assets fail
- [x] Current main Prompt Library features remain in the page shell

## Test / DoD

- Dedicated block, inline, DOM, security, limits and streaming suites are included.
- Bootstrap ordering and runtime-boundary tests are included.
- Browser visual verification remains a manual QA item because the available headless browser environment is not reliable for this repository.

## Rollback

Remove the Markdown bootstrap and assets; the existing text-only rendering path remains available in `app.js`.
