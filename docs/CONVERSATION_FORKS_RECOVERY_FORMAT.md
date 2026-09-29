# Konuşma Dalları Recovery Formatı

Dal yedeği JSON olarak üretilir:

- version: 1
- type: hafize-conversation-fork
- exportedAt: ISO tarih
- conversation: mevcut normalize edilmiş conversation kaydı

Export tek bir dalı kapsar. Parent, child ve mesaj metadata'sı snapshot içine aynı local biçimde alınır.

Yedek oluşturma network çağrısı yapmaz. Blob URL işlem tamamlandığında serbest bırakılır.

Snapshot formatı future import için genişletilebilir; mevcut turda otomatik import yapılmaz. Bu ayrım, yanlış bir dosyanın mevcut local conversation state'ini sessizce değiştirmesini engeller.
