# Prompt Smart Fill — Final Verification

## Functional gate

- Prompt Library records with `{{degisken}}` style placeholders open through the smart-fill path.
- Each detected variable receives its own bounded input.
- Preview updates as values change.
- Confirming the form writes only the completed prompt into `#messageInput`.
- The composer submit event is not triggered by insertion.
- Empty required values prevent insertion.
- Escape closes the dialog without mutating the composer.

## Security gate

- No server request is needed for variable substitution.
- User-supplied values are inserted through DOM properties rather than HTML parsing.
- Variable values are limited in length.
- Existing Prompt Library normalization remains the source of variable names.
- Usage or analytics telemetry is not introduced by the smart-fill surface.

## Accessibility gate

- Dialog semantics include an accessible name.
- Keyboard users can reach all fields and actions.
- Tab navigation stays within the active dialog.
- Escape provides a predictable cancellation path.
- Preview content is exposed as text and not interpreted as markup.

## Compatibility gate

- Existing Prompt Library storage remains unchanged.
- Existing command-palette and usage-insights modules remain compatible.
- Smart-fill assets are part of the PWA shell cache policy.
- The feature does not add a new dependency or server endpoint.

## Release gate

The final base-to-head diff remains below the repository's 3,000 changed-line hard limit and close to the requested 2.8k target. The branch is intended for PR-based review and merge; no direct `main` update is used.
