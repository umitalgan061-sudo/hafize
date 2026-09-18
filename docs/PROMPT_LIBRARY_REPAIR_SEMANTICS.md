# Repair semantics

## Normalize
Repair yalnızca canonical Prompt Library normalizer çıktısını kalıcılaştırır.

## Duplicate
İkinci ve sonraki aynı ID kayıtları yeni rastgele ID ile korunur.

## Collections
Collection promptIds yalnızca hâlâ var olan prompt ID'leri taşır.

## Revisions
Revision promptId mevcut prompt setinde değilse orphan kabul edilir ve safe repair sonrası ilişki dışına alınır.

## Checkpoint
Safe repair öncesi recovery snapshot oluşturulur.

## Undo
Undo son checkpoint'i geri yükler ve checkpoint'i temizler.

## Quarantine
Invalid entries kullanıcıya permanent delete yerine geri alınabilir bir yerel alanla ayrılır.
