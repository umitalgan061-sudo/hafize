# Doğrulama kapısı (`npm run check`)

## Neden değişti

Kapı daha önce `package.json` içinde elle tutulan tek satırlık uzun bir
`&&` zinciriydi. Yeni bir modül veya test eklendiğinde bu zincire elle
eklenmesi gerekiyordu ve bu adım atlandığında kimse fark etmiyordu.

Sonuç ölçüldüğünde depodaki 85 testten **32'si hiç çalışmıyordu**; bunların
arasında OAuth, PKCE, token şifreleme, token dosya deposu ve personal memory
gibi deponun en yüksek riskli güvenlik yüzeyleri vardı.

Bu sessiz boşluk iki gerçek hatayı gizlemişti:

1. `scripts/test-tool-runtime.mjs` araç kataloğunun tam listesini doğruluyordu
   ama `canva_read` ve `gmail_read` eklendiğinde güncellenmemişti; kapı zaten
   ilk hatada durduğu için bu kırık test `main` üzerinde kırmızıydı.
2. `lib/gmail-read-client.mjs` ve `lib/canva-read-client.mjs` içindeki
   `read()` fonksiyonları `null` istek aldığında doğrulama sınırının
   `INVALID_*_READ` sözleşmesi yerine ham bir `TypeError` fırlatıyordu.
   Varsayılan parametre (`= {}`) yalnızca `undefined` için devreye girdiğinden
   `null` doğrudan destructuring'e ulaşıyordu.

## Nasıl çalışıyor

`scripts/run-checks.mjs` kontrol hedeflerini elle tutulan bir listeden değil,
depo içeriğinden keşfeder:

- **Sözdizimi:** `server.mjs`, tüm `lib/*.mjs`, tüm `scripts/*.mjs` ve tüm
  `public/*.js` dosyaları için `node --check`.
- **Registry:** `scripts/validate-agent-registry.mjs`.
- **Testler:** `scripts/test-*.mjs` dosyalarının tamamı.

Yeni bir modül veya test eklendiğinde kapı kendiliğinden genişler; ayrıca bir
yere kaydedilmesi gerekmez.

## İstisnalar

Yalnızca gerçek bir dış servis gerektiren testler `EXCLUDED_TESTS` içinde
tutulur ve her istisna gerekçesini taşımak zorundadır. Bugün tek istisna
canlı Redis sunucusu gerektiren `test-redis-schedule-lease-live.mjs`'dir.

## Başarısızlık davranışı

Kapı ilk hatada durmaz; tüm hedefleri çalıştırır ve sonunda başarısız olan
her kontrolü tam çıktısıyla raporlayıp `1` ile çıkar. Böylece tek bir kırık
test arkasında başka hatalar gizlenmez.

## Kendi kendini doğrulama

`scripts/test-check-gate.mjs` kapının kapsamını korur:

- her `scripts/test-*.mjs` ya çalıştırılır ya da gerekçeli istisnadır;
- her istisna gerçekten mevcut bir dosyayı ve anlamlı bir gerekçeyi gösterir;
- `server.mjs`, tüm `lib/`, `scripts/` ve `public/` dosyaları sözdizimi
  kontrolündedir;
- `package.json` tek kapıyı çağırır ve elle tutulan paralel bir liste
  (`precheck`) geri gelmez.

`precheck` kaldırıldı: npm onu `check` öncesinde otomatik çalıştırdığı için
aynı testler iki kez koşuyordu ve ikinci bir elle tutulan liste oluşturuyordu.

## Geri alma

`package.json` içindeki `check` alanını eski `&&` zincirine döndürmek ve
`scripts/run-checks.mjs` ile `scripts/test-check-gate.mjs` dosyalarını
silmek yeterlidir; ürün kodu değişiklikleri (read client `null` düzeltmesi)
bağımsız olarak korunabilir.
