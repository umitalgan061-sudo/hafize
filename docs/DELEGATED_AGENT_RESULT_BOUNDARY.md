# Delegated agent result trust boundary

Hafize treats a delegated specialist's return value as untrusted runtime data until it passes a narrow structural contract.

## Accepted results

A successful child result is exactly:

```js
{ ok: true, content: "..." }
```

`content` must be a string no longer than 32,768 JavaScript characters.

A failed child result is exactly:

```js
{ ok: false, error: "UPPERCASE_ERROR_CODE" }
```

The error code is bounded to 120 characters and must use the stable uppercase code format. Raw exception messages, connector payloads, tokens, credentials, or arbitrary prose are not accepted as delegated error codes.

## Fail-closed structure

The result must be a plain object or a null-prototype object containing only data properties. Arrays, class instances, accessor properties, extra fields, malformed success/failure shapes, oversized content and introspection failures are rejected as `DELEGATED_RESULT_INVALID`.

This boundary is intentionally evaluated before a delegation is recorded as completed. A getter or proxy therefore cannot make the ledger say `completed` and then throw while the caller reads `content`.

## Cancellation precedence

If the child lease is aborted after execution starts, cancellation wins over the returned child payload. The caller receives `DELEGATION_CANCELLED`, and the delegation ledger records the terminal blocked/cancelled outcome.

An exception thrown by the child is normalized to `DELEGATED_AGENT_FAILED` unless the lease was cancelled.

## Security invariants

- This contract does not grant any new tool permission.
- Selector/specialist routing remains limited to the registry.
- Backend default-deny authorization remains authoritative.
- External write/send/merge operations still require their existing explicit approval boundaries.
- Secret values never become valid merely because a child returns them.
- All child work remains under the parent `trace_id` and task-ledger hierarchy.

The result validator is a trust boundary, not a substitute for provider validation, tool authorization, cancellation, or ledger sealing.
