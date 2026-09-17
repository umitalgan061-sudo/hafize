# Merge note

Feature branch: `hafize/auto-prompt-collections-0916`.

Base: current TypeScript/Vite mainline `bc9155702530be97e38f10c8984995e27be42ee2`.

Scope: local Prompt Library Collections and local Prompt Library Revisions.

The branch includes HTML integration, PWA shell caching, bounded local storage, security contracts, runtime tests, UI/lifecycle checks, QA matrix, rollback guidance and migration policy.

Normal rollback preserves the two new storage keys.

The feature does not add backend routes, credentials, OAuth scopes, analytics or telemetry.

The live prompt id and existing usage count remain authoritative during revision restore.

Collection membership stores ids only.
