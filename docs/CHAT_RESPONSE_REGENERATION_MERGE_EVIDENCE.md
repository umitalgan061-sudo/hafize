# Merge Evidence

## Base
PR base is current main commit selected at turn start.

## Scope
Only response regeneration and directly related chat action, typed helper, style, test and documentation files are expected.

## Diff
Base-to-head additions plus deletions must remain below 3000 changed lines.

## Verification
GitHub compare result is the authoritative changed-line measurement for the PR.

## Tests
Local command results must be copied into the PR body. Missing local execution must be stated instead of inferred as passing.

## Review
PR metadata must mention why the previous response is preserved and why only the last assistant response can be regenerated.

## Rollback
PR can be reverted without backend route changes.

## Final
After merge, main branch SHA should be re-read and match the merge commit.
