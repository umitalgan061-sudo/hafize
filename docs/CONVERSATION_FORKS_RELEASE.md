# Konuşma Dalları Release Kontrolü

## Build
- conversation-forks.ts typed Vite entry olarak build'e dahil.
- conversation-fork-core.ts aynı bundle içinde resolve edilir.
- index.html production typed-build entrypoint'i kullanır.
- Service worker CSS ve JS assetlerini shell cache'e alır.

## Runtime
- app-shell fork metadata'yı normalize eder.
- messages aria-busy ile streaming durumunu bildirir.
- hafize:open-conversation event'i güvenli conversation ID ile sınırlıdır.

## QA
- branch/depth/capacity sınırları.
- custom title ve fork note sınırları.
- dialog focus trap.
- global branch search.
- lineage navigation.
- comparison preview.
- local backup action.
