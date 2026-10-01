# Gizlilik Merkezi Rollback

## Kod rollback

PR revert edildiğinde settings privacy paneli, ilgili CSS/JS ve registration satırları geri alınır.

## Veri rollback

Kod rollback'i kullanıcı localStorage verisini silmemelidir. UI'nın kaldırılması persistent data'yı kendiliğinden değiştirmez.

## Kısmi hata

Temizleme işlemi sırasında hata alınırsa modül yalnız gerçekleştirilmiş removeları raporlar; uygulama genelinde storage reset yapmaz.

## PWA rollback

Cache version yeni assetleri içermediğinde Service Worker eski shell politikasına döner. Kullanıcı verisi cache içine yazılmadığı için veri geri dönüşü etkilenmez.

## Rapor rollback

Eski uygulama sürümü gizlilik raporu oluşturamıyorsa yeni rapor dosyası cihazda kalabilir; bu dosyanın otomatik olarak remote sunucuya gönderilmesi söz konusu değildir.

## Operational rule

Rollback sonrası veri temizleme çalıştırılmaz. Veri temizleme ile kod rollback'i bağımsız işlemlerdir.
