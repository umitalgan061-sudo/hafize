# Doğrulama kapısı (`npm run check`)

`scripts/run-checks.mjs` Hafize'nin tek doğrulama kapısıdır. Depoyu tarar, kaynak
dosyaların sözdizimini doğrular ve `scripts/test-*.mjs` altındaki tüm testleri
çalıştırır.

## Neden otomatik keşif

Kapı daha önce `package.json` içinde elle yazılmış tek satırlık uzun bir komut
zinciriydi. Yeni bir test dosyası eklendiğinde bu zincire eklenmesi unutulabiliyordu:
85 test dosyasının 33'ü hiçbir zaman çalıştırılmıyordu; bunların arasında OAuth,
PKCE, token şifreleme ve kişisel bellek gibi güvenlik sınırlarının testleri de vardı.
Otomatik keşif bu sessiz kapsam kaybını yapısal olarak imkânsız kılar.

## Kapsam

| Adım | Kapsam |
| --- | --- |
| Sözdizimi | `./*.mjs`, `lib/*.mjs`, `scripts/*.mjs`, `public/*.js` — her biri `node --check` ile |
| Registry | `scripts/validate-agent-registry.mjs` |
| Testler | `scripts/test-*.mjs` — alfabetik sırayla, her biri ayrı süreçte |

Sözdizimi kontrolleri paralel çalışır; testler deterministik sıra için art arda
çalıştırılır ve her testin süresi 120 saniye ile sınırlıdır.

## Kullanım

```bash
npm run check                      # tüm kapı
node scripts/run-checks.mjs oauth  # adı "oauth" içeren testler
node scripts/run-checks.mjs --list # çalıştırılacak testleri listele
```

Filtre argümanı yalnız yerel geliştirme kolaylığıdır; PR öncesi doğrulama her
zaman filtresiz tam kapı ile yapılır.

## Raporlama

Her dosya `PASS` veya `FAIL` olarak satır satır raporlanır. Başarısızlık varsa
çıkış kodu 1 olur ve başarısız olan her adımın tam çıktısı sonda tekrar basılır;
ilk hatada durulmadığı için tek turda tüm kırıklar görülür.

## Yeni test ekleme

Yeni testi `scripts/test-<konu>.mjs` olarak ekle. Kapıya kayıt gerekmez; keşif
otomatiktir. Testler dış ağ çağrısı yapmaz, secret okumaz ve gerçek bir servise
ihtiyaç duyan test (örneğin `test-redis-schedule-lease-live.mjs`) servis
yokken kendini atlamalıdır.
