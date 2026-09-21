# Composer Ekleri — Destek

## Dosya kabul edilmiyor
Dosya uzantısını allowlist ile karşılaştırın. Unknown medya veya binary türler kapsam dışıdır.

## Dosya büyük
Tek dosya limiti 256 KB'dır. Daha küçük bir dosya ya da yalnız gerekli bölümün ayrı dışa aktarılmış hali kullanılmalıdır.

## Binary algılandı
Dosyada NUL veya control karakter yoğunluğu olabilir. Binary dosyalar metin attachment olarak desteklenmez.

## Mesaja eklenemiyor
Composer'ın kalan maxlength kapasitesini kontrol edin. Daha az dosya seçin veya line range'i küçültün.

## Preview şaşırtıyor
Preview yalnız ilk 12 satırdır. Gerçek insert, seçilen startLine/endLine aralığına göre üretilir.

## Clipboard
Tarayıcı clipboard file desteği sunmuyorsa Dosya seç veya drag-drop kullanın. Normal text paste özellik tarafından engellenmemelidir.

## Panel kapandı
Kapatma staged queue'yi silmez. 15 dakika expiry temizliği bağımsızdır. Tümünü kaldır düğmesi hemen temizler.

## Gizlilik
Dosya içeriği storage veya telemetry'ye yazılmaz. Kullanıcı açıkça mesaja ekleyip normal chat gönderirse içerik normal mesaj kapsamına girer.

## Teknik destek
Sorun bildiriminde dosyanın kendisi yerine uzantı, boyut ve görünen hata mesajı paylaşılmalıdır.