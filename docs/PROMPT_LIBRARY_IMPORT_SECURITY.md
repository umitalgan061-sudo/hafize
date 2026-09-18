# Prompt Library import güvenliği

## Tehdit yüzeyi
Import yalnızca kullanıcının seçtiği yerel JSON dosyasını işler. Dosya adı ve prompt metni DOM'a textContent ile yazılır.

## Ağ
Import modülü fetch, XHR, WebSocket veya sendBeacon kullanmaz. Veriler sunucuya analytics amacıyla gönderilmez.

## Veri doğrulama
Normalize edilmeyen kayıtlar import planına alınmaz. Alan uzunlukları ana Prompt Library sınırlarına göre kırpılır.

## ID güvenliği
Çakışan ID'ler yeni rastgele kimliklerle yeniden anahtarlanır. Mevcut kayıt üstüne yazılmaz.

## Onay
Kullanıcı açık biçimde İçe aktar düğmesine basmadan storage değişmez.

## DOM
Dialog içindeki dinamik başlık, gövde, etiket ve istatistikler createElement/textContent ile oluşturulur. innerHTML kullanılmaz.

## Gizlilik
Dosyanın içeriği yalnızca cihaz üzerinde işlenir. Recovery backup kullanıcı tarafından indirildiğinde sorumluluk kullanıcıya aittir.

## Geri alma
Özellik revert edildiğinde mevcut prompt kayıt modeli aynı kalır.
