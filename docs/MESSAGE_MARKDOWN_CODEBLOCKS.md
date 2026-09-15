# Kod bloğu UX sözleşmesi

## Dil etiketi

Fence satırındaki ilk token dil etiketi olarak kabul edilir.

Etiket yalnız gösterim metadata'sıdır; kodu çalıştırmaz.

Dil etiketi 24 karakterle sınırlıdır.

## Kopyalama

Kopyala düğmesi kod elementinin textContent'ini Clipboard API'ye gönderir.

En fazla 24.000 karakter kopyalanır.

Başarı sonrası kısa status mesajı gösterilir.

Hata durumunda uygulama akışı devam eder.

## Aç/kapa

22 satırı geçen bloklar otomatik olarak uzun blok davranışı kazanır.

İlk durumda kod görünür, ancak yüksekliği sınırlıdır.

Kodu daralt/kodu aç düğmesi `aria-expanded` günceller.

## Yatay kaydırma

Uzun satırlar kod alanı içinde yatay taşabilir.

Kod bloğu sayfa genişliğini zorlamamalıdır.

## Tema

Yeni sabit renkler kullanılmaz.

`--panel`, `--card`, `--line`, `--text`, `--muted` ve `--accent` tokenları mevcut tasarımdan alınır.

## Mobil

Toolbar sıkıştığında butonlar küçülür.

Dil etiketi mevcut alanı kendiliğinden büyütmez.

## Güvenlik

Kod çalıştırma, eval, Function constructor veya sandbox entegrasyonu bulunmaz.

Kopyalama bir UI kolaylığıdır.

## Telemetri

Kopyalama event'i remote analytics'e gönderilmez.

Kullanım metrikleri prompt storage ile karıştırılmaz.

## Kabul kriterleri

- fenced code render edilir,
- dil etiketi varsa görünür,
- kopyalama metni tam ve güvenli olur,
- uzun bloklar sayfayı taşırmaz,
- keyboard ile kontrol edilebilir,
- forced colors'ta görünür kalır,
- clipboard hatası crash oluşturmaz.
