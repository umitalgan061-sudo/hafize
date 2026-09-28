# Görev Merkezi Kullanıcı Akışı

Görev planlama akışı form hazırlama, önizleme ve onay olmak üzere üç bölüme ayrılır.

Form hazırlamada hızlı zaman, şablon, başlangıç seti ve isteğe bağlı yerel taslak kullanılabilir. Liste tarafında arama, sıralama, durum özeti ve ayrıntı görünümü bulunur.

Görevi planla ilk submitte Preview açar. Preview görev metnini, ajanı, çalışma zamanını ve deneme sayısını özetler. Kullanıcı istek ayrıntılarını açabilir, güvenli özeti kopyalayabilir veya Düzenle ile geri dönebilir.

Onay verilmeden schedule API çağrısı yapılmaz. Onay sonrası mevcut workspace submit handlerı kullanılır.

Tekrar planla eski görevin güvenli metadata'sını forma taşır ve zamanı en az beş dakika ileri alarak aynı Preview kapısından geçirir.
