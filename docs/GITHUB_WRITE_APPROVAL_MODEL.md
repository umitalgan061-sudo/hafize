# GitHub write approval model

GitHub writes are intentionally split into approval and execution boundaries. A model-produced boolean is not an approval credential.

## Approval contract

The backend normalizes an allowlisted `branch.create`, branch-only `file.update`, draft-only `pr.create`, or head-SHA-pinned `pr.merge` command. It then issues a short-lived HMAC token bound to:

- authenticated connector owner scope,
- repository,
- operation,
- every normalized operation parameter,
- expiry and a random nonce.

The token is single-use. A changed branch, file path, expected blob SHA, commit message, file-content digest, PR title, PR number, expected merge head SHA, repository, or authenticated user cannot reuse it. Invalid or expired tokens fail before a writer callback is invoked.

`approvalGranted` is backend execution state, not request data. Public callers cannot set that field to authorize themselves.

## Execution contract

The execution boundary consumes the exact approval immediately before the injected GitHub writer is called. `file.update` is limited to `hafize/*` branches, requires an exact existing blob SHA, accepts at most 64 KiB of non-empty UTF-8 content, and blocks secret-like paths plus `.github/workflows/`. A writer failure still spends the token; retrying a side effect requires a fresh user approval. Pre-aborted requests do not consume the approval.

Writer receipts are reduced to fixed public fields and provider failures become `GITHUB_WRITE_EXECUTION_FAILED`. Provider tokens, filesystem paths, headers, raw API responses, principal subjects, owner IDs, and the approval token are never passed back as public execution data.

## Deployment boundary

The repository now contains a server-side GitHub REST writer adapter for branch creation, exact-SHA file update, draft PR creation, and head-pinned merge. It is still not registered in the model tool catalog and no production HTTP write route exists. Future production wiring must use a separate write-repository allowlist and a server-held approval secret, keep approval tokens request-scoped, and preserve the rule that self-development never writes directly to `main` or modifies `.github/workflows` automatically.
