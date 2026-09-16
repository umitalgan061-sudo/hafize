# PR summary

This change is intentionally additive to the current TypeScript/Vite mainline.

Collections group prompt ids without duplicating prompt bodies.

Revisions preserve bounded prompt snapshots for recovery.

Both features are local-only and require no backend schema or connector permission.

HTML and service-worker entries are updated together.

The shell cache version is v36.

Security contracts prohibit remote telemetry and executable HTML injection.

Rollback preserves local collection and revision storage by default.

The committed QA matrix identifies the runtime and source gates for release.

Full repository CI remains the final environment-level verification because this session did not have a local checkout.
