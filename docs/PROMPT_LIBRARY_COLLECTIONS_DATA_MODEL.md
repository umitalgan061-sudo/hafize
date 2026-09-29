# Koleksiyon Veri Modeli

## Collection

Her koleksiyon şu alanları taşır:

`id`: benzersiz ve bounded kimlik.

`name`: normalize edilmiş, boş olmayan 36 karakterlik görünen ad.

`createdAt`: ISO zaman damgası.

`updatedAt`: son isim değişikliği zamanı.

## Assignment map

Atama haritası düz bir nesnedir:

`promptId -> collectionId`.

Bu model prompt nesnesine yeni alan yazmayı zorunlu kılmaz ve eski normalizeItem davranışı ile çakışmaz.

## Normalizasyon

Collection girdisi nesne değilse reddedilir. İsim boşsa kayıt dışı bırakılır. Null karakterler ve satır sonları güvenli metne dönüştürülür.

ID tekrarları tekilleştirilir. İlk geçerli kayıt tutulur.

Map girdileri 120 karakterlik bounded prompt ve collection kimlikleri ile normalize edilir.

## Geçerlilik

Var olmayan koleksiyon ID'leri prune edilir. Mevcut prompt ID'leri biliniyorsa var olmayan prompt atamaları da prune edilir.

Bu iki aşamalı koruma eski import'ların zamanla büyüyen hayalet atamalara dönüşmesini önler.

## Sayımlar

Bir koleksiyonun count değeri ayrı saklanmaz. Mevcut prompt listesi ve assignment map üzerinden türetilir.

Bu sayede sayım için ek senkronizasyon alanı oluşmaz ve koleksiyon silme işleminde sayaç temizleme gerekmez.

## Import

Import edilen koleksiyonlar isim bazında mevcut kayıtlarla eşleştirilir. Aynı isim varsa mevcut ID korunur.

ID çakışmasında yeni rastgele ID üretilir. Atama, import edilen koleksiyon adının mevcut hedefteki ID'sine çevrilir.

## Export

Export `version: 1`, kaynak etiketi, zaman damgası, koleksiyonlar ve assignment map içerir.

Payload boyutu sınırı aşıldığında yalnızca bounded sayıda assignment dışa aktarılır.
