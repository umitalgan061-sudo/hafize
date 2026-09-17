# Organizer — Güvenlik Sözleşmesi

## Trust boundary

Organizer browser UI katmanıdır.

Schedule ownership server tarafındadır.

Client schedule ID bilse bile ownership kontrolünü aşamaz.

## Authentication

İstekler `credentials: same-origin` ile gönderilir.

Organizer bearer token okumaz.

Cookie değerleri JavaScript'e çıkarılmaz.

401 sonucunda kullanıcıya oturum mesajı gösterilir.

## State changing actions

Toplu iptal yazma işlemidir ve kullanıcı onayı olmadan başlamaz.

Tekli çoğaltma da kullanıcı onayı ister.

Export ve copy işlemleri yalnızca doğrudan kullanıcı etkileşimiyle başlar.

## Input safety

Arama metni DOM'a HTML olarak eklenmez.

Preset ismi textContent üzerinden kullanılmalıdır.

Görev başlığı ve task içeriği `textContent` ile gösterilir.

ID path segment'i `encodeURIComponent` ile taşınır.

## Clipboard

Clipboard yalnızca kullanıcı tarafından seçilen görev metni veya görev özeti için kullanılır.

Clipboard API yoksa fallback olarak server'a veri gönderilmez.

## Export

Export payload'ı kullanıcı indirir.

Export verisi localStorage'a yazılmaz.

Payload 1 MB ile sınırlandırılır.

Export edilen alanlar server response snapshot'ından türetilir.

## Persistent data

Local storage yalnızca görünüm presetlerini saklar.

Preset içeriğinde task text, trace ID, credential veya session token bulunmamalıdır.

Storage bozulması uygulamayı durdurmaz.

## Denial behavior

Server delete reddederse client görevi başarılı saymamalıdır.

Toplu iptal kısmi başarısızlıkta kalan görevleri sessizce silmiş gibi göstermemelidir.

Refresh server durumunu yeniden otoriter kaynak yapar.

## PWA

Service worker `/api/` cevaplarını cache'lememelidir.

Organizer JavaScript ve CSS shell içinde cache'lenebilir.

Offline modda export için server schedule snapshot'ı bulunmuyorsa organizer sahte veri oluşturmamalıdır.

## Threats

Kötü niyetli task text XSS girişimi olarak ele alınır.

Kötü niyetli schedule ID URL encoding ile sınırlandırılır.

Local storage manipülasyonu yalnızca görünüm state'ini etkileyebilir.

Preset manipülasyonu task ownership veya server schedule state'ini değiştiremez.

## Release assertions

No secret in source.

No fetch to third-party origin.

No `innerHTML` required for user task text.

No automatic DELETE.

No automatic POST from view selection.
