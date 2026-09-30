# Smart Fill Yerelleştirme Politikası

## Dil

Mevcut Hafize arayüzü Türkçe olduğu için Smart Fill metinleri de Türkçedir. Kısayol adları ve teknik terimler gerektiğinde kullanıcıya anlaşılır karşılıklarla gösterilir.

## Değişken isimleri

Değişken isimleri kullanıcı tarafından verildiğinden arayüz bunları çevirmeye çalışmaz. `{{konu}}` ve `{{topic}}` aynı kurala göre işlenir.

## Büyük/küçük harf

Değişken adları çekirdek regex sözleşmesine göre büyük/küçük harf duyarlı olarak korunur. Preset değer anahtarı prompt içindeki adla eşleşmelidir.

## Tarih ve sayı

Smart Fill değerlerin biçimini otomatik değiştirmez. Tarih, para veya sayı gibi alanlarda kullanıcı kendi yerel formatını girebilir.

## Uzunluk göstergeleri

Karakter sayaçları rakamsal olarak gösterilir. Bu gösterim locale formatlaması nedeniyle sınır sayısını değiştirmez.

## Erişilebilir metin

ARIA etiketleri de Türkçe tutulur ve placeholder'a tek başına güvenilmez.

## Gelecekte i18n

Uygulama tam i18n katmanına geçerse Smart Fill metinleri sabit stringlerden merkezi kaynaklara taşınabilir. Bu sürüm bağımsız bir i18n bağımlılığı eklemez.

## Kullanıcı verisi

Preset isimleri ve değerleri çevrilmez, normalize edilir. Kullanıcının kendi dili veri olarak korunur.

## Emoji ve Unicode

Değerlerde Unicode kabul edilir. Uzunluk sınırı JavaScript string uzunluğuna göre uygulanır; görsel karakter genişliği ölçülmez.

## Güvenlik

Yerelleştirme katmanı HTML üretme veya remote translation çağrısı yapmaz.

## Test

Locale davranışı kaynak seviyesinde korunur; özellikle `toLocaleLowerCase` kullanımının prompt çekirdeğiyle çelişmemesi gözetilir.
