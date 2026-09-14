# Chat Markdown Test Çalıştırma Sırası

## Hızlı kapı

Önce `node scripts/test-chat-markdown.mjs` çalıştırılır. Ardından güvenlik, bounds, links, rendering ve PWA sözleşmeleri çalıştırılır.

## Parser katmanı

`test-chat-markdown.mjs`, `golden`, `headings`, `lists`, `inline`, `fences`, `tables`, `structured`, `normalization`, `empty-and-fallback` ve `edge-cases` testleri parser'ın normal ve sınır davranışlarını kapsar.

## Güvenlik katmanı

`security`, `malicious`, `malicious` corpus, `network`, `review-contract`, `ownership`, `no-regression` ve `export-safety` testleri renderer'ın yeni bir yetki yüzeyi açmadığını doğrular. Link allowlist ayrıca dedicated URL tests ile kilitlenir.

## Runtime katmanı

`stream`, `observer`, `batching` ve `lifecycle` testleri MutationObserver'ın source equality, re-entrancy ve disconnect sözleşmesini doğrular.

## UI katmanı

`rendering`, `a11y`, `copy` ve CSS source testleri code block, table, link focus ve Clipboard davranışını doğrular. Mobile/reduced-motion/forced-colors seçimleri source contract ile korunur.

## PWA katmanı

`pwa`, `pwa-contract` ve `integration` testleri index assetleri, shell cache inclusion ve `/api/*` network-only politikasını kontrol eder.

## Dokümantasyon

`documentation` ve `quick-reference` testleri kritik sözleşmelerin kullanıcı/bakım dokümanlarında görünür kalmasını sağlar.

## Tam kapı

Repository'nin genel `npm run precheck` ve `npm run check` komutları en son çalıştırılır. Bu turda yerel checkout erişimi olmadan bu komutların çalıştırıldığı iddia edilmemelidir. Hosted CI sonucu varsa PR exact head ile ilişkilendirilmelidir.

## Başarı kriteri

Her testin exit 0 olması, merge öncesi PR head'in beklenen güvenlik ve PWA invariants'ını taşıması ve toplam turn diff'inin 3000 değişen satırı aşmaması gerekir.
