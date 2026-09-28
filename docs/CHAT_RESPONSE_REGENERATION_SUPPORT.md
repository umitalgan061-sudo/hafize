# Yanıt Regeneration Destek Notları

## Kullanıcıdan istenecek bilgiler
- tarayıcı adı
- mobil veya masaüstü
- seçili model
- araç modunun açık olup olmadığı
- görünen hata mesajı

## İstenmemesi gerekenler
- API key
- OAuth token
- cookie
- tam conversation export
- connector credential

## Yaygın durumlar
Yeniden üret düğmesi pasifse mesaj son assistant olmayabilir, stream devam ediyor olabilir veya model/ajan hazır olmayabilir.

Clipboard çalışmıyorsa tarayıcı izinlerini kontrol et; sohbet state'i etkilenmez.

Önceki yanıt görünmüyorsa henüz başarılı bir regeneration olmamıştır.

## Hata inceleme
Önce network connectivity, sonra model/agent state, sonra browser console ve build version kontrol edilir.

## Güvenli destek
Kullanıcı içeriği istemeden reproducible source-contract kontrolü yapılabilir.

## Escalation
Backend API değişikliği gerektiren sorunlar ayrı server bug'ı olarak ele alınır; bu feature frontend response action katmanıdır.
