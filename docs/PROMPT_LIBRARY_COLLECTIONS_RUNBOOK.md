# Koleksiyon Runbook

## Başlatma sonrası

1. Prompt Library kartını aç.
2. Collection panelinin göründüğünü doğrula.
3. "Tüm koleksiyonlar" filtresinin varsayılan olduğunu kontrol et.
4. Collection count göstergesini kontrol et.

## Incident

Storage read hatasında uygulama prompt library'yi boş collection state ile açabilir.

Storage write hatasında status mesajı kontrol edilir.

Import hatasında mevcut data korunmalıdır.

## Data repair

Stale map girdileri render reconciliation ile temizlenebilir.

Geçersiz collection ID'leri prune edilir.

## Backup

Collection export ile metadata yedeği alın.

Prompt export ile içerik yedeği alın.

İki dosyayı aynı kullanıcı çalışma alanına ait olarak saklayın.

## Recovery

Önce collections import, sonra prompt library import yapılabilir.

Aynı collection isimleri mevcutsa ID merge mantığı duplicate oluşturmaz.

## Verification

Bir collection oluşturup bir prompt ata.

Filtreyi collection'a getir.

Prompt'u sil.

Filtrede assignment'ın kaybolduğunu kontrol et.

## Release sonrası

Service worker asset listesini kontrol edin.

Eski shell cache varsa yeni activation ile temizlendiğini gözlemleyin.
