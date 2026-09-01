# Hafize kontrol kapısı

Tek komut: `npm run check` → `node scripts/run-checks.mjs`.

## Neden otomatik keşif

Kapı daha önce `package.json` içinde elle yazılmış tek satırlık uzun bir zincirdi. Yeni bir modül veya test eklendiğinde bu zincire eklenmeyi unutmak sessiz bir kapsam kaybı üretiyordu: `test-canva-read-client.mjs`, `test-oauth-*`, `test-personal-memory-runtime.mjs` gibi 30'dan fazla test hiç çalışmıyordu ve bu yüzden iki gerçek hata (`read(null)` üzerinde TypeError, eskimiş tool katalog beklentisi) fark edilmeden kaldı.

Runner artık dosya sisteminden keşif yapar; listeyi güncel tutmak için ayrı bir adım yoktur.

## Runner ne yapar

1. **Syntax kontrolü** — `server.mjs`, `lib/*.mjs`, `scripts/*.mjs` ve `public/*.js` için `node --check`.
2. **Registry doğrulaması** — `scripts/validate-agent-registry.mjs`.
3. **Testler** — `scripts/test-*.mjs` dosyalarının tamamı, alfabetik sırada, her biri ayrı Node sürecinde.

İlk hatada durmaz; tüm kontroller çalışır, başarısız olanların çıktısı sonda toplu gösterilir ve çıkış kodu `1` olur.

## Canlı servis gerektiren testler

Dış bir servise gerçekten bağlanan testler varsayılan kapıda çalışmaz, `skip` satırıyla raporlanır ve yalnız açık opt-in ile çalışır:

| Test | Değişken |
| --- | --- |
| `scripts/test-redis-schedule-lease-live.mjs` | `HAFIZE_LIVE_REDIS=1` |

Yeni bir canlı test eklenirse `scripts/run-checks.mjs` içindeki `LIVE_ONLY_TESTS` tablosuna kendi ortam değişkeniyle eklenir. Kapıya alınmayan başka bir test kategorisi yoktur; `scripts/test-*.mjs` adlandırmasına uyan her dosya otomatik çalışır.

## Yeni test eklerken

- Dosya adı `scripts/test-<konu>.mjs` olmalıdır.
- Test kendi kendine yeter: ağ, gerçek kimlik bilgisi veya kalıcı dış durum gerektirmez; sahte (`fake`) istemcilerle çalışır.
- Başarıda son satır kısa bir özet yazar; runner bu satırı `ok` raporunda gösterir.
- Başarısızlıkta süreç sıfırdan farklı kodla çıkar (`node:assert` yeterlidir).
