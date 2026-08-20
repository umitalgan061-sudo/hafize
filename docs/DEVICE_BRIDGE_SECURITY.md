# Hafize Electron device bridge güvenlik modeli

Bu katman Jarvis'teki yerel cihaz kontrolü fikrini Hafize için bağımsız ve en-az-yetkili biçimde yeniden uygular. Amaç cloud/model runtime'a terminal erişimi vermek değil, gelecekteki Electron kabuğunun yalnız kullanıcı tarafından görülebilen dar masaüstü işlemlerini güvenli IPC üzerinden yapabilmesidir.

## İzin verilen operasyonlar

- `system.info`: yalnız platform, mimari, Hafize uygulama sürümü, CPU çekirdek sayısı ve toplam bellek gibi dar bir özet döner.
- `browser.open`: yalnız `https:` URL kabul eder, `explicitUserIntent:true` gerektirir, preload tarafında aktif kullanıcı jesti olmadan çağrı üretilmez ve hedef URL'nin **origin'i Electron main process tarafından verilen exact allowlist'te** bulunmalıdır.
- `app.open`: yalnız main process tarafından önceden verilen `appOpeners` allowlist'indeki sabit `appId` değerlerini çalıştırır, preload tarafında aktif kullanıcı jesti ister ve açık kullanıcı niyeti gerektirir.
- `capabilities.read`: renderer'a yalnız izinli browser origin'leri ve sabit app-id listesini bildirir; yeni bir yetki vermez.

Dosya yolu, executable yolu, komut satırı, shell string'i, serbest uygulama adı veya komut argümanı renderer/model girdisi olarak kabul edilmez.

## Kesinlikle sunulmayan yüzeyler

- `child_process`, `exec`, `execFile`, `spawn` veya `shell=True` benzeri komut çalıştırma yoktur.
- `shell.openPath` veya renderer tarafından seçilen yerel dosya/executable açma yoktur.
- `file:`, `http:`, `javascript:` veya credential içeren URL açma yoktur.
- Preload renderer'a ham `ipcRenderer` nesnesini vermez; yalnız dar device bridge metotlarını expose eder.
- Renderer/preload `allowedBrowserOrigins` değerini değiştiremez veya `browser.open` request'i içine policy alanı enjekte edemez.
- Bu bridge agent tool catalog'a kayıtlı değildir. Model `explicitUserIntent` üreterek cihaz eylemi kazanamaz.

## IPC güven sınırı

Main-process kayıt fonksiyonu zorunlu `isTrustedSender(event)` doğrulaması ister. Uygulama kabuğu bunu kendi beklenen renderer origin'i, pencerenin exact `webContents` kimliği ve **exact `webContents.mainFrame` kimliği** ile bağlar. Aynı-origin bir iframe/subframe ana frame'in device IPC yetkisini devralamaz. Ana frame beklenen renderer origin'inden ayrılırsa istek reddedilir. Callback yoksa bridge kurulumu fail-closed olur; güvenilmeyen sender isteği `DEVICE_RENDERER_NOT_TRUSTED` ile çalıştırılmadan reddedilir.

## Tek-kullanımlık action kimliği ve replay sınırı

`browser.open` ve `app.open` yalnız `explicitUserIntent:true` ile yetinmez. Preload, **aktif kullanıcı jesti doğrulandıktan sonra** her yan etkili çağrı için yeni bir UUIDv4 `actionId` üretir. Read-only `system.info` ve `capabilities.read` çağrıları action kimliği tüketmez.

Main-process contract `actionId` biçimini doğrular ve yan etki başlamadan hemen önce bounded replay ledger'a tek-kullanımlık olarak işler. Aynı `actionId` ikinci kez gelirse komutun diğer alanları değişmiş olsa bile `DEVICE_ACTION_REPLAYED` ile reddedilir. Bu davranış aynı IPC mesajının çift tıklama, renderer bug'ı, yarış koşulu veya tekrar teslim nedeniyle yeniden gelmesinin ikinci bir dış uygulama/tarayıcı açmasına dönüşmesini engeller.

Replay ledger şu güvenlik özelliklerini taşır:

