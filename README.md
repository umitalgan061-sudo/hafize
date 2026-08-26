# Hafize

Hafize kişisel yapay zekâ çalışma alanı: Claude-benzeri sade bir sohbet
arayüzü, NVIDIA NIM model yönlendirmesi, araç çağırma, bulutta çalışan
zamanlanmış ajan görevleri ve kullanıcı izniyle bağlanan GitHub / Google /
Gmail / Canva connector'ları.

Geliştirme kuralları ve tur akışı için: [`HAFIZE_RULES.md`](HAFIZE_RULES.md).

## Çalıştırma

```bash
npm install
npm start            # varsayılan: http://127.0.0.1:4173 (PORT ile değiştirilir)
```

Sunucu anahtarsız da açılır; yapılandırılmamış entegrasyonlar `/api/health`
çıktısında `false` olarak raporlanır ve ilgili araçlar kapalı kalır.

## Doğrulama

```bash
npm run check                              # tam kapı: sözdizimi + tüm testler
npm run precheck                           # yalnızca tarayıcı/UI testleri
node scripts/run-checks.mjs --filter=gmail # ada göre daraltılmış seçim
```

Kapı test dosyalarını diskten keşfeder; `scripts/test-*.mjs` altına eklenen
yeni bir dosya ayrıca kaydedilmeden çalışır. Ayrıntı:
[`docs/CHECK_GATE.md`](docs/CHECK_GATE.md).

## Depo düzeni

| Yol | İçerik |
| --- | --- |
| `server.mjs` | HTTP sunucusu, sohbet/akış uçları, statik dosya servisi |
| `lib/` | Sunucu tarafı modüller: ajan çalışma zamanı, araç sınırları, OAuth, zamanlama, bellek |
| `public/` | İstemci arayüzü, PWA manifesti ve service worker |
| `agents/registry.json` | Ajan tanımları ve araç izinleri |
| `scripts/` | Doğrulama kapısı ve test paketi |
| `docs/` | Modül sözleşmeleri ve güvenlik sınırı belgeleri |

## Güvenlik

API anahtarları ve OAuth secret'ları yalnızca backend ortam değişkenlerinden
okunur; `public/` altına, istemci JavaScript'ine veya depoya hiçbir zaman
yazılmaz. Dış servislerde yazma/silme işlemleri açık kullanıcı onayı gerektirir.
Sınır kuralları [`HAFIZE_RULES.md`](HAFIZE_RULES.md) ve `docs/` altındaki
`*_SECURITY.md` / `*_CONTRACT.md` belgelerinde tanımlıdır.
