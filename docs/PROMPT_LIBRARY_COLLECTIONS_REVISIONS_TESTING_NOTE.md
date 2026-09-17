# Testing note

The feature includes source-contract and runtime-stub tests under `scripts/test-prompt-library-*`.

The runtime collection test uses an in-memory localStorage implementation and exercises create, update, membership, import/export, prune and delete behavior.

The runtime revision test exercises capture, duplicate suppression, export, restore and stable prompt metadata.

The remaining tests lock bounds, lifecycle, security, UI, PWA, enhancement and cross-feature contracts.

A full repository checkout was not available for this session, so the complete `npm run typecheck`, `npm run build`, `npm run test` and `npm run check` suite could not be executed locally here. The PR records this limitation rather than claiming a local full-suite pass.

No GitHub Actions workflow run was available for the branch at the time of preparation. Merge therefore relies on the repository's current mergeability plus the explicit source/runtime release gates committed with the feature.

This note is evidence, not a substitute for CI.
