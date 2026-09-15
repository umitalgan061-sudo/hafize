# Yerel Veri Merkezi — Mahremiyet

## Veri kaynağı

Kontrol merkezi yalnız browser `localStorage` içindeki önceden bilinen Hafize anahtarlarına bakar. Başka origin, cookie, sessionStorage veya IndexedDB taranmaz.

## İçerik görünürlüğü

Kullanıcıya alan adı, güvenli açıklama, kayıt adedi ve boyut gösterilir. Ham içerik yalnız başka feature zaten gerekli olduğunda kendi UI'sında görünür. Veri merkezi içerikleri topluca ekrana dökmez.

## Sunucu sınırı

Veri merkezi `fetch`, XHR, WebSocket, beacon veya account API çağrısı yapmaz. Manifest de yalnız yerel metadata üretir.

## Temizleme

Tekil silme explicit confirmation gerektirir. Toplu silme ikinci bir açık confirmation ister. İptal edildiğinde storage değişmez.

## Bilinmeyen anahtarlar

`hafize.*` ile başlayan ancak allowlist'e girmeyen anahtarlar yalnız sayılır. Silme aksiyonu bunlara uygulanmaz.

## Paylaşılan cihaz

Browser profili ortaksa local data yerel profilin parçasıdır. Kontrol merkezi bunu hesaplar arası güvenlik alanı olarak sunmaz; authentication boundary değiştirilmez.

## Export

Manifest içerik yedeği değildir. Kullanıcı prompt/history yedeği gerekiyorsa ilgili özelliğin explicit backup akışı kullanılmalıdır.

## Retention

Veri merkezi yeni retention politikası koymaz. Her feature'ın mevcut bounded retention sözleşmesine dokunmadan yalnız mevcut state'i yönetir.

## Gelecek sync

Cross-device sync eklenmek istenirse ayrı authentication, authorization, schema ve data transfer sözleşmesi gereklidir. Bu modül sessizce remote sync'e dönüşmemelidir.
