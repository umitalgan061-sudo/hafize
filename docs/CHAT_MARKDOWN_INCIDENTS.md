# Chat Markdown Incident Playbook

## XSS şüphesi

Model çıktısında HTML benzeri bir ifade tıklanabilir veya çalışabilir hale geldiyse feature hemen güvenlik regresyonu olarak değerlendirilir. Önce `safeLinkHref` ve DOM renderer kontrol edilir. Raw HTML desteği eklenmez.

## Yanlış link

Tıklanmaması gereken bir URL anchor'a dönüştüyse URL allowlist regression testleri çalıştırılır. Özellikle scheme case, protocol-relative ve encoded prefix örnekleri kontrol edilir.

## UI kilitlenmesi

Uzun model cevabı sonrasında ana thread gecikiyorsa input ve inline limitleri, observer batching ve table/code bounds test edilir. İlk müdahale limitleri düşürmek veya problemli syntax'ı text fallback'e almaktır.

## Streaming loop

CPU artışı veya sürekli DOM mutation görülürse `markdownSource` ve `markdownWriting` guard'ları incelenir. Renderer mutation'ı observer'a tekrar source değişikliği gibi görünmemelidir.

## PWA eksik asset

Offline shell Markdown stillerini veya parser'ı bulamıyorsa service worker revision ve shell listesi karşılaştırılır. Yeni asset için revision artırılır; API cache kapsamı genişletilmez.

## Clipboard hatası

Copy button başarısız oluyorsa Clipboard API availability ve secure context kontrol edilir. Clipboard hatası chat response error'a çevrilmez.

## Data loss

Renderer storage sahibi değildir. Bir incident sırasında conversation, message veya metadata verisi kayboluyorsa sorun Markdown katmanında olmamalıdır; storage ownership testleri kullanılır.

## Rollback kararı

Güvenlik sınırı ihlalindeyse presentation feature hızlıca kapatılabilir. Rollback, raw conversation metnini etkilemez. Yeniden açma yalnız dedicated security ve regression testleri geçtikten sonra yapılır.
