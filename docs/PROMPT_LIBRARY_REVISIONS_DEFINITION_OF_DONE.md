# Revision History Definition of Done

## Implementation

- Revision module mevcut Prompt Library core API'sini kullanır.
- Revision storage versioned key kullanır.
- Snapshot normalize edilir.
- Retention bounded'dır.

## User experience

- Geçmiş action'ı görünürdür.
- History dialog açıkça etiketlenir.
- Compare gerçek içerik gösterir.
- Restore onaylıdır.
- Manual checkpoint vardır.
- Export açık kullanıcı eylemidir.

## Reliability

- Parse errors catch edilir.
- Storage write errors catch edilir.
- Missing prompt safe failure üretir.
- Destroy listener'ları temizler.

## Security

- User text HTML olarak execute edilmez.
- No network request.
- No connector access.
- No telemetry.

## Accessibility

- Dialog role.
- aria-modal.
- aria-labelledby.
- Escape.
- Tab/Shift+Tab.
- focus return.
- live status.

## PWA

- Revision asset shell cache'te.
- Cache version ilerletilir.

## Testing

Core, bounds, normalization, retention, restore, DOM, keyboard, event, storage, PWA, checkpoint ve regression testleri bulunur.

## Documentation

User guide, QA, security, privacy, migration, rollback, support ve release dokümanları bulunur.

## Completion

Feature ancak bu DoD'nin kritik maddeleri karşılandığında merge edilebilir.
