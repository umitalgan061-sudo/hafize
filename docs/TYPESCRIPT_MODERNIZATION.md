# TypeScript-first modernizasyon

## Amaç

Hafize'nin mevcut vanilla JavaScript + Node ESM yapısını tek seferde kırmak yerine, üretim davranışını koruyan kademeli bir TypeScript-first mimariye taşımak.

Bu turda üç tekrar kullanılan browser modülü TypeScript'e geçirilmiştir:

- Prompt Library Smart Fill
- Prompt Library Command Palette
- Scheduled Task Countdown

Ayrıca ortak typed API sözleşmesi, resilient API client ve sistem sağlık yüzeyi eklenmiştir.

## Hedef platform

- Node.js 24 LTS ve üzeri
- TypeScript 6
- Vite 8.1
- Vitest 5
- native ESM
- browser platform API'leri

Node sürümü `package.json` içindeki `engines` alanında belirtilir. Uygulama runtime'ı için Node sunucusu korunur; Vite yalnızca browser build/development katmanına yeni bir sınır getirir.

## Neden tam rewrite yok?

`server.mts` üretim API boundary'sini, schedule worker'ı, connector runtime'larını ve auth guard'larını aynı anda değiştirmek yüksek regresyon riski taşır. Bu nedenle her migration adımı aynı davranışı koruyan küçük bir sınır oluşturur.

Her yeni typed modül:

1. mevcut davranışla aynı public sözleşmeyi korur,
2. TypeScript strict mode altında derlenir,
3. Vite tarafından optimize edilir,
4. bağımsız test edilebilir,
5. gerekirse tek dosya revert ile geri alınabilir.

## Kaynak yerleşimi

`public/typed/` yeni typed browser ortak kodunun evidir.

`public/*.ts` migration sırasında browser feature modüllerinin typed sürümleri için kullanılır.

`public/typed-build/` yalnızca üretim build çıktısıdır ve kaynak kod olarak düzenlenmez.

`src/` server veya domain sınırlarının sonraki migration'ları için ayrılmıştır.

## Build akışı

`npm run typecheck` TS derleyicisini emit olmadan çalıştırır.

`npm run build` önce typecheck yapar ve ardından Vite üretim bundle'ı oluşturur.

`npm start` öncesinde `prestart` otomatik olarak build çalıştırır. Böylece temiz bir checkout'tan sonra generated browser entry'leri bulunmadan sunucu açılmaz.

Development'ta Vite `/api` isteklerini mevcut Node runtime'a proxy eder. Typed entry URL'leri development sırasında `.ts` kaynağına dönüştürülür ve Vite HMR tarafından servis edilir.

## Runtime API client

`public/typed/hafize-api.ts` ortak HTTP sınırıdır.

Temel kurallar:

- timeout bounded'dır,
- transient HTTP hataları sınırlı retry kullanır,
- 4xx hataları tekrar denenmez,
- trace id header'ı korunur,
- upstream payload güvenilmeyen `unknown` olarak parse edilir,
- normalize edilmiş domain tipleri UI'a aktarılır.

UI kodu bundan sonra doğrudan `fetch('/api/...')` yerine typed client kullanmaya teşvik edilir.

## Sağlık yüzeyi

`public/typed/app-runtime.ts` API erişilebilirliği ve browser network durumunu tek bir `RuntimeSnapshot` içinde tutar.

Durumlar:

- `online`: browser online ve health endpoint hazır,
- `degraded`: network var ancak backend veya NVIDIA hazır değil,
- `offline`: browser network offline,
- `unknown`: henüz health kontrolü yapılmadı.

Panel secret, token veya credential göstermez. Yalnızca runtime kapasite bayraklarını gösterir.

## PWA

Generated typed entry'ler service worker shell cache içine açıkça eklenir. Cache sürümü her yeni generated asset boundary değişiminde artırılır.

API yolları network-only kalır. Runtime health verisi offline cache'e yazılmaz.

## Test stratejisi

Vitest browser modüllerinin pure helper ve API contract testlerini çalıştırır.

Repository'nin mevcut `scripts/run-checks.mjs` sistemi mevcut feature testlerini çalıştırmaya devam eder.

Modern migration için ikinci bir test katmanı bulunur:

- typed parsing tests,
- API retry/timeout/error tests,
- feature search tests,
- countdown edge-case tests.

Bir migration, yalnızca test dosyası yazıldığı için tamamlanmış sayılmaz. Build, runtime loading ve PWA asset sözleşmesi de doğrulanmalıdır.

## Güvenlik ilkeleri

TypeScript güvenlik kontrolü değildir. Güvenlik boundary'leri runtime'da kalır.

- Secret değerleri browser bundle'a taşınmaz.
- API client Authorization header eklemez.
- Health paneli yalnızca server'ın zaten public health yanıtındaki kapasite bayraklarını gösterir.
- Local prompt storage backend'e gönderilmez.
- Error detail UI'a sınırsız taşınmaz.

## Geri alma

Migration modülü ayrı bir generated entry olarak yüklenir. Sorun olması halinde ilgili HTML entry satırı ve source module birlikte revert edilebilir.

`server.mts` ile generated browser code arasında zorunlu bir runtime import bağı kurulmamıştır. Bu nedenle browser migration rollback'i backend deployment rollback'inden bağımsız tutulabilir.

## Sonraki migration sırası

En güvenli sıra browser tarafında tekrar kullanılan pure helpers, domain modelleri, state adapters ve API clients'tır. Daha sonra server domain modules, ardından `server.mts` composition root ve connector runtime'ları taşınabilir.

Her aşamada önce type surface, sonra implementation, sonra integration entry ve son olarak legacy JavaScript kaldırılmalıdır.

## Done kriteri

Bir modül migration-ready sayılır ancak şu koşullar birlikte sağlanırsa:

- strict TypeScript altında typecheck,
- üretim Vite bundle'ı,
- test coverage,
- mevcut public API davranışı korunmuş,
- legacy entry artık load edilmiyor,
- service worker shell güncel,
- rollback yolu dokümante edilmiş.
