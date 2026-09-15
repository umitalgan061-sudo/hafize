# Composer History — Test Matrix

| Alan | Pozitif | Negatif | Sınır |
|---|---|---|---|
| Load | valid array | invalid JSON | 40 kayıt |
| Save | localStorage write | quota exception | 12k chars |
| Dedup | same message | empty message | repeated submit |
| Keyboard | arrow at edge | arrow in middle | empty history |
| IME | composition active | stale composition | rapid key event |
| Draft | restore original | missing draft | empty draft |
| Panel | open/use | missing controller | empty list |
| Search | matching phrase | no match | 80 char query |
| Delete | single row | cancel confirm | last row |
| Clear | confirm | cancel | empty state |
| Settings | 10/20/40 | invalid value | zero retention |
| Backup | export/import | malformed JSON | 512 KB |
| DOM | plain text | HTML payload | long title |
| PWA | cached assets | missing asset | API exclusion |
| Lifecycle | destroy | double destroy | reload mount |

## Required evidence

Each row needs a deterministic assertion or source-contract test.

Browser-only behavior should be tested with a fake DOM when full browser automation is unavailable.

Hosted CI results must be recorded when provided.

Failures must be reported rather than masked.

## Security cases

History records containing script-like text remain inert.

History does not make fetch calls.

API paths are never added to shell assets.

Retention cannot exceed hard maximum.

Import cannot exceed bounded input size.
