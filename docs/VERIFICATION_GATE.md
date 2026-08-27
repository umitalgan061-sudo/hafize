# Doğrulama kapısı (`npm run check`)

## Neden değişti

Kapı önceden `package.json` içinde elle yazılmış tek bir `&&` zinciriydi. Bu iki
yapısal soruna yol açtı:

1. **Sessiz kapsam boşluğu.** Yeni bir test dosyası zincire elle eklenmediğinde
   hiç çalışmıyordu. Ölçüldüğünde `scripts/` altındaki 85 test dosyasının 33'ü
   kapının dışındaydı — aralarında OAuth PKCE, token şifreleme, token dosya
   deposu ve Google/Canva token exchange gibi tamamı güvenlik sınırı olan
   testler vardı.
2. **İlk hatada durma.** `&&` zinciri ilk kırmızı hedefte kesildiğinden,
   arkasındaki yaklaşık 60 hedef hiç çalışmıyordu. Kapı "kırmızı" derken
   aslında yalnızca *ilk* sorunu gösteriyor, geri kalanını gizliyordu.

Depo bu haldeyken `main` üzerinde kapı zaten kırmızıydı ve arkasında ikinci bir
gerçek hata saklıydı (aşağıya bakınız).

## Yeni davranış

`scripts/run-checks.mjs` hedefleri dosya sisteminden **keşfeder**:

- sözdizimi hedefleri: `server.mjs`, `lib/*.mjs`, `scripts/*.mjs`, `public/*.js`
  → her biri `node --check` ile;
- test hedefleri: `scripts/validate-agent-registry.mjs` ve `scripts/test-*.mjs`
  → her biri ayrı süreçte çalıştırılır.

Kapı **ilk hatada durmaz**. Tüm hedefleri çalıştırır, her hedef için `ok`/`FAIL`
satırı basar, başarısızlıkların tam çıktısını sonda toplu olarak raporlar ve
en az bir hedef kırmızıysa `1` ile çıkar.

Yeni bir `lib/` modülü veya `scripts/test-*.mjs` dosyası eklendiğinde kapıya
elle kayıt gerekmez; keşif onu kendiliğinden kapsar.

### Kullanım

| Komut | Ne yapar |
| --- | --- |
| `npm run check` | Tüm hedefleri çalıştırır (tam kapı). |
| `npm run check:list` | Hedefleri çalıştırmadan listeler. |
| `npm run precheck` | Yalnız frontend/erişilebilirlik alt kümesi. |
| `node scripts/run-checks.mjs --only=<parça>` | Adı eşleşen hedefleri çalıştırır. |
| `node scripts/run-checks.mjs --jobs=<n>` | Paralel süreç sayısı (varsayılan 4). |

Güvenlik davranışları:

- `--only` hiçbir hedefle eşleşmezse kapı **yeşile dönmez**; `NO_TARGETS` ile
  kırmızı çıkar. Böylece yazım hatası olan bir filtre "her şey geçti" gibi
  görünemez.
- Bilinmeyen argüman sessizce yok sayılmaz, hata verir.
- Her hedefin 120 saniye zaman aşımı vardır; asılı kalan bir test kapıyı
  süresiz bekletmez.
- Sonuçlar paralel çalışsa da keşif sırasına göre raporlanır.

Kapının kendi davranışı `scripts/test-run-checks.mjs` içinde geçici bir fixture
kökü üzerinde test edilir; bu yüzden kapı kendini özyinelemeli tetiklemez.

## Kapının gizlediği ve bu turda düzeltilen iki gerçek hata

1. **`lib/gmail-read-client.mjs` — `read(null)` ham `TypeError` üretiyordu.**
   `async function read({ ownerId, ... } = {})` varsayılanı yalnız `undefined`
   için devreye girer; `null` çağrısı sözleşme hatası yerine destructure
   `TypeError`'ına düşüyordu. Sınır artık girdiyi `strictObject` ile doğrular ve
   her geçersiz girdi için `INVALID_GMAIL_READ:*` üretir. Beklenmeyen alan
   içeren istekler de reddedilir.
2. **`scripts/test-tool-runtime.mjs` — bayat araç listesi.** `listToolPermissions()`
   için yazılmış tam eşleşme listesi, `canva_read` ve `gmail_read` araçları
   eklendiğinde güncellenmemişti. Liste bilerek tam eşleşmedir: modelin gördüğü
   araç kümesi bir güvenlik sınırıdır ve yanlışlıkla genişlemesi kırmızıya
   düşmelidir. Liste mevcut kayıtlı araçlarla eşitlendi, katılığı korundu.

Aynı `null` destructure hatası `lib/canva-read-client.mjs` içinde de mevcuttu
(henüz bir test onu yakalamamıştı); aynı biçimde düzeltildi ve her iki istemcinin
testine `null`, `{}` ve beklenmeyen alan girdileri eklendi.

## Geri alma

`package.json` içindeki `check` / `precheck` betikleri eski `&&` zincirine
döndürülür ve `scripts/run-checks.mjs` ile `scripts/test-run-checks.mjs`
silinir. `lib/` düzeltmeleri ve test eklemeleri bağımsızdır; kapı geri alınsa
bile ayrı ayrı korunabilir.
