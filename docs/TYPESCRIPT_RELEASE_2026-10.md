# TypeScript Release Baseline — 2026-10

## Source of truth

Hafize production server entrypoint'i server.ts'dir. Browser production entrypoint'leri TypeScript kaynaklarından Vite ile typed-build çıktısına dönüştürülür.

Toolchain:

- Node.js 24.21+ LTS
- TypeScript 7.0.2
- Vite 8.3.0
- Vitest 5.0.1

## Build

Production build typecheck ile başlar:

tsc --noEmit && vite build

Runtime typecheck:

tsc --noEmit -p tsconfig.runtime.json

Modern quality gate:

npm run check:modern

## Browser policy

HTML source legacy application JS dosyalarını doğrudan yüklemez. Generated module entry'ler type="module" ile yüklenir.

Service worker source of truth public/sw-policy.ts ve public/sw.ts dosyalarıdır. Current shell cache v55'tir ve generation-control.css içerir.

## Legacy sınırı

Kalan lib .mjs dosyalarının önemli bölümü test/tooling uyumluluk sınırıdır. Production server path bunlara import vermez.

Browser tarafındaki altı obsolete bridge bu migration dalgasında kaldırılmıştır. Böylece production browser source ağacında aynı işlevin JS ve TS ikinci kopyaları tutulmaz.

## Security parity

Migration aşağıdaki sınırları azaltmamalıdır:

- session auth ve CSRF,
- deny-by-default tool authorization,
- credential redaction,
- bounded request/stream size,
- rate limit,
- request/trace id,
- safe DOM rendering.

## Release gates

Migration release scriptleri TypeScript'e taşındı:

scripts/test-typescript-entrypoints-release.ts

scripts/test-typescript-ui-wave.ts

scripts/test-legacy-entry-contract.ts

Generation control ayrıca:

public/typed/generation-control.test.ts

ile unit test edilir; script seviyesinde contract/security/accessibility/PWA kontrolleri de bulunur.

## Rollback

Release sorunu oluşursa önce generation-control importu ve app-shell wiring'i geri alınır. Conversation schema değiştirilmediği için kullanıcı sohbetleri bu migration'dan bağımsızdır.
