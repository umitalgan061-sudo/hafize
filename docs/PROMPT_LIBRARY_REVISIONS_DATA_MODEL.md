# Revision data model

## Root

Storage key: `hafize.prompt-library.revisions.v1`.

The root value is an array. Invalid or unreadable JSON becomes an empty array. The module never executes imported JSON.

## Revision record

```text
id: string
promptId: string
createdAt: string
reason: string
snapshot: PromptSnapshot
```

## Snapshot

```text
id: string
title: string
body: string
tags: string[]
favorite: boolean
useCount: number
createdAt: string
updatedAt: string
```

## Limits

A body is truncated to 8000 characters. Title is truncated to 100, each tag to 24, tags to 8, reason to 160, id to 120. Twenty revisions are retained per prompt and 600 globally.

## Ordering

Revision lists are sorted by `createdAt` descending. Capture inserts the newest revision first and keeps bounded history.

## Duplicate suppression

The latest revision is compared for title, body, tags and favorite state. If no meaningful content change occurred, a new revision is not created.

## Restore semantics

Restore does not reuse the revision id as prompt id. The live prompt keeps its own id and creation timestamp. A pre-restore snapshot is captured before replacing the body/title/tags/favorite fields.

## Usage count

Restore preserves the live prompt's `useCount`; revision history is content history, not usage analytics.

## Orphan cleanup

`pruneOrphans` compares revision prompt ids to current prompt ids. Unmatched revisions are deleted from revision storage.

## Export

Export envelope contains version, source, exportedAt, promptId and revisions. It is a local Blob download only.

## Compatibility

Existing prompt records remain unchanged. Revision storage is additive and optional; deleting it does not invalidate the current prompt library.

## Failure behavior

A read failure is non-fatal. A write failure returns false. Restore returns null when the requested revision or prompt no longer exists.
