# Platform Runtime Observability

## Amaç

Runtime observability yalnızca cihaz içi çalışma kalitesini görselleştirir. Üçüncü taraf analytics veya remote event pipeline değildir.

## Signals

Snapshot, network, visibility, capability, storage, feature lifecycle ve bounded performance metrics taşır.

## Eventler

`hafize:platform-snapshot`, `hafize:platform-ready`, `hafize:platform-stopped` ve diagnostic error event'leri uygulama içi entegrasyon içindir.

## Boundedness

80 runtime metric, 24 runtime error ve 32 task queue kaydıyla sınırlandırılır. Dashboard daha küçük bir alt küme gösterir.

## Privacy

URL, cookie, chat content, connector credential ve auth token snapshot alanına girmez.

## Health interpretation

`ready` normal başlangıcı, `degraded` kısmi yetenek veya runtime error durumunu, `stopped` kapatılmış lifecycle'ı ifade eder.

## Feature state

`registered` keşfedilmiş ama başlamamış; `starting` başlatılmakta; `running` başarıyla etkin; `failed` start exception; `stopped` kontrollü durdurma anlamına gelir.

## Debug workflow

1. Network durumunu kontrol et.
2. Error count'u kontrol et.
3. Failed feature'ı bul.
4. Capability policy sonucunu incele.
5. Performance budget raporuna bak.
6. Gerekirse yerel diagnostics JSON üret.

## Production principle

Bir diagnostic mekanizmanın kendisi application failure yaratmamalıdır. Tüm observer, storage ve export fonksiyonları best-effort olmalıdır.
