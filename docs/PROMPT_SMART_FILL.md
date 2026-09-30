# Prompt Smart Fill

Prompt Smart Fill, Prompt Library içindeki `{{değişken}}` içeren istemlerin sohbet composer alanına güvenli ve kontrollü biçimde aktarılmasını sağlar.

## Amaç

Ham tarayıcı `prompt()` akışının yerine değişkenleri, önizlemeyi ve aktarım kararını tek panelde görünür kılmak hedeflenir. Kullanıcı, model çağrısı yapılmadan önce son metni görür.

## Akış

1. Kullanıcı Prompt Library içinde `Kullan` seçer.
2. İstem değişken içermiyorsa mevcut doğrudan aktarım yolu korunur.
3. İstem değişken içeriyorsa Smart Fill paneli açılır.
4. Her değişken için sınırlı uzunlukta bir alan oluşturulur.
5. Değer değiştikçe önizleme güncellenir.
6. Kaydedilmiş değişken seti seçilebilir veya yeni set yerelde saklanabilir.
7. `Önizlemeyi kopyala` yalnızca önizlemeyi panoya taşır.
8. `Mesaja aktar` son metni `#messageInput` alanına yazar ve `input` olayını tetikler.
9. Gönderim otomatik yapılmaz.

## Değişken kuralları

Değişken isimleri Prompt Library çekirdeğinin `extractVariables` sonucundan gelir. En fazla 12 değişken işlenir. Tek bir değer en fazla 1000 karakterdir. Son çıktı 8000 karakteri aşamaz.

Boş değişken alanları aktarımı durdurur. Kullanıcı eksik bir değeri kullanmak istiyorsa istemini buna göre düzenlemelidir; arayüz sessizce veri uydurmaz.

## Presetler

Presetler yalnızca cihazın local storage alanında tutulur. Her istem için en fazla 6 set saklanır. Set adı 60 karakter, değişken anahtarı 32 karakter ve değer 1000 karakter ile sınırlandırılır.

Preset silme toplu bir kütüphane silme işlemi değildir. Yalnızca seçili istemin değişken setlerini etkiler.

## Command palette

Composer alanında `/prompt` komutu kütüphane aramasını açar. `Ctrl+Shift+O` veya `⌘+Shift+O` ile de aynı panel çağrılabilir. Eşleşme önceliği tam başlık, başlık başlangıcı, başlık içi, etiket ve gövde olarak sıralanır.

Değişkenli bir istem palette üzerinden seçilirse Smart Fill paneline devredilir. Değişkensiz istem doğrudan composer alanına aktarılır.

## Güvenlik

Smart Fill ve command palette backend çağrısı yapmaz. OAuth, token, analytics, telemetry veya remote sync kullanmaz. Kullanıcı verisi DOM'a `textContent` ve form değerleri üzerinden alınır; kullanıcı metni HTML olarak yorumlanmaz.

## PWA

Smart Fill CSS/JS ve command palette CSS/JS service worker shell listesine dahil edilir. Cache versiyonu değiştirildiğinde eski shell cache'leri temizlenir.

## Tasarım ilkeleri

- aktarım ve gönderim ayrı işlemlerdir,
- önizleme ile son değer aynı kaynaktan üretilir,
- local presetler varsayılan olarak sınırlıdır,
- erişilebilirlik semantiği görünür UI kadar önemlidir,
- mevcut Prompt Library veri şeması değiştirilmez.
