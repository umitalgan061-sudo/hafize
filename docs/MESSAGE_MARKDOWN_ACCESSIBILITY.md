# Markdown erişilebilirlik davranışı

## Yapısal semantik

Başlıklar gerçek `h1`/`h2`/`h3` elementleriyle oluşturulur.

Sıralı listeler `ol`, sırasız listeler `ul`, öğeler `li` kullanır.

Alıntılar `blockquote`, yatay ayraçlar `hr` ile temsil edilir.

Bu yapı ekran okuyucunun görsel sembollere bağımlı kalmadan içeriği anlamasını sağlar.

## Kod blokları

Kod blokları `pre > code` yapısındadır.

Kopyalama ve aç/kapa kontrolleri gerçek button elementleridir.

Butonlar `type=button` ile form submit davranışından ayrılır.

Durum mesajları `role=status` ve `aria-live=polite` kullanır.

## Odak

Yeni kod kontrolü DOM'a eklendiğinde otomatik olarak odak çalınmaz.

Kullanıcı tab ile kontrole ulaşabilir.

`:focus-visible` outline mevcut tema token'larıyla görünür tutulur.

## Hareket

Renderer kendi animasyonunu gerektirmez.

Mevcut reduced-motion politikası ile uyumludur.

## Küçük ekran

Kod alanları yatay kaydırılabilir.

Metinler `overflow-wrap:anywhere` ile taşmaz.

Kod toolbar'ı dar ekranlarda daha küçük iç boşluk kullanır.

## Forced colors

Kod kontrollerinin kenarlıkları CanvasText ile görünür kalır.

Odak göstergesi Highlight ile korunur.

## Linkler

Bağlantı metni varsayılan tarayıcı erişilebilirlik özelliklerini kullanır.

Yeni sekmede açılan bağlantı davranışı link semantics'i bozmaz.

## Hata bildirimi

Clipboard başarısızlığında renk tek başına kullanılmaz; status metni gösterilir.

## QA

Keyboard-only testte:

1. Mesaj alanına erişilir.
2. Kod kopyala butonuna Tab ile ulaşılır.
3. Enter/Space ile tetiklenir.
4. Başarı veya hata metni duyulabilir durum alanında görünür.
5. Uzun kod aç/kapa kontrolü aynı şekilde erişilebilir kalır.
