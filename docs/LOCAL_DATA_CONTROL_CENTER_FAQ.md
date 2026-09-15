# Yerel Veri Merkezi — SSS

## Veriler sunucuya gider mi?

Bu panelin kendi işlemleri sunucuya veri göndermez. Sadece tarayıcının yerel storage alanlarını okur.

## Neden bazı Hafize verileri listede yok?

Yalnız allowlist'e alınmış storage anahtarları yönetilir. Yeni veya bilinmeyen key'ler bilinçli olarak otomatik temizlenmez.

## Manifest neden mesajlarımı içermiyor?

Manifest bir diagnostic metadata dosyasıdır. İçerik backup'ı olmaması, yanlışlıkla hassas mesajların teknik rapora girmesini önler.

## Tümünü temizlemek neyi siler?

Yalnız data center registry'sinde tanımlı storage key'leri silinir. Browser cookie'leri, başka origin verileri veya bilinmeyen key'ler silinmez.

## Bu işlem geri alınabilir mi?

Hayır. Clear işlemi için açık confirmation istenir. Silinen yerel veri ancak ilgili feature'ın ayrı bir backup'ından geri getirilebilir.

## Storage bozuksa ne olur?

Panel hata durumunu güvenli biçimde gösterir ve chat'i durdurmaz.

## Özel modda çalışır mı?

Tarayıcıya göre localStorage davranışı ve quota değişebilir. Feature fail-soft çalışacak şekilde tasarlanmıştır.

## Yeni bir feature key eklersek?

Önce key'in sensitivity, retention, clear ve migration politikası tanımlanmalı; sonra registry'ye alınmalıdır.
