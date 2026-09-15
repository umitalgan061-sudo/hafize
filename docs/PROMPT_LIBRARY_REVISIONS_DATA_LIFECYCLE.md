# Revision Data Lifecycle

## Create

Prompt mevcutken edit veya manual checkpoint eylemi snapshot üretir.

## Normalize

Snapshot kaydedilmeden önce id, title, body, tags, reason ve timestamp normalize edilir.

## Store

Revision map local storage altında bounded JSON olarak yazılır.

## Read

Panel açıldığında yalnız aktif prompt id'si için revision listesi okunur.

## Display

Revision metadata ve body text node/pre olarak gösterilir.

## Compare

Seçilen revision ve current prompt bounded preview olarak yan yana render edilir.

## Restore

Kullanıcı onayı sonrası mevcut prompt manual snapshot olarak saklanır ve seçilen revision core normalize ile uygulanır.

## Remove

Tek revision id'si hedeflenerek array'den çıkarılır.

## Clear

Prompt id'sine ait tüm revision array'i kaldırılır.

## Export

Aktif prompt history'si JSON payload'a dönüştürülür ve local Blob download başlatılır.

## Retention

Yeni snapshot retention penceresini aşarsa en eski revision çıkarılır.

## Rollback

UI kaldırılmış olsa bile storage anahtarı korunabilir.

## Destruction

Panel kapanınca DOM temizlenir. Destroy observer ve listener'ları kaldırır.

## Privacy

Lifecycle'ın hiçbir aşamasında network transferi yapılmaz.

## Audit

Test suite her aşamanın source contract'ını doğrular.
