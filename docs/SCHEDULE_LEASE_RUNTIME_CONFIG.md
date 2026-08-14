# Schedule lease runtime config

Bu katman distributed schedule execution için provider seçimini, holder kimliğini ve lease zamanlamasını server-side yapılandırmadan okur. Gerçek Redis/Postgres adapter bağlantısı bu katmanın sorumluluğu değildir.

## Ortam değişkenleri

- `HAFIZE_SCHEDULE_LEASE_PROVIDER`: küçük harf provider anahtarı (`redis`, `postgres` gibi). Bu değer bir credential değildir.
- `HAFIZE_SCHEDULE_LEASE_HOLDER_ID`: process/instance için benzersiz holder kimliği.
- `HAFIZE_SCHEDULE_LEASE_MS`: opsiyonel lease TTL; varsayılan 60000 ms, izin verilen aralık 1000–900000 ms.
- `HAFIZE_SCHEDULE_LEASE_RENEW_INTERVAL_MS`: opsiyonel heartbeat aralığı; lease süresinden küçük olmak zorundadır.

Bu dört değerin hiçbiri tanımlı değilse lease runtime devre dışıdır ve `lease: null` döner. Herhangi biri tanımlanmışsa provider ve holder birlikte geçerli olmak zorundadır; kısmi yapılandırma sessiz tek-instance fallback yapmaz.

## Provider factory sınırı

`createScheduleLeaseProviderRuntime()` provider factory registry alır. Yapılandırılmış provider registry içinde yoksa `SCHEDULE_LEASE_PROVIDER_UNAVAILABLE` ile fail-closed olur.

Provider factory'ye tüm `process.env` verilmez. Factory yalnızca `{ provider }` metadata'sını alır. Redis/Postgres credential gibi secret değerleri gerçek adapter factory tarafından kendi server-side secret kaynağından okunmalıdır; lease config katmanı bunları taşımaz veya ajan bağlamına sokmaz.

Factory/adapter oluşturma ayrıntıları başarısızlıkta `SCHEDULE_LEASE_RUNTIME_STARTUP_FAILED` altında sanitize edilir. Provider bağlantı URL'si, parola veya alt hata mesajı üst katmana taşınmaz.

## Composition

Factory adapter ürettikten sonra mevcut `createScheduleExecutionLeaseBoundary()` ile `{ adapter, holderId, leaseMs }` üzerinden lease sözleşmesi oluşturulur. Runtime sonucu:

```js
{
  configured: true,
  provider: 'redis',
  lease,
  renewIntervalMs: 15000
}
```

şeklindedir. Provider yapılandırılmamışsa:

```js
{
  configured: false,
  provider: null,
  lease: null,
  renewIntervalMs: null
}
```

döner.

## Bu katmanın yapmadıkları

- Redis veya Postgres istemcisi eklemez.
- Credential/secret formatı tanımlamaz.
- `server.mjs` wiring yapmaz.
- Distributed lease'in atomik provider implementasyonunu taklit eden local/in-memory adapter sunmaz.
- Yeni ajan veya tool permission eklemez.

Gerçek provider adapter ayrı, küçük ve provider'ın atomik compare-and-set/fencing semantiğini doğrulayan testlerle eklenmelidir.
