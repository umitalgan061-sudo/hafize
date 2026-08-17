# Cloud session secret buffer lifecycle

Hafize cloud-session girişinde parola düz metin olarak repoya, loga, agent context'ine veya kalıcı storage'a yazılmaz. JavaScript string'i runtime tarafından yönetildiği için uygulama onun bellekte tam olarak ne zaman silineceğini garanti edemez; buna karşılık uygulamanın kendisinin oluşturduğu mutable byte buffer'ların yaşam süresi daraltılabilir.

## Uygulanan sınır

`lib/cloud-session-auth.mjs` giriş parolasını UTF-8 `Buffer` haline getirdikten sonra yalnız scrypt doğrulaması boyunca tutar. `scrypt()` sonucu da mutable `Buffer` olarak ele alınır. Karşılaştırma tamamlanır tamamlanmaz, sonuç başarılı veya başarısız olsa da `finally` içinde:

- supplied password buffer `fill(0)` ile sıfırlanır,
- derived digest buffer `fill(0)` ile sıfırlanır.

Scrypt hata verirse de aynı `finally` çalışır. Böylece Hafize'nin kontrolündeki plaintext/derived scratch byte'ları gereğinden uzun süre heap üzerinde bırakılmaz.

## Erken reddetme

Parola UTF-8 buffer'a çevrildikten sonra byte sınırını aşıyorsa veya yasak kontrol karakteri içeriyorsa, hata dönmeden önce oluşturulmuş buffer sıfırlanır. Dışarıya yine yalnız genel `AUTH_REQUIRED` sonucu çıkar; parola içeriği hata metnine veya detail alanına taşınmaz.

## Timing-safe scratch buffer

`timingSafeEqual` için uzunluk eşitleme gereken durumda kullanılan geçici padded buffer da `finally` ile sıfırlanır. Bu buffer normal parola doğrulamasında beklenen yol değildir fakat defensive comparison sözleşmesinin parçasıdır.

## Garanti edilmeyen şey

Bu değişiklik "parola bellekte hiçbir zaman bulunmaz" garantisi vermez. Özellikle kullanıcıdan gelen JavaScript string'i ve Node/V8'in dahili kopyaları uygulama tarafından güvenilir biçimde overwrite edilemez. Sağlanan garanti daha dardır: Hafize'nin açıkça oluşturduğu mutable secret byte buffer'ları iş tamamlanınca best-effort ve deterministik biçimde sıfırlanır.

## Değişmeyen güvenlik sözleşmeleri

- Combined scrypt resource policy ve startup fail-closed sınırı korunur.
- Password hash ve signing key yalnız server-side env/secret yönetiminden gelir.
- Session HMAC, nonce, TTL ve `__Host-` cookie biçimi değişmez.
- Login limiter, logout revocation ve privileged Origin kontrolleri korunur.
- Secret değerleri agent context'e girmez.
- Dört profilli selector/specialist roster ve backend default-deny tool policy değişmez.
- External write/send/merge işlemleri explicit approval gerektirmeye devam eder.

## Testler

`test-cloud-session-secret-buffer-lifecycle.mjs` kaynak lifecycle sırasını, `finally` cleanup'ını, padded comparison scratch buffer'ını ve secret leak yasaklarını kilitler. `test-cloud-session-secret-buffer-regression.mjs` yanlış/oversized/malformed parola denemelerinden sonra geçerli login, cookie authentication ve expiry davranışının değişmediğini doğrular.

## Geri alma

Bu PR kalıcı veri, cookie veya password-hash formatı değiştirmez. Geri almak için buffer erase helper'ı, login `finally` cleanup'ı, padded-buffer cleanup'ı, iki test ve bu belge revert edilir; önceki bounded scrypt resource policy bağımsız olarak korunabilir.
