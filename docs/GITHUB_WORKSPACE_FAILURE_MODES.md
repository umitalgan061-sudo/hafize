# GitHub çalışma alanı failure modes

## Kimlik yok
GITHUB_NOT_CONFIGURED veya AUTH_REQUIRED görülür. UI yalnız kısa bir mesaj gösterir. Token browser tarafında oluşturulmaz.

## Allowlist reddi
GITHUB_REPO_NOT_ALLOWED, repository sunucuda izinli değildir. UI başka bir repository önermez; kullanıcı kendi izinli değerini girmelidir.

## Geçersiz giriş
Repository, ref, path veya PR numarası normalize edilemezse işlem GitHub'a çıkmadan reddedilir.

## Hassas dosya
SENSITIVE_GITHUB_PATH_BLOCKED veya GITHUB_CONTENT_CREDENTIAL_BLOCKED görüldüğünde içerik gösterilmez. Bu hata bypass edilecek bir kullanıcı ayarı değildir.

## Upstream 4xx/5xx
GITHUB_ENDPOINT_FAILED döner. Upstream response body doğrudan kullanıcı mesajına taşınmaz.

## Bozuk upstream JSON
INVALID_GITHUB_RESPONSE döner. UI mevcut sonucu korumak yerine güvenli hata durumuna geçer.

## Büyük sonuç
Liste çağrıları 30 öğe ile sınırlıdır. Dosya içeriği mevcut read policy sınırına tabidir. UI ayrıca scrollable sonuç alanı kullanır.

## Dizin güvenliği
Dizin API'si file/dir dışı tipleri göstermez. Secret benzeri isimler sonuçtan çıkarılır.

## Compare
Base ve head aynıysa işlem yapılmaz. Dosya farkı listesi 30 öğe ile sınırlıdır.

## PWA
API yanıtları shell cache'e alınmaz. Workspace asset'i değiştiğinde cache version artırılır.

## Browser hatası
Clipboard kullanılamıyorsa kopyalama eylemi sessizce veri kaybetmeden hata verir. Workspace mount edilemezse uygulamanın ana sohbeti çalışmaya devam eder.

## Rollback
Workspace bundle'ı revert edilebilir. Prompt Library, scheduled tasks ve conversation storage'a dokunulmaz.
