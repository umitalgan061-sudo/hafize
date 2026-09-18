# Recovery operations

## Önce
Şüpheli bir repair veya import öncesi Yedek indir kullanılabilir.

## Recovery snapshot
Prompts, collections ve revisions aynı JSON zarfında tutulur.

## Checkpoint
Repair öncesinde otomatik oluşturulur.

## Undo
Diagnostics içindeki Son onarımı geri al eylemi checkpoint'i tek adımda restore eder.

## Quarantine restore
Karantina kayıtları ana import merge kuralları ile yeniden eklenir; mevcut ID'ler overwrite edilmez.

## Sınırlar
Quarantine 80 kayıtla, recovery snapshot yaklaşık 1.5 MB ile sınırlandırılır.
