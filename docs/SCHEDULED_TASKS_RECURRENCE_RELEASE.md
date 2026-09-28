# Recurrence Release Checklist

## Source
Recurrence normalization mevcut store ile uyumlu.
Series anchor kalıcı.
History bounded.
Pause/resume transition guard var.
Preset storage ayrı namespace.

## UI
Index asset order kontrol.
Mobile CSS kontrol.
Forced-colors kontrol.
History toggle kontrol.
Bulk action confirmation kontrol.

## PWA
Cache version increment.
New asset list entries.
API network-only.
Offline shell precache integrity.

## Security
Credential policy.
Owner authorization.
Unknown field rejection.
Bounded history.
Bounded preset import.

## Test
Recurrence anchor.
Leap year.
Legacy compatibility.
Pause/resume.
Persistence round-trip.
HTTP PATCH.
Preset import.
Dashboard no-network.

## Manual smoke
Open Tasks.
Create one-shot.
Create daily recurring.
Create weekly multi-day.
Create monthly day 31.
Pause.
Resume.
Cancel.
Create and use preset.
Import after confirmation.
Export history summary.

## Rollback
Revert merge commit.
Validate old task panel.
Keep schedule data untouched.
