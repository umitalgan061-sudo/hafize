# Kalite kapısı bütünlüğü

Hafize'nin tek otomatik güvenlik ağı `npm run precheck` ve `npm run check` zinciridir.
Depoda `.github/workflows/` bulunmadığı için bu iki komut dışında hiçbir yerde test
çalıştırılmaz. Kapı kırmızıysa veya bir test kapıya bağlı değilse regresyon fark edilmez.

Bu belge, kapının kendi bütünlüğünü koruyan iki sözleşmeyi tanımlar.

## 1. Kapsam sözleşmesi — `scripts/test-check-gate-coverage.mjs`

`scripts/` altındaki her `test-*.mjs` dosyası `precheck` veya `check` zincirinde
**çalıştırılmak** zorundadır. Yalnızca `node --check` ile sözdizimi taranması yeterli
değildir; sözdizimi geçerli ama başarısız olan bir test bu şekilde sessizce atlanır.

Koruma ayrıca şunları doğrular:

- zincirdeki her `scripts/test-*.mjs` referansı gerçekten var olan bir dosyayı gösterir
  (silinmiş bir dosyaya yapılan referans, ilk adımda çökerek geri kalan tüm testleri atlatır);
- kapsam korumasının ve agent registry doğrulamasının kendisi de zincirde çalışır;
- zincir `||`, `; true` veya `; exit 0` gibi çıkış kodunu maskeleyen bir dallanma içermez.

Yeni bir test eklendiğinde `package.json` içindeki zincire de eklenir; aksi halde bu
koruma aynı turda hata verir.

`scripts/test-redis-schedule-lease-live.mjs` zincire dahildir ancak
`HAFIZE_TEST_REDIS_URL` tanımlı değilse kendini atlar; canlı Redis bağımlılığı
kapıyı kırmaz.

## 2. Tool catalog sözleşmesi — `scripts/test-tool-catalog-contract.mjs`

`lib/tool-runtime.mjs` içindeki tool catalog, modele sunulan tek araç yüzeyidir.
Tek tek araçların davranış testleri kendi dosyalarında kalır; bu koruma catalog'un
tamamına uygulanan güvenlik değişmezlerini doğrular ve yeni kaydedilen bir aracı
otomatik olarak kapsar:

- her araç benzersiz bir izin ve benzersiz bir fonksiyon adı taşır;
- hiçbir araç `secret.read`, `repo.delete`, `repo.merge`, `repo.write_branch`,
  `external.write` veya `external.send` izni altında kaydedilemez — bu izinler
  yalnızca açık kullanıcı onayı yolundan geçer;
- her aracın `running` / `success` / `failure` durumları için kullanıcıya görünen
  etiketi vardır ve bu etiketler araç sonucundan repo adı, dosya yolu, hata kodu
  veya token sızdırmaz;
- araç tanımları `additionalProperties: false` kullanır ve `ownerId`, `accessToken`,
  `refreshToken`, `apiKey` gibi kimlik alanlarını model şemasında taşımaz;
- `default: deny` politikalı, açıkça reddeden ve onay bekleyen ajanlar hiçbir aracı
  ne listede görür ne de yürütebilir;
- bozuk argümanlar yürütmeye ulaşmadan `INVALID_TOOL_ARGUMENTS` ile reddedilir;
- kayıtlı olmayan bir isim `UNKNOWN_TOOL` döndürür ve public activity üretmez.

`createMaximalContext()` her aracın `available()` koşulunu karşılar. Yeni bir araç
yeni bir context anahtarı gerektiriyorsa bu fonksiyon bilinçli olarak güncellenir;
güncellenmezse görünürlük kontrolü hata verir.

## Bakım notu

Her iki koruma da yalnızca değişmezleri okur; ürün davranışını değiştirmez.
Geri alma yolu, ilgili test dosyasını silmek ve `package.json` zincirinden
referansını çıkarmaktır.
