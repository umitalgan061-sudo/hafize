# Smart Insert — Operasyon ve Rollback

## Release öncesi

1. `main` tabanının güncel olduğu doğrulanır.
2. Smart Insert modüllerinin yalnızca browser storage kullandığı source scan ile kontrol edilir.
3. Yeni JS dosyalarının syntax kontrolü çalıştırılır.
4. JSON import limitlerinin değişmediği doğrulanır.
5. Service worker shell listesi ile gerçek asset adları karşılaştırılır.
6. Otomatik gönderim davranışının bulunmadığı kontrol edilir.

## Yayın sonrası

İlk yüklemede Prompt Library kartının oluştuğu, değişkenli istemin Akıllı doldur düğmesini gösterdiği, profil merkezinin yüklenebildiği ve geçmiş bölümünün boş durumda hata üretmediği kontrol edilir.

## Cache

Cache sürümü v38 olarak artırılmıştır. Yeni sürüm yayınlandığında eski `hafize-shell-*` cache'leri `shouldDeleteCache` politikası ile temizlenir. API istekleri shell cache içine alınmaz.

## Rollback

PR revert edildiğinde Smart Insert modülleri ve loader bağları kaldırılır. Profil ve geçmiş storage anahtarları ayrı olduğu için temel prompt kayıtları korunur. Önceki service worker sürümüne dönüldüğünde yeni UI dosyaları artık yüklenmez; mevcut local storage yalnızca kullanıcı verisi olarak kalır.

## Veri kurtarma

Profil yedeği kullanıcı tarafından dışa aktarılabiliyorsa rollback öncesi ayrıca saklanabilir. Import sırasında mevcut profiller üzerine yazma/merge davranışı isim temellidir. Geçmiş temizleme prompt kayıtlarını etkilemez.

## Gözlemlenebilirlik

Harici telemetry eklenmemiştir. Sorun analizi browser console, UI status mesajları ve kullanıcı tarafından alınan JSON yedekleri üzerinden yapılır.

## Destek checklist

Kullanıcıya önce browser storage temizlememesini, profil yedeği varsa saklamasını ve Smart Insert'i yeniden açmasını söyle. Sorun yalnızca profil merkezindeyse Prompt Library'nin temel CRUD akışının ayrı çalışıp çalışmadığını kontrol et. Cache kaynaklı görünüyorsa service worker güncellemesini ve v38 asset listesini kontrol et.
