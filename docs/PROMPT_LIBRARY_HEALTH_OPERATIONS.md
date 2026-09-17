# Health Center Operasyonları

## Günlük kullanım

Panel açıldığında otomatik tanı çalışır.

Kullanıcı önce hata sayısını, sonra uyarıları inceler.

Kritik yapı hatalarında `Güvenli onarım` kullanılabilir.

## Tarama

Yeniden tarama mevcut storage'ı tekrar okur.

Tarama sırasında ağ isteği yapılmaz.

Tarama sonuçları yalnızca UI belleğinde tutulur.

## Rapor

`Raporu kopyala` metin tabanlı JSON verir.

Ek health enhancement modülü raporu dosyaya indirebilir.

## Problemli kayıt dışa aktarma

Yalnızca hata veya uyarıyla ilişkili prompt'lar seçilir.

Çıktı 120 kayıtla ve bounded JSON boyutuyla sınırlandırılır.

## Onarım

Kullanıcı onayından sonra mevcut normalizer çalıştırılır.

Onarım sonrası tekrar tarama otomatik yapılır.

## Sorun giderme

Panel görünmüyorsa Prompt Library'nin yüklenip yüklenmediği kontrol edilir.

Storage erişimi başarısızsa panel yazma gerektiren eylemleri reddeder.

PWA'da eski asset görülürse service worker cache sürümü kontrol edilir.

## İşletim modeli

Health state yalnızca görünürlük ve filtre tercihlerini taşır.

Prompt metni veya secret telemetry'ye bağlanmaz.

## Geri alma

UI dosyaları revert edilebilir.

Ana Prompt Library storage anahtarı bağımsız kaldığı için özellik geri alınırken kullanıcı prompt'ları silinmez.
