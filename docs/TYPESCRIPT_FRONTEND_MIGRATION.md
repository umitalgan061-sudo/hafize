# TypeScript Frontend Migration

## Amaç

Bu turda Hafize'nin aktif tarayıcı runtime'ı TypeScript + Vite canonical kaynaklarına taşındı. Amaç yalnız dosya uzantısını değiştirmek değil; development, production bundle, PWA ve legacy URL davranışını aynı kaynak zincirinde birleştirmektir.

## Canonical kaynak kuralı

- Yeni çalıştırılabilir browser kaynakları TypeScript'tir.
- public/typed mevcut modern TS kaynaklarını tutar.
- public/typed/legacy taşınan eski browser modüllerinin canonical TS kaynaklarını tutar.
- Root .js dosyaları yalnız compatibility bridge olarak kalır.
- Bridge dosyalarında uygulama mantığı, network çağrısı ve credential bulunmaz.
- Vite canonical TS kaynaklarını public/typed-build altında üretir.

## Migration kapsamı

Bu iş paketi sohbet composer, sohbet geçmişi, composer history, workspace navigation, connector hub, hands-free, screen share, Prompt Library genişletmeleri ve scheduled-task yardımcılarının canonical kaynaklarını TypeScript'e aldı.

Ana örnekler:

| Alan | Canonical TypeScript | Production bundle |
| --- | --- | --- |
| Composer | public/typed/legacy/chat-composer-features.ts | /typed-build/legacy-chat-composer-features.js |
| Chat history | public/typed/legacy/chat-history-management.ts | /typed-build/legacy-chat-history-management.js |
| Prompt Library | public/typed/legacy/prompt-library-*.ts | /typed-build/legacy-*.js |
| Scheduled tasks | public/typed/legacy/scheduled-task-*.ts | /typed-build/legacy-*.js |
| Connector hub | public/typed/legacy/connector-hub.ts | /typed-build/legacy-connector-hub.js |
| Workspace navigation | public/typed/legacy/workspace-navigation.ts | /typed-build/legacy-workspace-navigation.js |
| PWA service worker | public/sw.ts | /typed-build/sw.js |

## Vite keşfi

Vite public/typed/legacy klasörünü readdirSync ile otomatik keşfeder.

Yeni bir migration girdisi için Vite config içinde ayrı bir entry listesi yazmak gerekmez.

İsim kuralı:

foo.ts -> legacy-foo.js

Development transform aynı generated yolu tekrar canonical TS kaynağına çevirir.

## Development

Development sırasında index.html içindeki typed-build girişleri Vite plugin tarafından .ts kaynaklarına çevrilir.

Service worker root scope ile çalışır:

- development: /sw.ts
- production: /sw.js

Bu ayrım önemlidir. /typed/sw.ts gibi bir path kullanmak varsayılan olarak /typed/ scope üretir ve root uygulamayı kontrol etmez.

## Production

npm start önce npm run build çalıştırır.

Build sırası:

1. TypeScript typecheck.
2. Vite bundle.
3. Modern typed entries.
4. Dynamic legacy typed entries.
5. Typed service worker bundle.

server.ts dışarıdan beklenen /sw.js yolunu generated /typed-build/sw.js dosyasına bağlar.

Service worker dosyası no-cache sunulur; index.html de no-cache kalır.

## Compatibility bridge

Legacy root JavaScript yolları kaldırılmadı. Eski bookmark, cached HTML veya dış referanslar için ince bir bridge olarak tutulur.

Bridge sözleşmesi:

- /typed-build/legacy-...js import eder.
- 700 karakterden kısa kalır.
- Uygulama mantığı taşımaz.
- fetch, XMLHttpRequest ve WebSocket içermez.
- Authorization, Bearer, API key veya OAuth secret içermez.

## PWA

Service worker canonical kaynağı public/sw.ts dosyasıdır.

Policy canonical kaynağı public/sw-policy.ts dosyasıdır.

API istekleri network-only kalır.

Aynı origin shell GET istekleri cache politikasına girebilir.

Cache sürümü v51'e yükseltilmiştir.

Legacy public/sw-policy.js dosyası compatibility yüzeyidir; production registration için canonical bundle kullanılır.

## Güvenlik

Migration sırasında credential istemci bundle'ına taşınmaz.

Backend tokenları public/ altında kullanılmaz.

Browser bridge katmanı yalnız bundle import eder.

Service worker API response cache'lemez.

Public static serving path traversal guard'ı korunmuştur.

## Kalite kapısı

scripts/test-typescript-frontend-complete-wave.mjs şu sözleşmeleri denetler:

- Vite dynamic TypeScript entry discovery.
- Canonical service worker entry.
- Root scoped development registration.
- Production /sw.js mapping.
- Root JS bridge yapısı.
- Her bridge için canonical TS dosyasının varlığı.
- index.html içinde legacy JS'in doğrudan çalıştırılmaması.
- PWA compatibility dosyalarında credential sızıntısı olmaması.
- Dynamic legacy TS girişlerinin build ve index ile eşleşmesi.

Gate package.json içindeki check:modern akışına bağlıdır.

## Test katmanları

Statik migration gate dosya ağacını ve runtime wiring'i doğrular.

TypeScript compiler mevcut strict runtime sınırlarını doğrular.

Vitest typed-core testleri davranış sözleşmelerini doğrular.

Eski compatibility bridge testleri root URL geriye dönük uyumluluğunu doğrular.

Bu oturumda tam yerel npm check çalıştırılamadı; repository'de GitHub Actions workflow da bulunmadığı için PR description test durumunu ayrıca belirtir.

## Rollback

Bu migration tek PR revert ile geri alınabilir.

Geri alma sırası:

1. Dynamic Vite legacy entries kaldırılır.
2. index.html eski girişlere döndürülür.
3. server.ts /sw.js mapping kaldırılır.
4. public/sw.ts ve public/sw-policy.ts kaldırılır.
5. Root bridge dosyaları önceki canonical implementation'a döndürülür.

Local storage ve credential state migration tarafından silinmez.

## Sonraki teknik dalga

Backend tarafında TS karşılığı bulunmayan .mjs modülleri önce aktif kullanım açısından sınıflandırılmalıdır.

Yalnız aktif runtime veya dış API sözleşmesi olan modüller TypeScript'e taşınmalıdır.

Pasif legacy modülleri sırf uzantı değiştirmek için kopyalamak tercih edilmez.
