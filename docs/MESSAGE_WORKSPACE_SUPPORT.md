# Mesaj Çalışma Alanı Destek Rehberi

## Panel görünmüyorsa

Sayfayı yenileyin ve tarayıcı console'unda JavaScript hatası olmadığını kontrol edin.

`message-workspace-policy.js` dosyası `message-workspace.js` dosyasından önce yüklenmelidir.

Service worker güncel asset listesini kullanıyorsa yeni cache revision'ı alındığında panel yüklenir.

Eski bir service worker tutuluyorsa uygulamanın normal yenileme akışıyla worker'ın yeni sürüme geçmesi beklenir.

## Mesaj altında düğmeler görünmüyorsa

Sohbette `data-message-id` taşıyan mesaj article'ları bulunmalıdır.

Message Workspace yalnız `#messages` ağacını izler.

DOM yeniden çizildiğinde MutationObserver action bar'ı tekrar ekler.

Tarayıcıda JS devre dışıysa feature çalışmaz; mevcut sohbet runtime'ı yine kendi statik görünümünü kullanır.

## Kayıt kayboluyorsa

Önce tarayıcı storage kullanımını kontrol edin.

`hafize.message-workspace.v1` anahtarı yalnız feature metadata'sını içerir.

Sohbet geçmişinin bulunduğu `hafize.conversations.v1` anahtarı bu feature tarafından yazılmaz.

Storage quota dolduğunda kullanıcıya kayıt uyarısı gösterilir.

Bozuk JSON okunursa güvenli boş liste kullanılır.

## Yanlış sohbet mesajı gösteriliyorsa

Metadata konuşma id'si ve mesaj id'si ile bağlanır.

Aktif sohbet sidebar'daki `.conversation-row.active .conversation-open` seçicisinden belirlenir.

Bir mesaj aktif DOM'dan çıkarılmışsa periodik cleanup eski kaydı kaldırır.

Başka konuşmanın mesajı aynı id ile yanlışlıkla kullanılmaz; aktif conversation id eşleşmesi gerekir.

## Cross-tab senaryosu

Aynı origin'deki sekmeler `storage` olayıyla metadata güncellemelerini görebilir.

Aynı sekme içindeki güncellemeler `hafize:message-workspace-changed` CustomEvent'i ile yenilenir.

Bir sekmede yapılan seçim diğer sekmede state anahtarı üzerinden okunur.

## Export dosyası yoksa

Export için en az bir kayıt seçilmelidir.

Export sayısı 100 ile sınırlandırılmıştır.

Tarayıcı indirmeyi engelliyorsa site download izinleri kontrol edilir.

Dosya adı `hafize-messages-YYYY-MM-DD.json` biçimindedir.

Export sunucuya gönderilmez.

Object URL export sonrasında revoke edilir.

## Büyük not veya etiket

Not 600 karakterde kesilir.

Etiket 24 karakterde kesilir.

Bir mesajda en fazla 8 normalize edilmiş etiket tutulur.

Başındaki `#` kaldırılır ve tekrar eden etiketler tekilleştirilir.

## Feedback davranışı

`↑` aktifse olumlu işaret kayıtlıdır.

Aynı düğmeye tekrar basıldığında işaret kaldırılır.

`↓` aynı şekilde çalışır.

Olumlu ve olumsuz durum aynı anda tutulmaz; son seçim diğer durumu değiştirir.

## Performans notları

Observer yalnız `#messages` subtree'sini izler.

Action bar oluşturma idempotenttir; aynı article'a ikinci kez eklenmez.

Sonuç listesi yalnız metadata kaydı bulunan mesajları çizer.

Arama bounded 120 karakterdir.

Export bounded 100 kayıttır.

Metadata toplamı 240 kayıtla sınırlıdır.

## Erişilebilirlik

Action düğmeleri `button` elementidir.

`aria-label` her eylemi açıkça tanımlar.

Saved ve feedback durumu `aria-pressed` ile yansıtılır.

Panel status alanı canlı yardımcı teknoloji duyurusu için `role=status` ve `aria-live=polite` kullanır.

Keyboard focus görünür bırakılır.

Forced-colors ve reduced-motion media koşulları ayrıca stillendirilmiştir.

## Güvenlik kontrolü

Feature source'u `fetch`, `XMLHttpRequest` veya `WebSocket` kullanmamalıdır.

`document.cookie`, Authorization ve Bearer erişimi olmamalıdır.

Conversation storage anahtarı üzerinde silme veya temizleme işlemi bulunmamalıdır.

Kullanıcı metni HTML API'leriyle DOM'a enjekte edilmemelidir.

## Geri alma

Önce index asset referanslarını çıkarın.

Sonra service worker shell asset listesinden üç feature yolunu çıkarın ve cache revision'ı uygun eski sürüme döndürün.

Feature JS, policy ve CSS dosyaları kaldırılabilir.

`hafize.conversations.v1` verisine dokunulmasına gerek yoktur.
