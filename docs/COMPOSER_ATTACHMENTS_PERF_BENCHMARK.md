# Composer Ekleri — Performans Benchmark

## Ölçüm hedefi
Testler davranışın sınırlarını doğrular; gerçek browser benchmark ayrı bir manuel kabul adımıdır.

## Cases
1. 1 KB text file read and render.
2. 256 KB text file reject boundary.
3. 4 × 50 KB files sequentially.
4. 200 KB total queue boundary.
5. 400-line range extraction.
6. 11.5K insertion boundary.
7. 12-line preview.
8. 80K character normalization.

## Beklenti
Byte limit aşımı readText'e girmemeli.
Queue 200K üzerinde büyümemeli.
Range extraction 400 satırla bounded olmalı.
Preview sürekli tüm dosyayı yeniden çizmemeli.
Insert payload composer maxlength'i aşmamalı.

## Gözlem
Chrome performance paneliyle scripting ve memory gözlenebilir. Attachment modülünde network activity beklenmez.

## Regression trigger
Yeni limit artırımı yapılırsa benchmark matrisi yeniden değerlendirilmeli.

## Not
Bu dosya sayısal bir production latency garantisi değildir; repeatable acceptance senaryolarıdır.