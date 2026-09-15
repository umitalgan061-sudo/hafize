# Markdown destek playbook

## Kullanıcı “biçimlendirme yok” diyorsa

Önce assistant mesajının gerçekten `.message.assistant .content` içinde olduğunu doğrula.

Ardından renderer assetlerinin Network panelinde yüklendiğini kontrol et.

`HafizeMarkdown` globalinin oluştuğunu kontrol et.

## Kullanıcı “kod bozuk” diyorsa

Fence başlangıcı ve kapanışı kontrol edilir.

Kod içindeki HTML benzeri metinlerin çalışması beklenmez.

Dil etiketi yalnız görsel metadata'dır.

## Kullanıcı “link açılmıyor” diyorsa

URL şemasının http, https veya mailto olduğunu kontrol et.

Diğer şemalar güvenlik nedeniyle reddedilir.

## Kullanıcı “yanıt çok uzun” diyorsa

Yanıt araçlarındaki “Yanıtı daralt” düğmesi kullanılabilir.

Bu yalnız görünümü değiştirir; veri silmez.

## Kullanıcı “Markdown dosyası indiremiyorum” diyorsa

Tarayıcının Blob/Object URL desteği ve indirme izinleri kontrol edilir.

İndirme isteği localdir; server upload yapılmaz.

## Kullanıcı “alıntı bozuldu” diyorsa

Alıntı her satıra `> ` ekler.

Composer maxlength 12.000 sınırı uygulanır.

## Kullanıcı “başlık özeti görünmüyor” diyorsa

Yanıtta en az iki H1-H3 heading bulunması gerekir.

20 başlıktan fazlası özete alınmaz.

## Kullanıcı “kopyala çalışmıyor” diyorsa

Clipboard API'nin kullanılabilirliği kontrol edilir.

HTTPS / secure context gereksinimi tarayıcı tarafından karşılanmalıdır.

Başarısızlık uygulamanın diğer işlevlerini engellemez.

## Güvenlik bildirimi

Şüpheli script çalışması görülürse renderer derhal devre dışı bırakılmalı ve ham text fallback doğrulanmalıdır.

Payload kullanıcı/model mesajından geldiyse tekrar üretim adımları korunur.

## Tanılama paketi

Destek ekibi şu bilgileri toplar:

- browser ve sürüm,
- cihaz türü,
- mesaj uzunluğu,
- kullanılan Markdown sözdizimi,
- console error,
- renderer asset status'u.

Secret veya token toplanmaz.

## Bilinen sınırlar

Tam CommonMark/GFM uyumluluğu garanti edilmez.

HTML, iframe, image embed, script ve özel URL protokolleri desteklenmez.
