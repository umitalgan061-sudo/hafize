# Yanıt Regeneration Geri Alma

## Amaç
Regeneration UI'sını geri alırken mevcut sohbet verisini korumak.

## Adım
1. PR revert edilir.
2. Ana chat runtime eski görünümüne döner.
3. Mevcut conversation storage olduğu gibi bırakılır.
4. Yeni alanlar eski normalize katmanında yok sayılabilir.

## Veri kaybı
Alternates içindeki yanıtlar revert işlemi sırasında otomatik silinmez; storage kaydı kullanıcı açıkça temizleyene kadar kalabilir.

## Acil durum
Build başarısızsa legacy bridge'e dönülmez; typed entrypoint korunur ve yalnız ilgili commit geri alınır.

## Kontrol
- sohbet açılmalı
- eski mesajlar görünmeli
- yeni composer submit çalışmalı
- secret değişmemeli
- PWA shell değişmemeli

## Sonuç
Geri alma, backend ve authentication katmanına dokunmadan yapılabilir.
