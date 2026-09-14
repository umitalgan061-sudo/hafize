# Chat Markdown Sign-off

## Kapsam

Bu turda asistan yanıtlarının sunumu için bounded Markdown parser, responsive CSS, code-copy etkileşimi ve MutationObserver entegrasyonu eklendi. Parser yalnız presentation layer'dır.

## Fonksiyonel karar

Başlık, paragraf, liste, task list, quote, rule, code, table ve seçilmiş inline biçimleri desteklenir. Tanınmayan syntax düz metin kalır.

## Güvenlik kararı

Raw HTML yoktur. Link protokolleri allowlist'tedir. Dış linklerde güvenli relation bulunur. Renderer network, storage ve credential erişimine sahip değildir.

## Performans kararı

Input ve alt yapı sınırları uygulanır. Uzun inline satırları düz text'e düşürülür. Observer microtask batching ve source guard kullanır.

## Uyumluluk kararı

Mevcut conversation storage, Message Workspace ve Conversation Workspace değişmez. Export/retry/edit ham mesaj içeriğiyle devam eder. Rollback migration gerektirmez.

## PWA kararı

Markdown JS/CSS shell cache'e alınır ve revision artırılır. API cache kapsamı genişletilmez.

## UX kararı

Mobile overflow kontrol edilir. Reduced-motion ve forced-colors desteklenir. Code copy keyboard-accessible button olarak sunulur.

## Test kararı

Parser normal, malformed, hostile, bounded ve structured corpus ile sınanır. Source-contract testleri HTML sink, network erişimi ve ownership sınırlarını kontrol eder. PWA testleri asset inclusion ve network-only API politikasını kontrol eder.

## Bilinen sınır

Tam yerel `npm run check` bu ortamda GitHub checkout/DNS nedeniyle çalıştırılamadı; bu durum release notunda saklanmamalıdır. Hosted CI yeşil değilse merge başarısı iddia edilmemelidir.

## Sonuç

Özellik mevcut sohbet state sahipliğini bozmadan Claude-benzeri daha okunabilir bir asistan çıktısı sağlar. Gelecekte raw HTML, image embed veya syntax highlighting eklenmesi ayrı güvenlik/performance kararı gerektirir.
