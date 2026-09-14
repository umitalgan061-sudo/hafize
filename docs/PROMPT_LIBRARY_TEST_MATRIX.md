# Prompt Library Test Matrix

| Alan | Kontrol | Beklenen |
| --- | --- | --- |
| Normalizasyon | başlık/gövde sınırı | veri limitte kalır |
| Etiket | tekrar eden / boş | benzersiz değerler |
| Değişken | tekrar / geçersiz isim | yalnız izinli isimler |
| Arama | title/body/tag/variable | doğru eşleşme |
| Favori | true/false | filtre doğru çalışır |
| Sıralama | dört mod | deterministic sıralama |
| Import | bozuk JSON | mevcut veri korunur |
| Import | duplicate id | overwrite yok |
| Import | >1 MB | reddedilir |
| Export | seçili/visible | doğru kayıt kümesi |
| Storage | read/write hata | uygulama çökmez |
| DOM | untrusted text | textContent ile kalır |
| PWA | shell asset | cache listesinde |
| A11y | label/focus/status | klavye ve yardımcı teknoloji |
| Lifecycle | mount/destroy | listener sızıntısı yok |
| Starter | boş kütüphane | 10 başlangıç istemi |
| Starter | mevcut veri | duplicate seed yok |
| Composer | kullan | otomatik gönderim yok |
| Mobil | dar rail | içerik taşması yok |
| Güvenlik | network surface | yeni egress yok |

Tam kapı `npm run check` ile syntax ve `test-*` paketlerini birlikte çalıştırır. Yeni prompt-library testleri isim öneki sayesinde otomatik keşfedilir.
