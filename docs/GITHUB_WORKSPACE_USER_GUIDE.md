GitHub çalışma alanı kullanıcı rehberi

## Başlangıç

Repository alanına sahip/depo biçiminde bir değer girin. Yükle düğmesi ile repository özetini görün.

## Branch inceleme

Branch sekmesine geçin ve Yükle'ye basın. Bir branch satırını seçtiğinizde ref alanı güncellenir. Ardından Commit veya Dosya görünümünde aynı ref kullanılabilir.

## Commit inceleme

Commit sekmesi seçilen ref için son kayıtları gösterir. Her kayıt kısa SHA ve GitHub bağlantısıyla birlikte görünür.

## PR inceleme

PR sekmesinde varsayılan olarak açık PR'lar gelir. Hızlı işlemler bölümündeki PR durum filtresi ile kapalı veya tüm PR'lar seçilebilir.

## Dosya okuma

Dosya sekmesine güvenli bir dosya yolu yazın. Örnek: src/example.ts. Hassas dosyalar veya credential içeren içerikler güvenlik politikası nedeniyle gösterilmez.

## Dizin gezme

Dizin listele ile mevcut ref üzerindeki dizin öğeleri okunabilir. Bir klasör seçildiğinde yol alanına alınır; tekrar listeleme ile alt dizine gidilebilir.

## Ref karşılaştırma

Base ref ve mevcut head ref farklı olmalıdır. Ref karşılaştır ile iki dal veya başka iki ref arasındaki commit ve dosya değişim özeti gösterilir.

## Kopyalama ve yenileme

Görüneni kopyala ile mevcut sonuç metni panoya alınabilir. Yenile ile aktif repository görünümü tekrar okunur. Son kullanılan repository'ler bu oturum için hızlı seçim olarak gösterilir.

## Kısayol

Ctrl / Cmd + Shift + G repository alanına odaklanır.

## Gizlilik

GitHub erişim token'ı browser'da tutulmaz. Workspace sonuçları analytics'e gönderilmez. Repository/ref/path hatırlama oturumla sınırlı sessionStorage kullanır.

## Nelerin yapılamadığı

Bu çalışma alanı repository değiştiremez, branch oluşturamaz, commit atamaz, PR açamaz, PR merge edemez ve dosya silemez. Bunlar kasıtlı olarak kapsam dışıdır.

## Hata mesajları

Repository allowlist dışında ise ilgili güvenlik mesajı görünür. GitHub bağlantısı sunucuda yapılandırılmadıysa yapılandırma mesajı gösterilir. Dosya yolu geçersizse yeni bir yol girilmesi gerekir.
