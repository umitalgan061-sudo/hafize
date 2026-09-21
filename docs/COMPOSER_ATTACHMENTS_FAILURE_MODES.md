# Composer Ekleri — Failure Modes

| Durum | Davranış |
| --- | --- |
| bilinmeyen uzantı | okunmadan reddet |
| boş dosya | reddet |
| 256 KB üstü | okumadan reddet |
| duplicate | ikinci kaydı alma |
| binary yoğunluğu | reddet |
| toplam 200k üstü | yeni dosyayı alma |
| 4 dosya dolu | yeni dosyayı alma |
| invalid range | clamp |
| insert kapasiteyi aşar | composer'ı değiştirme |
| read error | mevcut ekleri koru |
| expiry | queue'yi temizle |
| destroy | listener ve timer temizle |

## Atomiklik
Insert hatasında partial write yapılmaz. Dosyaların yalnız bir kısmı eklenmiş halde bırakılmaz.

## İzole hata
Bir dosyanın okunamaması diğer dosyaların sırayla denenmesini engellemez.

## Kullanıcı mesajı
Hata status alanında kısa biçimde gösterilir; dosya içeriği hata mesajına echo edilmez.