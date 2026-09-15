# Prompt Workspace — Acceptance Criteria

## Workspace

Kullanıcı workspace oluşturabilir, isim değiştirebilir, silebilir ve aktif alanı değiştirebilir.

Aktif alan değişirken mevcut state saklanmalı ve yeni alanın state'i uygulanmalıdır.

## Collections

Kullanıcı collection oluşturabilir, yeniden adlandırabilir, silebilir ve prompt atayabilir.

Collection silme prompt'un kendisini silmemelidir.

## Revisions

Prompt değiştiğinde revision capture yapılabilmelidir. History geçmiş sürümleri gösterebilmelidir. Restore sonrası güncel içerik kaybolmamalıdır.

## Packs

Kullanıcı tam veya seçili pack export edebilmelidir. Import öncesi review yapılabilmelidir. Duplicate ID mevcut içeriği overwrite etmemelidir.

## Workflows

Kullanıcı seçili prompt'ları workflow'a dönüştürebilmeli ve workflow'u composer'a hazırlayabilmelidir.

## Smart Insert

Prompt tek tıklamayla composer'a eklenmelidir. Append modu mevcut metni korumalıdır.

## Batch

En fazla 40 seçimle toplu tag/favorite düzenlemesi yapılmalıdır.

## Audit

Kullanıcı prompt storage tutarlılığını tek aksiyonla denetleyebilmelidir.

## Privacy

Hiçbir acceptance senaryosunda yeni server analytics veya remote prompt sync oluşmamalıdır.

## Safety

Hiçbir acceptance senaryosunda otomatik chat submit bulunmamalıdır.

## Resilience

Bozuk bir workspace veya revision kaydı temel Prompt Library'nin açılmasını engellememelidir.

## Mobile

Tüm araçlar 700px altı genişlikte yatay taşma oluşturmadan kullanılabilmelidir.
