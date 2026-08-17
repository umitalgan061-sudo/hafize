# Hands-free explicit consent review

## Amaç

Hafize'nin mevcut `hands-free.js` wake phrase akışı görünür, süreli ve kullanıcı kontrollüdür; ancak önceki UI'da `Eller serbest kapalı` düğmesine tek tıklama doğrudan sürekli SpeechRecognition oturumunu başlatabiliyordu. Bu sözleşme, sürekli dinleme başlamadan önce ayrı bir review + confirm kullanıcı eylemi zorunlu kılar.

## Davranış sözleşmesi

1. İlk `Eller serbest` tıklaması yalnız review panelini açar.
2. İlk tıklamada mevcut hands-free click handler'ı capture fazında durdurulur; `SpeechRecognition.start()` yoluna geçilmez.
3. Review paneli sabit ve kısa biçimde şunları açıklar: yalnız bu oturum, `Hafize` wake phrase, 30 dakikalık güvenlik süresi ve otomatik gönderim olmaması.
4. Dinlemeyi başlatmak için ayrı `Onayla ve dinlemeyi aç` tıklaması gerekir.
5. Onay 15 saniye içinde verilmezse pending consent silinir; dinleme başlamaz.
6. `Escape`, sekmenin görünmez olması, `Vazgeç` veya controller destroy pending consent'i iptal eder.
7. Onay kalıcı değildir. Hands-free kapatıldıktan sonraki her yeniden açma girişimi yeni review ister.
8. Mikrofon zaten aktifken `Eller serbest` düğmesine basmak tek tıklamayla kapatmaya devam eder. Güvenlik kapatma yoluna ikinci onay eklenmez.

## Veri ve izin sınırı

Consent katmanı transcript, sohbet mesajı, model, ajan, tool sonucu, connector sonucu veya kişisel bellek okumaz. Pending durum yalnız sayfa belleğinde boolean/timer olarak yaşar. `localStorage`, `sessionStorage`, IndexedDB, cookie, clipboard veya backend endpoint kullanılmaz.

Bu katman mikrofon API'sini doğrudan çağırmaz. Yalnız mevcut `hands-free.js` düğme sözleşmesinin önünde capture-phase kullanıcı onayı uygular. Böylece wake phrase algılama, voice-input handoff, voice-output yankı koruması, 30 dakikalık session limit ve background visibility guard mevcut runtime'da kalır.

## Tool / model güvenliği

Hands-free seçimi NVIDIA veya local provider'ın tool yetkisini değiştirmez. Backend default-deny agent tool policy aynıdır. Wake phrase yeni GitHub/Gmail/Canva write/send/merge izni üretmez ve agent registry değişmez.

## PWA

`hands-free-consent.js` ve `hands-free-consent.css` shell asset olarak cache edilir. Cache sürümü `v82`'dir. API cevapları shell cache'e alınmaz.

## Erişilebilirlik

Review `role=group` ve sabit bir `aria-label` kullanır. Pending durumda toggle `aria-describedby` ile review'a bağlanır. Review açıldığında confirm düğmesi odaklanır; Escape/Vazgeç/timeout sonrasında odak güvenliyse toggle'a döner. Mobil buton hedefleri en az 44 px, `focus-visible`, reduced-motion ve forced-colors davranışları tanımlıdır.

## Test kapsamı

- İlk toggle tıklamasında sıfır hands-free activation.
- İkinci explicit confirm'de tam bir existing-runtime handoff.
- Aktif mikrofonda tek tıklamayla kapatma.
- Consent'in sticky olmaması.
- 15 saniyelik timeout, Escape ve visibility fail-closed davranışı.
- Destroy sırasında timer/listener/panel cleanup.
- Storage/network/secret/shell/HTML yüzeyi bulunmaması.
- PWA v82 ve asset wiring.
- 44 px mobil hedef, focus-visible, reduced-motion ve forced-colors.

## Geri alma

Bu özellik kalıcı veri veya schema migration oluşturmaz. Geri almak için `hands-free-consent.js`, `hands-free-consent.css`, ilgili testler ve bu belge kaldırılır; `index.html` ile `sw-policy.js` önceki wiring/cache sürümüne döndürülür. Mevcut `voice-input.js` ve `hands-free.js` bağımsız olarak çalışmaya devam eder.
