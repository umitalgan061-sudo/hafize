# TypeScript release checklist

## Build

Run npm run typecheck and npm run typecheck:runtime.

Run npm run test:modern and npm run test:typed-core.

Run npm run format:check.

## Entry verification

Confirm start uses lib/production-guard.ts.

Confirm server.mjs imports the typed core boundaries.

Confirm tsconfig includes lib/**/*.ts.

Confirm Vitest includes lib/**/*.test.ts.

## Security verification

Confirm no secrets were added under public or committed environment files.

Confirm credential policy and tool-result policy tests pass.

Confirm production guard still enforces authentication, CSRF and bounded rate limits.

## Runtime verification

Start the application with the documented production command.

Exercise health, model listing, chat, tool, schedule creation and schedule listing smoke paths.

Verify a failed stream terminates with the existing SSE completion marker.

Verify a local model URL outside loopback is rejected.

## Migration verification

A migrated .mjs module must have its runtime import changed to the .ts implementation.

A legacy module may remain only as a leaf dependency behind an explicit migration boundary.

Do not rename hundreds of files only to satisfy a language quota. Preserve behavior and migrate one domain boundary at a time.

## Rollback

Revert the affected typed import or revert the PR as one unit. Do not delete runtime data or weaken security checks during rollback.
