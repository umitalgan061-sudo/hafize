# Mesaj düzenleme güvenlik sözleşmesi

Hafize kullanıcı mesajını doğrudan geçmiş içinde mutasyona uğratmaz. `Düzenle` aksiyonu yalnız seçilen kullanıcı mesajının görünür düz metnini mevcut composer'a taşır ve kullanıcıya değişiklik yapma fırsatı verir.

## Kullanıcı kontrolü

- İşlem yalnız görünür `Düzenle` düğmesine açık kullanıcı tıklamasıyla başlar.
- Mesaj composer'a taşındığında otomatik submit yapılmaz.
- Kullanıcı metni değiştirebilir, vazgeçebilir veya normal `Gönder` yoluyla gönderebilir.
- Aktif yanıt üretimi sırasında düzenleme fail-closed durur.
- Composer'da farklı gönderilmemiş bir taslak varsa bu taslak sessizce ezilmez.

## Veri sınırı

- Kaynak yalnız kullanıcı mesajının `.content.textContent` değeridir.
- HTML, tool activity, trace metadata veya görünmeyen DOM alanları taşınmaz.
- Metin mevcut composer sınırıyla aynı şekilde en fazla 12.000 karakterdir.
- Boş veya sınırı aşan içerik reddedilir.
- Düzenleme controller'ı localStorage/sessionStorage, clipboard veya credential okumaz.

## Ağ ve tool sınırı

`message-edit.js` kendi `fetch`, WebSocket veya başka ağ yolu oluşturmaz. Composer'a alınan metin ancak kullanıcı sonradan normal form submit yaptığında mevcut `app.js` sohbet akışına girer.

Bu nedenle:

- seçili model/ajan normal sohbet akışı tarafından belirlenir;
- tool-calling backend default-deny politikasını kullanmaya devam eder;
- external write/send/merge işlemleri mevcut açık onay sınırını korur;
- düzenleme işlemi yeni permission veya approval üretmez;
- secret değerleri ajan bağlamına eklenmez.

## Geçmiş semantiği

Bu özellik eski mesajı yerinde değiştirmez. Önceki kullanıcı mesajı konuşma geçmişinde kalır; düzenlenmiş sürüm kullanıcı tarafından gönderilirse yeni mesaj olarak eklenir. Bu seçim, eski assistant yanıtlarının hangi prompt'a ait olduğuna dair geçmişi sessizce yeniden yazmamak için bilinçlidir.

Gerçek "mesajı yerinde değiştir ve sonrasındaki branch'i yeniden üret" davranışı ileride eklenirse ayrı conversation-branch veri modeli, açık kullanıcı onayı ve regresyon testleri gerektirir.

## PWA

`/message-edit.js` same-origin shell asset'idir. Service worker yalnız statik shell kopyasını cache'ler; `/api/*` isteklerinin network-only politikası değişmez.

## Regresyon beklentileri

Testler en az şunları doğrular:

- yalnız user mesajlarına düzenleme kontrolü eklenmesi;
- idempotent decoration;
- farklı taslağın korunması;
- aktif generation sırasında bloklama;
- 12.000 karakter sınırı;
- otomatik submit ve paralel network yolunun olmaması;
- PWA cache sürümü ve shell asset wiring'i.
