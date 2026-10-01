# Test Çalıştırma

Tek feature testleri:
`node scripts/test-settings-privacy-*.mjs`

Runner ile:
`node scripts/run-checks.mjs --filter=settings-privacy`

Runtime fixture testleri gerçek modülü Node altında import eder.

Source contract testleri index, service worker ve README uyumunu da kontrol eder.

Syntax runner public JavaScript dosyalarını `node --check` ile tarar.

Full repository check CI yoksa veya bu ortamda çalıştırılamıyorsa PR açıklamasında belirtilir.
