# Schedule Edit Data Retention

Edit işlemi yeni bir veri kategorisi oluşturmaz.

Schedule task text mevcut schedule persistence kaydında tutulur.

Browser katmanında task body veya owner bilgisi ayrı bir cache/storage alanına yazılmaz.

`updatedAt` yalnız en son başarılı mutation zamanını gösterir.

Repeat-plan yeni kayıt olduğu için kendi `createdAt`, `updatedAt`, `scheduleId` ve `traceId` değerlerine sahiptir.

Rollback sonrası mevcut kayıtlar worker tarafından okunmaya devam eder.

Bulk işlemler geçici selection state'ini yalnız memory'de tutar ve panel kapanınca temizler.
