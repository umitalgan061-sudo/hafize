# Revision History Design Review

## Amaç

Revision History, Prompt Library'nin edit işlemlerinde kullanıcıya güvenli geri dönüş noktaları sağlayan local-only bir özellik olarak incelenmiştir.

## Karar

Revision storage ana prompt storage'dan ayrı tutulur. Böylece eski sürümler ana CRUD akışına yeni alanlar eklemeden saklanabilir.

## Data ownership

Prompt metadata ve usage değerleri ana kayda aittir. Revision yalnız geçmiş içerik durumunu temsil eder.

## Restore invariant

Restore edilmiş prompt aynı `id` ile yaşamaya devam eder. Favorite/useCount/createdAt hedef prompt'tan korunur.

## Capture invariant

Edit başlamadan önceki durum history'ye alınır. Aynı içerik için duplicate snapshot üretilmez.

## UI invariant

History paneli kullanıcı açıkça `Geçmiş` dediğinde açılır. Otomatik modal açılması yoktur.

## Error invariant

Revision hatası ana sohbet uygulamasını crash ettirmemelidir.

## Privacy invariant

Network ve telemetry yoktur.

## Performance invariant

Bounded listeler, preview limitleri ve retention uygulanır.

## Accessibility invariant

Dialog semantics, focus return, Escape, Tab trap ve live status gerekir.

## Rollback invariant

Kod rollback local history verisini silmez.

## Review sonucu

Architecture, security, accessibility ve retention hedefleri birbiriyle uyumludur. Özellik merge için uygun olmak üzere test gate'lerine bağlanmıştır.
