# Hafize Electron device bridge güvenlik modeli

Bu katman Jarvis'teki yerel cihaz kontrolü fikrini Hafize için bağımsız ve en-az-yetkili biçimde yeniden uygular. Amaç cloud/model runtime'a terminal erişimi vermek değil, gelecekteki Electron kabuğunun yalnız kullanıcı tarafından görülebilen dar masaüstü işlemlerini güvenli IPC üzerinden yapabilmesidir.

## İzin verilen operasyonlar

- `system.info`: yalnız platform, mimari, Hafize uygulama sürümü, CPU çekirdek sayısı ve toplam bellek gibi dar bir özet döner.
- `browser.open`: yalnız `https:` URL kabul eder, `explicitUserIntent:true` gerektirir ve hedef URL'nin **origin'i Electron main process tarafından verilen exact allowlist'te** bulunmalıdır.
- `app.open`: yalnız main process tarafından önceden verilen `appOpeners` allowlist'indeki sabit `appId` değerlerini çalıştırır ve açık kullanıcı niyeti gerektirir.

Dosya yolu, executable yolu, komut satırı, shell string'i, serbest uygulama adı veya komut argümanı renderer/model girdisi olarak kabul edilmez.

## Kesinlikle sunulmayan yüzeyler

- `child_process`, `exec`, `execFile`, `spawn` veya `shell=True` benzeri komut çalıştırma yoktur.
- `shell.openPath` veya renderer tarafından seçilen yerel dosya/executable açma yoktur.
- `file:`, `http:`, `javascript:` veya credential içeren URL açma yoktur.
- Preload renderer'a ham `ipcRenderer` nesnesini vermez; yalnız üç sabit metot expose edilir.
- Renderer/preload `allowedBrowserOrigins` değerini okuyamaz, değiştiremez veya `browser.open` request'i içine policy alanı enjekte edemez.
- Bu bridge agent tool catalog'a kayıtlı değildir. Model `explicitUserIntent` üreterek cihaz eylemi kazanamaz.

## IPC güven sınırı

Main-process kayıt fonksiyonu zorunlu `isTrustedSender(event)` doğrulaması ister. Uygulama kabuğu bunu kendi beklenen renderer origin'i, pencerenin exact `webContents` kimliği ve **exact `webContents.mainFrame` kimliği** ile bağlar. Aynı-origin bir iframe/subframe ana frame'in device IPC yetkisini devralamaz. Ana frame beklenen renderer origin'inden ayrılırsa istek reddedilir. Callback yoksa bridge kurulumu fail-closed olur; güvenilmeyen sender isteği `DEVICE_RENDERER_NOT_TRUSTED` ile çalıştırılmadan reddedilir.

## Browser origin allowlist yaklaşımı

`allowedBrowserOrigins` yalnız Electron main/app-shell composition katmanından verilir ve varsayılanı boş listedir; yani yapılandırılmamış masaüstü bridge dış tarayıcı açmayı **deny-all** yapar. Allowlist girdileri wildcard değil exact HTTPS origin değerleridir. Path, query, fragment, credential ve HTTP origin config olarak reddedilir; farklı port farklı origin sayılır. İzinli bir origin seçildikten sonra aynı origin altındaki path/query/fragment URL'leri açılabilir.

Bu sınır özellikle `docs.example.com.evil.test`, beklenmeyen subdomain veya farklı port gibi suffix/prefix benzerliklerinin allowlist'i aşmasını engeller. Renderer yalnız hedef URL + açık kullanıcı niyetini gönderebilir; hangi origin'lerin izinli olduğuna karar veremez.

## BrowserWindow sözleşmesi

Hafize masaüstü penceresi bridge'i kullanacaksa `createSecureWebPreferences()` çıktısı temel alınmalıdır:

- `contextIsolation: true`
- `sandbox: true`
- `nodeIntegration: false`
- `nodeIntegrationInWorker: false`
- `webSecurity: true`
- `allowRunningInsecureContent: false`
- `webviewTag: false`
- preload yolu mutlak ve uygulama tarafından belirlenmiş olmalıdır.

Bu ayarlar renderer içeriğinin Node/Electron ayrıcalıklarına doğrudan ulaşmasını engelleyen sözleşmenin parçasıdır; uygulama oluşturulurken gevşetilmemelidir.

## App allowlist yaklaşımı

`appOpeners` yalnız Electron main process içinde, kullanıcı tarafından düzenlenemeyen sabit uygulama kimliklerinden oluşturulmalıdır. Her opener belirli bir uygulamayı açan dar platform kodu olmalı; model/renderer tarafından sağlanan path veya argümanı kabul etmemelidir. Uygulama kurulu değilse opener güvenli biçimde hata vermeli ve bridge yalnız `DEVICE_ACTION_FAILED` döndürmelidir.

## Sonraki entegrasyon

Gerçek masaüstü dağıtım composition'ı `allowedBrowserOrigins` ve `appOpeners` değerlerini ürün tarafından sahip olunan sabit konfigürasyondan sağlamalıdır; renderer veya model girdisinden türetmemelidir. Device eylemlerini Hafize agent tool'larına açmak ayrı bir güvenlik tasarımı ve açık kullanıcı onay sistemi gerektirir; bu bridge tek başına model yetkisi değildir.
