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
9. Review ve confirm yalnız görünür document üzerinde çalışır. Sekme hidden durumuna geçerse pending onay geçersizleşir ve confirm boundary bunu yeniden kontrol eder.
10. Tarayıcı `isSecureContext === false` bildirirse yeni hands-free onayı oluşturulmaz; mevcut açık mikrofonu kapatma yolu yine engellenmez.

## Tehdit modeli

Bu katman özellikle yanlışlıkla sürekli dinleme başlatma, eski/pending bir onayı daha sonra kullanma ve UI görünmezken consent yarışına girme risklerini azaltır. Capture-phase guard sayesinde ilk tıklama mevcut hands-free bubble handler'ına ulaşmaz. Confirm sırasında visibility, secure-context, disabled-state ve active-state yeniden doğrulanır; yani yalnız review açılmış olması yeterli değildir.

Consent token veya imzalı capability üretmez; bu davranış cihaz içi UI niyet sınırıdır. Bu nedenle onay başka sekmeye, reload'a, yeni pencereye veya gelecekteki oturuma taşınamaz. Review DOM'u ve timer destroy sırasında kaldırılır. Bu katman tarayıcının mikrofon izin diyaloğunun yerine geçmez; işletim sistemi/tarayıcı mikrofon izni ayrıca geçerlidir.

Güvenli kapatma önceliklidir: hands-free zaten aktifse toggle click'i review tarafından bloke edilmez. Kullanıcı mikrofonu tek tıklamayla kapatabilmelidir. Bu ilke, consent UX'in güvenlik çıkış yolunu yanlışlıkla zorlaştırmasını önler.

## Ses tanıma gizlilik sınırı

Hafize bu katmanda ham mikrofon sesini kendi backend'ine yükleyen yeni bir endpoint açmaz. Web Speech API'nin ses tanıma uygulaması ise kullanılan tarayıcıya ve işletim sistemine bağlıdır; bazı sağlayıcılar sesi kendi hizmetlerinde işleyebilir. Bu nedenle review metni “yalnız cihazda işlenir” gibi doğrulanamayacak bir garanti vermez.

Hands-free katmanı yalnız wake phrase algılama ve mevcut voice-input handoff'unu yönetir. Transcript ancak mevcut `voice-input.js` yolu tarafından composer taslağına aktarılır ve otomatik gönderilmez. Kullanıcı mesajı göndermedikçe bu consent katmanı sohbet, agent veya connector isteği üretmez.

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
- Hidden/secure-context yarışının confirm boundary'de yeniden reddedilmesi.
- Destroy sırasında timer/listener/panel cleanup.
- Storage/network/secret/shell/HTML yüzeyi bulunmaması.
- PWA v82 ve asset wiring.
- 44 px mobil hedef, focus-visible, reduced-motion ve forced-colors.

## Geri alma

Bu özellik kalıcı veri veya schema migration oluşturmaz. Geri almak için `hands-free-consent.js`, `hands-free-consent.css`, ilgili testler ve bu belge kaldırılır; `index.html` ile `sw-policy.js` önceki wiring/cache sürümüne döndürülür. Mevcut `voice-input.js` ve `hands-free.js` bağımsız olarak çalışmaya devam eder.
