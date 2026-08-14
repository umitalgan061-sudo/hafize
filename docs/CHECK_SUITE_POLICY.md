# Hafize Check Suite Policy

`npm run check` is the repository's canonical local verification entrypoint. It must not depend on a hand-maintained list of every test file because that list silently drifts as new capabilities are added.

## Discovery contract

`scripts/run-checks.mjs` builds its plan through `scripts/check-suite-policy.mjs` on every run. The policy syntax-checks JavaScript modules under `lib/`, `public/`, `desktop/`, and `scripts/`, plus the root `server.mjs` entrypoint. Paths are normalized and sorted so the same tree produces the same execution order.

Every `scripts/test-*.mjs` file is a standard test by default. A new test therefore joins `npm run check` without a package.json edit. `scripts/validate-agent-registry.mjs` remains an explicit validator and runs before behavioral tests.

## Opt-in tests

Tests that require external infrastructure may be excluded only by an explicit entry in `CHECK_OPT_IN_TESTS`. Each entry must name an existing discovered test and include a reason. Missing or duplicate entries fail plan discovery, so the exclusion list cannot become stale silently.

The only current opt-in test is `scripts/test-redis-schedule-lease-live.mjs`, because it requires `HAFIZE_TEST_REDIS_URL` and a reachable Redis service. It is still syntax-checked during the standard suite; its live behavior is run explicitly when that environment is intentionally available.

## Failure behavior

The runner is fail-fast. Syntax failures stop before validators or behavioral tests. Validator failures stop before tests. A failing child process reports its captured output and terminates the suite with `CHECK_STEP_FAILED` instead of continuing with a misleading partial success.

`npm run check:list` prints counts plus the explicit opt-in metadata without executing tests. This is intended for reviewing suite coverage, not as a substitute for `npm run check`.

## Adding tests

Add normal regression tests under `scripts/test-*.mjs`; no package script update is needed. Do not add a test to the opt-in list merely because it is slow or flaky. External-service dependency must be intentional, narrowly scoped, and documented.

If another truly live integration test becomes necessary, update the policy and its regression tests in the same PR. The default remains: tests run unless explicitly classified otherwise.
