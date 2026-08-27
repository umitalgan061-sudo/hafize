# Hafize

Hafize yapay zeka uygulaması deposu.

## Geliştirme kontrolleri

| Komut | Ne yapar? |
| --- | --- |
| `npm start` | `server.mjs` üzerinden uygulamayı çalıştırır. |
| `npm run check` | Zorunlu gate: tüm kaynakların syntax kontrolü ve tüm `scripts/test-*.mjs` / `scripts/validate-*.mjs` doğrulamaları. |
| `npm run check:ui` | Yalnız istemci tarafı alt kümesi; hızlı geri bildirim içindir, gate'in yerine geçmez. |

Gate dosyaları elle listelemez, diskten keşfeder; yeni bir test dosyası eklemek onu kontrol kapsamına almak için yeterlidir. Ayrıntılar: [`docs/CHECK_GATE.md`](docs/CHECK_GATE.md).

## Geliştirme kuralları

Sürekli geliştirme akışı, tur bütçesi ve güvenlik sınırları [`HAFIZE_RULES.md`](HAFIZE_RULES.md) dosyasında tanımlıdır. Self-development değişiklikleri ayrı branch ve Pull Request üzerinden ilerler; doğrudan `main` üzerine merge edilmez.
