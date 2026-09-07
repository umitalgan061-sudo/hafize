# Hafize Skills güvenlik sözleşmesi

Skills katmanı ajan yetkilerinin üstünde değil, altında çalışır. Bir skill yalnızca mevcut ajan policy'sinin izin verdiği yetkileri kullanabilir; yeni yetki üretemez.

## Manifest

Her skill strict manifest ile tanımlanır. Bilinmeyen alanlar reddedilir. Kimlik, trigger, permission ve argument adları bounded biçimde doğrulanır. Prompt boyutu sınırlıdır.

Kaynak önceliği `builtin < user < project` şeklindedir. Aynı kaynakta aynı skill kimliği ikinci kez tanımlanamaz. Daha yüksek öncelikli kaynak aynı kimliği açıkça override edebilir.

## Çağırma

Kullanıcı tarafından çağrılabilen skill'ler yalnız açık slash trigger ile çözülür. Metnin ortasında geçen `/skill` ifadesi otomatik invocation oluşturmaz. Bu davranış accidental veya prompt-injection kaynaklı skill tetiklenmesini azaltır.

Public skill listesi prompt, requested permission, model hint ve fork hedefi gibi yürütme ayrıntılarını yayınlamaz.

## Tool yetkileri

`allowedPermissions` bir grant listesi değildir; skill'in ihtiyaç bildirimidir. Her permission çağrı anında mevcut agent `allow` veya `approvalRequired` policy'siyle karşılaştırılır.

- Agent policy'de bulunmayan permission `tool_escalation` ile reddedilir.
- `approvalRequired` permission skill tarafından otomatik onaylanamaz; approval gereksinimi execution planına taşınır.
- Secret okuma, dış gönderim, repo merge veya benzeri yetkiler skill prompt'u tarafından açılamaz.

## Inline ve fork

`inline` skill yalnız bounded prompt hazırlığı yapar.

`fork` skill ayrıca `agent.delegate` permission istemek zorundadır ve yalnız registry'deki `specialist` ajana hedeflenebilir. Child agent kendi backend tool policy'sini korur; skill veya parent agent child'ın yetkisini genişletemez.

Bu ilk sürüm execution planı üretir; gerçek server slash wiring'i ayrı değişiklikte eklenecektir. Böylece manifest ve authorization sözleşmesi production invocation açılmadan önce test edilebilir.

## Builtin başlangıç skill'leri

- `/plan`: araç istemeyen inline planlama.
- `/review`: mevcut salt-okunur Code Reviewer uzmanına fork hazırlığı.

Yeni skill ancak ayrı sorumluluk, ölçülebilir kullanıcı değeri ve mevcut agent/tool güvenlik modeline uyum gösterdiğinde eklenir.
