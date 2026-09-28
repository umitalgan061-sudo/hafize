# Final Smoke Sign-off

## Normal response
Assistant answer displays action controls.

## Regeneration
Only the last assistant answer can start a new generation.

## Instruction modes
Preset and custom instructions are transient request context only.

## Variants
Existing response variants are viewable and selectable.

## Feedback
👍 / 👎 state remains local and bounded.

## Copy
Clipboard action never changes conversation state on failure.

## Recovery
Generation failure restores the prior response.

## Persistence
Successful generation, restore and feedback use existing conversation persistence.

## Accessibility
Action rows and dialogs retain button semantics, labels, pressed state, focus-visible and keyboard paths.

## Network
Only existing chat/agent endpoints are used.

## PWA
Response data is not added to service worker shell assets.

## Release
Final base-to-head diff must remain below 3000 changed lines.
