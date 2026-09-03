# Doğrulama kapısı (`npm run check`)

## Neden değişti

Kapı önceden `package.json` içinde elle yazılmış tek satırlık bir `&&` zinciriydi.
Zincir elle bakıldığı için depo büyüdükçe geride kaldı:

- 85 test dosyasının 33'ü hiç çalıştırılmıyordu (Canva/Google OAuth, PKCE, token
  store, personal memory runtime, hands-free, screen-share ve device bridge
  testlerinin tamamı dahil);
- 27 `lib/` modülü ve 2 `public/` dosyası hiç syntax kontrolünden geçmiyordu;
- zincir `&&` ile bağlı olduğu için ilk başarısızlıkta duruyor, arkasındaki
  hataları gizliyordu.

Bu boşluk teorik değildi: kapı kırmızıyken arkasında iki gerçek hata birikmişti
(aşağıya bakınız).

## Yeni davranış

`npm run check` artık `scripts/run-checks.mjs` çalıştırıcısını çağırır. Çalıştırıcı
kontrol edilecek dosyaları elle yazılmış listeden değil dosya sisteminden keşfeder:

| Kategori | Keşif kuralı | Çalıştırma |
| --- | --- | --- |
| `syntax` | `server.mjs`, `lib/*.mjs`, `scripts/*.mjs`, `public/*.js` | `node --check <dosya>` |
| `validate` | `scripts/validate-*.mjs` | `node <dosya>` |
| `test` | `scripts/test-*.mjs` | `node <dosya>` |

Kurallar:

- **Sessiz atlama yoktur.** Yeni bir `lib/` modülü veya yeni bir `scripts/test-*.mjs`
  dosyası eklendiğinde kapı kendiliğinden genişler; `package.json` düzenlemek gerekmez.
- **İlk hatada durulmaz.** Tüm hedefler çalıştırılır, başarısızlıkların hepsi
  çıktının sonunda tam çıktısıyla raporlanır ve süreç `1` ile çıkar.
- **Kilitlenme kapıyı asmaz.** Her hedefin varsayılan 180 sn zaman aşımı vardır;
  aşan hedef `TIMEOUT` olarak başarısız sayılır.
- **Keşif deterministiktir.** Sıralama sabittir, tekrar üretilmez, eksik dizin
  (örneğin `public/` yoksa) keşfi çökertmez.
- Hedefler sınırlı eşzamanlılıkla (varsayılan 4) çalışır; kapı seri zincire göre
  belirgin biçimde hızlıdır.

Çalıştırıcının kendisi `scripts/test-check-runner.mjs` ile test edilir. Bu test
gerçek depo üzerinde keşif sözleşmesini, geçici bir fixture dizininde ise
başarısız test / bozuk syntax / başarısız doğrulayıcı / asılı test davranışlarını
doğrular.

## Kapının arkasında birikmiş iki gerçek hata

### 1. `lib/gmail-read-client.mjs` — `null` girdide fail-closed değildi

`read({ ownerId, operation, params } = {})` imzasındaki varsayılan değer yalnızca
`undefined` için devreye girer. `read(null)` çağrısı sözleşmeye ait
`INVALID_GMAIL_READ:*` hatası yerine ham bir `TypeError` fırlatıyordu; yani
sınır girdi doğrulamasına hiç girmeden çöküyordu.

Düzeltme: girdi önce `strictObject` ile doğrulanır. Böylece `null`, dizi,
skaler ve bilinmeyen alan içeren tüm girdiler diğer geçersiz girdilerle aynı
`INVALID_GMAIL_READ` sözleşmesine düşer.

### 2. `scripts/test-tool-runtime.mjs` — bayat izin beklentisi

Test, `listToolPermissions()` çıktısının yalnızca üç aracı (`runtime_status`,
`agent_delegate`, `github_read_file`) içermesini bekliyordu. Canva ve Gmail
salt-okunur araçları sonradan kaydedildiği için beklenti bayatlamıştı ve kapı
buradan kırmızıya düşüyordu.

Düzeltme: beklenti, kayıtlı gerçek araç kümesini (`canva_read`, `gmail_read`
dahil) yansıtacak şekilde güncellendi. Bu test hâlâ bir güvenlik kontrolüdür:
listedeki her araç izin adıyla eşleşmek zorundadır, bu yüzden yeni bir aracın
izinsiz sızması testi kırar.

## Nasıl çalıştırılır

```bash
npm run check            # tüm kapı
npm run check:registry   # yalnız ajan kayıt defteri doğrulaması
```

Canlı Redis testi (`scripts/test-redis-schedule-lease-live.mjs`) `HAFIZE_TEST_REDIS_URL`
tanımlı değilse kendini atlar; kapı bu durumda da yeşil kalır.

## Geri alma

`package.json` içindeki `check` script'i eski zincire döndürülüp
`scripts/run-checks.mjs` ile `scripts/test-check-runner.mjs` silinebilir. Bu
durumda yukarıdaki iki hata düzeltmesi bağımsızdır ve korunabilir.
