# Import threat model

## Varlıklar
Prompt gövdeleri, başlıklar, etiketler, kullanım sayaçları ve collection/revision ilişkileri hassastır.

## Girişler
Tek giriş noktası kullanıcının seçtiği yerel JSON dosyasıdır.

## Kötü niyetli örnekler
Oversized file, malformed JSON, duplicate IDs, invalid types, malicious text and relation floods.

## Savunma
Boyut sınırı, bounded array slicing, normalizer, yeni ID üretimi ve kullanıcı onayı uygulanır.

## DOM
Dynamic content never becomes executable markup.

## Storage
Import planı read-only'dir. Apply güncel storage'ı tekrar okur.

## Recovery
Repair öncesi checkpoint oluşturulur. Invalid records quarantine alanında tutulabilir.

## Sınırlar
Otomatik orphan repair 240 ilişkiyi aşarsa durur.

## Güvenlik sonucu
Ağ erişimi eklenmeden yerel veri bütünlüğü korunur.
