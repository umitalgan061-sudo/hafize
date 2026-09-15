# Composer History — Erişim Kontrolü

History data is scoped to the current browser origin.

No cross-origin reads are attempted.

The module does not inspect browser credentials.

The module does not read cookies directly.

The module does not call account APIs.

## User actions

Capture is caused by submit.

Panel opening is explicit.

Delete is explicit.

Clear requires confirmation.

Export is explicit.

Import is explicit.

Retention changes are explicit.

## Local authority

The browser localStorage object is the persistence authority.

A storage exception is treated as unavailable state.

Malformed state is not elevated into executable content.

## Future sync

Cross-device synchronization is intentionally outside this contract.

Any future sync must authenticate independently and receive explicit user authorization.

The local-only implementation must not silently become a remote sync client.
