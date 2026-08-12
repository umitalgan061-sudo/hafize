# Schedule persistence boundary

Bu katman, Hafize'nin in-memory schedule kayıtlarını ileride cloud database, encrypted KV veya başka bir durable provider'a bağlamak için provider-bağımsız persistence sözleşmesini tanımlar.

## Adapter sözleşmesi

`createTaskSchedulePersistence({ adapter, storeOptions })` iki async adapter fonksiyonu bekler:

- `adapter.load()` — kayıt yoksa `null`, varsa versioned persistence envelope döndürür.
- `adapter.save(envelope)` — verilen envelope'u durable storage'a yazar.

Envelope biçimi sabittir:

```json
{
  "schemaVersion": 1,
  "snapshot": {
    "entries": []
  }
}
```

Provider `save()` işlemini mümkünse atomik replace/transaction olarak uygulamalıdır. Boundary, provider'ın yarım yazımını kendi başına düzeltemez.

## Atomiklik ve concurrency

Mutation çağrıları (`add`, `claimDue`, `complete`, `fail`, `cancel`) async ve sıraya alınmıştır. Her mutation mevcut doğrulanmış snapshot'tan ayrı bir candidate store oluşturur. Candidate snapshot ancak `adapter.save()` başarıyla tamamlandıktan sonra canlı state olur.

Bu nedenle provider save hatasında Hafize'nin boundary içindeki canlı snapshot'ı ilerlemez. Provider hata mesajı dışarı taşınmaz; `SCHEDULE_PERSISTENCE_SAVE_FAILED` kullanılır.

## Hydration güvenliği

`createTaskScheduleStore({ initialSnapshot })` artık persisted snapshot'ı doğrulayarak hydrate edebilir. Doğrulama şunları kapsar:

- yalnızca bilinen snapshot/entry alanları,
- bounded entry sayısı,
- benzersiz ve güvenli `schedule_N` kimlikleri,
- geçerli status/attempt/maxAttempts ilişkisi,
- ISO tarih alanları,
- bounded task/owner/agent/trace alanları,
- sanitize edilmiş error code.

Hydration sonrasında yeni schedule ID, persisted en büyük `schedule_N` değerinden devam eder; restart sonrası ID çakışması oluşmaz.

## Running kayıtların recovery davranışı

Persisted `running` kayıtlar restart sırasında otomatik olarak `scheduled` durumuna çevrilmez. Otomatik replay, bir tool/connector yan etkisi provider'a yazılmadan hemen önce process çökerse aynı işlemi ikinci kez yapabilir. Distributed lease, idempotency key ve stale-run recovery politikası ayrı bir geliştirme olarak ele alınmalıdır.

## Güvenlik sınırları

- Bu PR düz dosya persistence eklemez; task metinlerini şifresiz JSON dosyasına otomatik yazmaz.
- Adapter envelope dışında token/credential gibi ek alanlar kabul edilmez.
- Provider hata ayrıntıları boundary error'una taşınmaz.
- Task metni kullanıcıya ait hassas içerik taşıyabileceğinden gerçek provider encryption-at-rest ve erişim kontrolü sağlamalıdır.
- Secret değerleri schedule task içine konmamalıdır; secret'lar server-side secret manager/environment üzerinden kullanılmaya devam eder.
- `.env`, credential/secret dosyaları ve `.github/workflows/` değiştirilmez.

## Bu PR'ın yapmadıkları

Bu katman henüz `server.mjs` içinde etkin değildir; mevcut server schedule store'u in-memory çalışmaya devam eder. Cloud database seçimi, async command/worker wiring, distributed lease ve crash recovery sonraki küçük PR'lara bırakılmıştır.
