# Health Center Destek Rehberi

## Panel görünmüyor

Prompt Library kartının mount olup olmadığını kontrol et.

Health JS dosyasının index ve service worker asset listesinde bulunduğunu kontrol et.

## Çok fazla hata

Önce hata filtresini seç.

Raporu dışa aktar.

Mevcut prompt JSON yedeği varsa onarım öncesi sakla.

## Onarım başarısız

Local storage erişiminin çalıştığını kontrol et.

Tarayıcı private mode veya storage kısıtlaması olasılığını incele.

Paneli yeniden yükledikten sonra tekrar tara.

## Yanlış duplicate uyarısı

Duplicate title ve near-duplicate bulguları veri silme önerisi değildir.

Kullanıcı iki prompt'un ayrı tutulmasına karar verebilir.

## Eski prompt uyarısı

Stale bulgusu yalnızca güncellik sinyalidir.

Kullanılmayan ancak tarihsel değeri olan prompt'lar korunabilir.

## Collection orphan

Koleksiyonda bulunmayan id varsa ilgili collection gözden geçirilir.

Ana prompt kaydı health center tarafından tahmin edilmez veya yeniden oluşturulmaz.

## Export sorunu

Blob veya object URL desteğini kontrol et.

Rapor kopyalama alternatif olarak clipboard API ile denenebilir.

## Güvenlik şüphesi

Health module network çağrısı yapmamalıdır.

Kod review sırasında fetch, XHR ve WebSocket kullanımına bakılmalıdır.

## Destek kanıtı

Health JSON raporu, browser bilgisi ve problemli kayıt sayısı birlikte incelenebilir.

Secret veya access token destek çıktısına dahil edilmemelidir.
