# Gizlilik Merkezi Veri Modeli

## Surface

Her yüzey şu alanlarla temsil edilir:

- `id`: UI ve eylem kimliği.
- `keys`: exact localStorage anahtarları.
- `prefix`: prefix tabanlı alanlar için başlangıç.
- `label`: kullanıcıya görünen başlık.
- `description`: kısa kapsam açıklaması.
- `group`: `data` veya `preference`.

## Inventory Snapshot

Storage taraması şu toplamları üretir:

- bilinen byte,
- bilinmeyen anahtar sayısı,
- bilinmeyen byte,
- toplam anahtar sayısı,
- yüzey bazında anahtar ve byte sayısı.

Snapshot hiçbir key value saklamaz.

## Report

Rapor; biçim, sürüm, oluşturulma zamanı, localOnly/contentIncluded bayrakları, yüzey özetleri ve tarayıcı storage estimate değerlerinden oluşur.

## Clear Result

Temizleme sonucu `removed`, `ok` ve gerektiğinde `failures` alanlarını taşır. UI bu sonucu yalnız kullanıcıya durum mesajı olarak gösterir.

## Compatibility

Mevcut workspace-backup yüzeyleriyle aynı localStorage adları kullanılır. Yeni bir persistent data migration gerekmez.

## Extensibility

Yeni bir local yüzey eklendiğinde SURFACES allowlist'ine explicit entry, README açıklaması ve en az inventory/clear/security testi eklenmelidir.
