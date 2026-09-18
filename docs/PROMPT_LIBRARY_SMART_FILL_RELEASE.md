# Smart Fill Release Checklist

## Feature readiness

- [ ] Variable prompt card renders `Alanları doldur` only when variables exist.
- [ ] Dialog resolves the prompt by id.
- [ ] Preview is plain text.
- [ ] Composer transfer dispatches the existing input event.
- [ ] Smart Fill never submits the chat automatically.
- [ ] Usage increments once per successful transfer.
- [ ] Persistent remembered values require explicit user choice.
- [ ] Session values never enter persistent storage.
- [ ] Presets are isolated by prompt id.
- [ ] Fill history is bounded and deduplicated.
- [ ] Preset backups are bounded and normalized.
- [ ] Privacy controls are visible and confirmation based.
- [ ] Field character counts remain within the core limit.
- [ ] Safe defaults never call a remote service.
- [ ] Preview copy is best-effort and never blocks transfer.

## Security readiness

- [ ] No secret/token access.
- [ ] No cookie access.
- [ ] No remote analytics.
- [ ] No fetch/XHR/Beacon/WebSocket/EventSource.
- [ ] No eval/new Function.
- [ ] No innerHTML/outerHTML for user content.
- [ ] Storage writes are bounded.
- [ ] Backup imports are bounded.
- [ ] User content is never logged by the feature.
- [ ] Prompt ids are not replaced by titles as keys.

## Accessibility readiness

- [ ] Dialog has an accessible label.
- [ ] Variable controls have accessible names.
- [ ] Focus enters the first field.
- [ ] Escape closes the dialog.
- [ ] Keyboard transfer shortcut works.
- [ ] Keyboard reset shortcut works.
- [ ] Character counts use polite live updates.
- [ ] Forced colors preserve control boundaries.
- [ ] Reduced motion disables entry animation.
- [ ] Mobile actions remain reachable.

## PWA readiness

- [ ] Smart Fill static assets are shell cached.
- [ ] History CSS is shell cached.
- [ ] Fill helpers are shell cached.
- [ ] Session and copy helpers are shell cached.
- [ ] API requests remain network-only.
- [ ] Cache version is incremented when assets change.

## Data compatibility

- [ ] Existing prompts work without migration.
- [ ] Imported duplicate prompt ids remain addressable.
- [ ] Same-title prompts use distinct id-scoped preset/history values.
- [ ] Corrupt storage falls back safely.
- [ ] Removing Smart Fill does not delete Prompt Library data.
- [ ] Privacy cleanup does not delete prompt records.

## Verification

Run the Smart Fill source, safety, lifecycle and PWA checks.

Run the existing Prompt Library checks.

Run the repository's normal precheck/check commands in CI.

Record any unavailable local command honestly in the PR.

## Rollback

Revert the Smart Fill PR.

Keep Prompt Library records intact.

Keep Usage Insights intact.

Remove only Smart Fill-specific static assets and tests when necessary.

Optionally clean the three Smart Fill storage namespaces if the product requires a full client-side cleanup.

## Support

When collecting a bug report, ask for browser family/version and the prompt id, not the user's prompt content or variable values.

Do not request API keys, access tokens, session cookies or backup files containing private data.
