# Health Center Tehdit Modeli

## Varlıklar

Korunan ana varlıklar prompt metinleri, collection ilişkileri, revision geçmişi ve yerel kullanıcı tercihidir.

## Saldırı yüzeyleri

Storage içindeki kötü biçimli JSON, kullanıcı kontrollü prompt metni, collection id'leri, revision id'leri ve dışa aktarma dosyaları incelenir.

## XSS

Prompt başlığı ve issue detayları `textContent` ile DOM'a aktarılır.

Kullanıcı değerleri HTML parser'a verilmez.

## Storage poisoning

Bozuk root, bozuk kayıt ve yinelenen id durumları bounded parser ile teşhis edilir.

Onarım mevcut normalizer üzerinden yapılır.

## Resource exhaustion

Prompt, collection, revision ve issue listelerine üst sınır konur.

Benzerlik algoritması bounded çift döngü kullanır.

## Exfiltration

Tanı modülünde network çağrısı yoktur.

Export yalnızca kullanıcı komutuyla başlar.

## Yetki yükseltme

Health center herhangi bir backend token veya connector yetkisi istemez.

## Veri kaybı

Onarım öncesi kullanıcı onayı alınır.

Revision ve Smart Fill preset verileri otomatik silinmez.

## Dosya güvenliği

Download dosya isimleri sabit şablondan oluşturulur.

Object URL kısa sürede revoke edilir.

## Kabul

Health center dışarıdan gelen veri ile çalışırken crash, XSS veya ağ üzerinden veri sızıntısı üretmemelidir.
