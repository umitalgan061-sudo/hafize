# Bağlantılar hata modları

## Health 500

Panel genel sağlık kartında bazı durumların okunamadığını belirtir. Provider kartları kendi bağımsız sonucu ile kalabilir.

## Gmail 401

Gmail kartı “Oturum gerekli” gösterir.

## Canva 404 / not configured

Canva kartı “Devre dışı” gösterir.

## Network error

İstek sonucu NETWORK_ERROR olarak normalize edilir. Raw error message UI'a taşınmaz.

## Timeout

Sekiz saniye sonunda TIMEOUT kodu kullanılır.

## Fetch bulunmaması

Test/harness ortamında fetch yoksa FETCH_UNAVAILABLE fallback'ini kullanır.

## Bozuk JSON

Başarısız response JSON parse edilirse HTTP status tabanlı güvenli hata kodu kullanılır.

## Eksik linked alanı

linked=true değilse provider varsayılanı “Bağlı değil” olarak ele alınır.

## Refresh çakışması

In-flight guard ikinci refresh'i reddeder.

## Çok hızlı refresh

900 ms cooldown kullanıcı tıklamasını kısa aralıkta tekrar sorguya dönüştürmez.

## Destroy sırasında yanıt

Destroy sonrası response render edilmez.

## Storage exception

SessionStorage erişimi başarısızsa panel yine varsayılan state ile açılır.

## Style injection failure

Stylesheet eklenemezse controller null döner; mevcut uygulama kırılmaz.

## Recovery

Kullanıcı yenileme ile durumu yeniden okuyabilir. Hub provider credential'ını onarmaya çalışmaz.

## Test

Her hata modu için source contract veya davranış testi bulunmalıdır.
