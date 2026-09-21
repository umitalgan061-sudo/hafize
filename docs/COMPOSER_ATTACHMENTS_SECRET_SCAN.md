# Composer Ekleri — Secret Risk Scanner

## Amaç
Attachment içeriği composer'a eklenmeden önce yaygın credential ve private-key desenleri için yerel bir risk taraması yapılır.

Tarama bir DLP sistemi değildir; bilinen desenlere karşı uyarı katmanıdır.

## Tespit edilen örnekler

- PEM private key başlangıçları
- GitHub token biçimleri
- OpenAI-style secret key biçimleri
- AWS access key biçimleri
- Google API key biçimleri
- Slack token biçimleri
- JWT biçimleri
- api key / access token / client secret / private key assignment biçimleri

## Davranış
Tarama 80.000 karaktere kadar içerik üzerinde yapılır ve en fazla 12 bulgu raporlanır.

Riskli attachment satırında uyarı gösterilir. Kullanıcı riskli bir dosyayı mesaja eklemeye çalıştığında açık onay istenir.

İptal edilirse composer değişmez.

## Gizlilik
Tarama tamamen browser belleğinde çalışır. Ağ çağrısı yoktur ve bulgular telemetry'ye gönderilmez.

## Sınırlar
Regex tabanlı tarama yanlış pozitif veya yanlış negatif üretebilir. Bu özellik secret temizleme veya güvenlik garantisi olarak yorumlanmamalıdır.

## Release
Secret scanner asset'i index.html'de policy'den sonra, runtime'dan önce yüklenir. PWA shell listesinde bulunur.