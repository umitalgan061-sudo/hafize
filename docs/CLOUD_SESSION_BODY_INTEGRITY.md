# Cloud Session Login Body Integrity

Bu belge Hafize cloud-session login endpoint'inin request body sınırını tanımlar. Amaç parola doğrulamasına ulaşan byte dizisinin tek, açık ve bounded bir yorumunun olmasıdır.

## Kapsam

Bu sözleşme yalnız `POST /api/session/login` request body okuma yolunu sertleştirir. Session cookie formatını, signing-key rotation'ını, logout revocation'ını, login rate limiter'ını, global scrypt concurrency gate'ini veya ajan/tool izinlerini değiştirmez.

## Kabul edilen gövde

Login body için:

- medya tipi tam `application/json` olmalıdır;
- parametre yoksa veya yalnız `charset=utf-8` / `charset="utf-8"` varsa kabul edilir;
- başka charset, profile veya ek media-type parametresi reddedilir;
- `Content-Encoding` yoksa veya tam `identity` ise kabul edilir;
- gzip, br, deflate veya başka sıkıştırma/decompression yolu kabul edilmez;
- varsayılan gövde üst sınırı 1024 byte'tır;
- varsayılan okuma deadline'ı 10 saniyedir;
- `Content-Length` varsa yalnız canonical decimal safe integer olmalıdır;
- beyan edilen uzunluk üst sınırı aşarsa body okunmadan reddedilir;
- okuma sonunda gerçek byte sayısı beyan edilen `Content-Length` ile birebir eşleşmelidir.

Node HTTP parser normal şartlarda framing hatalarının önemli bölümünü daha alt seviyede durdurur. Uygulama katmanındaki length equality kontrolü, test doubles, proxy/adaptor katmanları veya gelecekte farklı request kaynaklarının aynı runtime'a bağlanması halinde de sözleşmenin korunmasını sağlar.

## UTF-8 sözleşmesi

Body bytes `TextDecoder('utf-8', { fatal: true })` ile decode edilir. Replacement-character tabanlı tolerans kullanılmaz. Bu nedenle:

- geçersiz continuation byte,
- eksik/truncated çok-byte dizisi,
- overlong veya başka geçersiz UTF-8 gösterimleri

JSON parser'a ulaşmadan reddedilir.

Leading UTF-8 BOM ayrıca reddedilir. Login request'in canonical JSON bytes alanında BOM'a alternatif gösterim olarak izin verilmez.

## Hata yüzeyi

Public cevaplar bounded ve sabittir:

- malformed JSON, invalid UTF-8, malformed/mismatched content length → `400 INVALID_REQUEST`;
- oversized body/declaration → `413 BODY_TOO_LARGE`;
- body deadline → `408 REQUEST_TIMEOUT`;
- unsupported media type veya content encoding → `415 UNSUPPORTED_MEDIA_TYPE`.

Ambiguous length/framing ve body-limit/timeout durumlarında `Connection: close` kullanılır. Decoder/provider exception message, stack, parola içeriği veya özel hata detayı response body'ye taşınmaz.

## Abuse muhasebesi

Exact HTTPS Origin kontrolü login limiter'dan önce kalır; cross-origin request login deneme bütçesini tüketmez. Aynı-origin request limiter reservation aldıktan sonra invalid UTF-8, malformed JSON veya body framing hatası verirse reservation başarısız deneme olarak tamamlanır. Böylece pahalı parola doğrulamasına ulaşmayan fakat auth endpoint'ini hedefleyen malformed trafik rate-limit politikasını bypass etmez.

Global scrypt verification gate body tamamen okunup exact `{ password }` şeması doğrulandıktan sonra alınır. Slow body veya decoder hatası pahalı verification slot'unu işgal etmez.

## Güvenlik ve veri minimizasyonu

Bu geliştirme:

- yeni endpoint veya network çağrısı eklemez;
- request body'yi loglamaz;
- plaintext password, cookie, signing key veya provider credential saklamaz;
- compression kütüphanesi veya genel-purpose parser eklemez;
- `shell=True`, `child_process`, `exec` veya `spawn` kullanmaz;
- ajan registry'sini veya tool permission sözleşmesini değiştirmez;
- `.env`, credential dosyaları veya `.github/workflows/` üzerinde değişiklik yapmaz.

Aktif dört ajanlı selector/specialist roster ve backend `denyByDefault` politikası aynen korunur. Dış write/send/merge işlemleri bu değişiklikten bağımsız olarak açık kullanıcı onayı gerektirmeye devam eder.

## Test sözleşmesi

Regresyonlar şu davranışları kilitler:

1. geçerli Unicode JSON'ın auth katmanına ulaşması;
2. invalid/truncated UTF-8 ve BOM'un auth öncesi reddi;
3. UTF-8 dışı charset ve compressed request reddi;
4. gerçek byte sayısı ile `Content-Length` eşitliği;
5. malformed body'lerin peer rate-limit bütçesini tüketmesi;
6. gerçek Node `IncomingMessage` üzerinden aynı davranışın korunması;
7. public hata gövdesinde özel decoder ayrıntısı bulunmaması;
8. agent roster, default-deny, secret ve terminal-yürütme sınırlarının değişmemesi.
