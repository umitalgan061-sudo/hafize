# Koleksiyon Gözlemlenebilirlik

Koleksiyon modülü remote telemetry kullanmaz.

Destek amaçlı gözlemler yalnızca kullanıcı tarafından görülen bounded status mesajlarıdır.

Önemli durumlar:
- collection oluşturuldu
- collection adı güncellendi
- collection silindi
- assignment değişti
- bulk assignment tamamlandı
- export tamamlandı
- import tamamlandı
- storage write başarısız
- invalid import

Sayaçlar prompt verisinden türetilir ve local kalır.

Toplam kullanım veya collection count için server endpoint kullanılmaz.

Incident sırasında kullanıcıdan collection export istenebilir.

Prompt içeriği support loglarına otomatik eklenmemelidir.

Debugging sırasında yalnızca ID ve metadata incelenmesi tercih edilir.

Network waterfall'da collection işlemleri için yeni istek bulunmaması beklenir.

PWA offline durumda collection UI shell içinde yüklenebilir; runtime API ihtiyacı yoktur.
