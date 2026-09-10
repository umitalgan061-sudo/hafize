# Conversation Workspace güvenlik incelemesi

## Tehdit modeli

Workspace, kullanıcının tarayıcısında bulunan sohbet geçmişini işler. Girdi kaynağı ikiye ayrılır: mevcut `localStorage` verisi ve kullanıcı tarafından seçilen JSON yedeği. Her iki kaynak da güvenilmeyen veri gibi ele alınır.

Workspace'in güvenlik hedefleri şunlardır:

- Yerel conversation verisini dış servislere göndermemek.
- Import edilen metni HTML/JavaScript olarak çalıştırmamak.
- Bozuk veya aşırı büyük import'ın tarayıcıyı gereksiz yük altına sokmasını sınırlamak.
- Mevcut conversation id'sini sessizce üzerine yazmamak.
- Kalıcı silmeyi açık kullanıcı onayına bağlamak.
- OAuth, API key veya connector kimliğini workspace kapsamına sokmamak.
- PWA cache politikasında `/api/*` network-only sınırını korumak.

## Veri akışı sınırı

Workspace `fetch()` veya `XMLHttpRequest` kullanmaz. NVIDIA, GitHub, Google, Gmail ve Canva servislerine çağrı yapmaz. Bu yüzden workspace içinde bearer token, API key veya OAuth secret işleme ihtiyacı yoktur.

JSON import bir dosya picker ile seçilir. Dosya metni `File.text()` ile okunur; bu içerik yalnız JavaScript object olarak parse edilir. UI metni `textContent` ile eklenir.

Dışa aktarma Blob üzerinden gerçekleşir. Object URL kısa süre sonra revoke edilir.

## Input validation

Conversation normalization aşaması fail-open değildir. Şu alanlar açıkça kontrol edilir:

| Alan | Kontrol |
| --- | --- |
| id | string ve boş olmayan değer |
| title | string, trim ve 80 karakter |
| agentId | string veya boş |
| toolsEnabled | sadece `true` |
| archived | sadece `true` |
| pinned | sadece `true` |
| tags | array, temizlenmiş, unique, en fazla 8 |
| messages | array, en fazla 200 |
| message id | string veya kontrollü fallback |
| role | `assistant` veya güvenli `user` fallback |
| content | string ve en fazla 12000 |
| at | string veya güncel timestamp |
| toolActivities | array, en fazla 4 |
| activity label | string, en fazla 80 |
| activity state | allowlist |
| createdAt | parse edilebilir tarih veya fallback |
| updatedAt | parse edilebilir tarih veya fallback |

Import dosyasının byte sınırı JSON parse öncesinde uygulanır. Decoded text için de aynı 1 MB sınırı korunur.

## ID güvenliği

Mevcut conversation id'si import edilen kayıt tarafından kullanılmak istenirse workspace yeni bir `import-*` id'si üretir. Böylece import işlemi existing conversation üzerine yazamaz.

Clone işlemi de yeni `copy-*` id'si üretir. Aynı storage anahtarı içinde duplicate conversation id oluşması engellenir.

## HTML injection

Title, tag, message content ve tool activity label alanları kullanıcı tarafından kontrol edilebilir. Bunların hiçbiri `innerHTML`, `outerHTML` veya `insertAdjacentHTML` ile DOM'a yazılmaz.

Search yalnız text normalization yapar. Query'nin regex veya selector olarak çalıştırılması yoktur.

## Destructive işlemler

Bulk delete öncesi kullanıcıdan `confirm()` ile onay alınır. Onay verilmezse `writeConversations()` çağrılmaz.

Archive, unarchive, pin ve tag işlemleri geri alınabilir metadata mutation'larıdır. Clone yeni kayıt yaratır ve history limitini aşmaz.

## Storage failure

Read failure boş list veya default state'e düşer. Write failure kullanıcıya toast döndürür. Başarısız write sonrası uygulama yeni state'i olmuş gibi kabul etmemelidir.

Workspace state'in kaydedilememesi sohbet verisinin kaybedildiği anlamına gelmez çünkü iki anahtar ayrıdır.

## Çoklu sekme

Native `storage` event başka sekmedeki değişikliği bildirir. Aynı sekmede native event oluşmadığı için workspace kendi CustomEvent'ini üretir.

Event payload conversation içeriği taşımaz; yalnız kısa `reason` bilgisi bulunur. Bu, gereksiz büyük event kopyalarını önler.

## PWA izolasyonu

Workspace JS/CSS shell cache'e girer; API route'ları girmez. Service worker `classifyRequest()` API yollarını `network-only` olarak bırakır.

Workspace offline durumda local history yönetimini sürdürebilir fakat model çağrısı veya connector çağrısı başlatmaz.

## Kısayol güvenliği

Global shortcut listener text editing hedeflerinde devre dışıdır. Kullanıcı textarea içinde yazarken workspace kısayolları metni bozmaz.

Composition sırasında (`event.isComposing`) shortcut çalışmaz. Alt kombinasyonları bilerek ignore edilir.

## Denial-of-service sınırları

History 30 kayıtla sınırlandığı için render maliyeti bounded'dır. Import 1 MB ile sınırlandırılır. Conversation/message/tag/tool activity koleksiyonları ayrıca kendi sınırlarına sahiptir.

Bu sınırlar tarayıcı tarafındaki bir yardımcı katmandır; server endpoint'lerinin kendi auth, rate limit ve payload sınırlarının yerine geçmez.

## Review kararları

1. Yeni backend endpoint açılmamalı.
2. Workspace secret okumamalı.
3. Import DOM'a HTML yazmamalı.
4. Destructive işlemler confirm olmadan çalışmamalı.
5. Existing id üzerine sessiz overwrite yapılmamalı.
6. PWA shell listesine API path eklenmemeli.
7. Shortcut listener composer yazımını bozmamalı.
8. Storage event ve MutationObserver cleanup davranışları korunmalı.
9. Yeni bir paralel conversation persistence sistemi eklenmemeli.
10. Workspace yalnız history lifecycle alanında kalmalı.

## Test hedefleri

Security package'leri kaynak contract'larını ve forbidden API desenlerini kontrol eder. Data compatibility paketi import edge case'lerini matrix olarak listeler. Keyboard paketi event ownership ve editing-target davranışını sabitler.

Tam repo check'i ayrıca production regression'larını yakalamalıdır. Workspace özel testleri tek başına tüm backend güvenliğini temsil etmez.
