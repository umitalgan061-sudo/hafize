# Yanıt Regeneration Operasyon

## İzleme
Bu özellik server metric veya telemetry üretmez. Sorunlar kullanıcı toast'ı ve mevcut browser log sınırı üzerinden incelenir.

## Tanılama
Bir sorun görüldüğünde message ID, model ve endpoint davranışı kullanıcı tarafından güvenli biçimde doğrulanabilir; token veya secret istenmez.

## Ağ hatası
Offline veya API error durumunda mevcut response geri yüklenir.

## Storage hatası
saveConversations başarısızsa mevcut uygulamanın mevcut persistence warning mekanizması kullanılır.

## Rollout
Feature yalnız typed app-shell değişikliği ve typed helper modülü üzerinden gelir.

## Rollback
PR revert edilir. Backend release gerektirmez.

## Destek
Kullanıcıdan yalnız tarayıcı, model adı, tools modu ve görülen hata metni istenir; sohbet içeriği istemek gerekmez.

## Güvenlik
Connector token veya OAuth state bu feature tarafından okunmaz.

## Release evidence
Source testleri, typecheck ve build çıktısı release kaydına eklenir.
