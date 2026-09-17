# Health Center Veri Modeli

## Sağlık özeti

Tanı sonucu `version`, `healthy`, `checkedAt`, kayıt sayıları ve issue sayıları alanlarını içerir.

`promptCount` normalize edilebilir prompt sayısını ifade eder.

`rawPromptCount` bounded ham aday sayısını ifade eder.

`collectionCount` görülen koleksiyon sayısını ifade eder.

`revisionCount` bounded revizyon sayısını ifade eder.

## Issue modeli

Her bulgu `severity`, `code`, `title`, `detail`, isteğe bağlı `promptId` ve `related` alanlarına sahiptir.

Kimlik alanları sınırlı uzunlukta tutulur. Metinler DOM'a yalnızca `textContent` ile yazılır.

## Severity

`error` yapısal bozulmayı veya veri bütünlüğü sorununu ifade eder.

`warning` bakım gerektiren ancak veriyi doğrudan geçersiz kılmayan durumdur.

`info` kullanıcı incelemesi için faydalı sinyaldir.

## Storage state

`hafize.prompt-library.health.v1` yalnızca panelin açık/kapalı durumunu ve seçilen severity filtresini tutar.

Bu state prompt metni, kimlik bilgisi veya sohbet içeriği içermez.

## Repair sonucu

Onarım mevcut Prompt Library normalizer'ı ile normalize edilmiş kayıtları yeniden yazar ve koleksiyon üyelerini geçerli prompt id kümesine göre temizleyebilir.

Onarım sağlık panelinin raporunu yeniden çalıştırır.

## Sürümleme

Sağlık özeti `version: 1` ile başlar. İleride alan eklendiğinde eski kayıtların okunması için default değerler korunur.

Yeni alanların yokluğu uygulama açılışını engellemez.
