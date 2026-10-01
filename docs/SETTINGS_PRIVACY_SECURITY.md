# Gizlilik Merkezi Güvenlik Sözleşmesi

## Tehdit modeli

Panel kötü niyetli bir localStorage anahtarının yanlışlıkla temizlenmesi, kullanıcı verisinin raporda sızması veya bilinmeyen credential alanlarının yanlışlıkla ifşa edilmesi gibi risklere karşı tasarlanır.

## Allowlist

Silinebilir alanlar `SURFACES` sabitinden gelir. Exact key ile prefix key ayrımı açıkça tanımlıdır. Prefix eşleşmesi yalnız Smart Fill için kullanılır.

## Hassas alanlar

Token, OAuth secret, session ve sunucu görevi gibi kavramlar UI kapsamı dışında tutulur. Bilinmeyen anahtarların değerleri hiçbir koşulda rapora veya ekrana yazılmaz.

## Yıkıcı işlemler

Tek alan temizliği bir onay ister. Veri grubu temizliği ayrı onay ister. Bilinen tüm alanların temizlenmesi ayrıca `TEMIZLE` metniyle doğrulanır.

## Ağ politikası

Modül fetch, XMLHttpRequest ve WebSocket çağrısı içermez. Gizlilik raporu cihaz üzerinde Blob olarak oluşturulup indirilir veya kullanıcının açık eylemiyle panoya kopyalanır.

## DOM güvenliği

Dinamik metin `textContent` ile yazılır. `innerHTML` ve `outerHTML` kullanılmaz. Veri kimlikleri dataset alanlarında taşınır.

## Hata davranışı

Storage erişilemezse işlem başarısız olarak raporlanır; panel sessizce tüm storage'ı silmez. Kısmi silme durumunda silinen alan sayısı kullanıcıya bildirilir.

## Regresyon

Güvenlik sözleşmesi inventory, clear, report, DOM ve lifecycle testleriyle korunur.
