# Organizer — SSS

## Organizer görevleri server'da mı saklıyor?

Hayır. Organizer yalnızca server'ın döndürdüğü schedule kayıtlarını gösterir.

Kaydedilen görünüm state'i task içeriği değildir.

## Arama görevleri siliyor mu?

Hayır. Arama yalnızca DOM görünürlüğünü değiştirir.

## Zaman filtresi görevin zamanını değiştiriyor mu?

Hayır. `today`, `next24`, `next7` ve `past` yalnızca görünümü filtreler.

## Toplu iptal neden onay istiyor?

DELETE state-changing bir işlemdir. Kullanıcı onayı olmadan başlatılmaz.

## 40'tan fazla görev seçebilir miyim?

Tek toplu işlem en fazla 40 kayıtla sınırlandırılır.

## Görünür export neyi içeriyor?

Seçili zaman/arama/ajan/status görünümünde kalan server snapshot kayıtlarını içerir.

## Export localStorage'a yazılıyor mu?

Hayır. Dosya browser download akışıyla oluşturulur.

## Clipboard kullanılamazsa ne olur?

Görev başka bir kanala gönderilmez; kullanıcıya kopyalama hatası bildirilir.

## Görünüm preset'i görevimi kopyalar mı?

Hayır. Preset query, agent, sort, status ve time değerlerinden oluşur.

## Kaç preset saklanır?

En fazla altı adet.

## Aynı isimle tekrar kaydedebilir miyim?

Evet. Aynı isim mevcut preset'i günceller.

## Detail panel server'a yazar mı?

Hayır. Ayrıntı mevcut DOM satırından oluşturulur.

## Duplicate ne yapar?

Mevcut schedule snapshot'ını GET ile okur ve kullanıcı onayından sonra gelecekteki yeni bir POST schedule oluşturur.

## Duplicate hangi zamanı kullanır?

Kaynak zamanından en az beş dakika sonrası ve o andan en az beş dakika sonrası olacak şekilde güvenli future timestamp oluşturur.

## Scheduled olmayan görevler neden seçilemiyor?

Running, completed, failed veya cancelled görevler kullanıcı tarafından organizer üzerinden iptal edilemez.

## Görevler offline çalışır mı?

Shell asset'leri offline cache'de bulunabilir. Gerçek schedule API verisi cache'lenmez.

## Güvenlik açısından organizer neye güvenir?

Ownership, authentication ve state transition kararlarında backend otoritedir.

## Kısayol nedir?

`Ctrl / ⌘ + Shift + T` görevler panelini açar; düzenlenebilir alanlarda çalışmaz.
