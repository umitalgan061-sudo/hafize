# Tekrar Planlama Hata Modları

Ajan ID artık mevcut listede bulunmuyorsa form select değeri geçersiz kalabilir. Preview doğrulaması bunu onaydan önce engeller.

Görev metni row başlığından alınır ve 20.000 karakter sınırına kırpılır.

Kaynak runAt okunamazsa yeni zaman şimdi + 5 dakika olarak seçilir.

Kaynak runAt geçmişteyse yine minimum gelecek zamanı kullanılır.

Task workspace açılmazsa duplicate eylemi yalnızca hiçbir şey yapmadan sonlanır.

Preview modülü yoksa form doldurulur ancak doğrudan POST başlatılmaz; kullanıcı normal submit akışıyla devam edebilir.
