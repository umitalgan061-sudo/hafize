# Revision History Quick Reference

| İşlem | Tetikleyici | Kullanıcı onayı | Ana prompt etkisi |
|---|---|---|---|
| Geçmiş aç | Geçmiş | Hayır | Yok |
| Snapshot | Düzenle öncesi | Hayır | Yok |
| Sürümü koru | Sürümü koru | Hayır | Yok |
| Karşılaştır | Karşılaştır | Hayır | Yok |
| Geri yükle | Geri yükle | Evet | İçerik değişir |
| Revision sil | Sil | Evet | Yok |
| History temizle | Geçmişi temizle | Evet | Yok |
| Export | Geçmişi dışa aktar | Hayır | Yok |

## Korunan alanlar

Restore; prompt id, favorite, useCount ve createdAt alanlarını korur.

## Değişen alanlar

Restore title, body, tags ve updatedAt alanlarını seçilen revision'dan/işlem anından günceller.

## Sınırlar

120 prompt, prompt başına 10 revision, 100 title, 8000 body, 8 tag, 24 tag karakteri.

## Storage

`hafize.prompt-library.revisions.v1`

## PWA

Revision scripti shell cache içindedir.

## Hata

Storage veya prompt hedef hatalarında status mesajı kullanılır.

## Gizlilik

Sunucu çağrısı ve telemetry yoktur.

## Destek

Sorunlarda browser, sürüm, adım ve status mesajı raporlanmalıdır.
