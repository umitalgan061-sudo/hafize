# Prompt Smart Fill — Release Note

Bu turdaki smart-fill paketi; değişkenli Prompt Library kayıtlarının kontrollü doldurulması, önizlenmesi ve composer'a aktarılmasını destekleyen mevcut yüzeyi tamamlar.

Release kararı:
- Base `998547ddc63e8b3a62ad74c3ed49614df62620d4` ile son head arasındaki diff 3000 değişen satır sınırının altındadır.
- Değişiklikler PR üzerinden merge edilmek üzere hazırlanmıştır.
- Ağ/telemetri eklenmemiştir.
- PWA shell asset politikası güncellenmiştir.
- Güvenlik, erişilebilirlik, veri sınırları, lifecycle ve no-submit kontratları test dosyalarıyla korunur.
- Tam yerel npm test koşumu bu oturumda yapılamadığından CI/PR sonucu ayrıca dikkate alınmalıdır.

Geri alma yolu PR revert'tir; Prompt Library'nin mevcut yerel kayıtları korunacak şekilde yalnızca smart-fill yüzeyi geri alınabilir.
