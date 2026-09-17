# Prompt Power Security Review

## Yerel veri sınırı

Prompt, kullanım, profil, koleksiyon ve revizyon verileri tarayıcı storage alanlarında tutulur. Yeni trust araçları backend endpoint oluşturmaz ve uzaktaki analytics servisine bağlanmaz.

## Girdi sınırları

Prompt body için mevcut 8000 karakter sınırı korunur. Import dosyası 1 MB ile sınırlandırılır. Smart profile değeri 1000 karakterle, değişken isimleri 32 karakterle, profil sayısı 60 ile sınırlandırılır.

## DOM güvenliği

Dosya önizlemesinde başlıklar `textContent` ile yazılır. Kullanıcı verisi HTML, script veya attribute parçası olarak birleştirilmez. CSS sınıfları sabittir; kullanıcı girdisi CSS selector'a dönüştürülmez.

## Yetkilendirme

Import, repair ve silme işlemleri dış servis yazma yetkisi istemez. Repair ve destructive collection işlemlerinde açık kullanıcı onayı gerekir.

## Storage güvenliği

`JSON.parse` hataları yakalanır. `localStorage` yazma başarısızlıkları kullanıcıya durum mesajı olarak raporlanır. Storage boyut baskısı altında uygulama crash etmek yerine operasyonu başarısız kabul eder.

## Clickjacking / modal davranışı

Import preview `aria-modal` ile tanımlanır. ESC ve kontrollü focus davranışı sağlanır. Panel kapandığında odak tetikleyici kontrole döner.

## Ağ izolasyonu

Yeni JS dosyalarında `fetch`, `XMLHttpRequest`, WebSocket veya beacon kullanımı yoktur. PWA shell asset listesi statik varlıkları kapsar; `/api/` istekleri network-only davranışını korur.

## Tehditler

Tehditler arasında bozuk JSON, aşırı uzun kayıt, yinelenen id, yetim collection üyeleri, storage erişim hatası, clipboard reddi, modal focus kaybı ve sahte HTML içerik bulunur.

## Kontrol noktaları

- Import boyutu kontrolü file read öncesinde yapılır.
- Normalization storage yazımından önce uygulanır.
- Id çakışması overwrite yerine yeni id ile çözülür.
- Repair öncesi confirm kontrolü yapılır.
- Tanı çıktısı ham gövdeyi render etmez.
- Kullanıcıya gönderilecek mesajlar sabit UI metinleridir.

## İnceleme sonucu

Yeni modüller mevcut Prompt Library sınırlarını genişletmeden güven ve kurtarma yetenekleri ekler. Üretim merge'i öncesinde ilgili statik testlerin çalışması gerekir; CI yoksa PR'da açıkça belirtilmelidir.
