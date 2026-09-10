# Conversation Workspace bakım ve operasyon runbook'u

## Tur öncesi kontrol

1. `HAFIZE_RULES.md` ve `README.md` okunur.
2. `main` commit'i belirlenir.
3. Açık PR'larda aynı dosyalara dokunan çalışmalar incelenir.
4. Workspace özelliğinin mevcut history search/export/management modüllerini yeniden üretmediği kontrol edilir.
5. Değişiklik yalnız `hafize/auto-*` branch'inde yapılır.

## Çalışma alanının veri akışı

```text
localStorage(hafize.conversations.v1)
          |
          v
 readConversations()
          |
          v
 normalizeConversationList()
          |
          +------------------------+
          |                        |
          v                        v
 filtre/sıralama             toplu mutation
          |                        |
          v                        v
 mevcut DOM satırları        writeConversations()
                                   |
                                   v
                         hafize:conversation-workspace-changed
```

Workspace state ayrı bir anahtardan okunur. History kayıtları ile görünüm state'i aynı JSON objesine konulmaz.

## Veri kurtarma yaklaşımı

Kullanıcı bir sohbeti silmeden önce mevcut `chat-history-export` yüzeyinden tam JSON dışa aktarımı alabilir. Workspace yalnız seçili kayıtlar için hızlı JSON çıkarır.

İçe aktarma önce dosya boyutunu, sonra JSON şeklini, sonra her conversation/message/tag alanını doğrular. Doğrulama sırasında kayıt mümkün olduğunca korunur; desteklenmeyen alanlar yok sayılır.

Aynı id zaten varsa mevcut kaydın üzerine yazılmaz. Import edilen kayıt yeni kimlik kazanır. Bu, yedek içe aktarmanın mevcut geçmişi sessizce bozmasını önler.

## Arşiv operasyonu

Arşivleme silme değildir. Aktif filtre kullanıcının görünümünü değiştirebilir ama kayıt storage'da kalır. Arşivden çıkarma aynı boolean alanı tekrar false yapar.

Bir sohbet arşivlendikten sonra eski tekli history yönetimi hâlâ başlık, sabitleme ve silme işlemlerini sağlayabilir. Workspace yalnız bulk kontrol sağlar.

## Tag operasyonu

Tag alanı metadata'dır. Mesaj içeriğine string olarak eklenmez. Bu nedenle AI'ye giden `messages` payload'ına workspace tag bilgisi dahil olmaz.

Bir tag eklemek için kullanıcıdan açık metin alınır. Boş değer reddedilir. Aynı etiket ikinci kez eklenmez. Tag sayısı eight sınırını aşamaz.

Tag filtresi seçildiğinde workspace görünümü yalnız o etiketi taşıyan kayıtları gösterir. Tag seçicisi mevcut history üzerinden dinamik olarak üretilir.

## Bulk delete operasyonu

Bulk delete geri alınamaz. UI önce seçili kayıt sayısını gösterir. `confirm()` false dönerse storage işlemi yapılmaz.

`writeConversations()` başarısız olursa UI yenilemesi yapılmamalıdır. Başarıdan sonra mevcut uygulama bootstrap akışına dönmek için bounded bir reload tetiklenir.

## Bulk clone operasyonu

Clone mümkün olduğunca aynı message dizisini korur. Conversation id değiştirilir, title'a `· kopya` eklenir ve timestamp'ler güncellenir.

30 kayıt sınırı doluysa clone üretimi durur. Kısmi başarı olursa yalnız gerçekten eklenen clone'lar storage'a yazılır.

Clone işlemi kullanıcı yetkisi gerektiren dış servis çağrısı değildir çünkü yalnız localStorage üzerinde çalışır.

## JSON import hata matrisi

| Durum | Sonuç |
| --- | --- |
| Dosya yok | no-op |
| 0 byte | toast |
| 1 MB üstü | reject |
| Geçersiz UTF-8 metin | reject |
| Geçersiz JSON | reject |
| `conversations` yok | reject |
| Ham array | kabul |
| Boş array | reject |
| Duplicate id | yeni id |
| id yok | kayıt düşer |
| message yok | conversation boş kalabilir |
| message content non-string | mesaj düşer |
| title çok uzun | truncate |
| tag çok uzun | truncate |
| 8 üstü tag | ilk 8 |
| 200 üstü message | ilk 200 |
| tool activity fazla | ilk 4 |
| bilinmeyen activity state | success fallback |
| bozuk tarih | güvenli fallback |

