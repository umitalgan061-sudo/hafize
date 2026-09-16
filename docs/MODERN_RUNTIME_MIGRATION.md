# TypeScript Runtime Migration Plan

## Kapsam

Bu migration sunucu execution boundary'sini JavaScript ağırlıklı yapıdan TypeScript-first yapıya taşır. Amaç mevcut özellikleri yeniden yazmak değil, yeni değişikliklerin typed contract'larla ilerlemesini sağlamaktır.

## Faz 1 — giriş noktası

`server.ts` production'ın canonical giriş noktasıdır. Bootstrap yalnız runtime config'i okur, doğrular ve asıl HTTP motorunu çalıştırır. Bu ayrım test edilebilir bir startup sınırı oluşturur.

`server.mjs` geriye dönük uyumluluk için korunur ve `server.ts` dosyasını çağırır. Eski deployment komutları bu sayede aniden kırılmaz.

## Faz 2 — kritik sınırlar

Model response, request failure ve bearer authentication için `.ts` canonical implementation'ları kullanılır. Eski `.mjs` yolları yalnız export bridge'tir.

Bu katmanların ortak kuralları:

- dış girdileri `unknown` olarak ele al,
- doğrulama sonrasında explicit result type kullan,
- mutable ortak state döndürme,
- hassas tanı verisini client response'a taşımama,
- uzunluk ve adet sınırlarını contract'a yaz.

## Faz 3 — çalışma zamanının kalan modülleri

Öncelik sırası agent registry, context/scheduler runtime, GitHub read boundary ve connector runtime olarak belirlenmiştir. Bir modül TS'ye taşınırken onun tüketicileri aynı PR içinde gereksiz yere yeniden yazılmaz.

## Compatibility stratejisi

Bir migration PR'ı iki entrypoint'in de aynı davranışa sahip olmasını hedefler. Runtime logic yalnız canonical TS modülünde bulunur. Bridge yeni davranış barındırmaz.

## Rollback

Rollback gerekirse `package.json` start komutları legacy `server.mjs` entrypointine alınabilir. Bridge mevcut olduğu için data storage veya kullanıcı konuşma kayıtlarının geri alınması gerekmez.

## Kontroller

Migration PR'larında minimum kontrol seti:

1. `npm run typecheck`
2. `npm run test:modern`
3. `npm run format:check`
4. runtime boundary source tests
5. legacy entry contract test
6. production hardening testleri

## Node policy

Native TypeScript runtime Node 24+ kabul edilir. Daha eski Node sürümlerinde bootstrap fail-fast davranmalıdır. Production image ve deployment platformu engine constraint ile eşleşmelidir.

## Build policy

Frontend Vite build'i Node runtime typecheck'inden bağımsız tutulur. `npm run build` önce typed runtime ve frontend TypeScript kontrolünü, sonra Vite bundle'ını çalıştırır.

## Review checklist

- [ ] main'e doğrudan yazma yok.
- [ ] branch `hafize/auto-*` formatında.
- [ ] .env veya secret dosyası değişmedi.
- [ ] legacy bridge'e iş mantığı eklenmedi.
- [ ] public static yüzey TS source expose etmiyor.
- [ ] test script'i package.json'a bağlı.
- [ ] rollback yolu belgeli.
