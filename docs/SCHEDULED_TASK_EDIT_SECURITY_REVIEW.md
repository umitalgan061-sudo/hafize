# Schedule Edit Security Review

### Input
PATCH body allowlist uygulanır; client tarafından status, ownerId, traceId veya attempts değiştirilemez.

### Authorization
Authenticated principal subject ownerId ile karşılaştırılır.

### State
Yalnız scheduled state update kabul eder; execution state üzerinde client kontrolü yoktur.

### Secrets
Task text aynı plaintext credential guard'dan geçer.

### Exposure
Public schedule response ownerId içermez.

### Storage
Update mevcut encrypted persistence path'i kullanır; ayrı açık storage dosyası oluşturmaz.

### Cache
API response'ları cache dışıdır.

### Bulk
Selection bound vardır ve server-side tekil authorization/state kontrolleri korunur.

### Rollback
Kod revert edilebilir; kayıtların silinmesi gerekmez.
