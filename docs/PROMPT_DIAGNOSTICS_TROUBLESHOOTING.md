# Prompt Diagnostics Troubleshooting

## Panel shows healthy but user reports missing prompt

Export the current Prompt Library and inspect the exported item count. Search uses the normalized title/body/tags/variables fields. A missing result can be caused by the active query, tag filter or favorite-only filter rather than storage loss.

## Panel reports invalid prompts

The diagnostics layer counts records that cannot pass `normalizeItem`. Empty bodies and malformed objects are not recoverable as valid prompts. Export valid records before repair when the original local data may be important.

## Duplicate ids

Duplicate ids are reported but do not automatically overwrite one another. Repair normalizes the collection to bounded unique ids according to the current Prompt Library contract.

## Orphan collection members

An orphan is a collection membership pointing to an id not present in the current prompt set. Repair removes only those stale references. It does not delete valid prompts.

## Storage write failures

Browser quota or private-mode restrictions can make `localStorage.setItem` fail. The UI should report the failure without crashing the application. The user can export smaller subsets or free browser storage.

## Import looks empty

Verify that the JSON root is either an array or an object containing `items`. Body-less records are filtered by the normalizer. A preview with zero valid items disables confirmation.

## Import reports conflicts

Conflicts are expected when an export contains a prompt id already present on the device. The merge policy creates a new id rather than overwriting the existing prompt.

## Repair safety

Repair requires explicit confirmation. Cancel or Escape must leave storage unchanged. If a repair operation fails, the user should retain access to the last readable prompt list.

## PWA stale version

When new static trust modules are deployed, the service-worker shell cache version must advance. Without a cache version change, an older worker may continue to serve previous assets.

## Rollback

Revert the trust workflow changes without clearing `hafize.prompt-library.v1`. The base library and user prompts should remain readable after the new modules are removed.
