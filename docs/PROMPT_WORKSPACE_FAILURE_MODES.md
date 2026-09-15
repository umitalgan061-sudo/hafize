# Prompt Workspace — Failure Modes

## Storage read failure

Belirli bir storage anahtarı parse edilemiyorsa yalnızca o modül fallback kullanır. Diğer Prompt Library alanlarının okunması engellenmez.

## Storage write failure

Quota veya browser policy nedeniyle write başarısızsa kullanıcıya status mesajı gösterilir. Eski geçerli veri körlemesine silinmez.

## Import parse failure

JSON parse hatasında import uygulanmaz. Mevcut kayıtlar değiştirilmez.

## Import schema failure

`packVersion` veya `source` beklenen değer değilse paket reddedilir. Kullanıcıya yalnızca kısa hata nedeni gösterilir.

## Capacity failure

Prompt limitine ulaşıldığında import veya duplicate yeni kayıt oluşturmaz. Kullanıcı mevcut kayıtlar üzerinde temizlik yapmalıdır.

## Duplicate identity

Aynı ID gelen pakette mevcut kayda dokunulmaz. Duplicate sayısı kullanıcıya raporlanır.

## Missing workflow step

Workflow içindeki prompt ID artık yoksa workflow compile edilmez. Kısmi metin üretimi yerine güvenli başarısızlık seçilir.

## Stale workspace reference

Workspace selectedIds içinde bulunmayan prompt ID varsa audit bunu uyarı olarak gösterir. Workspace aktifliği temel chat'i durdurmaz.

## Revision restore failure

Revision bulunamazsa restore yapılmaz. Prompt mevcut haliyle bırakılır.

## DOM failure

Card veya composer henüz mount olmamışsa yardımcı modül işlem yapmaz ve tekrar DOM mutation ile boot edilebilir.

## Clipboard failure

Clipboard API yoksa copy akışı başarısız mesajı verir; prompt body kaybolmaz.

## File API failure

FileReader hata verirse import uygulanmaz. Geçerli lokal data korunur.

## Timer failure

Dashboard veya usage refresh timer'ı desteklenmiyorsa ilk render yine yapılır; periyodik yenileme kritik bir gereksinim değildir.

## PWA stale cache

Yeni asset cache'te değilse bootstrap script'i network üzerinden yüklemeyi deneyebilir. API cache davranışı değişmez.
