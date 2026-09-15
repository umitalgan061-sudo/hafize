# Uzun yanıt başlık özeti

## Ne zaman görünür?

Assistant yanıtında en az iki adet H1, H2 veya H3 bulunduğunda `Başlık özeti` kontrolü oluşturulur.

20 başlığa kadar özetlenir.

## Navigasyon

Her başlık benzersiz bir yerel id kazanır.

Özet bağlantıları aynı assistant mesajının ilgili başlığına gider.

## Gizlilik

Başlık id'leri yalnız DOM içindir.

Server-side metadata oluşturulmaz.

## Erişilebilirlik

Özet bir `nav` elementidir.

`aria-label` ile başlıkları açıklar.

Göster/gizle düğmesi `aria-expanded` kullanır.

## Mobil

Başlık metni 80 karaktere kadar gösterilir.

H2 ve H3 girintileri CSS ile ayırt edilir.

Uzun başlıklar kırılabilir.

## Performans

Maksimum 20 heading okunur.

Özet ayrı bir network çağrısı yapmaz.

MutationObserver yalnız mevcut mesaj ağacını izler.

## Güvenlik

Başlık label'ı `textContent` üzerinden atanır.

HTML veya script çalıştırılmaz.

CSS selector yalnız sabit assistant message alanında kullanılır.

## Fallback

Heading sayısı yetersizse ekstra UI oluşmaz.

Renderer devre dışıysa outline da oluşmaz.

## QA

2 heading, 20 heading, 21+ heading ve özel karakter içeren heading test edilmelidir.

Keyboard ile açma, gezinme ve kapatma doğrulanmalıdır.
