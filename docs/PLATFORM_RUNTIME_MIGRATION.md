# Platform Runtime Migration

## Mevcut durum

Hafize frontend'inin önemli bölümleri TypeScript + Vite + Vitest toolchain'ine taşınmış durumdadır. Bu tur platform runtime ve çevresindeki yardımcı katmanları aynı typed build girişine alır.

## Migration kuralı

Legacy JS modülünü doğrudan silmek yerine önce aynı davranışı typed adapter ile kapsa. Build entry değiştirildikten sonra eski modül yalnızca artık hiç çağrılmıyorsa kaldırılır.

## Adapter modeli

Feature registry global controller'ları keşfeder. Adapter yeniden başlatmaz, yalnızca feature'ın varlığını ve lifecycle durumunu platform snapshot'ına taşır.

## Veri uyumu

Platform runtime mevcut conversation, prompt ve task storage anahtarlarını değiştirmez. Runtime metadata ayrı anahtarda tutulur.

## Build

Vite typed entry `platform-app.ts` üzerinden `app-runtime` bundle'ını üretir. Bu entry platform runtime, diagnostics, policy, event bus ve accessibility yardımcılarını import eder.

## Rollback

Vite entry eski `public/typed/app-runtime.ts` dosyasına döndürülür. Runtime storage anahtarı bilinmeyen bir metadata olarak kalabilir.

## Browser downgrade

TypeScript compile-time avantaj sağlar; çalışma zamanında feature detection kullanılmaya devam eder. Modern API olmayan browser'lar fallback alır.

## Test migration

Yeni modül contract testleri legacy smoke testlerinin yerine geçmez. İkisi bir süre birlikte çalıştırılmalıdır.

## Deprecation

Bir legacy dosya ancak:

- typed karşılığı production build'de yükleniyor,
- behavior parity testleri mevcut,
- browser smoke testi tamamlanmış,
- rollback prosedürü yazılı

olduğunda kaldırılmalıdır.
