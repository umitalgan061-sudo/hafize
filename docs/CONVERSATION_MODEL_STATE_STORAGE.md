# Conversation model state storage boundary

Hafize keeps the selected model as a per-conversation UI preference without mixing that preference into the guarded conversation transcript payload.

## Keys

- Conversation transcript source: `hafize.conversations.v1`.
- Model preference map: `hafize.conversation-models.v1`.
- The model map contains only `{ conversationId, modelId }` records and is bounded to 30 entries.
- Serialized model metadata is bounded to **32 KiB** before parsing or writing.

This separation is intentional. `conversation-storage-guard.js` canonicalizes transcript state with an explicit allowlist. A model preference is not message content and should not be silently removed by transcript normalization or force the transcript guard to accept unrelated UI metadata.

## Validation

Conversation IDs use the same bounded identifier shape as guarded conversation state: 1–120 characters from `[A-Za-z0-9._:-]`. Model IDs are NFC-normalized, trimmed, limited to 240 characters, and reject ASCII control characters. Entries for conversations that no longer exist are discarded. Duplicate conversation IDs are collapsed deterministically.

Unknown fields are not persisted. Tokens, credentials, owner IDs, trace IDs, connector data, message content, or tool output never belong in the model preference map. Oversized raw model metadata is not parsed and is compacted to the bounded canonical state on the next model-state synchronization.

## Active conversation identity

Conversation rows can be visually reordered by the local organization layer when a conversation is pinned. DOM position is therefore not a stable conversation identity once `conversation-organize.js` has tagged a row.

When the active row contains `data-conversation-organize-id`, model-state treats that identifier as authoritative only after it passes the bounded conversation-ID validator, resolves to exactly one canonical conversation, and appears on exactly one rendered row. A stale, malformed, empty, duplicate, or otherwise ambiguous organizer identity fails closed; Hafize does not fall back to the row index and risk writing another conversation's model preference.

Legacy surfaces that have no organizer identity attribute retain the historical DOM-index lookup so older shells remain compatible. Assignment of the organizer identity attribute is itself observed so an already-active row can be safely re-synchronized once its stable identity becomes available.

## Lifecycle and compaction

When a conversation becomes active, Hafize restores its saved model only when that model still exists in the current model selector allowlist. If no saved preference exists, the current valid selector value becomes the bounded preference for that conversation.

Every model-state restore/persist synchronization canonicalizes the separate preference store against the current conversation IDs before returning, even when the active model itself did not change. This removes preferences for individually deleted or retention-evicted conversations and strips unknown fields without waiting for a later model change.

Compaction writes only when raw storage differs from canonical JSON. A canonical store therefore does not create cross-tab storage-event ping-pong. When clear-history temporarily removes every conversation, model preferences may compact to `[]`; the session-only clear undo layer snapshots this bounded companion state before deletion and can restore it if the user chooses `Geri al`.

Older state that still contains a valid `modelId` inside a conversation object is migrated best-effort into the separate map. New writes do not mutate `hafize.conversations.v1` merely to store model selection.

A `storage` event for either conversation state or model state triggers a bounded re-sync so multiple tabs converge on the same preference. Model selection remains locked while a response is streaming.

## Security invariants

- No network request is introduced by this preference layer.
- No provider or agent tool permission is changed by model selection.
- NVIDIA/local provider choice remains independent of backend default-deny tool authorization.
- No secret values enter agent context or the preference map.
- No external write/send/merge operation is triggered.
- No `.env`, credential file, generated/vendor file, or workflow file is involved.
