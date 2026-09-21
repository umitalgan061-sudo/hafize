# TypeScript giriş noktaları

Bu tur, Hafize'nin server ve browser uygulama girişlerini JavaScript yerine TypeScript-first çalışma modeline taşıyan migration paketidir.

## Amaç

Migration'ın hedefi yalnızca dosya uzantısını değiştirmek değildir. Kaynak kodun gerçek giriş noktası tekilleştirilir, Vite typed-build üretimini kullanır, production komutu aynı TS kaynağını çalıştırır ve service worker yalnızca üretilen artifact'ları cache'ler.

## Server

Production entry artık `server.ts` dosyasıdır. `package.json` içindeki `start` ve `dev:server` komutları TypeScript entry'yi `production-guard.ts` ile çalıştırır.

Runtime typecheck `tsconfig.runtime.json` üzerinden hem `server.ts` hem `lib/**/*.ts` kapsamını doğrular.

Server tarafında TypeScript'e taşınan kritik sınırlar:

- HTTP/SSE response ve request body boundary
- graceful shutdown coordinator
- agent delegation
- GitHub read boundary
- schedule HTTP/storage/Redis runtime
- Canva ve Gmail connector runtime
- OAuth PKCE, callback, flow store ve token encryption
- personal memory encryption

Kalan `.mjs` dosyaları bulunan security modüllerinde TS kaynak tek doğruluk kaynağıdır ve MJS dosyası gerekiyorsa yalnız compatibility bridge görevi görür.

## Browser

Vite şu typed browser entry'lerini üretir:

- `auth`
- `app-shell`
- `ui-shell`
- `voice-input`
- `voice-output`
- mevcut smart-fill, command-palette, countdown ve runtime entry'leri

Development'ta Vite transform plug-in'i `/typed-build/*.js` yollarını doğrudan `.ts` kaynaklarına map eder. Production'ta aynı entry'ler `public/typed-build` altında ES module artifact'larına dönüşür.

`public/index.html` typed artifact'ları module script olarak yükler. Eski browser entry dosyaları kullanılmaz.

## PWA

Service worker shell cache listesinde typed-build artifact'ları bulunur. API yolları network-only kalır; API response'ları shell cache'e alınmaz.

## Veri akışı

Browser → typed entry → mevcut backend API → typed runtime boundary.

Migration sırasında yeni remote analytics, telemetry veya credential storage katmanı eklenmez. Local workspace verileri önceki storage sözleşmeleriyle korunur.

## Geri alma

Migration bir PR olarak geri alınabilir. Rollback sırasında önce package/Vite/HTML entry referansları eski girişlere döndürülür, ardından legacy dosyalar geri yüklenir. OAuth ve memory encryption davranışları ayrı veri şemasına taşınmadığı için migration rollback'i veri migrasyonu gerektirmez.

## DoD

- `server.ts` production entry olarak çalışır.
- `tsconfig.runtime.json` server entry'yi kapsar.
- Typed browser entry'leri Vite tarafından build edilir.
- HTML ve service worker aynı artifact isimlerini kullanır.
- Legacy entry dosyaları HTML tarafından yüklenmez.
- TypeScript migration release gate testi bu sözleşmeyi otomatik kontrol eder.
