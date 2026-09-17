# Hafize — teknoloji tabanı (17 Eylül 2026)

Bu not, bu geliştirme turunda kullanılan güncel üretim tabanını kayıt altına alır.

## Runtime

- Node.js 24.21.x LTS hattı üretim için sabit tabandır.
- Node 24.12 ile yerleşik TypeScript type-stripping kararlı hale gelmiştir; runtime tarafında yalnızca silinebilir TypeScript sözdizimi kullanılmalıdır.
- TypeScript'in Node runtime tarafından okunması, `tsconfig.json` seçeneklerinin runtime'da uygulanacağı anlamına gelmez; tip doğrulaması ayrıca `tsc` ile yapılır.

## Toolchain

- TypeScript 7.0.x native compiler hattı hedeflenir.
- Vite 8.3.x modern bundler hattıdır.
- Vitest 5.x test hattıdır.
- ESM ve strict TypeScript, yeni kodun varsayılanıdır.

## Geçiş kuralı

Legacy `.mjs` ve browser `.js` yüzeyleri tek seferde toplu rename edilmez. Her turda tek bir bounded alan TypeScript'e taşınır, davranış sözleşmesi korunur ve eski giriş noktası yalnızca güvenli bir compatibility bridge olarak tutulur.

## Doğrulama

Toolchain sürümleri package.json'da pinlenir ve `scripts/test-modern-toolchain.mjs` ile kaynak sözleşmesi doğrulanır. Node runtime ile çalışan `.ts` dosyaları için `erasableSyntaxOnly` ve explicit type-only imports tercih edilir.
