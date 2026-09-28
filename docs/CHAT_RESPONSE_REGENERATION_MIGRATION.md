# Yanıt Regeneration Migration

## Storage migration
Gerekli değildir. Yeni alanlar optional.

## First read
normalizeMessage alternates, feedback ve generation alanlarını güvenli biçimde çıkarır.

## First write
Bir user feedback veya regeneration sonrası message object yeni alanları içerebilir.

## Revert
Feature revert edilirse eski kod yeni alanları kullanmadan aynı content ile çalışabilir.

## Data cleanup
Alternates ayrıca temizlenmez; mevcut conversation deletion aynı message object'i kaldırır.

## Browser update
Build cache invalidate edilirse yeni typed artifact alınır. Service worker yalnız shell assets'i yönetir.

## Compatibility test
Legacy conversation fixture, malformed alternate fixture ve generation metadata fixture ile doğrulanır.

## Migration risk
En büyük risk bozuk localStorage shape'idir. Normalize katmanı bu riski sınırlar.

## Rollback
Backend rollback gerekmez.
