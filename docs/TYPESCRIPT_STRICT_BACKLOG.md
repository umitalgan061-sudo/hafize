# TypeScript strict mode backlog

`npm run typecheck` (the `tsconfig.runtime.json` project) passes and gates
`npm run build`. The full-project `tsconfig.json`, which also covers the browser
sources and the suites, still reports **527 errors across 58 files**.

This file records that gap so it is a tracked work package rather than an
invisible one. Reproduce with:

```bash
npx tsc --noEmit
```

## Errors by file

| File | Errors |
| --- | --- |
| `public/typed/conversation-forks.ts` | 68 |
| `public/typed/legacy/prompt-library-smart-insert.ts` | 56 |
| `public/typed/legacy/prompt-library-smart-insert-center.ts` | 35 |
| `public/typed/conversation-fork-core.ts` | 33 |
| `public/typed/legacy/prompt-library-smart-insert-suggestions.ts` | 28 |
| `public/typed/conversation-fork-core.test.ts` | 26 |
| `public/typed/legacy/prompt-library-bulk-organizer.ts` | 26 |
| `public/typed/legacy/prompt-library-smart-insert-presets.ts` | 24 |
| `scripts/test-runtime-modernization.ts` | 21 |
| `public/typed/legacy/prompt-library-smart-insert-history.ts` | 15 |
| `public/typed/model-preferences.test.ts` | 15 |
| `public/typed/legacy/prompt-library-smart-insert-activity.ts` | 14 |
| `public/typed/legacy/prompt-library-smart-insert-validation.ts` | 13 |
| `lib/github-workspace-write.test.ts` | 12 |
| `lib/http-runtime.test.ts` | 10 |
| `public/prompt-library-smart-fill.ts` | 10 |
| `public/typed/legacy/prompt-library-smart-insert-shortcuts.ts` | 9 |
| `public/typed/workspace-backup.ts` | 7 |
| `lib/agent-delegation.test.ts` | 6 |
| `public/typed/voice-input.ts` | 6 |
| `lib/github-read.test.ts` | 5 |
| `lib/github-workspace.test.ts` | 5 |
| `lib/production-guard.ts` | 5 |
| `public/typed/legacy/prompt-library-smart-insert-history-bridge.ts` | 5 |
| `scripts/test-schedule-lease-runtime-config.ts` | 5 |
| `public/github-workspace-actions.ts` | 4 |
| `public/github-workspace-extra.ts` | 4 |
| `public/github-workspace-write.ts` | 4 |
| `public/typed/hafize-api.ts` | 4 |
| `public/typed/hafize-sse.test.ts` | 4 |
| `lib/delegated-agent-runner.ts` | 3 |
| `lib/github-workspace-extra.test.ts` | 3 |
| `public/github-workspace.ts` | 3 |
| `public/prompt-library-command-palette.ts` | 3 |
| `public/system-readiness-panel.ts` | 3 |
| `public/typed/hafize-storage.test.ts` | 3 |
| `public/typed/hafize-stream-state.ts` | 3 |
| `public/typed/response-variants.ts` | 3 |
| `lib/runtime-metrics.ts` | 2 |
| `public/github-workspace-details.ts` | 2 |
| `public/prompt-library-smart-fill.test.ts` | 2 |
| `public/typed/model-preferences-ui.ts` | 2 |
| `lib/agent-delegation.ts` | 1 |
| `lib/agent-run-ledger.ts` | 1 |
| `lib/canva-read-tool-boundary.ts` | 1 |
| `lib/context-compaction.ts` | 1 |
| `lib/gmail-read-tool-boundary.ts` | 1 |
| `lib/local-model-provider.ts` | 1 |
| `lib/model-provider-router.ts` | 1 |
| `public/prompt-library-smart-fill-hints.ts` | 1 |
| `public/scheduled-tasks-countdown.ts` | 1 |
| `public/typed/app-runtime.ts` | 1 |
| `public/typed/hafize-async.test.ts` | 1 |
| `public/typed/hafize-async.ts` | 1 |
| `public/typed/ui-shell.ts` | 1 |
| `public/typed/voice-output.ts` | 1 |
| `public/typed/workspace-backup.test.ts` | 1 |
| `scripts/test-typescript-source-integrity.ts` | 1 |

## Errors by kind

| Code | Meaning | Count |
| --- | --- | --- |
| `TS7006` | Parameter implicitly has an `any` type | 229 |
| `TS2339` | Property does not exist on the inferred type | 58 |
| `TS2322` | Assigned type is not compatible with the declared type | 25 |
| `TS2345` | Argument type is not assignable to the parameter | 24 |
| `TS2532` | Object is possibly `undefined` | 22 |
| `TS2554` | Wrong number of arguments | 22 |
| `TS2775` | Assertion needs an explicitly typed call target | 21 |
| `TS18047` | Value is possibly `null` | 20 |
| `TS7005` | Variable implicitly has an `any` type | 20 |
| `TS2352` | Conversion needs an `unknown` step | 19 |
| `TS2379` | Optional property type is not exact | 15 |
| `TS18048` | Value is possibly `undefined` | 13 |
| `TS7034` | see tsc output | 8 |
| `TS18046` | see tsc output | 6 |
| `TS2739` | see tsc output | 4 |
| `TS2769` | see tsc output | 3 |
| `TS2741` | see tsc output | 2 |
| `TS2375` | see tsc output | 2 |
| `TS2451` | see tsc output | 2 |
| `TS2393` | see tsc output | 2 |
| `TS2538` | see tsc output | 2 |
| `TS2448` | see tsc output | 1 |
| `TS2454` | see tsc output | 1 |
| `TS2306` | see tsc output | 1 |
| `TS2488` | see tsc output | 1 |
| `TS2304` | see tsc output | 1 |
| `TS18004` | see tsc output | 1 |
| `TS7053` | see tsc output | 1 |
| `TS2552` | see tsc output | 1 |

## Suggested order

1. `TS7006` / `TS7005` dominate and are mostly untyped callback parameters in the
   migrated browser modules. They are mechanical and unblock the rest.
2. `TS2339` concentrates in the Smart Insert and conversation-fork modules, whose
   DOM and storage records still need declared shapes.
3. The nullability codes (`TS2532`, `TS18047`, `TS18048`) are real guards worth
   adding rather than casting away.
4. `TS2775` affects `scripts/*.ts` assertion helpers and needs explicit
   annotations on the asserting functions.

Once the count reaches zero, change `build` to `tsc --noEmit && vite build` and
tighten the assertion in `scripts/test-typescript-ui-wave.mjs` to match.
