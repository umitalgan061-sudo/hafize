# Kontrol gate'i (`npm run check`)

Hafize'nin tek zorunlu doğrulama kapısı `scripts/run-checks.mjs` dosyasıdır.

## Neden değişti?

Gate daha önce `package.json` içinde elle bakımı yapılan tek satırlık dev bir komut zinciriydi. Yeni test dosyaları bu zincire eklenmediği için sessizce kapsam dışında kaldı: 85 test dosyasının 33'ü hiç çalıştırılmıyordu. Bu yüzden iki gerçek hata üretimde fark edilmeden kaldı:

- `scripts/test-tool-runtime.mjs` beklentisi `canva_read` / `gmail_read` araçlarını içermiyordu ve gate `main` üzerinde kırmızıydı;
- `lib/gmail-read-client.mjs` ve `lib/canva-read-client.mjs`, nesne olmayan istekte sözleşme hatası yerine ham `TypeError` fırlatıyordu.

## Sözleşme

- **Keşif elle yapılmaz.** `lib/`, `public/`, `scripts/` altındaki tüm `.mjs` / `.js` dosyaları ve `server.mjs` `node --check` ile syntax kontrolünden geçer.
- **`scripts/test-*.mjs` ve `scripts/validate-*.mjs` dosyalarının tamamı çalıştırılır.** Yeni bir test dosyası eklemek onu gate'e dahil etmek için yeterlidir; ayrıca bir listeye kaydetmek gerekmez.
- **Bir dosyayı gate dışında bırakmanın yolu yoktur.** İstisna listesi bilinçli olarak tanımlanmamıştır; kapsam dışı kalma en son bu hataların kaynağıydı.
- **İlk hata turu bitirmez.** Tüm kontroller çalıştırılır, başarısızlıklar toplanır ve sonunda listelenir; çıkış kodu 1 olur.
- **Eşleşmeyen filtre başarı sayılmaz.** Hiçbir dosyayla eşleşmeyen bir filtre `no-match` hatasıyla kırmızı döner; böylece yanlış yazılmış bir filtre "her şey geçti" gibi görünmez.

## Komutlar

| Komut | Kapsam |
| --- | --- |
| `npm run check` | Tüm syntax kontrolleri + tüm test/validate scriptleri. Zorunlu gate. |
| `npm run check:ui` | Yalnız istemci tarafı alt küme (voice, ui-shell, sidebar erişilebilirliği, hands-free, screen-share). Hızlı geri bildirim içindir, gate'in yerine geçmez. |
| `node scripts/run-checks.mjs <filtre> [...]` | Verilen alt dizeleri içeren dosyalar. Örn. `node scripts/run-checks.mjs gmail`. |

Eski `npm run precheck` adı kaldırıldı: npm bu adı `check` öncesinde otomatik çalıştırdığı için aynı testler iki kez koşuyordu. İstemci alt kümesi artık `npm run check:ui` altındadır.

## Harici servis gerektiren testler

`scripts/test-redis-schedule-lease-live.mjs` yalnız `HAFIZE_TEST_REDIS_URL` tanımlıysa gerçek Redis'e bağlanır; tanımsızsa kendini atlayıp sıfır çıkış kodu döndürür. Gate bu yüzden ağ erişimi olmadan da eksiksiz çalışır ve secret gerektirmez.

## Gate'in kendi testi

`scripts/test-run-checks.mjs` keşif sözleşmesini doğrular: diskteki her kaynak dosyanın syntax hedeflerinde, her `test-*` / `validate-*` dosyasının çalıştırılacak listede bulunduğunu, filtrelemenin ve başarısızlık toplamanın doğru çalıştığını kontrol eder. Enjekte edilmiş bir runner kullandığı için alt süreç başlatmaz.

## Kapsam doğrulaması

Gate her testi çalıştırır, ama bir modülün testi hiç yazılmamışsa bunu tek başına göremez. `scripts/validate-check-coverage.mjs` bu boşluğu kapatır: `lib/` altındaki her modüle en az bir `scripts/test-*.mjs` dosyasından referans verilmiş olmalıdır. Bugün 63 modülün tamamı kapsamlıdır; doğrulayıcı bu durumun geriye düşmesini engeller ve testsiz yeni bir modül eklendiğinde gate'i kırar.

Bilinen açık kapsam boşluğu: `public/app.js` hiçbir testten yüklenmiyor. Bu dosya sözleşme testleriyle değil yalnız dolaylı PWA cache testleriyle anılıyor; istemci sohbet kabuğu için ayrı bir doğrulama turu gerekir. Doğrulayıcı bugün yalnız `lib/` kapsamını zorunlu tutar; bu boşluk sahte bir istisna listesine gizlenmek yerine burada açıkça takip edilir.

## Geri alma

Değişiklik tek dosya (`scripts/run-checks.mjs`) ve `package.json` script alanlarıyla sınırlıdır; commit geri alındığında eski elle bakımlı zincir geri döner.
