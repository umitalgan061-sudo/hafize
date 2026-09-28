# Kabul Örnekleri

## Örnek 1
User: şehir planlama raporu hazırla.
Assistant: ilk cevap.
Yeniden üret: ikinci cevap.
Beklenen: ilk cevap alternate[0] olur.

## Örnek 2
İkinci cevap başarısız.
Beklenen: ilk cevap aynen geri gelir.

## Örnek 3
Üç regeneration.
Beklenen: en fazla üç önceki cevap tutulur.

## Örnek 4
Restore.
Beklenen: en son previous cevap current olur.

## Örnek 5
Feedback positive.
Beklenen: yalnız positive state tutulur.

## Örnek 6
Feedback tekrar.
Beklenen: feedback alanı kaldırılır.

## Örnek 7
Copy.
Beklenen: current response clipboard'a yazılır.

## Örnek 8
Tools açık.
Beklenen: agent endpoint kullanılır.

## Örnek 9
Offline.
Beklenen: request yoktur.

## Örnek 10
Eski fixture.
Beklenen: yeni alanlar olmadan conversation açılır.
