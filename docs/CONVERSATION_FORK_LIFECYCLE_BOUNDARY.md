# Conversation fork lifecycle boundary

`public/conversation-fork.js` lets a user create a new conversation from an existing assistant message while retaining the source conversation. Because the action writes canonical conversation storage and reloads the app, stale UI controllers must not retain authority after teardown or remount.

## Ownership

- Exactly one conversation-fork controller may own a given `#messages` root at a time.
- Ownership is tracked independently from DOM markers, so removing a generated button does not let a second controller silently take over.
- A controller only owns controls and markers that it created itself.
- Existing `.conversation-fork-btn` controls or non-owned `hafizeForkReady` marker values are treated as host/foreign state and are not replaced or removed.

## Installation and teardown

- Decoration installation is atomic per assistant message. Listener, wrapper and marker state roll back if installation fails.
- MutationObserver installation failure rolls back all decorations created by that controller and releases root ownership.
- `destroy()` disconnects observation, removes owned listeners/controls, restores the previous marker state and releases root ownership.
- Destroy is idempotent and a clean controller may mount after the prior owner is destroyed.

## Stale callback boundary

A callback captured from a destroyed or superseded controller must not:

- read or write canonical conversation storage,
- create or roll back a fork,
- copy model preference state,
- publish `hafize:conversation-branched`,
- reload the application,
- decorate messages appended after teardown.

Every side-effecting stage revalidates live ownership. A stale callback therefore becomes inert even if JavaScript still holds a reference to it.

## Existing user-data protections

The lifecycle change does not weaken existing fork semantics:

- an active response stream blocks forking;
- an unsent composer draft blocks forking;
- only uniquely identifiable assistant messages can be fork anchors;
- the source conversation must still be present after persistence verification;
- a failed persistence verification does not publish lineage or reload;
- model preference copy remains best-effort only after the transcript fork is canonical.

## Security and privacy scope

This feature does not gain connector, OAuth, filesystem, shell or external-send permissions. It only mutates Hafize's existing canonical conversation storage after an explicit user click. Agent registry/router, provider selection and backend tool authorization remain unchanged.