## Storage arızası

`localStorage.getItem()` JSON parse hatası verse bile workspace çalışmaya devam eder. `setItem()` kota/private-mode hatası verirse kullanıcıya açıklayıcı toast gösterilir.

Workspace state yazılamazsa özellik kullanılamaz hâle gelmez; UI state varsayılan değerlere dönebilir. History yazma başarısızsa veri mutasyonu kabul edilmez.

## Çoklu sekme

Başka bir sekme history'yi değiştirirse native `storage` olayı workspace satırlarını tekrar senkronize eder. Aynı sekmede yapılan bulk operation native storage event üretmeyeceği için ayrıca CustomEvent yayınlanır.

Event listener'lar backend socket veya BroadcastChannel gerektirmez. Böylece PWA offline kabuğunda aynı davranış korunur.

## Kısayol desteği

Klavye katmanı yalnız workspace görünürken kayıtlıdır. `Ctrl/⌘ + Shift + A` görünür kayıtları seçer. `Ctrl/⌘ + Shift + X` seçimi temizler. `Ctrl/⌘ + Shift + U` workspace aramasına geçer. `Esc` arama alanını temizler.

Mevcut textarea/input alanlarında yazı yazılırken global kısayollar yanlışlıkla devreye girmez. `event.isComposing` true olduğunda shortcut yok sayılır.

## Erişilebilirlik doğrulaması

Native checkbox kullanımı tarayıcının klavye semantiğini korur. Toolbar durumları `role=status` ile kısa bilgi verir. Quota bar progressbar olarak min/max/current değer taşır.

Forced colors modu border görünürlüğünü artırır. Reduced-motion hem sistem medya sorgusu hem Hafize'nin data attribute'u ile desteklenir.

## PWA doğrulaması

Her workspace asset'i `index.html` içinde bir kez yüklenir ve service worker shell listesinde de bulunur. Yeni asset eklenirse cache revision artırılır.

API yolları shell listesine eklenmez. Workspace import/export local Blob ve localStorage kullandığı için service worker network-only API politikasını değiştirmemelidir.

## Test sırası

Yerel geliştirmede önce:

```text
node --check public/conversation-workspace.js
node --check public/conversation-workspace-keyboard.js
node scripts/test-conversation-workspace.mjs
node scripts/test-conversation-workspace-adversarial.mjs
node scripts/test-conversation-workspace-keyboard.mjs
```

Sonra standart repo kapısı:

```text
npm run precheck
npm run check
```

Production smoke gerektiğinde README'deki production hardening testleri de çalıştırılır.

## Review checklist

- Workspace backend'e yeni network yüzeyi ekliyor mu? Eklememeli.
- Import sırasında `innerHTML` veya script üretimi var mı? Olmamalı.
- Destructive işlemin `confirm()` guard'ı var mı? Olmalı.
- Duplicate id mevcut kaydı eziyor mu? Ezmemeli.
- 30 conversation cap korunuyor mu? Korunmalı.
- Cache revision shell asset listesiyle uyumlu mu? Uyumlu olmalı.
- Kısayollar textarea içinde yanlış tetikleniyor mu? Tetiklenmemeli.
- `storage` olayları listener sızıntısı oluşturuyor mu? Oluşturmamalı.
- MutationObserver kendi eklediği checkbox'lar nedeniyle sonsuz iş üretiyor mu? Üretmemeli.
- Test dosyaları gerçek güvenlik sözleşmelerini kontrol ediyor mu? Etmeli.

## Rollback

Önce workspace PR'ı squash commit olarak revert etmek yeterlidir. Local conversation data silinmez. Kullanıcı tarayıcısında `hafize.conversation-workspace.v1` kalabilir; eski uygulama bu anahtarı okumadığı için veri etkisizdir.

PWA cache revision eski shell'e döndürülürken workspace asset listesi de birlikte geri alınmalıdır. Aksi hâlde eski index yeni olmayan asset'i istemeye devam edebilir.

## Gelecek geliştirmeler için sınır

Bu workspace yalnız local conversation lifecycle içindir. Connector yönetimi, scheduled tasks, remote document storage veya server-side search burada uygulanmamalıdır. Bu alanlar ilgili backend güvenlik sözleşmelerine sahip ayrı geliştirme turlarında ele alınmalıdır.
