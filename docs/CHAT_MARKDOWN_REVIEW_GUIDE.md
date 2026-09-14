# Chat Markdown Review Guide

## İlk bakılacak yerler

Kod incelemesinde önce `safeLinkHref`, `scanInline`, `parseMarkdown`, `renderMarkdown`, `copyCode` ve `install` fonksiyonlarına bakılır. Bunlar renderer'ın güvenlik ve yaşam döngüsü omurgasıdır.

## Parser değişikliği

Yeni token parser'a eklenecekse normal kullanım, bozuk kullanım ve limit üstü kullanım birlikte düşünülür. Token'ın DOM'da hangi elemente dönüştüğü ve bu elementin hangi browser yetkisini açtığı not edilir.

## Link değişikliği

Yeni protocol eklemek basit syntax genişlemesi değildir. Allowlist, new-tab relation, user intent ve phishing yüzeyi ayrıca incelenir. Relative URL desteği açılması bu review kapsamını büyütür.

## DOM değişikliği

Yeni element yalnız gerekli olduğunda eklenir. HTML string kullanımı kabul edilmez. Text node ve attribute değerleri mümkün olduğunca `textContent` ve güvenli property/attribute API'leriyle oluşturulur.

## Observer değişikliği

Observer callback'i kendi render mutation'ını görebilir. Source equality ve writing guard davranışı korunur. Synchronous DOM render yerine gerekliyse batching yaklaşımı tercih edilir.

## Limit değişikliği

Bir limit yükseltilecekse neden gerektiği ölçülmeli ve corresponding test değişmelidir. Güvenlik veya performans gerekçesi olmadan sınır yükseltilmemelidir.

## CSS değişikliği

Desktop, mobile, reduced-motion ve forced-colors birlikte kontrol edilir. Table ve code block'ın global horizontal overflow üretmemesi önemlidir.

## PWA değişikliği

Index'te asset değişiyorsa shell policy de değişir. Cache revision artırılır. `/api/*` yolları statik shell kapsamına sokulmaz.

## Test yeterliliği

Dedicated testlerin sayısı tek başına kalite ölçüsü değildir. Her değişmez için fail durumunu gösteren en az bir assertion bulunmalı ve test production source ownership'iyle çelişmemelidir.
