# Cloud session signing-key rotation

Hafize cloud session cookie'leri HMAC-SHA256 ile server-side imzalanır. Signing key hiçbir istemci payload'ına, agent context'ine veya repository dosyasına yazılmaz.

Bu sözleşme kontrollü anahtar rotasyonu için en fazla iki doğrulama anahtarı kabul eder:

- `HAFIZE_CLOUD_SESSION_SIGNING_KEY`: aktif anahtar. Yeni session cookie'leri **yalnız** bu anahtarla imzalanır.
- `HAFIZE_CLOUD_SESSION_PREVIOUS_SIGNING_KEY`: isteğe bağlı eski anahtar. Yalnız mevcut cookie'leri geçici olarak doğrulamak için kullanılır.
- Üçüncü/fallback key listesi yoktur. Key ring dinamik veya sınırsız değildir.
- İki anahtar aynı olamaz.
- Her anahtar canonical base64url biçiminde 32–64 byte secret olmalıdır.

## Güvenli rotasyon prosedürü

1. Yeni, bağımsız ve yüksek entropili bir signing key üretin. Secret'ı repository'ye veya istemci konfigürasyonuna yazmayın.
2. Mevcut aktif key'i `HAFIZE_CLOUD_SESSION_PREVIOUS_SIGNING_KEY` olarak taşıyın.
3. Yeni key'i `HAFIZE_CLOUD_SESSION_SIGNING_KEY` olarak ayarlayın.
4. Tüm Hafize instance'larını aynı iki-key overlap konfigürasyonuyla deploy edin.
5. En az yapılandırılmış session TTL kadar bekleyin. Hafize TTL üst sınırı 12 saattir.
6. Overlap penceresi tamamlandıktan sonra `HAFIZE_CLOUD_SESSION_PREVIOUS_SIGNING_KEY` değerini kaldırıp yeniden deploy edin.
7. Eski secret'ı secret manager politikanıza göre imha edin.

Overlap sırasında eski cookie'ler doğrulanabilir, fakat yeni login her zaman aktif key ile imzalanır. Previous key kaldırıldığı anda hâlâ eski key ile imzalı cookie'ler `AUTH_REQUIRED` olur.

## Revocation ile etkileşim

Process-local logout revocation store ham cookie saklamaz. Token için domain-separated HMAC fingerprint saklar. Bir session previous key ile doğrulanmışsa fingerprint de o session'ı imzalayan previous key ile hesaplanır. Bu sayede rotasyondan önce logout edilmiş eski-key cookie, overlap penceresinde yeniden geçerli hale gelmez.

Public `authenticate()` sonucu hangi signing key slotunun kullanıldığını açıklamaz. Internal key-slot bilgisi yalnız doğru revocation fingerprint anahtarını seçmek için kullanılır.

Mevcut revocation store'un process-local olma sınırı değişmemiştir. Process restart/deploy process-local deny-set'i sıfırlar. Multi-instance veya restart-surviving revocation ayrı durable-store çalışması gerektirir; signing-key rotation bunu çözmüş gibi göstermez.

## Privileged yollar

Aynı rotation sözleşmesi şu server-side cloud-session tüketicilerine uygulanır:

- `/api/session/*` cloud auth runtime,
- GitHub write gibi privileged principal fallback,
- schedule cloud-session fallback.

Browser kaynaklı privileged mutation'larda mevcut exact HTTPS Origin kontrolü korunur. Server-to-server bearer kimliği öncelikli kalır ve previous signing key bearer yetkisini değiştirmez.

## Fail-closed konfigürasyon

`HAFIZE_CLOUD_SESSION_PREVIOUS_SIGNING_KEY` tek başına Hafize cloud auth'u etkinleştirmez. Previous key mevcutsa aktif password hash, active signing key, subject ve HTTPS origin konfigürasyonu da eksiksiz olmak zorundadır. Partial config startup sırasında reddedilir.

Malformed previous key, active key ile duplicate key veya desteklenmeyen uzunluk startup sırasında reddedilir. Secret değerleri health response, runtime public object veya agent/tool context içinde yayınlanmaz.

## Değişmeyen güvenlik sınırları

- Agent roster iki selector + iki specialist olmak üzere dört profildir.
- Tool policy backend `denyByDefault` kalır.
- Provider seçimi tool yetkisi vermez.
- GitHub/Gmail/Canva dış write/send/merge işlemleri açık kullanıcı onayını korur.
- Signing key rotation yeni endpoint, tool, shell/exec/spawn, client storage veya persistent memory write eklemez.
- `.env`, credential/secret dosyaları ve `.github/workflows/` self-development değişiklik alanı değildir.

## Operasyonel not

Emergency key compromise durumunda eski key'i previous slotuna koymak uygun değildir; bu, kompromize key'i overlap boyunca geçerli tutar. Böyle bir olayda previous key'i **yapılandırmadan** yalnız yeni active key ile deploy edin. Sonuç olarak tüm eski session cookie'leri hemen geçersiz olur ve kullanıcıların yeniden giriş yapması gerekir.
