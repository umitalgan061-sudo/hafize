# Hafize güvenli kişisel bellek kontrol modeli

Bu katman Jarvis incelemesindeki kalıcı kişisel bellek ürün ihtiyacını Hafize'nin kendi güvenlik mimarisiyle uygular. Üçüncü taraf Jarvis kodu kullanılmaz.

## Güvenlik sınırı

Kişisel bellek modelin kendisine ait bir yazma yetkisi değildir. Bellek kontrol API'si kullanıcı kimliğini backend'de doğrular ve `ownerId` değerini authenticated principal'dan HMAC ile türetir. İstemci veya model `ownerId` seçemez.

Kalıcı veri mevcut `personal-memory-runtime` üzerinden AES-256-GCM şifreli snapshot olarak saklanır. Storage key yalnız server environment'tadır; HTTP yanıtlarına, agent context'ine veya frontend dosyalarına girmez.

## İşlemler

- `GET /api/memory`: yalnız authenticated owner'ın belleğini sorgular.
- `POST /api/memory`: `explicitUserIntent:true` olmadan kalıcı kayıt oluşturmaz.
- `DELETE /api/memory/:memoryId`: hem `explicitUserIntent:true` hem `exactMatch:true` ister.
- `POST /api/memory/export`: açık kullanıcı niyetiyle yalnız mevcut owner kayıtlarını export eder.
- `DELETE /api/memory`: açık niyetin yanında ayrı `confirmDeleteAll:true` gerektirir.

Export/read/write response'larında dahili `ownerId` alanı temizlenir. Request gövdesinde owner, token veya bilinmeyen alan kabul edilmez.

## Yapılandırma

Bellek storage kapalıysa control runtime disabled döner. Storage yapılandırılmışsa şu server-side değerlerin tamamı gerekir:

- `HAFIZE_MEMORY_KEY_B64`
- `HAFIZE_MEMORY_STORAGE_DIR`
- `HAFIZE_CONNECTOR_AUTH_TOKEN`
- `HAFIZE_CONNECTOR_AUTH_SUBJECT`
- `HAFIZE_CONNECTOR_OWNER_KEY_B64`

Kısmi yapılandırma fail-closed kabul edilir. Bu dosyada veya repoda gerçek secret değeri tutulmaz.

## Bilerek yapılmayanlar

- Modelin konuşmadan sessizce memory write yapması yoktur.
- `memory.write` / `memory.delete` agent tool catalog'a açılmaz.
- Plaintext memory JSON storage yoktur.
- Client-provided owner scope yoktur.
- Delete-all işlemi tek bir genel boolean ile çalışmaz; ayrı confirmation ister.

## Sonraki wiring

Bu PR güvenli runtime + HTTP boundary sözleşmesini tamamlar. `server.mjs` route wiring'i ayrı küçük PR olarak yapılmalıdır; büyük server dosyasını bu turda test kapsamı olmadan full-file replacement ile değiştirmek tercih edilmedi. Wiring sırasında API yalnız `runtime.configured === true` ise açılmalı ve health sadece boolean capability bilgisi yayınlamalıdır.
