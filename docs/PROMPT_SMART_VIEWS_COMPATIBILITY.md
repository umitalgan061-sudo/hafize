# Akıllı Görünümler Uyumluluk

## Tarayıcı

Modern Chromium, Firefox ve Safari sürümleri hedeflenir.
LocalStorage mevcut değilse modül güvenli boş duruma dönmelidir.
MutationObserver bulunmayan ortamda temel liste davranışı korunur.
StorageEvent bulunmayan yardımcı ortamlar exception üretmemelidir.

## Prompt Library

Smart Views core Prompt Library'nin `HafizePromptLibrary` API'sine bağımlıdır.
Core modül mount olmadan Smart Views paneli eklenmez.
Core storage anahtarı Smart View storage'ından ayrı kalır.
Core item id'leri görünüm üyeliğinde doğrudan değiştirilmez.

## PWA

Smart View asset'leri shell cache listesine açıkça yazılır.
Cache sürüm artışı yeni asset setinin yüklenmesini garanti eder.
API response'ları shell cache'e eklenmez.
Offline kullanım statik panel dosyalarıyla sınırlıdır.

## Veri taşıma

v1 görünüm payload'ı name/query/core filtreleriyle okunabilir kalır.
Yeni alanlar normalizeView içinde varsayılan değer alır.
Bilinmeyen alanlar ignore edilir.
Duplicate name import sırasında mevcut kayıt korunur.
Duplicate id import sonrası yeni id ile ayrıştırılır veya import katmanında atlanır.

## Geriye dönük davranış

Smart Views dosyaları yüklenmese bile temel Prompt Library arama ve kullanım akışı devam etmelidir.
Smart View geçmişi yoksa panel boş durum gösterebilir.
Repair checkpoint yoksa geri alma düğmesi pasif olmalıdır.
Builder olmadan kaydedilmiş görünüm listesi yine uygulanabilir.

## Test

Asset order kontrol edilir.
PWA cache asset kontrol edilir.
Security boundary kontrol edilir.
Core search operatör uyumluluğu kontrol edilir.
Storage ve normalize limitleri kontrol edilir.

Bu belge yeni bir harici bağımlılık, backend endpoint'i veya credential akışı tanımlamaz.