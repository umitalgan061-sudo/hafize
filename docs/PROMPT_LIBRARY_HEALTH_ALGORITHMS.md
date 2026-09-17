# Health Center Algoritmaları

## Başlık duplicate

Başlıklar `trim + toLocaleLowerCase('tr-TR')` ile gruplanır.

Aynı grup iki veya daha fazla kayıt içeriyorsa warning üretilir.

## Gövde duplicate

Gövde önce whitespace normalize edilerek küçük harfe çevrilir.

Aynı normalized gövde tekrar ediyorsa warning üretilir.

## Near duplicate

Gövde token setlerine ayrılır.

Üç karakterden kısa tokenlar elenir.

Jaccard benzeri `intersection / union` oranı hesaplanır.

0.82 ve üstü info bulgusu üretir.

## Kullanım sinyali

`useCount > 0` kullanılan kayıt olarak değerlendirilir.

0 kullanım bilgi bulgusudur.

Negatif veya sayı olmayan kullanım sayacı warning'dir.

## Yaş sinyali

`updatedAt` yoksa `createdAt` kullanılır.

Geçersiz tarih için 0 gün kabul edilir ve stale uyarısı üretilmez.

180 gün ve üzeri info olarak değerlendirilir.

## Değişken

Geçerli placeholder biçimi `{{name}}` benzeri alfasayısal, `_` ve `-` karakterli isimdir.

12'den fazla benzersiz değişken error'dur.

Şüpheli kapanmamış placeholder warning'dir.

## Collection ilişkisi

Her `promptId`, mevcut prompt id setiyle karşılaştırılır.

Bulunmayan id yetim üyedir.

## Revision ilişkisi

`revision.promptId` mevcut id kümesinde değilse yetim revision kabul edilir.

## Sınır

Algoritmalar bounded veri üzerinde çalışır ve dışarıdan model çağırmaz.
