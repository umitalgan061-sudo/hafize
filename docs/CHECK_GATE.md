# Doğrulama Kapısı (`npm run check`)

## Amaç

Tek komutla deponun tüm syntax kontrollerini ve testlerini çalıştırmak, **hiçbir
testin sessizce kapı dışında kalmamasını** sağlamak ve bir hata çıktığında geri
kalan kontrolleri gizlememek.

```bash
npm run check          # tüm kapı
npm test               # aynı komut
node scripts/run-checks.mjs --list                 # ne çalışacağını göster
node scripts/run-checks.mjs --only=test-tool       # alt küme çalıştır
node scripts/run-checks.mjs --timeout=30000        # kontrol başına süre sınırı
```

## Neden değişti?

Kapı daha önce `package.json` içinde elle bakımı yapılan tek satırlık bir
`&&` zinciriydi. Bu iki somut arızaya yol açtı:

- **İlk hatada duruyordu.** `scripts/test-tool-runtime.mjs` bayat bir araç
  listesi beklediği için 14 Ağustos'tan itibaren 55 commit boyunca kırmızıydı;
  zincirdeki sonraki 45 test hiç çalışmadı. Bu sırada `lib/gmail-read-client.mjs`
  içinde `read(null)` çağrısının sözleşmedeki `INVALID_GMAIL_READ` yerine ham
  `TypeError` fırlattığı ikinci bir arıza da fark edilmeden kaldı.
- **Zincire eklenmeyen testler görünmezdi.** Depoda geçen ama kapıya hiç
  girmemiş 32 test dosyası birikmişti (OAuth akışları, Canva token değişimi,
  kişisel bellek şifrelemesi, ekran paylaşımı ve diğerleri).

## Runner sözleşmesi

`scripts/run-checks.mjs` listeyi elle tutmaz, diskten keşfeder:

| Kontrol türü | Kaynak |
| --- | --- |
| `syntax <dosya>` | `server.mjs`, `lib/*.mjs`, `public/*.js`, `scripts/*.mjs` için `node --check` |
| `scripts/validate-agent-registry.mjs` | ajan kayıt defteri doğrulaması |
| `scripts/test-*.mjs` | tüm test betikleri |

Davranış kuralları:

- **Hiçbir kontrolde durmaz.** Tümü çalışır; başarısızlıklar sonda toplu olarak,
  her biri için son 8 KB çıktıyla raporlanır.
- **Çıkış kodu**: hepsi geçerse `0`, en az bir kontrol başarısızsa `1`, hatalı
  komut satırı argümanında `2`.
- **Kontrol başına zaman aşımı** (varsayılan 120 sn) asılı kalan bir testin
  kapıyı süresiz bloke etmesini engeller.
- **Sıralama kararlıdır**, böylece çıktı diff'leri gürültü üretmez.
- `process.exit()` kullanılmaz; borulanmış çıktı kesilmesin diye her yolda
  `process.exitCode` atanır.

## Yeni test eklerken

`scripts/` altına `test-*.mjs` adıyla bir dosya koymak yeterlidir; kapıya
otomatik girer. `package.json` düzenlenmez.

`scripts/test-check-runner.mjs` bunu bekçi olarak doğrular: diskteki her test
dosyasının ve her kaynak dosyasının keşfedilen listede bulunmasını şart koşar,
yani bir testin kapı dışında kalması artık testi kırar.

## Geri alma

`package.json` içindeki `check` betiği eski `&&` zinciriyle değiştirilebilir;
`scripts/run-checks.mjs` ve `scripts/test-check-runner.mjs` silinir. Bu, kapıyı
ilk-hatada-duran ve elle bakım gerektiren eski davranışına döndürür.
