# Doğrulama kapısı (`npm run check`)

## Neden değişti

Kapı daha önce `package.json` içinde elle bakımı yapılan tek satırlık dev bir
`&&` zinciriydi. Bu tasarımın iki ölçülebilir arızası vardı:

1. **Sessiz kapsam kaybı.** Yeni bir test dosyası eklendiğinde zincire elle
   eklenmesi gerekiyordu. Bu adım unutulduğunda test diskte duruyor ama hiç
   çalışmıyordu. Onarım anında diskteki **85 test dosyasının 33'ü** zincirde
   yoktu; aralarında tüm OAuth, PKCE, token şifreleme, token dosya deposu,
   Canva token exchange/refresh/revoke, cihaz köprüsü politikası, ekran
   paylaşımı ve kişisel bellek şifreleme testleri vardı. Yani güvenlik
   sınırlarının önemli bir bölümü kapı tarafından hiç doğrulanmıyordu.
2. **İlk hatada durma.** `&&` zinciri ilk başarısızlıkta durduğu için bir turda
   yalnız tek bir hata görülebiliyor, arkasındaki hatalar gizleniyordu.

Bu iki arıza birlikte gerçek bir regresyonu gizledi: kapı bozulduktan sonra
main üzerinde iki ayrı hata birikti (aşağıya bakınız).

## Şimdiki davranış

`npm run check` → `node scripts/run-checks.mjs`.

Çalıştırıcı hedeflerini **diskten keşfeder**:

- **Sözdizimi kontrolü** (`node --check`): `server.mjs`, `lib/*.mjs`,
  `scripts/*.mjs`, `public/*.js`.
- **Yürütme**: `scripts/test-*.mjs` ve `scripts/validate-*.mjs`.

Kapsam kod tabanıyla birlikte kendiliğinden büyür; yeni bir test dosyası
eklemek onu kapıya dahil etmek için yeterlidir.

Ek davranışlar:

- Kapı **ilk hatada durmaz**; tüm hedefleri çalıştırır ve turun sonunda
  başarısız olanların tamamını çıktısıyla birlikte raporlar.
- Her hedef ayrı bir alt süreçte çalışır; test başına 120 sn, sözdizimi
  kontrolü başına 30 sn zaman aşımı vardır. Asılı kalan bir test kapıyı
  süresiz kilitlemez, kırmızıya düşürür.
- Alt süreç çıktısı son 20 KB ile sınırlanır (teşhis için yeterli).
- Çıkış kodu yeşilde `0`, kırmızıda `1`'dir.

## Kapsam kayması sözleşmesi

`scripts/test-check-runner.mjs` kapının kendisini doğrular ve asıl olarak
kapsam kaymasını engeller: diskteki her `test-*.mjs` / `validate-*.mjs`
dosyası, gerekçesi `run-checks.mjs` içindeki `EXCLUDED_TESTS` sözlüğünde
**açıkça yazılmadıkça** kapı tarafından çalıştırılmak zorundadır. Liste şu an
bilinçli olarak boştur; amaç bir testin sessizce atlanması yerine atlanma
gerekçesinin kodda görünür olmasıdır.

Aynı test `lib/`, `public/` ve `scripts/` içindeki her kaynak dosyanın
sözdizimi kontrolü kapsamında olduğunu, kaynak olmayan dosyaların
(`.css`, `.webmanifest`, görseller) kapsam dışı kaldığını da doğrular.

Bu test kapı tarafından da keşfedildiği için `main()` fonksiyonunu asla
çağırmaz; yalnız keşif fonksiyonlarını sınar (sonsuz özyineleme olmaz).

## Kapının gizlediği iki gerçek hata

Kapı onarılırken ortaya çıkan ve düzeltilen hatalar:

1. **Connector sınırları null argümanla aşılabiliyordu.** Bir `= {}` varsayılan
   parametresi yalnız `undefined` için devreye girer; `null`, bir sayı veya bir
   dizi geçirildiğinde destructuring ham `TypeError` fırlatır ve sınırın kendi
   `INVALID_*` sözleşmesi hiç üretilmez. Girdi artık `lib/boundary-input.mjs`
   içindeki ortak `requireObjectInput()` ile destructuring'den önce normalize
   edilir. Kapsanan beş sınır: `gmail-read-client`, `canva-read-client` (fabrika
   + `read`) ve `gmail-read-tool-boundary`, `canva-read-tool-boundary`,
   `gmail-send-tool-boundary` (fabrika + `execute` context argümanı). Sözleşme
   hatalarının `error.code` alanı korunur, çünkü tool runtime hata
   sınıflandırmasını bu alan üzerinden yapar. Gönderme sınırı için bu ayrıca
   fail-closed davranıştır: bozuk bir context artık sessizce
   `approvalGranted: false` varsayımıyla devam etmez, sözleşme hatası üretir.
   Sözleşme `scripts/test-boundary-input.mjs` ile kilitlenmiştir.
2. **`scripts/test-tool-runtime.mjs` — eski araç beklentisi.** `canva_read` ve
   `gmail_read` araçları tool runtime'a eklendiğinde bu testin izin listesi
   beklentisi güncellenmemişti. Beklenti güncellendi ve iki connector aracının
   herkese açık etkinlik etiketleri de teste bağlandı; böylece beklenti yalnız
   genişletilmiş olmuyor, yeni davranış da kilitleniyor.

## Doğrulama

- `npm run check` → 162 sözdizimi hedefi, 88 test hedefi, 0 başarısız.
- Kırmızı yol ayrıca kanıtlandı: geçici olarak bozuk sözdizimli bir `lib`
  dosyası ve başarısız bir test dosyası eklendiğinde kapı ikisini de raporladı
  ve `1` ile çıktı (yani kapı gerçekten kırmızıya düşebiliyor).

## Geri alma

`package.json` içindeki `check` script'i eski `&&` zincirine döndürülür ve
`scripts/run-checks.mjs` ile `scripts/test-check-runner.mjs` silinir. Connector
sınırı sertleştirmesi (`lib/boundary-input.mjs` ve onu kullanan beş sınır) ile
tool runtime test onarımı bağımsızdır; ayrı ayrı geri alınabilir.
