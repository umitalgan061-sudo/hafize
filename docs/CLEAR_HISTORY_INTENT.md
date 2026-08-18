# Tüm sohbet geçmişini temizleme intent sözleşmesi

## Amaç

`Temizle` eylemi kullanıcının yerel Hafize sohbetlerinin tamamını kaldırır. Bu işlem tek sohbet silmeden daha geniş veri kaybı yüzeyidir; yanlış dokunma ile çalışmamalıdır.

Bu sözleşme mevcut `public/app.js` davranışını yeniden yazmadan, `conversation-delete-confirm.js` katmanında iki ayrı kullanıcı eylemi gerektirir.

## Kullanıcı akışı

1. İlk `Temizle` tıklaması uygulamanın clear-history handler'ına ulaşmaz.
2. Düğme en fazla 8 saniyeliğine `Temizle?` durumuna geçer.
3. Kullanıcı aynı düğmeye ikinci kez açıkça dokunursa yalnız mevcut uygulamanın exact `Tüm yerel sohbet geçmişi silinsin mi?` confirmation çağrısına tek kullanımlık izin verilir.
4. Uygulamanın mevcut streaming, boş-geçmiş, persistence ve render sınırları aynen çalışır.
5. Timeout, Escape, başka bir hedefe tıklama, focus değişimi veya sekmenin arka plana geçmesi pending intent'i iptal eder.

## Neden mevcut app handler korunuyor?

`app.js` halen authoritative destructive action sahibidir. Enhancement yalnız intent toplar; conversation state'i doğrudan değiştirmez, localStorage'a yazmaz ve render çağırmaz. Böylece:

- yanıt stream ederken geçmiş temizlenemez;
- app içindeki canonical save yolu atlanmaz;
- cross-tab conversation storage guard devrede kalır;
- enhancement yüklenmezse mevcut native confirmation fallback'i korunur.

## Tek kullanımlık confirm köprüsü

İkinci kullanıcı eyleminde uygulamanın mevcut click handler'ını senkron çalıştırmak için `confirm` yalnız o synchronous replay süresince sarılır.

Sınırlar:

- yalnız exact clear-history prompt'u otomatik `true` alabilir;
- izin yalnız bir kez tüketilebilir;
- başka prompt'lar doğrudan orijinal `confirm` fonksiyonuna gider;
- synthetic click tamamlanınca orijinal `confirm` `finally` içinde geri yüklenir;
- host `confirm` değiştirilemiyorsa replay yapılmaz ve silme fail-closed kalır.

Bu köprü genel confirmation bypass'ı değildir.

## Veri ve gizlilik sınırı

Intent katmanı:

- sohbet veya mesaj içeriğini okumaz;
- localStorage/sessionStorage/IndexedDB kullanmaz;
- cookie, Authorization, token veya credential okumaz;
- network isteği üretmez;
- HTML parse/render API'leri kullanmaz;
- shell/exec/spawn veya terminal yürütme içermez.

Pending durum yalnız JavaScript belleğinde ve en fazla 8 saniye tutulur.

## Ajan/tool sınırı

Bu değişiklik yalnız istemci destructive-UX korumasıdır. Dört profilli selector/specialist roster değişmez. Backend tool authorization default-deny kalır; GitHub/Gmail/Canva dış write/send/merge işlemleri için mevcut explicit approval sözleşmeleri etkilenmez.

## Test DoD

Aşağıdaki davranışlar regresyonlarla kilitlenir:

- ilk tıklamada sıfır destructive propagation;
- ikinci tıklamada tam bir approved replay;
- exact prompt dışındaki native confirmation davranışının korunması;
- streaming guard'ın authoritative kalması;
- timeout/Escape/visibility/outside-click iptali;
- immutable-host durumda fail-closed davranış;
- persistent storage/network/secret/shell yüzeylerinin eklenmemesi;
- PWA shell'in güncel script sürümünü dağıtması.

## Geri alma

Bu değişiklik geri alınırsa `conversation-delete-confirm.js` içindeki clear-history intent bölümü, ilgili testler ve bu sözleşme kaldırılır; tek sohbet için iki-aşamalı silme intent'i bağımsız biçimde korunabilir.