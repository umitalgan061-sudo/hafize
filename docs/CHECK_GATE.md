# Doğrulama Kapısı (check gate)

## Sorun

Kapı, `package.json` içinde elle bakımı yapılan tek satırlık dev bir
`node --check ... && node scripts/test-... && ...` zinciriydi. Bu iki somut
soruna yol açtı:

1. **Sapma.** Yeni bir `scripts/test-*.mjs` eklendiğinde zincire eklenmeyi
   unutmak sessizce kapsam kaybı üretiyordu; 86 test dosyasının 32'si hiç
   koşmuyordu (Canva/Google OAuth, token store, personal memory, screen share,
   hands-free testlerinin tamamı dahil).
2. **Erken duruş.** `&&` zinciri ilk hatada duruyordu, bu yüzden bir tek
   kırık test kendisinden sonraki tüm adımları görünmez kılıyordu.

## Çözüm

`scripts/run-checks.mjs` kapıyı dosya keşfiyle kurar:

- **Syntax adımları:** `server.mjs`, `lib/**/*.mjs`, `public/**/*.js`,
  `scripts/**/*.mjs` için `node --check`.
- **Test adımları:** `scripts/test-*.mjs` (alfabetik) + `EXTRA_TEST_SCRIPTS`
  listesindeki `scripts/validate-agent-registry.mjs`.

Yeni bir kaynak veya test dosyası eklemek kapıyı otomatik genişletir; ayrıca
`package.json` düzenlemek gerekmez.

## Davranış

- Kapı **ilk hatada durmaz**; tüm adımları koşar ve sonunda başarısız adımların
  listesini, her birinin tam çıktısıyla birlikte raporlar.
- Adım başına 120 sn timeout vardır; asılı kalan bir test kapıyı kilitlemez.
- Çıkış kodu: hepsi geçtiyse 0, en az bir adım başarısızsa 1.

## Komutlar

| Komut | Kapsam |
| --- | --- |
| `npm run check` | `precheck` (syntax) + tüm testler — tam kapı |
| `npm run precheck` | yalnızca `node --check` adımları (hızlı) |
| `npm run check:all` | tek süreçte syntax + testler |
| `npm run check:list` | koşulacak adımları listeler, hiçbirini çalıştırmaz |
| `node scripts/run-checks.mjs --filter=gmail` | yol parçasına göre daraltılmış koşu |

`npm run check` npm yaşam döngüsü sayesinde önce `precheck`'i çalıştırır; bu
sıra syntax hatalarında hızlı başarısızlık sağlar ve iki komut arasında
tekrarlı iş yapılmaz.

## Sapma koruması

`scripts/test-run-checks.mjs` keşif sözleşmesini kilitler:

- diskteki her `scripts/test-*.mjs` kapı adımları arasında bulunmalıdır,
- `lib/*.mjs`, `public/*.js`, `scripts/*.mjs` ve `server.mjs` syntax adımları
  arasında bulunmalıdır,
- aynı dosya iki kez koşmamalı ve syntax adımları kararlı sırada olmalıdır,
- bayrak ayrıştırma (`--list`, `--filter=`, `--syntax-only`, `--tests-only`)
  ve çelişkili bayrak reddi doğrulanır.

Bu test kapının kendi içinde koştuğu için, kapı kapsamını daraltan bir
değişiklik kapının kendisi tarafından yakalanır.

## Geri alma

`package.json` içindeki `scripts` bloğu eski zincire döndürülür ve
`scripts/run-checks.mjs` ile `scripts/test-run-checks.mjs` silinir. Kapı
mantığı tek dosyada toplandığı için geri alma tek commit'lik bir işlemdir.