- Varsayılan TTL **5 dakikadır**. Süresi geçen kayıtlar yeni action kabulü öncesinde temizlenir.
- Varsayılan kapasite **512 action** ile bounded'dır; sınıra ulaşılıp henüz TTL ile temizlenecek kayıt yoksa yeni yan etki `DEVICE_ACTION_LEDGER_FULL` ile fail-closed reddedilir. Eski kayıt sırf yer açmak için sessizce evict edilmez.
- Action kimliği yalnız allowlist/policy doğrulamaları geçtikten sonra tüketilir. Örneğin izin verilmeyen browser origin'i aynı action kimliğini yakmaz; kullanıcı daha sonra izinli hedefle gerçek bir eylem yapabilir.
- Action kimliği **side effect çağrısından önce** tüketilir. `shell.openExternal` veya app opener hata verirse sonuç platform açısından belirsiz olabileceğinden aynı action kimliğiyle kör retry engellenir.
- Replay check ve consume senkron kritik bölümde yapılır. İlk opener promise'i hâlâ beklemedeyken aynı action kimliğiyle gelen eşzamanlı ikinci istek yan etkiye ulaşmadan reddedilir.

Bu ledger bir kullanıcı kimlik doğrulama mekanizması değildir; trusted-sender, active-user-gesture, exact allowlist ve explicit-intent sınırlarının üzerine eklenen duplicate/replay korumasıdır. Yeni bir model/tool yetkisi yaratmaz.

## Retry ve hata semantiği

`DEVICE_ACTION_REPLAYED` görüldüğünde renderer aynı action kimliğini yeniden kullanmamalıdır. Kullanıcı gerçekten yeni bir açma işlemi istiyorsa yeni, canlı bir kullanıcı jesti üzerinden yeni `actionId` üretilir. `DEVICE_ACTION_FAILED` sonrasında otomatik retry yapılmamalıdır; platform çağrısı hata vermeden önce yan etki kısmen gerçekleşmiş olabilir.

`DEVICE_ACTION_LEDGER_FULL` kapasite güvenlik sınırıdır. Uygulama bunu aşmak için ledger'ı temizlememeli veya rastgele kayıt silmemelidir; kısa TTL dolduktan sonra yeni kullanıcı eylemi tekrar denenebilir. Bu yaklaşım availability yerine “aynı kullanıcı eylemini iki kez yürütmeme” güvenliğini önceliklendirir.

## Browser origin allowlist yaklaşımı

`allowedBrowserOrigins` yalnız Electron main/app-shell composition katmanından verilir ve varsayılanı boş listedir; yani yapılandırılmamış masaüstü bridge dış tarayıcı açmayı **deny-all** yapar. Allowlist girdileri wildcard değil exact HTTPS origin değerleridir. Path, query, fragment, credential ve HTTP origin config olarak reddedilir; farklı port farklı origin sayılır. İzinli bir origin seçildikten sonra aynı origin altındaki path/query/fragment URL'leri açılabilir.

Bu sınır özellikle `docs.example.com.evil.test`, beklenmeyen subdomain veya farklı port gibi suffix/prefix benzerliklerinin allowlist'i aşmasını engeller. Renderer yalnız hedef URL + açık kullanıcı niyetini gönderebilir; hangi origin'lerin izinli olduğuna karar veremez.

## Electron permission yaklaşımı

App shell hem `setPermissionRequestHandler` hem `setPermissionCheckHandler` kurar ve varsayılan olarak tüm Electron web permission'larını reddeder. Sesli kullanım için yalnız ürün composition'ı `allowAudioMedia:true` verdiğinde, exact Hafize renderer origin'inden ve main frame'den gelen yalnız `audio` media isteği kabul edilir; video/kamera, geolocation, notifications, filesystem ve diğer permission türleri reddedilir. Pencere kapatıldığında policy Electron'ın varsayılan davranışına geri dönmek yerine deny-all handler bırakır.

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

Gerçek masaüstü dağıtım composition'ı `allowedBrowserOrigins`, `appOpeners` ve gerekiyorsa `allowAudioMedia` değerlerini ürün tarafından sahip olunan sabit konfigürasyondan sağlamalıdır; renderer veya model girdisinden türetmemelidir. Device eylemlerini Hafize agent tool'larına açmak ayrı bir güvenlik tasarımı ve açık kullanıcı onay sistemi gerektirir; bu bridge tek başına model yetkisi değildir.
