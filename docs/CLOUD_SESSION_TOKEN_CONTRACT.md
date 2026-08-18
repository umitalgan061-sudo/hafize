# Cloud session canonical token contract

Bu belge Hafize cloud-session cookie/token biçiminin fail-closed doğrulama sınırını tanımlar. Bu katman yeni bir kimlik doğrulama yöntemi veya yeni bir yetki yüzeyi değildir; mevcut HMAC imzalı oturum modelinin parser girdisini daraltır.

## Amaç

İmzalı bir token doğrulanırken cookie ayrıştırma, base64url çözme ve JSON şema yorumlama davranışlarının tek ve canonical olması gerekir. Hafize tarafından üretilmeyen alternatif gösterimler geçerli HMAC taşısa bile kabul edilmez. Böylece gelecekteki parser değişiklikleri, key rotation ve logout revocation aynı token tanımını paylaşır.

## Sınırlar

- Cookie adı yalnız `__Host-hafize_session`.
- Tam `Cookie` header en fazla 4096 byte.
- Session token en fazla 2048 byte.
- Encoded payload en fazla 1024 byte.
- Token tam iki parçadır: `encodedPayload.signature`.
- Payload ve imza canonical unpadded base64url karakter kümesini kullanır.
- HMAC-SHA256 imzası tam 43 base64url karakteridir.
- Aynı request içinde session cookie birden fazla kez bulunursa kimlik doğrulama fail-closed olur.
- Payload tam şu sıradaki beş anahtarı taşır: `v`, `sub`, `iat`, `exp`, `n`.
- Ek alan, eksik alan veya farklı key sırası kabul edilmez.
- JSON parse edildikten sonra aynı nesnenin compact JSON + base64url yeniden kodlaması gelen payload ile byte-for-byte aynı olmalıdır.
- `v` yalnız sürüm 1 olabilir.
- `sub` yapılandırılmış principal subject ile exact eşleşir.
- `iat` ve `exp` sıfır veya pozitif safe integer olmalıdır; TTL ve zaman kontrolleri ayrıca auth katmanında uygulanır.
- Nonce tam 24 base64url karakteridir.

## Üretim

Yeni login tokenı da aynı ortak contract helper'ı ile oluşturulur. Böylece üretici ve doğrulayıcı farklı JSON/base64url kuralları geliştiremez. Mevcut `__Host-`, `Path=/`, `HttpOnly`, `Secure`, `SameSite=Strict`, bounded TTL ve active signing-key davranışı değişmez.

## Key rotation ve revocation

Active + previous signing-key rotasyonu aynı canonical token parser'ını kullanır. Bir token önce biçim ve imza açısından doğrulanır; previous slot üzerinden doğrulanan eski session'ın logout fingerprint'i tokenı gerçekten imzalayan previous key ile üretilmeye devam eder.

Revocation katmanı kendi cookie parser'ını taşımak yerine ortak token extractor'ı kullanır. Duplicate veya oversized cookie/token hem authentication hem revoke yolunda aynı şekilde `AUTH_REQUIRED` ile reddedilir. Revocation fingerprint'i hâlâ HMAC-SHA256 domain-separated değerdir; raw cookie/token revocation store'a yazılmaz.

## Değişmeyen güvenlik mimarisi

- NVIDIA/local model seçimi tool yetkisi vermez.
- Agent roster iki selector + iki specialist olmak üzere dört profildir.
- Tool permission backend'de `denyByDefault` kalır.
- External write/send/merge işlemleri explicit approval gerektirir.
- Secret değerleri agent context'e taşınmaz.
- Yeni network endpoint, storage, cookie'yi client-side okuma, shell/exec/spawn veya persistent memory write eklenmez.
- `.env`, credential dosyaları ve `.github/workflows/` bu değişikliğin kapsamı değildir.

## Bilinen sınır

Bu contract #256'daki process-local logout revocation sürekliliği sınırını değiştirmez. Multi-instance/restart-surviving revocation, senkron authenticator sözleşmesini geniş çaplı ve riskli biçimde async'e çevirmeden ayrıca tasarlanmalıdır.

## DoD

Regresyon testleri canonical üretim/parse, duplicate cookie, byte limitleri, valid-HMAC fakat noncanonical JSON, ek alan, nonce şekli, subject/time/TTL sınırları, active/previous key rotasyonu, logout revocation, fresh-session izolasyonu ve dört profilli default-deny güvenlik sözleşmesini kapsar.
