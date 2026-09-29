# Koleksiyon Threat Model

## Varlıklar

Collection names.

Prompt IDs.

Assignment relationships.

Default collection preference.

## Tehditler

Zararlı collection name ile DOM injection.

Aşırı büyük JSON ile memory pressure.

Bozuk JSON ile runtime exception.

Stale IDs ile gereksiz storage büyümesi.

Kullanıcıdan habersiz network telemetry.

Koleksiyon silmeyi prompt silme sanma.

## Kontroller

textContent tabanlı DOM.

500 KB import sınırı.

JSON parse catch.

Prompt ve collection ID prune.

Network API kullanılmaması.

Silme onayında promptların korunacağının açık belirtilmesi.

## Residual risk

LocalStorage dış araçlar veya browser extensions tarafından değiştirilebilir. Uygulama veriyi güvenilir kaynak olarak kabul etmemelidir.

İçe aktarma malicious data için normalize edilir ancak kullanıcı cihazında kalır.

## Test

Security source testleri injection sink'lerini ve network API'lerini kontrol eder.

Bounds testleri import, collection ve selection limitlerini kontrol eder.

Failure-mode testleri bozuk storage ve import akışını kapsar.
