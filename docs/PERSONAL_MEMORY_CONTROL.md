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

## Kullanıcı sahiplik kontrolleri

PWA bellek kartı backend'deki mevcut owner-control sözleşmesini doğrudan kullanıcıya açar:

- **Tümünü dışa aktar** yalnız açık düğme etkileşiminden sonra `POST /api/memory/export` çağırır. Dönen kayıtlar istemcide tekrar şema ve `ownerId` sızıntısı açısından doğrulanır, en fazla 4 MiB JSON dosyasına dönüştürülür ve yalnız yerel tarayıcı indirmesi olarak sunulur.
- **Tüm belleği sil** iki ayrı tarayıcı onayı tamamlanmadan hiçbir mutation çağrısı yapmaz. İkinci onaydan sonra backend'e hem `explicitUserIntent:true` hem `confirmDeleteAll:true` gönderilir.
- Export veya tam silme agent tool catalog'a eklenmez; model bu düğmeleri kendiliğinden çalıştıramaz.
- Her iki kontrol de yalnız authenticated session sırasında etkinleşir; same-origin/no-store istemci politikası korunur.

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
- Delete-all işlemi tek bir genel boolean ile çalışmaz; backend confirmation alanına ek olarak arayüzde iki ayrı kullanıcı onayı vardır.
- Export dosyası sunucuda yeni kalıcı kopya oluşturmaz; browser indirmesi dışında otomatik dış gönderim yoktur.

## Runtime wiring

`server.mjs` bellek route'unu yalnız `MEMORY_SERVER_RUNTIME.configured === true` olduğunda etkinleştirir. Health endpoint yalnız boolean capability durumu yayınlar; encryption key, auth token, owner kimliği veya kayıt içeriği health yanıtına girmez.
