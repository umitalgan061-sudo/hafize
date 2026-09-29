# Konuşma Dalları Güvenlik İncelemesi

## Threat surface
Fork işlemi yalnız local conversation state'i çoğaltır. Server-side auth, agent authorization veya connector credential akışına erişmez.

## Input
Message content, title ve note bounded biçimde temizlenir. Role alanı yalnız user/assistant olarak kabul edilir.

## DOM
Kullanıcı metinleri textContent ile eklenir. innerHTML ve outerHTML kullanılmaz. Dialog preview kısa tutulur.

## Storage
localStorage okuma/yazma try/catch ile çevrilidir. Write başarısızsa child kayıt oluşturulmuş kabul edilmez.

## Concurrency
aria-busy true iken fork reddedilir. Onay anında kaynak conversation yeniden okunur; stale state nedeniyle yanlış child üretimi önlenir.

## Graph
Parent traversal seen Set ile cycle-safe'dir. Child count ve depth hard limitlidir.

## PWA
Fork assets shell cache içinde tutulur; /api/ istekleri fork modülünden çağrılmaz ve service worker API response cache'i oluşturmaz.

## Privacy
Fork metadata'sı aynı local conversation store'da bulunur. Ayrı analytics, telemetry veya remote sync mekanizması yoktur.

## Recovery
Dal yedeği version/type alanlarıyla işaretlenir. Export sırasında parent state mutate edilmez.

## Approval
Storage değişikliği yalnız açık Yeni dal oluştur onayından sonra gerçekleşir. Escape, backdrop ve Vazgeç işlemleri state'i değiştirmez.

## Review result
Bu turdaki fork yüzeyi bounded, local-first ve mevcut chat runtime güvenlik sınırlarıyla uyumlu tutulmuştur.
