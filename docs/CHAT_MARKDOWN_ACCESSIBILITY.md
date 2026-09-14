# Chat Markdown Erişilebilirlik

## Klavye

Kod kopyalama düğmesi gerçek `button` elementidir ve klavye ile ulaşılabilir. Linkler normal anchor davranışını korur. Focus-visible outline tema değişse de görünürdür.

## Ekran okuyucu

Kod kopyalama kontrolünün açık `aria-label` değeri vardır. Kod dili görsel label olsa da code text'in kendisi DOM'da bulunur. Görev listesi marker'ı `aria-hidden` gibi davranacak şekilde yalnız görsel işaret olarak tasarlanmıştır.

## Küçük ekran

Tablolar ve code block'lar yatay scroll kullanır. Uzun kelimeler `overflow-wrap:anywhere` ile görünümü taşırmaz. Bu, yatay kaydırmayı yalnız gerçekten geniş içeriğe sınırlar.

## Hareket

Renderer'da zorunlu animasyon yoktur. CSS'teki reduced-motion kuralı, gelecekte eklenen geçişlerin de kapatılacağı güvenli bir sınırdır.

## High contrast / forced colors

Border ve focus durumları sistem renklerine bağlanır. Böylece koyu/açık tema palette bağımlı kalmadan görünür kontroller korunur.

## Metin bütünlüğü

Model yanıtındaki Unicode, Türkçe karakterler ve emoji textContent yoluyla doğrudan korunur. Parser tanımadığı bir karakteri silently drop etmez.

## Test yaklaşımı

Erişilebilirlik testleri implementation ayrıntısından çok kontrol yüzeyini doğrular: focus-visible, forced-colors, reduced-motion, button label ve overflow sözleşmeleri. Gerçek ekran okuyucu entegrasyonu CI sınırında değil; release smoke kapsamında manuel doğrulanmalıdır.
