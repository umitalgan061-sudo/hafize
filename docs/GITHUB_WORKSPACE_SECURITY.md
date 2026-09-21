GitHub çalışma alanı güvenlik sözleşmesi

## Tehdit modeli

Ana riskler yetkisiz repository erişimi, secret dosyalarının okunması, credential içeren dosya gövdelerinin tarayıcıya gönderilmesi, GitHub token'ının browser'a sızması, XSS ile uzak metnin HTML olarak çalıştırılması ve API yanıtlarının service worker cache'lenmesidir.

## Allowlist

Her GitHub workspace işlemi repository'yi sunucu allowlist'ine karşı kontrol eder. Allowlist dışında kalan repository 403 ve sabit hata koduyla reddedilir. Browser allowlist kararı vermez; güvenlik kararı backend'dedir.

## Yol normalizasyonu

Repository, ref ve path alanları bounded uzunluklarla normalize edilir. Mutlak path, ters slash, boş segment, nokta veya üst dizin segmentleri kabul edilmez. Bu kontrol API yolu oluşturmadan önce yapılır.

Mevcut github-read.ts ayrıca .env, credential, secret, token, private key ve anahtar dosyası uzantılarını filtreler. Base64 içeriği decode edildikten sonra binary ve plaintext credential kontrolleri yapılır.

## Kimlik

Token yalnız server-side request header içine eklenir. public/github-workspace*.ts kaynaklarında GitHub token veya Authorization değeri bulunmaz. Browser same-origin endpoint'e session credentials ile erişir.

## HTTP

Production guard GitHub workspace endpoint'lerini protectedPath listesine dahil eder. Auth gerektiğinde session veya izin verilmiş connector principal olmadan endpoint çalışmaz. API response cache-control uygulama güvenlik politikasına uyar.

## DOM güvenliği

GitHub'dan gelen name, title, commit message, path ve content değerleri textContent veya güvenli text node ile oluşturulur. UI doğrudan innerHTML ile uzak içerik basmaz. GitHub dış bağlantıları https://github.com/ ile başlayan URL'lerle sınırlandırılır ve noopener noreferrer kullanır.

## Yazma ve yükseltilmiş yetki

Workspace okuyucu GET ile sınırlıdır. Branch oluşturma, commit, PR oluşturma veya merge etme yetkisi yoktur. Bu kısıt UI görünümünden bağımsız olarak reader katmanında da tutulur.

## Telemetry

Workspace kendi analytics, telemetry, fetch proxy veya WebSocket katmanını çalıştırmaz. Recent repository geçmişi sessionStorage seviyesinde kalır.

## Güvenlik testi minimumu

Allowlist red, traversal red, sensitive path red, credential content red, token absence in UI, no POST/PATCH/DELETE, same-origin credentials, no-store API fetch, safe external link ve service worker network-only davranışı her release'te kontrol edilir.

## Olay sonrası inceleme

Beklenmeyen erişim, credential sızıntısı veya upstream GitHub hata patlaması görülürse önce endpoint erişimi kapatılabilir; mevcut prompt library verileri bundan etkilenmez. Rollback yalnız workspace katmanını geri alacak şekilde tasarlanır.
