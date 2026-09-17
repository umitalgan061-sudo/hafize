# Prompt Collection Workspace v2

## Amaç

Prompt Library içindeki koleksiyonları yalnızca klasör benzeri etiketler olmaktan çıkarıp küçük bir yerel çalışma alanına dönüştürür.

Koleksiyon verisinin tek kaynak sistemi `hafize.prompt-library.collections.v1` anahtarıdır.

Workspace görünüm durumu `hafize.prompt-library.collections-workspace.v1` anahtarında tutulur.

Sunucuya koleksiyon verisi gönderilmez.

## Kapsam

Workspace yeni bir veri modeli icat etmez.

Mevcut koleksiyon çekirdeğinin oluşturma, güncelleme, silme ve üyelik API'lerini kullanır.

Koleksiyon sırası çekirdek listedeki sıradır.

Favori, arşiv, kullanım sayısı ve son kullanım tarihi workspace metadata'sıdır.

Bu metadata çekirdek koleksiyon kaydının geriye dönük uyumluluğunu bozmaz.

## Liste

Liste arama alanı koleksiyon adı ve açıklaması üzerinde çalışır.

Sıralama son güncelleme, ad, üye sayısı, kullanım ve favori önceliği seçeneklerini içerir.

Filtreleme tümü, aktif, favoriler ve arşivliler seçeneklerini içerir.

Her satırda seçim, renk, ad, açıklama ve üye/kullanım özeti bulunur.

## İşlemler

Koleksiyon açılabilir ve detayları gösterilebilir.

Favori durumu tek tıkla değiştirilebilir.

Arşiv durumu tek tıkla değiştirilebilir.

Koleksiyon yukarı veya aşağı taşınabilir.

Koleksiyon düzenlenebilir.

Koleksiyon çoğaltılabilir.

Koleksiyon silme işlemi kullanıcı onayı gerektirir.

## Toplu işlemler

En fazla 40 koleksiyon aynı anda seçilebilir.

Seçilen koleksiyonlar topluca favorilenebilir.

Seçilen koleksiyonlar topluca arşivlenebilir.

Seçilen koleksiyonlar arşivden topluca çıkarılabilir.

Toplu silme ayrı onay ister.

Silinen koleksiyonların workspace metadata'sı otomatik olarak temizlenir.

## Ayrıntı görünümü

Açılan koleksiyon üyelerini ayrı listede gösterir.

Üye listesi başlık, metin ve etiket araması yapar.

Tek bir istem koleksiyondan çıkarılabilir.

Composer seçimlerinden mevcut koleksiyona istem eklenebilir.

Üyeler seçildiğinde ana Prompt Library seçimiyle uyumlu çalışır.

## Düzenleyici

Yeni koleksiyon ve düzenleme aynı formu kullanır.

Ad zorunludur.

Açıklama bounded olarak saklanır.

Renk sabit seçeneklerden seçilir.

Favori ve arşiv bayrakları ayrı alanlardır.

Düzenleme sırasında isim benzersizliği korunur.

Tarayıcı `prompt()` akışı yerine erişilebilir form kullanılır.

## Yedekleme

Workspace yedeği JSON olarak dışa aktarılabilir.

Yedek metadata'yı koleksiyon adı ile eşler; böylece import sırasında yeni koleksiyon kimlikleri kullanılsa bile metadata taşınabilir.

İçe aktarma mevcut koleksiyon çekirdeğinin import API'sini kullanır.

Import ve export dosyaları bounded boyutlarla işlenir.

Geçersiz JSON kullanıcıya hata durumu olarak bildirilir.

## Durum

Arama, filtre, sıralama, aktif koleksiyon ve seçim durumu yerelde korunur.

Kullanım sayısı koleksiyon açıldığında artar.

Kullanım sayısı 9999 ile sınırlıdır.

Metadata geçersiz veya silinmiş koleksiyonlar için yeniden normalize edilir.

## PWA

Workspace JavaScript ve CSS service worker shell listesinde tutulur.

Cache sürümü yeni workspace sürümünde artırılır.

API yolları cache edilmez.

## Erişilebilirlik

Liste ve üye alanları `list`/`listitem` semantiği kullanır.

Düzenleyici modal davranışında odak döngüsü vardır.

Escape aktif ayrıntıyı veya düzenleyiciyi kapatır.

Ctrl/⌘+Shift+L koleksiyon aramasına odaklanır.

Satırlar Enter, F, A, Delete ve ok tuşlarıyla yönetilebilir.

Focus-visible stili ve reduced-motion desteği sağlanır.

## Güvenlik

Dinamik kullanıcı metni `textContent` üzerinden oluşturulur.

`innerHTML` ve `outerHTML` kullanılmaz.

Workspace runtime'ında ağ çağrısı yoktur.

Secret, cookie veya Bearer token okunmaz.

Dosya boyutları import öncesi kontrol edilir.

## Geri alma

Workspace yüzeyi PR revert edilerek geri alınabilir.

Koleksiyon çekirdek verisi korunabilir.

Metadata anahtarı kullanılmaya devam etmiyorsa normalize edilmeden okunabilir durumda kalır.
