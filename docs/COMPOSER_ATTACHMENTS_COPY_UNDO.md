# Composer Ekleri — Copy ve Undo

## Copy
Her attachment satırı seçili start/end range'i clipboard'a kopyalayabilir.

Copy fenced wrapper eklemez ve composer'a dokunmaz.

## Undo
Mesaja ekle veya hızlı analiz işlemi öncesindeki textarea state'i memory'de snapshot olarak tutulur.

Undo, metin arada farklı bir işlemle değişmediyse önceki before/after parçalarını restore eder.

## Atomicity
Insert kapasitesi aşılırsa snapshot oluşturulmaz ve textarea değişmez.

## Focus
Başarılı insert veya undo sonrasında composer focus'u korunur.

## Privacy
Copy ve undo metadata kalıcı storage'a yazılmaz.