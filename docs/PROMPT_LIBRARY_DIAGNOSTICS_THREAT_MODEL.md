# Diagnostics threat model

## Hedef
Yerel veri sağlığını gösterirken repair işlemlerinin yanlış veri kaybı üretmesini önlemek.

## Riskler
Corrupt storage, duplicate IDs, invalid references, hostile text and repeated repair actions.

## Okuma
Tarama normalize edilmiş kopyalar kullanır; raw storage yalnızca gerekli destructive/quarantine adımında okunur.

## Repair
Duplicate IDs re-key edilir; mevcut kayıt overwrite edilmez.

## Relations
Collections ve revisions mevcut prompt kimlikleriyle sınırlandırılır.

## Undo
Son repair için local checkpoint tutulur.

## Destructive
Geçersiz kayıtlar önce quarantine'a alınır.

## Network
Remote transport bulunmaz.
