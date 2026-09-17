# Organizer — Hata ve Kurtarma

## Storage failure

Preset storage okunamazsa boş preset listesi kullanılır.

Preset yazılamazsa kullanıcıya durum mesajı gösterilir.

Task verisi bu storage hatasından etkilenmez.

## Authentication failure

401 cevapları oturum gerekli mesajına dönüştürülür.

Client credential üretmez.

Retry otomatik yapılmaz.

## List failure

GET başarısızsa mevcut liste sahte kayıtlarla doldurulmaz.

Loading görünümü hata boş durumuna dönüşür.

Refresh yeniden kullanıcı tarafından başlatılabilir.

## Delete failure

Tekli veya toplu DELETE başarısız olduğunda kayıt local olarak kaldırılmaz.

Refresh sonrası server snapshot'ı gösterilir.

Kısmi başarı sayacı gerçek başarılı işlemleri ifade eder.

## Duplicate failure

POST başarısızsa yeni görev varmış gibi gösterilmez.

Status bölgesi kullanıcıya genel hata mesajı verir.

Backend hata ayrıntıları gerektiğinde server trace mekanizmasına bırakılır.

## Export failure

GET başarısızsa indirilebilir sahte JSON üretilmez.

Payload boyut limiti aşılırsa export iptal edilir.

## Clipboard failure

Clipboard API yoksa UI görev metnini başka bir kanala göndermez.

Hata status bölgesinde görünür.

## DOM failure

Panel henüz oluşmamışsa enhancement modülleri no-op davranır.

Gecikmeli panel oluşumu MutationObserver ile yakalanabilir.

## Unknown status

Bilinmeyen status mevcut core satırını bozmamalıdır.

Organizer status sıralamasında bilinmeyen durum sona alınır.

## Corrupt row

Eksik `runAt` sıralamada güvenli fallback ile ele alınır.

Eksik agent bilgisi filtrede boş değer olarak kabul edilir.

Eksik schedule ID toplu işlem için seçilebilir hale getirilmez.

## Recovery principles

UI server state'i uydurmaz.

Kullanıcı işlemi yarım kaldığında tekrar çalıştırılabilir.

Geri alınamayacak otomatik yan etkiler oluşturulmaz.
