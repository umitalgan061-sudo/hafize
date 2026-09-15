# Markdown QA matrisi

## Smoke

Uygulama açılır ve mevcut sohbet geçmişi görünür.

Yeni assistant mesajı renderer katmanından geçer.

Kullanıcı mesajlarının mevcut görünümü değişmez.

## Formatting

`# Başlık` → H1.

`## Başlık` → H2.

`### Başlık` → H3.

`- öğe` → unordered list.

`1. öğe` → ordered list.

`> alıntı` → blockquote.

`` `kod` `` → inline code.

`**kalın**` ve `*italik*` → uygun semantic elementler.

## Code

```js fence` ile code block oluşturulur.

Dil etiketi gösterilir.

Kopyala düğmesi çıkar.

22 satırı aşan blokta aç/kapa çıkar.

## Links

https, http ve mailto linkleri çalışır.

javascript/data/vbscript linkleri çalışmaz.

Yeni sekmede açılan linkler opener izolasyonu taşır.

## Limits

24.000 karakterlik input sınırı.

240 blok sınırı.

1.200 karakter satır sınırı.

## Streaming

Parça parça delta geldiğinde DOM güncellenir.

Aynı kaynak ikinci kez işlendiğinde gereksiz DOM churn oluşmaz.

Renderer gecikmesi uygulamayı kilitlemez.

## Clipboard

Başarılı kopyalamada status mesajı görünür.

Clipboard reddinde kullanıcıya hata metni görünür.

Uygulama crash olmaz.

## Accessibility

Başlık ve liste semantiği korunur.

Kod düğmeleri keyboard focus alır.

Durum mesajları polite live region'dır.

Forced-colors ve reduced-motion testleri yapılır.

## Regression

Conversation export ham Markdown metni korur.

Mesaj düzenleme renderer DOM'una değil storage verisine dayanır.

Search davranışı render edilmiş DOM'a bağımlı değildir.

## Release sign-off

Tüm kaynak kontrat testleri geçmelidir.

Yeni network endpoint oluşmamalıdır.

PWA asset listesi renderer ve code-tools dosyalarını içermelidir.

Rollback sonrası ham text görünümü kullanılabilir kalmalıdır.
