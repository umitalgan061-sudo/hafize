# Hafize — akan yanıtı takip etme

Streaming sırasında gelen metin doğrudan mesaj düğümüne yazılır; bu tek başına sayfayı kaydırmaz. Composer bu yüzden akışı açıkça takip eder: her delta sonrası, okuyucu hâlâ en alttaysa görünüm en alta sabitlenir.

Takip koşulludur. Kullanıcı önceki bir mesajı okumak için yukarı kaydırdıysa (`120px` eşiğinden uzaklaştıysa) sonraki delta görünümü geri çekmez. Kullanıcı tekrar en alta indiğinde takip kendiliğinden devam eder.

Kaydırma her zaman anlıktır (`behavior: 'auto'`). Yumuşak kaydırma, hedef nokta hesaplandıktan sonra büyümeye devam eden bir içerikte hep eksik kalır ve ürettiği ara scroll olayları "kullanıcı yukarı kaydırdı" gibi okunur.

Yeni mesaj eklenmesi, sohbet değiştirme veya geçmiş temizleme gibi açık durum değişikliklerinde tam render çalışır ve görünüm yeniden en alta sabitlenir. Aynı kare içindeki birden çok istek tek `requestAnimationFrame` çağrısında birleştirilir.
