# Conversation model state storage boundary

Hafize keeps the selected model as a per-conversation UI preference without mixing that preference into the guarded conversation transcript payload.

## Keys

- Conversation transcript source: `hafize.conversations.v1`.
- Model preference map: `hafize.conversation-models.v1`.
- The model map contains only `{ conversationId, modelId }` records and is bounded to 30 entries.

This separation is intentional. `conversation-storage-guard.js` canonicalizes transcript state with an explicit allowlist. A model preference is not message content and should not be silently removed by transcript normalization or force the transcript guard to accept unrelated UI metadata.

## Validation

Conversation IDs use the same bounded identifier shape as guarded conversation state: 1–120 characters from `[A-Za-z0-9._:-]`. Model IDs are NFC-normalized, trimmed, limited to 240 characters, and reject ASCII control characters. Entries for conversations that no longer exist are discarded. Duplicate conversation IDs are collapsed deterministically.

Unknown fields are not persisted. Tokens, credentials, owner IDs, trace IDs, connector data, message content, or tool output never belong in the model preference map.

## Lifecycle

When a conversation becomes active, Hafize restores its saved model only when that model still exists in the current model selector allowlist. If no saved preference exists, the current valid selector value becomes the bounded preference for that conversation.

Older state that still contains a valid `modelId` inside a conversation object is migrated best-effort into the separate map. New writes do not mutate `hafize.conversations.v1` merely to store model selection.

A `storage` event for either conversation state or model state triggers a bounded re-sync so multiple tabs converge on the same preference. Model selection remains locked while a response is streaming.

## Security invariants

- No network request is introduced by this preference layer.
- No provider or agent tool permission is changed by model selection.
- NVIDIA/local provider choice remains independent of backend default-deny tool authorization.
- No secret values enter agent context or the preference map.
- No external write/send/merge operation is triggered.
- No `.env`, credential file, generated/vendor file, or workflow file is involved.
