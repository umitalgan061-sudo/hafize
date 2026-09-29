# Konuşma Dalları Performans

Fork işlemi localStorage parse ve JSON serialize maliyeti taşır. Konuşma başına 100 mesaj ve toplam 30 conversation sınırı bu maliyeti bounded tutar.

Message decorator MutationObserver üzerinden çalışır ve mevcut fork button varsa tekrar üretmez.

Branch panel yalnız aktif conversation'ın doğrudan child kayıtlarını gösterir. Global tree taraması yalnız fork depth hesaplama gibi küçük bounded işlemlerde kullanılır.

Dialog DOM'u kapanınca kaldırılır. beforeunload cleanup observer ve event listener'ları temizler.
