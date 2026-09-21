GitHub çalışma alanı test matrisi

## Kaynak testleri

Reader export'ları, action isimleri ve normalize sözleşmeleri doğrulanır. Sunucu route'ları doğru reader'a bağlanır.

## Güvenlik testleri

Allowlist, GET-only, token absence, credential-aware file read, traversal denial, sensitive path denial ve protected path kontrolleri zorunludur.

## UI testleri

Kart başlığı, tüm görünüm kontrolleri, aria-labelledby, aria-live, aria-pressed, focus-visible ve innerHTML kullanılmaması kontrol edilir.

## PWA testleri

CSS ve typed-build entrypoint'leri index.html, Vite ve service worker ile aynı isimde olmalıdır. GitHub API yolları network-only kalmalıdır.

## Runtime unit testleri

lib/github-workspace.test.ts repository, allowlist, branches, commits, pulls, file, malformed input ve upstream failure davranışlarını test eder.

lib/github-workspace-extra.test.ts directory filtering, traversal, compare, compare bounds ve upstream failuresı test eder.

## Manuel smoke

Repository alanına test allowlistindeki bir repository girilir. Repo, Branch, Commit, PR ve Dosya görünümü ayrı ayrı yüklenir. Ardından Dizin ve Compare akışları denenir.

## Responsive

700px altında kontrol düğmeleri satır yapısına geçmelidir. Forced colors modunda alan ve sonuç border'ları görünür kalmalıdır. Reduced motion modunda ek animasyon varsayılmamalıdır.

## Negatif senaryolar

Allowlist dışı repo, ../path, boş path, aynı base/head, bozuk JSON response, 403 upstream, 500 upstream ve GitHub bağlantısının yapılandırılmaması test edilir.

## Release gate

Reader testleri, UI source testleri, PWA wiring testi, security testi ve documentation contract testi geçmeden PR merge edilmemelidir. Tam npm check çalıştırılamıyorsa PR açıklamasında açıkça belirtilir.
