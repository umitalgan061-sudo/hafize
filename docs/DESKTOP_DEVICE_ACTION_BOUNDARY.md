# Hafize masaüstü cihaz eylemi güvenlik sınırı

Bu belge Electron device bridge'in hangi masaüstü eylemlerini kabul ettiğini ve hangi koşullarda fail-closed davranacağını tanımlar.

## Amaç

Hafize masaüstünde sistem bilgisi gösterebilir ve açık kullanıcı eylemiyle önceden allowlist edilmiş web originlerini veya uygulama açıcılarını çağırabilir. Bu yetenek cloud agent'a genel işletim sistemi komutu çalıştırma hakkı vermez.

## İzin verilen operasyonlar

- `system.info`: salt-okunur platform, mimari, Hafize sürümü, CPU sayısı ve toplam bellek bilgisi.
- `capabilities.read`: yalnız main process tarafından yapılandırılmış browser origin ve app kimliği allowlist'ini döndürür.
- `browser.open`: yalnız HTTPS ve exact allowlist origin içinde kabul edilir.
- `app.open`: yalnız main process'te fonksiyon olarak önceden kaydedilmiş exact app kimliklerini kabul eder.

Başka operasyon adı `DEVICE_OPERATION_NOT_ALLOWED` ile reddedilir.

## Kullanıcı eylemi zorunluluğu

Dış tarayıcı veya uygulama açma iki ayrı katmanda korunur:

1. Renderer preload katmanı `navigator.userActivation.isActive` doğrulaması yapar. Aktif kullanıcı gesture yoksa IPC çağrısı hiç gönderilmez ve `DEVICE_ACTION_REQUIRES_ACTIVE_USER_GESTURE` döner.
2. Main-process sözleşmesi `explicitUserIntent: true` alanını exact request şemasında zorunlu tutar.

Bu iki kontrol birbirinin yerine geçmez. Preload kontrolü UI kaynaklı niyeti, main kontrolü IPC request sözleşmesini sınırlar.

## Renderer güven sınırı

IPC handler yalnız mevcut Hafize BrowserWindow `webContents` nesnesinden ve onun `mainFrame`'inden gelen çağrıları kabul eder. Main frame URL'si exact Hafize renderer origininde değilse `DEVICE_RENDERER_NOT_TRUSTED` döner.

Subframe, başka BrowserWindow, harici origin veya sonradan yönlenmiş renderer yetkili değildir.

## Browser allowlist

- Yalnız `https:` origin kabul edilir.
- Kullanıcı adı/parola içeren URL kabul edilmez.
- Allowlist en fazla 32 origin içerir.
- Renderer capability listesi yalnız bu doğrulanmış originleri görür.
- UI origin kökünü açar; serbest metin URL alanı sunmaz.
- Main process çağrı anında URL originini tekrar allowlist ile karşılaştırır.

## Uygulama allowlist

App kimliği dar regex ile doğrulanır ve yalnız `appOpeners` nesnesinde main process tarafından kayıtlı fonksiyon çağrılır. Renderer uygulama yolu, executable yolu, argüman veya shell komutu gönderemez.

`terminal`, `shell`, `cmd`, PowerShell veya benzeri genel komut yürütücüler varsayılan yetenek değildir ve otomatik allowlist'e eklenmez.

## Bilerek desteklenmeyen desenler

- `shell=True`, `exec`, `spawn` veya genel child-process komutları.
- Deny-list tabanlı komut filtreleme.
- Arbitrary file path veya executable path çalıştırma.
- HTTP origin açma.
- Model/tool çıktısından otomatik device action üretme.
- Kullanıcı tıklaması olmadan arka planda browser/app açma.
- Secret, credential veya token değerlerini capability listesine ekleme.

## Hata davranışı

Allowlist dışı origin `DEVICE_BROWSER_ORIGIN_NOT_ALLOWED`, allowlist dışı uygulama `DEVICE_APP_NOT_ALLOWED`, action implementation hatası `DEVICE_ACTION_FAILED` olarak sanitize edilir. Ham Electron/OS hata metni renderer'a taşınmaz.

## Test sözleşmesi

Regresyon testleri şu sınırları ayrı ayrı kilitler:

- request şema doğrulaması ve capability listesi,
- preload active-user-gesture kontrolü,
- renderer UI'nin yalnız capability allowlist'inden düğme üretmesi,
- main-process trusted sender kontrolü,
- browser/app allowlist enforcement,
- BrowserWindow navigation ve popup engelleri,
- bridge dispose/lifecycle temizliği,
- shell/child-process/network/storage gibi yasak yan etkilerin renderer enhancement'ında bulunmaması.

Bu sınır değiştirilirse ayrı güvenlik incelemesi gerekir; agent roster veya backend tool policy bu değişiklikle otomatik genişletilemez.
