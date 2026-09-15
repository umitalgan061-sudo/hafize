# Composer History — Mimari Kararlar

## ADR-01: localStorage

History cihaz-yereldir.

Backend history API açılmadı.

Bu seçim privacy ve offline davranışı birlikte korur.

## ADR-02: string-only model

Mesaj metadata'sı history kaydına eklenmez.

Bu, schema'yı küçük ve migration'ı kolay tutar.

## ADR-03: bounded collection

40 kayıt varsayılan üst sınırdır.

Daha büyük bir arşiv için Conversation Workspace kullanılmalıdır.

## ADR-04: submit-time capture

Taslaklar history'ye girmez.

Yalnız submit edilen değer kaydedilir.

Bu, Drafts ile History arasında net sınır oluşturur.

## ADR-05: cursor navigation

History navigation yalnız edge cursor davranışında devreye girer.

Textarea içinde serbest hareket korunur.

## ADR-06: IME safety

Composition sırasında keyboard interception kapalıdır.

Türkçe dahil IME kullanan girişler history shortcut'larından etkilenmez.

## ADR-07: no auto-submit

History'den seçim yalnız composer value'sunu değiştirir.

Kullanıcı son gönderimi kendisi başlatır.

Bu karar istem/mesaj riskini azaltır.

## ADR-08: retention setting

Kullanıcı 0/10/20/40 sınırlarından birini seçer.

0 explicit opt-out'tur.

## ADR-09: manual backup

Backup yalnız kullanıcı eylemiyle başlar.

Background export veya remote upload yoktur.

## ADR-10: progressive enhancement

History modülü bulunmazsa mevcut composer çalışmaya devam etmelidir.

Panel ve backup çekirdek history API'sine gevşek bağlıdır.
