# Koleksiyon Operasyonları

## Günlük kontrol

Koleksiyon panelinin açıldığını, filtre select'inin dolduğunu ve kayıt sayımlarının prompt listesiyle uyumlu olduğunu kontrol edin.

## Yedek

Kullanıcıya önemli koleksiyon düzenlemelerinden önce "Yedeği dışa aktar" eylemi önerilebilir.

## Import

Import dosyasının 500 KB sınırını aşmadığını kontrol edin. Başarısız dosyada mevcut koleksiyonlar değiştirilmemelidir.

## Silme

Koleksiyon silme onayı promptların silinmediğini belirtir. Silme sonrasında prompt'lar koleksiyonsuzdur.

## Assignment

Tekli atamada select değişikliği anında localStorage'a yazılır. Toplu atama mevcut seçili prompt checkbox'larını kullanır.

## Storage hatası

Yazma başarısız olursa status alanında bounded hata mesajı görünür. Kullanıcı akışı sessizce başarılı gösterilmez.

## PWA

Yeni asset'in shell cache listesinde bulunduğu kontrol edilir.

## Debug

Koleksiyon verisi iki sabit storage anahtarından incelenebilir. Prompt gövdesi bu modülde tekrar yazılmamalıdır.

## Reconciliation

Render sırasında collection IDs ve prompt IDs ile assignment map temizlenir.

MutationObserver, prompt listesi yeniden üretildiğinde per-row selector'ları tekrar ekler.

## Başarı kriteri

Koleksiyon ekleme, yeniden adlandırma, silme, filtreleme, tekli atama, toplu atama, export ve import aynı browser oturumunda tutarlı çalışmalıdır.
