# Prompt Library Doğrulama Matrisi

| Alan | Test | Beklenen sonuç |
| --- | --- | --- |
| Normalizasyon | boş body | kayıt reddedilir |
| Normalizasyon | uzun title | 100 karakter |
| Normalizasyon | uzun body | 8000 karakter |
| Etiket | duplicate | tekil değer |
| Değişken | duplicate | tekil değer |
| Değişken | invalid char | temizlenir |
| Koleksiyon | >120 | 120 kayıt |
| Arama | title | eşleşir |
| Arama | body | eşleşir |
| Arama | tag | eşleşir |
| Arama | variable | eşleşir |
| Favori | true | favorite filter gösterir |
| Sıralama | title | alfabetik |
| Sıralama | created | yeni önce |
| Sıralama | favorite | favori önce |
| Import | invalid JSON | mevcut veri korunur |
| Import | >1MB | reddedilir |
| Import | duplicate id | overwrite yok |
| Export | selected | seçili kayıtlar |
| Export | no selection | visible kayıtlar |
| Storage | read error | fallback |
| Storage | write error | status |
| DOM | untrusted title | textContent |
| DOM | untrusted body | textContent/value |
| Source | fetch | bulunmamalı |
| Source | WebSocket | bulunmamalı |
| PWA | core asset | shell'de |
| PWA | enhancement asset | shell'de |
| A11y | aria-label | mevcut |
| A11y | focus-visible | mevcut |
| Lifecycle | duplicate mount | engellenir |
| Lifecycle | destroy | observer/listener temizlenir |
| Starter | boş storage | 10 kayıt |
| Starter | dolu storage | duplicate seed yok |
| Starter | restore | eksikler eklenir |
| Composer | Kullan | auto-send yok |
| Clipboard | success | status gösterilir |
| Clipboard | failure | güvenli fallback |
| Mobile | 700px | toolbar tek kolon |
| Reduced motion | prefers | özel animasyon yok |
| Forced colors | active | görünür border/focus |

`npm run check` repository genelinde `test-*.mjs` paketlerini otomatik keşfeder. Prompt Library testleri de aynı mekanizmaya bağlıdır.
