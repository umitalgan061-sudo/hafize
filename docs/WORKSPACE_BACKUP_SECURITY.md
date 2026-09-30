# Çalışma Alanı Yedekleme Güvenlik Modeli

## Güvenlik hedefi

Özellik kullanıcı state'ini taşırken kimlik bilgilerini taşımamalıdır.

Allowlist yaklaşımı denylist yaklaşımından önce gelir.

Yalnız tanımlı storage yüzeyleri export edilebilir.

Dynamic Smart Fill key'leri yalnız kontrollü prefix üzerinden kabul edilir.

## Secret izolasyonu

Uygulama auth token'ları storage allowlist'inde değildir.

Connector token'ları allowlist'te değildir.

OAuth cache alanları allowlist'te değildir.

Session anahtarları allowlist'te değildir.

Password içeren key'ler ek denylist ile reddedilir.

Secret, token ve credential ifadeleri ek denylist ile reddedilir.

Authorization veya Bearer içeren client implementation bu modüle eklenmemelidir.

## Network sınırı

Workspace backup modülü fetch çağırmaz.

XMLHttpRequest kullanılmaz.

WebSocket kullanılmaz.

Beacon veya telemetry çağrısı kullanılmaz.

Download Browser Blob URL üzerinden yapılır.

Import kullanıcı dosyasını local memory üzerinde okur.

Backup export server'a upload edilmez.

## DOM güvenliği

Kullanıcı verisi innerHTML ile yazılmaz.

Section title textContent ile oluşturulur.

Description textContent ile oluşturulur.

Status mesajları textContent ile yazılır.

Checkbox label'ları DOM API ile kurulur.

Download link'i DOM API ile oluşturulur.

## Boyut savunması

Dosya boyutu parse edilmeden önce kontrol edilir.

Section JSON byte uzunluğu kontrol edilir.

Smart Fill entry sayısı sınırlandırılır.

Storage key uzunluğu sınırlandırılır.

Section sayısı sınırlandırılır.

Bu sınırlar parser memory tüketimini öngörülebilir tutar.

## JSON savunması

JSON parse exception yakalanır.

Root object kontrol edilir.

Version integer değeri kontrol edilir.

Source exact string olarak kontrol edilir.

Section object yapısı kontrol edilir.

Unknown kind allowlist dışı kabul edilir.

Undefined section data restore edilmez.

## Integrity

Yedek üretiminde SHA-256 digest oluşturulur.

Digest kanonik gövde üzerinden alınır.

Import sırasında digest tekrar oluşturulur.

Digest eşleşmiyorsa restore engellenir.

Web Crypto kullanılamıyorsa dosya unverified olabilir.

Failed state restore butonunu kapatır.

## Restore güvenliği

Restore destructive bir state update işlemidir.

Bu nedenle confirmation zorunludur.

Kullanıcı section bazında kapsam seçer.

Seçilmeyen section'lar değiştirilmez.

İşlem öncesi mevcut raw değerler captured olur.

Exception sonrası rollback yapılır.

Rollback best-effort sonuç olarak ayrıca raporlanır.

## Malicious backup

Saldırgan unknown storage key yazabilir.

Unknown storage key allowlist'ten geçmez.

Saldırgan Smart Fill prefix ile token suffix kullanabilir.

Sensitive key denylist'i bunu da sınırlar.

Saldırgan çok büyük string yazabilir.

Section byte limiti bunu sınırlar.

Saldırgan çok fazla entry ekleyebilir.

Max entry ve max section limitleri bunu sınırlar.

Saldırgan bozuk JSON gönderebilir.

Parser exception kontrollü hata üretir.

## Integrity saldırıları

Digest alanını değiştirerek bütünlüğü bozulan dosya reddedilir.

Section içeriği değiştiğinde digest mismatch oluşur.

Restore öncesi inspection zorunlu olduğu için raw payload doğrudan yazılmaz.

## Storage güvenliği

localStorage erişimi exception üretebilir.

safeStorage bu durumu güvenli bir null sonucuna çevirir.

Quota exception restore sırasında yakalanır.

Rollback map mevcut raw değerleri korur.

Metadata yazılamazsa ana backup dosyası yine download edilir.

## Privacy boundary

Backup dosyası kullanıcı cihazının download alanına çıkar.

Uygulama dosyayı backend'e göndermez.

Yedek içeriği analytics event'i oluşturmaz.

Son export metadata'sı içerik taşıyan bir cache değildir.

## Code review

Yeni storage key eklenirse allowlist review edilmelidir.

Yeni section kind eklenirse restore branch'i review edilmelidir.

Yeni UI alanı eklenirse DOM escaping kontrol edilmelidir.

Yeni network çağrısı bu modülün sınır ihlalidir.

Yeni credential field eklenmemelidir.

Yeni migration varsa rollback planı yazılmalıdır.

## Kabul kriterleri

Unknown key export edilemez.

Unknown key restore edilemez.

Sensitive-looking key kabul edilmez.

Integrity mismatch restore edilemez.

Restore confirmation olmadan yazma yapılamaz.

Backup module remote write yapamaz.

DOM sink'leri güvenli API'lerle sınırlı kalır.
