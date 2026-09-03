# Kontrol Kapısı (`npm run check`)

## Amaç

Her geliştirme turunda çalıştırılan tek doğrulama girişi. Kapı, elle bakımlı bir
npm script zinciri değil; `scripts/run-tests.mjs` içindeki **dosya keşfi**
üzerine kuruludur.

## Sözleşme

1. **Syntax aşaması** — `server.mjs`, `lib/*.mjs`, `scripts/*.mjs` ve
   `public/*.js` altındaki her dosya `node --check` ile doğrulanır. Bir dosya bile
   ayrıştırılamazsa test aşaması hiç başlamaz.
2. **Doğrulama aşaması** — `scripts/validate-agent-registry.mjs` çalıştırılır.
3. **Test aşaması** — `scripts/test-*.mjs` kalıbına uyan **tüm** dosyalar ayrı
   birer alt süreçte çalıştırılır.

Tek bir başarısızlık bile çıkış kodunu `1` yapar. Kapı ilk hatada durmaz; tüm
aşamayı tamamlayıp başarısız olan her adımın çıktısını sonda topluca raporlar.

## Neden keşif tabanlı?

Önceki kapı, her test dosyasını tek tek sayan çok uzun bir npm script
metniydi. Bu iki somut soruna yol açtı:

- `scripts/` altındaki 85 test dosyasının 32'si kapının dışında kalmıştı; bu
  testler aylarca hiç çalıştırılmadı.
- Kapıdaki `test-tool-runtime.mjs` beklentisi yeni bağlanan `canva_read` ve
  `gmail_read` araçlarıyla birlikte güncellenmediği için `main` üzerinde kırık
  kaldı.

Keşif tabanlı kapıda yeni bir test dosyası eklemek onu otomatik olarak kapının
parçası yapar; ayrıca `package.json` düzenlemesi gerekmez.

## Güvenlik ve dayanıklılık

- Her alt süreç izole çalışır; varsayılan zaman aşımı **120 sn**'dir ve aşan
  süreç `SIGKILL` ile sonlandırılıp başarısız sayılır. Böylece asılı kalan tek
  bir test kapıyı süresiz bloke edemez.
- Alt süreç çıktısı 64 KB ile sınırlıdır; devasa log'lar raporu boğmaz.
- Kapı hiçbir secret okumaz, ağ çağrısı yapmaz ve dosya yazmaz.

## Kapının kendi testi

`scripts/test-check-gate.mjs` keşif sözleşmesini kilitler: diskteki her
`scripts/test-*.mjs` dosyasının keşfedildiğini, kritik kaynakların syntax
listesinde olduğunu, koşucunun kendini test olarak çalıştırmadığını ve başarısız
/ asılı / eksik alt süreçlerin doğru şekilde başarısız raporlandığını doğrular.

## Geri alma

`package.json` içindeki `check` script'i eski zincire döndürülerek veya
`scripts/run-tests.mjs` ile `scripts/test-check-gate.mjs` silinerek geri alınır.
