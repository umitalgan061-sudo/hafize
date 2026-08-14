# Hafize Electron device bridge güvenlik modeli

Bu katman Jarvis'teki yerel cihaz kontrolü fikrini Hafize için bağımsız ve en-az-yetkili biçimde yeniden uygular. Amaç cloud/model runtime'a terminal erişimi vermek değil, gelecekteki Electron kabuğunun yalnız kullanıcı tarafından görülebilen dar masaüstü işlemlerini güvenli IPC üzerinden yapabilmesidir.

## İzin verilen operasyonlar

- `system.info`: yalnız platform, mimari, Hafize uygulama sürümü, CPU çekirdek sayısı ve toplam bellek gibi dar bir özet döner.
- `browser.open`: yalnız `https:` URL kabul eder ve `explicitUserIntent:true` gerektirir.
- `app.open`: yalnız main process tarafından önceden verilen `appOpeners` allowlist'indeki sabit `appId` değerlerini çalıştırır ve açık kullanıcı niyeti gerektirir.

Dosya yolu, executable yolu, komut satırı, shell string'i, serbest uygulama adı veya komut argümanı renderer/model girdisi olarak kabul edilmez.

## Kesinlikle sunulmayan yüzeyler

- `child_process`, `exec`, `execFile`, `spawn` veya `shell=True` benzeri komut çalıştırma yoktur.
- `shell.openPath` veya renderer tarafından seçilen yerel dosya/executable açma yoktur.
- `file:`, `http:`, `javascript:` veya credential içeren URL açma yoktur.
- Preload renderer'a ham `ipcRenderer` nesnesini vermez; yalnız üç sabit metot expose edilir.
- Bu bridge agent tool catalog'a kayıtlı değildir. Model `explicitUserIntent` üreterek cihaz eylemi kazanamaz.

## IPC güven sınırı

Main-process kayıt fonksiyonu zorunlu `isTrustedSender(event)` doğrulaması ister. Uygulama kabuğu bunu kendi beklenen renderer URL/origin ve `webContents` kimliğiyle bağlamalıdır. Callback yoksa bridge kurulumu fail-closed olur; güvenilmeyen sender isteği `DEVICE_RENDERER_NOT_TRUSTED` ile çalıştırılmadan reddedilir.

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

Bu PR Electron bağımlılığı veya masaüstü entrypoint'i eklemez. Gerçek Electron kabuğu geldiğinde `registerElectronDeviceBridge`, güvenilir sender doğrulaması ve güvenli BrowserWindow ayarları birlikte bağlanmalıdır. Device eylemlerini Hafize agent tool'larına açmak ayrı bir güvenlik tasarımı ve açık kullanıcı onay sistemi gerektirir; bu bridge tek başına model yetkisi değildir.
