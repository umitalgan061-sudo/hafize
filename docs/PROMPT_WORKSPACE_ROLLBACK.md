# Prompt Workspace — Rollback Plan

## Amaç

Rollback, Prompt Workspace UI ve yardımcı modüllerini devreden çıkarırken temel Prompt Library kayıtlarını korumayı hedefler.

## Öncelik

1. Kullanıcı verisi kaybı veya dışarı veri sızıntısı şüphesi varsa yeni Pack import/Smart Insert/Workflow akışını kullanma.
2. UI katmanı kaldırılabilir; temel prompt storage ayrı kalır.
3. Revision ve collection storage ayrı anahtarlar olarak kalabilir.
4. Sorun giderildikten sonra aynı version migration ile geri alınabilir.

## Rollback tetikleyicileri

- Prompt içeriğinin remote endpoint'e yanlışlıkla gönderilmesi.
- Import sırasında mevcut prompt'un overwrite edilmesi.
- Restore sırasında önceki revizyonun kaybolması.
- Workflow çıktısının istemeden gönderilmesi.
- Browser crash sonrası veri bozulması.

## Güvenli geri alma

Önce Prompt Pack export ile mevcut sağlam istemler alınır. Ardından yeni workspace asset'leri yüklenmeyebilir. Temel Prompt Library shell'i çalışmaya devam edebilir.

## Storage temizliği

Rollback tek başına storage temizliği yapmamalıdır. Kullanıcının açık talebi olmadan prompt, revision veya workspace kayıtları silinmez.

## PWA

Yeni asset cache'den kaldırılabilir ve eski cache version kullanılabilir. API network-only davranışı korunmalıdır.

## Sonraki doğrulama

Rollback sonrası create/edit/delete, search, favorite, usage ve normal composer gönderimi ayrı ayrı smoke edilmelidir.

## İletişim

Kullanıcıya hangi özelliklerin geçici olarak kapatıldığı ve temel prompt kayıtlarının korunup korunmadığı açıkça söylenmelidir. Hassas prompt içeriği destek mesajlarında tekrar edilmemelidir.
