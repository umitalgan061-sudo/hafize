# Preview Performans

Preview DOM'da tek bir dialog oluşturur. Form mevcut oldukça tek capture listener kullanılır.

MutationObserver yalnız scheduled task workspace içindeki formun yeniden oluşturulmasını algılamak için kullanılır. Preview açıldığında countdown saniyede bir güncellenir ve dialog kapanınca interval temizlenir.

Payload JSON yalnız preview açıkken hazırlanır. Kalıcı cache veya ağ kuyruğu oluşturulmaz.

Duplicate enhancement görev listesi yeniden çizildiğinde satırları tarar; her satıra en fazla bir tekrar düğmesi ekler. Ağ işlemi yalnız mevcut workspace tarafından yürütülür.

Kabul edilen sınırlar: 20.000 karakter görev metni, 5 maksimum deneme ve 1 aktif preview dialog.
