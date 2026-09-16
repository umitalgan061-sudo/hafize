# Prompt Accessibility QA

## Import preview

The preview must announce itself as a dialog, expose a labelled heading, and keep keyboard focus inside the active surface. Escape closes without writing storage. The first available action receives focus.

## Diagnostics

The health panel uses a heading association and `aria-expanded` for collapse state. Summary values are text, not color-only indicators. Repair is disabled when the state is healthy.

## Bulk organizer

The selected count is visible before editing. Tag input and favorite selector have accessible labels. Buttons describe the operation they perform. Escape returns to the library.

## Screen reader expectations

The user can identify what will happen before confirming an import or repair. Dynamic status messages are concise and use a live region when appropriate.

## Mobile

Panels fit within the viewport without horizontal scrolling. Action buttons wrap instead of clipping. Long prompt titles and tag values wrap naturally.

## Forced colors

Borders, focus indicators and text remain visible using system colors. Status meaning is repeated in text.

## Reduced motion

No required interaction depends on animation timing. Opening, closing, rendering and confirmation work with motion preferences disabled.

## Focus return

After closing a modal, focus returns to the invoking button when that button still exists. Destroyed or missing triggers do not throw.

## QA evidence

Manual keyboard testing should cover Tab, Shift+Tab, Enter, Escape and direct text entry. Automated source-contract tests should check dialog semantics and the absence of unsafe HTML construction.

## Acceptance

Accessibility is considered complete only when a keyboard-only user can import, cancel, inspect health, repair after confirmation, and bulk-edit without relying on a pointer or color cues.
