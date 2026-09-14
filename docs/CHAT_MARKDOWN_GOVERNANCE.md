# Chat Markdown Governance

Bu renderer sohbet ürününün sunum katmanıdır. Kod sahipliği, güvenlik sınırı ve test sözleşmesi birlikte değerlendirilir.

## Değişiklik kabulü

Parser syntax değişikliği tek başına kabul edilmez. Yeni syntax için normal kullanım, malformed input, hostile input ve resource bound senaryosu gerekir. DOM karşılığı güvenli olmalıdır.

## Link politikası

URL allowlist genişletilirse bunun yeni bir güvenlik yüzeyi olduğu PR açıklamasında belirtilmelidir. Protocol-relative veya scriptable URL desteği bu modülde kabul edilmez.

## DOM politikası

HTML string sink kullanılmaz. Elementler explicit DOM API ile oluşturulur. Attribute değerleri güvenli property veya attribute yöntemleriyle atanır.

## State politikası

Markdown parser kalıcı sohbet state'ini sahiplenmez. Conversation storage ve Message Workspace metadata ayrı kalır. Renderer'dan storage erişimi eklemek bu modülün kapsamını değiştirir.

## PWA politikası

Index'e Markdown asset'i eklenmişse shell cache listesi aynı deploy içinde güncellenir. API response cache kapsamına alınmaz.

## Performans politikası

Limitler ölçümsüz yükseltilmez. Özellikle inline parser ve streaming observer UI thread üzerinde çalıştığından bounded tasarım korunur.

## Erişilebilirlik politikası

Keyboard focus, reduced motion, forced colors ve mobile overflow yeni UI elementleriyle birlikte gözden geçirilir. Kopyalama button'ı gerçek button olmalıdır.

## Rollback politikası

Renderer bağımsız olduğundan feature rollback conversation verisini değiştirmemelidir. Rollback sonrası plain text fallback minimum işlevdir.

## Dokümantasyon

Kullanıcı rehberi, güvenlik belgesi, QA playbook, runbook ve test matrisi değişen sözleşmeyle birlikte güncel tutulur.
