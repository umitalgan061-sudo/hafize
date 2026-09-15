# Revision History Changelog

## v1

İlk revision history sürümü Prompt Library ile birlikte local-only olarak yayınlanır.

### Added

- prompt başına bounded revision listesi,
- edit öncesi otomatik snapshot,
- manual checkpoint,
- history modal,
- compare görünümü,
- restore,
- tek revision silme,
- history clear,
- JSON export,
- accessibility ve PWA desteği.

### Preserved

Mevcut Prompt Library CRUD davranışı korunur. Favorite, useCount ve createdAt revision restore tarafından ezilmez.

### Security

Network/telemetry/connector erişimi eklenmez.

### Retention

120 prompt ve prompt başına 10 revision sınırı uygulanır.

### Compatibility

Storage key `hafize.prompt-library.revisions.v1` ile versionlanır.

### QA

Source-contract ve runtime testleri revision veri modeli, restore, retention, DOM, event, keyboard ve PWA davranışını doğrular.

### Rollback

UI ve asset loader geri alınabilir; local revision storage otomatik silinmez.
