# Collections security

## Boundary

Collections are browser-local data structures. The module has no fetch, XHR, WebSocket, beacon, analytics SDK, cookie write, or server-side persistence path.

## Input validation

Collection input must be an object. Name is required. Description and id fields are bounded strings. Membership entries are accepted only when they are strings and are present in prompt storage.

## DOM boundary

User-controlled collection names and descriptions are inserted with `textContent` or form `value`. No collection field is interpolated into HTML markup. Buttons and selects use explicit DOM creation.

## Storage failure

Storage reads are fail-soft. Invalid JSON produces an empty collection set. Writes return false on quota/security failure and callers surface a bounded status message.

## Import boundary

Import is JSON-only and limited to 500 KB. Incoming collection ids are regenerated, duplicate names are skipped, and members are pruned against currently known prompt ids.

## Export boundary

Export contains metadata and prompt id references only. Prompt bodies, variable values, or chat history are not copied into a collection export.

## Orphans

A missing prompt id is never presented as a valid member. Pruning occurs before normal collection reads and writes.

## Least privilege

Collections do not request permissions, account identity, OAuth scopes, or connector access.

## Recovery

Reverting the UI files does not require deleting collection storage. A later compatible release can read the same key.

## Review checklist

- no network primitive added
- no secret access
- no cross-origin resource access
- no HTML interpolation of user data
- bounded import
- bounded record counts
- duplicate member removal
- orphan pruning
- safe storage failure
- explicit delete confirmation
