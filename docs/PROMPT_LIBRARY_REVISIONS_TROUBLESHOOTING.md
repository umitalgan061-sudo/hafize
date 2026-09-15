# Revision Troubleshooting

## 1. Geçmiş düğmesi yok

Revision loader'ın yüklendiğini ve prompt card'ın oluştuğunu kontrol edin. PWA'da service worker cache sürümü güncel olmalıdır.

## 2. Geçmiş paneli açılmıyor

Prompt id'nin ana Prompt Library kaydında bulunması gerekir. Browser console'da uncaught exception kontrol edilir.

## 3. Snapshot oluşmuyor

Edit action'ının capture-phase click listener'ı çalışıyor olmalıdır. Aynı içerik duplicate olarak eklenmez.

## 4. Restore olmuyor

Prompt storage quota, silinmiş prompt veya geçersiz revision nedenleri kontrol edilir.

## 5. Kullanım sayısı değişiyor

Restore semantiğinde target useCount korunmalıdır. Regression test restore semantics çalıştırılır.

## 6. Favori kayboluyor

Restore target favorite değerini taşımalıdır. History revision favorite alanı içermez.

## 7. Export çalışmıyor

Blob/URL desteği ve browser download davranışı kontrol edilir. Export 1 MB ile bounded'dır.

## 8. Panel kilitleniyor

Escape ve Tab davranışı kontrol edilir. Lifecycle testleri listener leak olmadığını doğrular.

## 9. Storage bozuk

Revision key JSON verisi parse edilemiyorsa modül boş store ile açılır. Ana prompt key'i korunur.

## 10. Offline sorun

Shell asset listesinde revision scripti bulunmalı ve cache version artmış olmalıdır.

## 11. Güvenlik şüphesi

Revision source içinde innerHTML, fetch, XMLHttpRequest veya WebSocket bulunmamalıdır.

## 12. Support çıktısı

Browser, app version, action sırası, status mesajı ve mümkünse redacted revision export sağlanır.

## 13. Rollback

Revision loader/checkpoint geri alınabilir; local history verisi otomatik silinmez.

## 14. Escalation

Kaynak kod ile doküman farklıysa release branch source ve testleri esas alınır.
