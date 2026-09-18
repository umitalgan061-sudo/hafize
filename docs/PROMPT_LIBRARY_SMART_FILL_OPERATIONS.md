# Smart Fill Operasyon Rehberi

## 1. Amaç

Bu rehber, Prompt Library Smart Fill özelliğinin günlük kullanımını, hata ayıklamasını ve geri alma adımlarını tanımlar.

## 2. Bileşenler

`prompt-library-fill.js` temel doldurma diyaloğunu yönetir.

`prompt-library-fill-presets.js` adlandırılmış değişken presetlerini yönetir.

`prompt-library-fill-backup.js` preset yedekleme veri sözleşmesini yönetir.

`prompt-library-fill-backup-ui.js` preset import/export/clear kontrollerini yönetir.

`prompt-library-fill-history.js` son doldurma geçmişini cihazda bounded olarak tutar.

`prompt-library-fill-history-ui.js` geçmişi dialog içine bağlar.

`prompt-library-fill-privacy.js` hatırlanan değerler ve presetler için açık temizleme kontrolleri sağlar.

`prompt-library-fill-keyboard.js` klavye kısayollarını sağlar.

`prompt-library-fill-field-status.js` alan doluluk ve karakter sayaçlarını gösterir.

`prompt-library-fill-defaults.js` güvenli, içerik üretmeyen varsayılan değer önerileri sağlar.

## 3. Storage anahtarları

Ana prompt verisi `hafize.prompt-library.v1` altındadır.

Hatırlanan değerler `hafize.prompt-library.fill.v1` altındadır.

Presetler `hafize.prompt-library.fill.presets.v1` altındadır.

Doldurma geçmişi `hafize.prompt-library.fill.history.v1` altındadır.

Bu alanlar birbirinden bağımsızdır.

Bir alanın silinmesi diğer alanın prompt kayıtlarını değiştirmemelidir.

## 4. Normal akış

Prompt Library kartı render edilir.

Değişkenli promptlar ek `Alanları doldur` eylemi alır.

Eylem prompt id'sini taşır.

Dialog açılır.

Hatırlanan değerler varsa alanlar doldurulur.

Kullanıcı isterse güvenli varsayılanları uygular.

Kullanıcı alanları düzenler.

Preview plain-text güncellenir.

Kullanıcı isterse geçmişten bir kombinasyon seçer.

Kullanıcı isterse preset seçer.

Kullanıcı `Mesaja aktar` ile composer'a aktarır.

Usage counter +1 olur.

History kaydı oluşturulur.

Hatırlama açık ise değerler saklanır.

Chat gönderimi ayrıca kullanıcı tarafından yapılır.

## 5. Hata ayıklama sırası

Önce `promptLibraryCard` elementinin oluştuğunu kontrol et.

Sonra `HafizePromptLibrary` nesnesinin mevcut olduğunu kontrol et.

Prompt kartının `data-prompt-id` değerini kontrol et.

`hafize.prompt-library.v1` JSON'unun geçerli olduğunu kontrol et.

Dialog açılıyorsa `promptLibraryFillDialog` id'sini kontrol et.

Alanlar görünüyorsa `extractVariables` sonucunu kontrol et.

Preview değişiyorsa replacement katmanı çalışıyordur.

Composer değişmiyorsa `#messageInput` mevcutluğunu kontrol et.

Usage artmıyorsa prompt id'sinin storage'da bulunduğunu kontrol et.

History görünmüyorsa history key JSON'unu kontrol et.

Preset görünmüyorsa prompt id'siyle preset grubunu kontrol et.

Backup import olmuyorsa dosya boyutunu ve JSON formatını kontrol et.

## 6. Güvenli temizleme

Tek prompt hatırlama değerleri dialog içinden temizlenebilir.

Tek prompt presetleri dialog içinden temizlenebilir.

Boş hatırlama kayıtları topluca temizlenebilir.

Tüm smart-fill verisi açık onayla temizlenebilir.

Ana prompt storage'ı bu kontroller tarafından silinmez.

## 7. Cache

Smart Fill assetleri shell cache'te bulunur.

Yeni asset eklenirse `CURRENT_CACHE` sürümü yükseltilmelidir.

API path'leri cache içine alınmamalıdır.

Offline shell davranışı yalnız static assetler için geçerlidir.

## 8. Deployment checklist

[ ] Yeni JS dosyası shell asset listesinde.

[ ] Yeni CSS dosyası shell asset listesinde.

[ ] `index.html` gereksiz yere yeniden yazılmadı.

[ ] Storage key isimleri versioned.

[ ] Test dosyaları keşfedilebilir.

[ ] PR body test limitation açıklıyor.

[ ] Rollback yolu belgeli.

## 9. Rollback

Smart Fill assetleri kaldırılabilir.

Preset assetleri kaldırılabilir.

History asseti kaldırılabilir.

Privacy asseti kaldırılabilir.

Ana Prompt Library storage'ı korunur.

Usage insights korunur.

Chat composer gönderim akışı etkilenmez.

## 10. Veri ihlali varsayımı

Tarayıcı local storage gizli kasa değildir.

Cihaz paylaşımı, browser extension veya yerel profil erişimi bu verileri etkileyebilir.

Kullanıcıya parola, API key, refresh token, session cookie veya OTP gibi sırları preset olarak saklamaması önerilir.

## 11. Support log ilkeleri

Destek incelemesinde prompt gövdesi ve variable değerleri loglara kopyalanmaz.

Prompt id ve feature sürümü gibi düşük riskli metadatalar tercih edilir.

Secret değerleri istenmez.

Backup dosyaları destek kanalına yüklenmeden önce kullanıcı içeriği temizlenmelidir.

## 12. Performans

Prompt sayısı core tarafından bounded'dır.

History 24 kayıtla sınırlıdır.

Preset 8 kayıtla sınırlıdır.

Hatırlanan değerler 30 promptla sınırlıdır.

Observer yalnız gerekli DOM subtree'lerinde çalışır.

Yüksek frekanslı preview güncellemesi ağ çağrısı üretmez.

## 13. Release evidence

Source testleri syntax ve davranış sözleşmesini kontrol eder.

Security testleri injection ve network yüzeylerini kontrol eder.

Lifecycle testleri observer temizliğini kontrol eder.

PWA testleri asset listesini kontrol eder.

QA matrisi manuel smoke kapsamını tanımlar.

## 14. Operasyonel kararlar

Bir özellik eski prompt kayıtlarını migrate etmek zorunda kalmamalıdır.

Bir failure, ana chat çalışma alanını kilitlememelidir.

Bir storage hatası kullanıcı aksiyonunu mümkün olduğu kadar korumalıdır.

Kullanıcı açıkça istemedikçe persistent memory kullanılmamalıdır.

## 15. Son kontrol

Release öncesi ana akış ve rollback birlikte değerlendirilir.

Smart Fill bağımlılıkları Prompt Library çekirdeğinden gevşek bağlı tutulur.

PWA cache güncel değilse yeni assetler network-only kalabilir; cache güncellemesi için sürüm artırılır.
