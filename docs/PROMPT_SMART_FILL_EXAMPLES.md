# Smart Fill Örnekleri

## E-posta

İstem:

`{{alici}} için {{konu}} hakkında kısa ve {{ton}} tonda e-posta yaz.`

Kullanım: `alici`, `konu` ve `ton` alanları doldurulur; önizleme kontrol edilir; sonuç composer'a aktarılır.

## Kod inceleme

İstem:

`{{dil}} kodu için {{odak}} odaklı, {{seviye}} seviyesinde inceleme yap.`

Preset örneği: dil=JavaScript, odak=güvenlik, seviye=ayrıntılı.

## Toplantı özeti

İstem:

`{{toplanti}} notlarını {{hedef}} için eylem maddelerine dönüştür.`

Burada büyük not metni değişkene konabilir ancak 1000 karakter sınırı vardır.

## Araştırma

İstem:

`{{konu}} konusunda {{kitle}} için kaynaklı bir araştırma çerçevesi oluştur.`

## Planlama

İstem:

`{{proje}} için {{sure}} sürede uygulanabilir bir plan hazırla.`

## Command palette

Composer: `/prompt araştırma`

Palette başlık, etiket ve gövde içinde arama yapar. Değişkenli sonuç seçildiğinde Smart Fill açılır.

Klavye: `Ctrl/⌘+Shift+O`.

## Kopyalama

Önizleme kopyalanabilir; bu işlem prompt kaydını veya sohbet geçmişini değiştirmez.

## Güvenlik örneği

Değişkene `<img src=x onerror=alert(1)>` yazılırsa önizlemede düz metin görünmelidir; HTML olarak çalışmamalıdır.
