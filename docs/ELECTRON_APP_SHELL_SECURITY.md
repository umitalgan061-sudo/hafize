# Electron app shell güvenlik modeli

Bu belge Hafize masaüstü uygulamasının Electron main-process composition sınırını tanımlar.

## Amaç

`desktop/app-shell.mjs`, #121 ile hazırlanan BrowserWindow güvenlik ayarları ve allowlist'li device bridge'i tek lifecycle içinde birleştirir. Bu katman yeni model/tool yetkisi üretmez; yalnız masaüstü renderer'ının hangi origin'den yüklenebileceğini ve hangi IPC sender'ın güvenilir sayılacağını belirler.

## Renderer kaynağı

Masaüstü shell yalnız loopback Hafize origin'i kabul eder:

- `127.0.0.1`
- `localhost`
- `::1`

`file:`, harici HTTP/HTTPS origin, URL credential ve fragment içeren başlangıç URL'leri reddedilir. Aynı-origin alt yollarına navigation izinlidir; başka origin'e `will-navigate` engeli uygulanır.

Yeni pencere/popup açma renderer için tamamen kapalıdır. Harici web sayfası açılması gerekiyorsa yalnız device bridge'in `browser.open` operasyonu, HTTPS doğrulaması ve `explicitUserIntent:true` sözleşmesi üzerinden yapılır.

## BrowserWindow

App shell yeni pencere oluştururken `createSecureWebPreferences()` kullanır. Böylece aşağıdaki ayarlar composition seviyesinde korunur:

- `contextIsolation: true`
- `sandbox: true`
- `nodeIntegration: false`
- `nodeIntegrationInWorker: false`
- `webSecurity: true`
- `allowRunningInsecureContent: false`
- `webviewTag: false`
- mutlak preload yolu

Renderer'a Node.js, shell veya ham Electron IPC nesnesi verilmez.

## Güvenilir IPC sender

Device bridge handler yalnız iki koşul birlikte sağlanırsa renderer'ı güvenilir kabul eder:

1. `event.sender`, aktif Hafize penceresinin `webContents` nesnesidir.
2. `event.senderFrame.url`, başlangıç Hafize URL'siyle aynı origin'dedir.

Yalnız sender kimliği veya yalnız URL kontrolü yeterli değildir. Pencere yok edilmişse hiçbir sender güvenilir değildir.

## Device bridge yaşam döngüsü

Her aktif BrowserWindow için tek device bridge registration oluşturulur. Pencere kapandığında navigation guard ve IPC registration dispose edilir. Uygulama yeniden aktive olduğunda yeni pencere oluşturulursa yeni sender sınırı da yeni pencereye bağlanır.

App shell şu yetenekleri eklemez:

- terminal/shell komutu yürütme,
- `child_process`, `exec`, `spawn` veya `shell.openPath`,
- serbest executable/path açma,
- model tarafından seçilen uygulama adı,
- renderer'dan doğrudan external URL açma.

## Platform lifecycle

`window-all-closed` Windows/Linux üzerinde uygulamayı kapatır. macOS'ta standart Electron davranışına uygun olarak app açık kalabilir ve `activate` geldiğinde pencere yeniden oluşturulur.

## Bilinçli sınır

Bu katman Electron paketini veya dağıtım/packaging konfigürasyonunu eklemez. Gerçek entrypoint, Electron dependency ve installer/signing işleri ayrı, testli PR'larda ele alınmalıdır. `.github/workflows`, credential ve signing secret'ları self-development kapsamına alınmaz.
