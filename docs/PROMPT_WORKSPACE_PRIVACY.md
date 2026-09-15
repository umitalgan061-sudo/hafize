# Prompt Workspace — Gizlilik

Prompt Workspace verisinin tamamı cihazdaki browser storage katmanlarında tutulur.

## Tutulan veriler

Prompt gövdesi, başlığı, etiketleri, kullanım sayısı, collection eşleşmesi, workspace seçimi, workflow reçetesi ve revizyon snapshot'ları tutulabilir. Bunların tamamı kullanıcı cihazında yerel veridir.

## Tutulmayan veriler

Yeni bir server-side prompt geçmişi, telemetry event'i, usage analytics payload'u, üçüncü taraf kullanıcı profili veya OAuth credential'ı oluşturulmaz.

## Export

Export dosyası kullanıcı tarafından açıkça başlatılır ve JSON olarak cihazdan alınır. İndirilen dosyanın dışarıya gönderilip gönderilmeyeceği uygulama tarafından kontrol edilmez.

## Import

Import edilmiş içerik önce boyut, schema ve limit kontrolünden geçer. Var olan kayıtlar ID çakışması nedeniyle sessizce ezilmez.

## Revizyon gizliliği

Revizyonlar aynı prompt'un geçmiş metnini içerir. Bu nedenle cihazı paylaşan kişiler browser storage veya export dosyasına erişirse revizyon içeriğini de görebilir.

## Workspace gizliliği

Workspace profili yalnızca kullanım tercihlerini ve istem ID'lerini taşır. Çözülmüş workflow çıktısı veya değişken değerleri kalıcı olarak workspace profile yazılmaz.

## Silme

Prompt silmek temel istem kaydını kaldırır; revizyon storage'ı otomatik olarak silinmez. Bu tasarım yanlışlıkla silme sonrası geri alma ihtimalini korur. Hassas bir prompt'un cihazdan tamamen çıkarılması isteniyorsa ilgili revizyon geçmişi ayrıca temizlenmelidir.

## Cache

Service worker yalnızca statik uygulama asset'lerini shell olarak cache'ler. Prompt içerikleri HTTP cache veya service worker response storage'a taşınmaz.

## Privacy review checklist

- Yeni fetch/XHR/WebSocket yok.
- Yeni analytics provider yok.
- Prompt body query string'e konulmuyor.
- Secret veya token storage'a yazılmıyor.
- Export kullanıcı eylemi olmadan başlamıyor.
- Import mevcut kaydı doğrudan overwrite etmiyor.
