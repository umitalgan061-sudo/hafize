# Akıllı Görünümler Operasyon

## Sağlık kontrolü

1. Prompt Library panelinin açıldığını doğrula.
2. Akıllı Görünümler panelinin listelendiğini doğrula.
3. Hazır görünümleri oluştur.
4. Bir görünüm uygula ve eşleşen kayıt sayısını kontrol et.
5. Hızlı sorgu oluşturucuyla aynı koşulu tekrar uygula.
6. Geçmiş panelinin kullanım sayacını kontrol et.

## PWA kontrolü

Service worker cache sürümünü kontrol et.
Smart Views CSS ve JS asset'lerinin SHELL_ASSETS içinde olduğunu doğrula.
API path'lerinin network-only politikasında kaldığını doğrula.

## Veri kontrolü

Storage anahtarları:
`hafize.prompt-library.smart-views.v1`
`hafize.prompt-library.smart-views.v1.state`
`hafize.prompt-library.smart-view-history.v1`

Bozuk JSON durumunda modül boş listeye dönmelidir.
Kapasite limitleri otomatik normalize edilmelidir.

## Sorun giderme

Panel görünmüyorsa index.html script sırasını kontrol et.
Filtre sonucu yanlışsa parseQuery ve evaluate testlerini çalıştır.
Core arama boşalıyorsa applyView'ın yalnız normal metni geçirdiğini doğrula.
Geçmiş görünmüyorsa custom event ve storage key wiring'ini kontrol et.

## Geri alma

Görünüm kodu kaldırılırsa Prompt Library temel kayıtları korunmalıdır.
Görünüm storage anahtarlarının silinmesi core prompt verisini silmemelidir.
PWA shell cache değişikliği geri alınırken API network-only politikasına dokunulmamalıdır.

## Log ve telemetry

Yeni sunucu log formatı yoktur.
Kullanım geçmişi backend'e gönderilmez.
Tarayıcı konsolunda hassas prompt içeriği yazdırılmaz.