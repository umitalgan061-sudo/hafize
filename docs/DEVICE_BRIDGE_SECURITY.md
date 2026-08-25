# Electron device bridge security contract

Hafize masaüstü uygulaması sistem bilgisi okuma, tarayıcıda URL açma ve sınırlı uygulama açma yeteneklerini doğrudan shell komutlarına dönüştürmez. `lib/device-bridge-contract.mjs`, Electron main/preload katmanının ileride bağlanacağı provider-independent güvenlik sınırını tanımlar.

## İzin verilen eylemler

- `system.info` — yalnız allowlist'li sistem metadata alanlarını döndürür.
- `browser.open` — yalnız açık kullanıcı niyetiyle HTTPS URL açar.
- `app.open` — yalnız açık kullanıcı niyetiyle konfigüre edilmiş app ID allowlist'inden uygulama açar.

`shell.run`, serbest executable path, argüman dizisi veya raw command string bu sözleşmenin parçası değildir.

## Sistem bilgisi minimizasyonu

Yalnız şu alanlar kabul edilir:

- `platform`
- `arch`
- `release`
- `hostname`

Username, home path, process list, environment variables, installed app inventory, network secrets veya credential benzeri değerler generic sistem bilgisi cevabına eklenemez. Ek alanlar fail-closed reddedilir.

## URL açma

- Yalnız `https:` protokolü kabul edilir.
- URL içindeki username/password credential bölümü reddedilir.
- `file:`, `javascript:`, `data:`, `ftp:` ve raw shell/protocol handler girişleri kabul edilmez.
- URL açma işlemi `explicitUserIntent: true` gerektirir.

Bu ilk contract bilinçli olarak HTTP ve custom application protocol'lerini açmaz. Somut ürün ihtiyacı doğarsa ayrı, testli allowlist genişletmesi gerekir.

## Uygulama açma

UI/model serbest executable veya filesystem path gönderemez. Sadece `appId` gönderir. Electron main process, örneğin `browser.chrome` veya `editor.vscode` gibi ürün kontrollü ID'leri işletim sistemine özgü güvenli açma yöntemlerine eşler.

- `appId` küçük harfe normalize edilir.
- Runtime allowlist dışında kalan ID `DEVICE_BRIDGE_APP_NOT_ALLOWED` ile reddedilir.
- Açma işlemi explicit user intent gerektirir.
- Terminal/shell uygulamalarının allowlist'e eklenmesi bu genel contract tarafından önerilmez.

## Electron wiring ilkeleri

Gelecekte Electron entegrasyonu yapılırken:

1. Renderer'a Node.js veya `child_process` verilmez.
2. `contextIsolation` açık, `nodeIntegration` kapalı tutulur.
3. Preload yalnız dar IPC metodlarını expose eder.
4. Main process bu contract ile girdiyi doğrulamadan OS API çağırmaz.
5. Tool permission backend default-deny kalır; model sağlayıcısı bu policy'yi değiştiremez.
6. Dış yan etki yaratan app/browser open işlemleri kullanıcı kontrolü olmadan çalışmaz.
7. Secret, environment veya credential değerleri renderer/model bağlamına taşınmaz.

## Test kapsamı

`scripts/test-device-bridge-contract.mjs` action allowlist, HTTPS-only URL normalizasyonu, credential URL reddi, explicit intent gate'i, app allowlist, sistem metadata minimizasyonu ve dependency hata davranışlarını doğrular.
