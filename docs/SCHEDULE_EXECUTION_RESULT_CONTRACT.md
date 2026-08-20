# Schedule execution result contract

Bu belge `lib/schedule-worker.mjs` ile `executeAgentTask` arasındaki güven sınırını tanımlar.

## Amaç

Zamanlanmış görev executor'ı backend içinde çalışsa da döndürdüğü değer doğrudan persistence state transition kararı sayılmaz. Worker yalnız doğrulanmış, küçük ve açık bir sonuç şemasını kabul eder. Böylece hatalı adapter, beklenmedik provider çıktısı veya sonradan eklenen metadata alanları bir görevi yanlışlıkla `completed` yapamaz ya da attempt-refund semantiğini değiştiremez.

## Kabul edilen sonuçlar

Başarı yalnız şu exact şekildir:

```json
{ "ok": true }
```

Başarı sonucunda başka alan kabul edilmez. `error`, `retryAt`, metadata veya provider payload eklemek contract ihlalidir.

Normal hata şu şekildedir:

```json
{ "ok": false, "error": "UPSTREAM_TEMPORARY" }
```

İzin verilen tek opsiyonel alan `retryAt`'tır:

```json
{
  "ok": false,
  "error": "SCHEDULE_LEASE_BUSY",
  "retryAt": "2026-08-20T17:05:00.000Z"
}
```

`retryAt` parse edilebilir, bounded bir tarih string'i olmalıdır. Worker mevcut retry horizon ve retry-delay kurallarını ayrıca uygulamaya devam eder.

## Yapısal sınırlar

Sonuç:

- yalnız plain object veya null-prototype record olabilir;
- array, Date, Map, class instance veya primitive olamaz;
- `ok` alanı exact boolean olmalıdır;
- accessor/getter/setter property içeremez;
- success için yalnız `ok`; failure için yalnız `ok`, `error`, `retryAt` anahtarları kabul edilir;
- error kodu trim edilmemiş boşluk içeremez, en fazla 120 karakterdir ve yalnız büyük harf, sayı, `_`, `:`, `-` karakterlerinden oluşur;
- raw exception/detail metinleri worker sonucuna taşınmaz.

## Contract ihlali

Malformed executor sonucu `SCHEDULE_EXECUTION_RESULT_INVALID` olarak işlenir.

Bu durum:

- başarı sayılmaz;
- `store.complete` çağırmaz;
- `outcomeUnknown` sayılmaz; çünkü worker yanlış state transition yapmadan önce ihlali deterministik olarak yakalamıştır;
- normal attempt tüketir;
- attempt kaldıysa mevcut bounded retry politikasını kullanır;
- otomatik attempt refund/defer kazanamaz;
- batch içindeki diğer schedule'ları durdurmaz;
- `runDue().invalidResults` sayacına eklenir.

Contract ihlali ile persistence hatası aynı şey değildir. Executor sonucu geçerli olsa bile `complete`, `fail` veya `defer` persistence adımı çökerse önceki fault-boundary kuralları geçerlidir ve sonuç state-uncertain olabilir.

## Reserved worker hata kodları

`SCHEDULE_EXECUTION_STATE_UNCERTAIN` worker'ın kendi persistence/side-effect belirsizliğini ifade eder. Executor bu kodu kendi sonucu gibi döndüremez; böyle bir sonuç contract ihlalidir.

`SCHEDULE_EXECUTION_CANCELLED` cancellation sözleşmesinin parçasıdır. Worker ayrıca kendi `AbortSignal` durumunu kontrol eder; task başladıktan sonra worker-level cancellation oluşursa yan etki gerçekleşmiş olabileceği için mevcut post-execution uncertainty davranışı korunur.

`SCHEDULE_LEASE_BUSY` ve `SCHEDULE_LEASE_LOST` mevcut backend infra retry sözleşmesinde tanınmaya devam eder. Ancak yalnız structural contract'tan geçmiş failure sonucu refundable infra yoluna girebilir; malformed/extra-field sonuç aynı error string'ini taşısa bile attempt refund alamaz.

## Gözlemlenebilirlik

`runDue()` batch sonucu iki ayrı sayaç taşır:

- `uncertain`: dış/persistence state sonucunun kesin bilinmediği schedule sayısı;
- `invalidResults`: executor sonuç contract'ını ihlal eden schedule sayısı.

Bu ayrım operasyonel olarak önemlidir. `uncertain` kör retry yapılmaması gereken potansiyel yan-etki belirsizliğini; `invalidResults` ise adapter/executor kalite veya entegrasyon hatasını gösterir.

Sayaçlar raw executor payload veya exception detail içermez.

## Güvenlik sınırı

Bu contract agent tool yetkisi vermez ve prompt tabanlı permission mekanizması değildir. Tool authorization backend default-deny olarak kalır. Dış gönderme/yazma/merge işlemleri kendi açık kullanıcı approval sınırlarını korur. Secret değerleri executor sonucu veya task ledger içine eklenmemelidir.

## Değişiklik kuralı

Executor sonuç şemasına yeni alan eklemek normal metadata değişikliği sayılmaz. Önce şu üç nokta birlikte güncellenmelidir:

1. `schedule-execution-result-policy` doğrulaması,
2. worker state-transition semantiği,
3. contract ve regresyon testleri.

Yeni alan persistence, retry, cancellation veya dış yan etki kararını etkiliyorsa ayrıca güvenlik incelemesi gerektirir.
