# Model ve Ajan Tercihleri Güvenlik Modeli

## Tehdit yüzeyi

Özellik localStorage, model ve ajan seçimleri, kullanıcı profil adları ve JSON yedek dosyalarını işler.

## Ağ sınırı

Model tercih modülü fetch, XHR veya WebSocket kullanmaz.
Model listesi ve ajan listesi için ağ isteğini ana uygulama yapar.
Profil mekanizması bu istekleri sarmalamaz ve yeni endpoint üretmez.

## Secret sınırı

Profil veri modelinde API key, access token, refresh token veya OAuth secret alanları bulunmaz.
Export payload yalnız model, ajan, araç tercihi ve kullanım metadatasını taşır.
Profil adı serbest metindir ancak UI'da textContent ile gösterilir.

## Import sınırı

Dosya 200 KB üzerindeyse okunmaz.
JSON parse başarısızsa mevcut state korunur.
Geçersiz kayıtlar state içine alınmaz.
ID çakışması mevcut kaydı ezmez.
Kapasite taşması yeni kayıtların devamını durdurur.

## Storage sınırı

Storage yazma hataları yakalanır.
Bozuk JSON güvenli boş state'e düşer.
Clear işlemi yalnız hafize.model-preferences.v1 anahtarını siler.
Conversation storage veya başka özelliklerin anahtarları değiştirilmez.

## Yetki sınırı

Profil uygulamak backend yetkisi vermez.
Ajan kimliğinin gerçekten kullanılabilir olduğu mevcut ajan listesiyle doğrulanır.
Model seçimi mevcut model seçenekleri arasından uygulanır.
Tool mode backend policy tarafından yönetilmeye devam eder.

## UI güvenliği

Dinamik model, ajan ve profil adları innerHTML'e yazılmaz.
Dialog düğmeleri güvenli DOM API'leriyle oluşturulur.
Export URL kullanım sonrası revoke edilir.
Silme ve sıfırlama açık kullanıcı onayı gerektirir.

## Privacy

Tercih verisi analytics veya telemetry servisine gönderilmez.
Service worker tercih JSON'unu cache'lemez.
Kullanıcının profilleri başka cihazlarda otomatik paylaşılmış sayılmaz.
Paylaşım için açık export/import gerekir.
