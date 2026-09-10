# Mesaj Çalışma Alanı Tasarım Kararları

## Ayrı metadata storage

Mesaj işaretleri `hafize.conversations.v1` içine gömülmez.

Conversation runtime mesajları streaming sırasında tekrar tekrar kaydeder.

Mesaj metadata'sını aynı nesneye eklemek, bağımsız UI state güncellemeleriyle yarış oluşturabilirdi.

Ayrı `hafize.message-workspace.v1` anahtarı bu yarış yüzeyini kaldırır.

Sohbet geçmişi silinse dahi metadata temizliği ayrı lifecycle ile yapılır.

## Neden backend yok

Kaydetme, geri bildirim, not ve etiket kişisel çalışma alanı işaretleridir.

Bunları sunucuya göndermek yeni authentication, authorization ve retention kararları gerektirirdi.

Bu turda kullanıcıya görünür bir fayda için bu maliyet gerekli değildir.

Bu nedenle özellik tamamen yereldir.

## Neden model geri beslemesi yok

Olumlu/olumsuz işaretler bu turda analytics veya fine-tuning sistemi değildir.

Geri bildirim, kullanıcının kendi sohbetini düzenleme sinyalidir.

Bu ayrım kullanıcı onayı gerektiren dış yazma davranışı eklemeden hızlı kullanılabilirlik sağlar.

## Neden prompt kullanıldı

Not ve etiket düzenleme için mevcut bağımlılıkları artırmadan küçük bir UI yüzeyi gerekir.

Yerleşik prompt, erişilebilir bir form üretmeden tarayıcının güvenli metin girişini kullanır.

Daha zengin düzenleyici sonraki ayrı ana iyileştirme olabilir; bu turda sohbet DOM'unu yeniden tasarlamamak tercih edildi.

## Neden 240 kayıt

Sohbet başına sınırsız metadata, localStorage kotasını belirsiz hâle getirir.

240 kayıt, uzun süreli kullanım için anlamlı bir tampon bırakırken listeleme ve JSON export maliyetini bounded tutar.

Gerekirse sonraki turda yaşlandırma veya arşivleme davranışı eklenebilir.

## Neden export 100

Export kullanıcı cihazında dosya üretir.

Tek seferde yüz kayıt sınırı, yanlışlıkla çok büyük dosya üretme riskini düşürür.

Seçim 100 ile sınırlandığı için panel durumuyla export durumu aynı sözleşmeyi izler.

## Neden MutationObserver

`app.js` her sohbet değişiminde mesaj DOM'unu yeniden üretir.

Tek seferlik event listener bağlamak bu nedenle kırılgan olur.

Observer, yeni ve güncellenmiş mesajlara action bar'ı tekrar uygular.

Observer yalnız `#messages` ağacını izler.

## Cross-tab sözleşmesi

Aynı storage anahtarındaki değişiklikler `storage` olayıyla diğer sekmelere ulaşır.

Aynı sekme için özel CustomEvent kullanılır.

İki olay da yeniden normalize edilmiş kayıt kümesini çizer.

## XSS yaklaşımı

Mesajlar zaten modelden geldiği için güvenilmeyen içerik kabul edilir.

Bu katman mesajı HTML olarak yorumlamaz.

Sonuç özetleri de `textContent` ile eklenir.

Kullanıcı tarafından yazılan `<script>` veya `<img>` metni bu nedenle yürütülecek DOM düğümüne dönüşmez.

## Service worker

Feature shell'de kullanılacağı için CSS, policy ve UI JavaScript'i cache listesine eklenir.

Cache revision her yeni asset setinde artırılır.

API yolları service worker tarafından yine network-only sınıfında kalır.

## Geri alma kararı

Feature bağımsız dosyalara ayrıldığı için geri alma conversation schema migration gerektirmez.

Index referansları çıkarılıp üç feature dosyası kaldırıldığında mevcut sohbet runtime'ı çalışmaya devam eder.

Kalan local metadata anahtarı işlevsel olmayan eski veri olarak kalabilir veya kullanıcı cihazından manuel temizlenebilir.
