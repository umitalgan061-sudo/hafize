# Hafize delegation lifecycle sözleşmesi

Bu katman mevcut seçici ajan registry'sini değiştirmez; yalnız `agent.delegate` yürütmesinin yaşam döngüsünü backend tarafında sınırlar.

## Paralellik

`agents/registry.json` içindeki `policy.maxParallelAgents` toplam geçmiş delegasyon sayısı değildir. Aynı anda çalışan child ajan slotlarının üst sınırıdır. Bir child tamamlandığında veya iptal edildiğinde slot serbest bırakılır; sonraki seri delegasyon çalışabilir.

Limit doluyken yeni child görevi başlatılmaz ve ledger girdisi `blocked / DELEGATION_PARALLEL_LIMIT_EXCEEDED` olarak kapanır. Bu durum mevcut çalışan child ajanları iptal etmez.

## Cancellation

Her aktif delegasyon ayrı `AbortController` taşır. Delegator:

- belirli `taskId` için `cancel(taskId)`,
- tüm aktif child görevleri için `cancelAll()`,
- salt-okunur lifecycle snapshot

yüzeyi sağlar.

Child signal `executeAgent` ve `runDelegatedAgent` üzerinden completion katmanına taşınır. İptal edilen görev kullanıcıya veya modele upstream hata ayrıntısı taşımadan `DELEGATION_CANCELLED` döner ve task ledger'da `blocked` olarak görünür.

Parent/caller signal lifecycle'a bağlanabilir. Parent abort olduğunda aktif child signal'ları da abort olur; nested delegator kendi parent signal'ını child zincirine aktarır.

## Yetki sınırı

Lifecycle yeni tool permission üretmez. Hedef ajan yine kendi `toolPolicy` sözleşmesiyle çalışır; parent izinleri child'a miras kalmaz. `maxDelegationDepth`, specialist-only hedef, self-delegation yasağı, structured handoff doğrulaması ve ortak `traceId/task ledger` kuralları aynen korunur.

## Bilinçli sınır

Bu PR server request-close signal'ını top-level delegator constructor'ına henüz bağlamaz. Private checkout/DNS erişimi olmadan büyük `server.mjs` dosyasını tam içerikle riskli biçimde yeniden yazmak yerine bu wiring ayrı küçük ve testli patch'e bırakılmıştır. Individual cancellation ve nested signal propagation çekirdek runtime'da hazırdır.
