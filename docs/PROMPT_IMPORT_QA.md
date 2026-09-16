# Prompt Import QA

## Uygulama

Akış `public/prompt-library-import-preview.js` içindedir. Modül kütüphane kartındaki gizli
dosya girdisini capture aşamasında dinler, kartın kendi anında içe aktarma davranışını
`stopImmediatePropagation()` ile durdurur ve dosyayı önce önizleme panelinde gösterir.
Birleştirme ve normalizasyon Prompt Library çekirdeğinde kalır; panel yalnızca sonucu
gösterir ve onay alındığında `saveItems` ile yazar.

## Fonksiyonel senaryolar

1. Boş JSON dizisi seçilir; önizleme açılır, aktarım düğmesi pasif kalır.
2. Tek geçerli prompt seçilir; özet doğru kayıt sayısını gösterir.
3. Birden fazla prompt seçilir; örnek başlıklar güvenli DOM düğümleriyle görünür.
4. Aynı id taşıyan kayıt seçilir; mevcut kayıt ezilmez ve yeni id üretilir.
5. 120 kayıtlık kapasite doluyken yeni dosya seçilir; kullanıcı kapasite dışını görür.
6. Geçersiz JSON seçilir; mevcut kütüphane korunur ve hata mesajı gösterilir.
7. 1 MB üstü dosya seçilir; dosya okunmadan reddedilir.
8. Dosya okuma hatası oluşur; mevcut storage değişmez.

## UI senaryoları

Panel açıkken Escape kapanmalıdır. Kapatma ve Vazgeç işlemleri storage yazmamalıdır. Önizlemede başlıklar HTML olarak yorumlanmamalıdır. Uzun başlık ve içerikler sınırlandırılmış görünümde kalmalıdır.

## Veri senaryoları

İçe aktarılan kayıtlar mevcut Prompt Library normalizer'ından geçer. Yinelenen id'ler ayrı kayıt üretirken mevcut kaydın değerlerini korur. Koleksiyon üyeliği prompt id'lerine göre sonradan yeniden doğrulanabilir.

## Kabul

Tüm senaryolarda kullanıcı açıkça onaylamadan kalıcı değişiklik yapılmamalıdır. Bir test başarısızsa merge öncesi nedeni PR açıklamasında belirtilmelidir.

## Test ortamı

Masaüstü Chromium, mobil viewport, klavye-only ve forced-colors senaryoları göz önüne alınır. Ağ bağlantısı olmadan da önizleme ve temel validation çalışmalıdır.

## Regression

Temel `İçe aktar` butonu, `Dışa aktar`, `Kullan`, arama, favori filtreleme ve kullanım istatistikleri birlikte doğrulanmalıdır.
