# Smart Fill Architecture

## 1. Overview

Smart Fill is a client-only workflow layered on top of the Prompt Library. Its purpose is to turn a stored prompt with normalized placeholders into a user-editable message in the existing composer.

The feature is intentionally additive. The Prompt Library remains the source of prompt records, Usage Insights remains the source of usage summaries, and Smart Fill consumes both without replacing their storage contracts.

## 2. Modules

### `prompt-library-fill.js`

Owns the core dialog lifecycle.

Responsibilities:

- resolve a prompt record by id,
- discover normalized variables,
- create bounded text fields,
- restore optional remembered values,
- update the plain-text preview,
- copy the completed text into `#messageInput`,
- dispatch the existing input event,
- increase prompt usage after a successful transfer,
- close and clean up the dialog.

It does not own preset persistence, history persistence, or backup files.

### `prompt-library-fill-presets.js`

Owns named sets of variable values.

A preset belongs to one prompt id. Presets never use prompt title as a foreign key. This matters when two prompts share a title.

### `prompt-library-fill-backup.js`

Owns normalization and bounded merge logic for preset backups.

The module is deliberately independent from the file picker and download UI so the data contract can be tested without a browser.

### `prompt-library-fill-backup-ui.js`

Owns visible preset import/export and clear actions.

The UI uses a temporary file input and a generated Blob download. It never calls a remote endpoint.

### `prompt-library-fill-history.js`

Owns recent successful fill combinations. History is bounded, deduplicated by prompt id and value set, and local to the device.

### `prompt-library-fill-history-ui.js`

Bridges fill dialogs to the history module. It records a history entry after the fill form reaches its submit handler. It also provides an `Uygula` action for an earlier value set.

### `prompt-library-fill-privacy.js`

Provides visible controls for removing remembered values and presets. It does not delete Prompt Library records.

### `prompt-library-fill-field-status.js`

Adds per-field character counts and a simple completion summary. It does not alter the underlying value limits.

### `prompt-library-fill-defaults.js`

Offers safe static defaults for common variable names such as language, tone, format, and audience. It never calls an AI service and never guesses from private content.

### `prompt-library-fill-keyboard.js`

Provides keyboard-only convenience operations within an open dialog.

## 3. Storage boundaries

Prompt data: `hafize.prompt-library.v1`

Remembered field values: `hafize.prompt-library.fill.v1`

Named presets: `hafize.prompt-library.fill.presets.v1`

Recent fill history: `hafize.prompt-library.fill.history.v1`

No Smart Fill data is stored in the chat history namespace.

## 4. Ownership rules

The Prompt Library owns prompt ids and prompt bodies.

Smart Fill reads those values and does not mutate the prompt body while editing fields.

Only successful composer transfer updates the prompt's `useCount`.

Usage Insights reads `useCount`; it does not create a second counter.

History stores a copy of variable values, not the whole prompt body.

Preset storage stores only named values, not chat messages.

## 5. Event flow

1. Prompt Library renders a card.
2. Smart Fill enhancement detects a variable-bearing row.
3. `Alanları doldur` is added.
4. Click resolves the record by `data-prompt-id`.
5. The dialog is created.
6. Fields are populated from remembered values.
7. History/preset helpers may add controls after the dialog appears.
8. User changes fields.
9. Preview updates through replacement logic.
10. User transfers the result.
11. Composer receives the result.
12. Composer receives an input event.
13. Usage count is persisted.
14. Successful values are optionally remembered.
15. Successful values are recorded in fill history.
16. The dialog closes.

No step sends a network request from Smart Fill itself.

## 6. Failure isolation

A missing helper module should not make the base Prompt Library unusable.

The core fill dialog uses optional access to helper APIs.

A failed history write should not prevent a composer transfer.

A failed preference write should not prevent a preview.

A failed backup import should not replace existing data.

A missing composer prevents transfer because there is no valid destination.

## 7. DOM boundary

Static UI labels may be created as text constants.

Prompt title, variable names, preset names, history summaries, and preview content are inserted as text.

The architecture deliberately avoids HTML parsing for user content.

## 8. Network boundary

The Smart Fill layer contains no remote request implementation.

Any chat send after transfer belongs to the existing composer/app runtime.

This keeps Smart Fill testable without credentials and safe for offline use.

## 9. PWA boundary

Static Smart Fill assets are listed in the service-worker shell policy.

Dynamic API endpoints remain network-only.

The feature does not introduce a new backend route.

## 10. Keyboard model

`Ctrl/Cmd+Shift+Enter` transfers the current form values.

`Ctrl/Cmd+Shift+R` clears current fields.

Escape closes the dialog through its cancel handler.

These shortcuts are scoped to the open fill dialog.

## 11. Privacy model

Remembering values is explicit.

Preset storage is explicit.

History is local.

Users receive controls to clear current prompt values or all Smart Fill data.

Secret values are intentionally discouraged by the user documentation.

## 12. Test model

Source tests verify static contracts.

Storage tests verify bounded normalization.

Lifecycle tests verify observer teardown.

Security tests verify no dynamic HTML or network primitives.

PWA tests verify shell asset wiring.

QA documentation defines manual browser behavior.

## 13. Extensibility

A future variable type system can be added beside the current text input flow.

A future connector can consume the completed composer content through the normal app runtime.

A future server-side sync can use a dedicated user-approved API rather than silently changing the local-only contract.

None of those capabilities are required for the current Smart Fill release.
