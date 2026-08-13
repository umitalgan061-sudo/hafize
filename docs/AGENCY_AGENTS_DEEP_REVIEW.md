# Agency Agents derin inceleme — 2026-08-13

Kaynak: `msitarzewski/agency-agents`, incelenen `main` tree: `ebe9c99acb5c96f9468de368d8bead775387d1a7`.

Bu belge katalogu Hafize'ye topluca kopyalamak için değil; ürün ve runtime seviyesinde gerçekten işe yarayan sözleşmeleri seçmek için karar kaydıdır. Kaynak MIT lisanslıdır ve mevcut `THIRD_PARTY_NOTICES.md` atfı korunur.

## Repo hakkında güncel gözlem

Agency Agents artık yalnız ajan kişiliklerinden oluşan bir prompt klasörü değildir. Katalog 17 division içerir; ayrıca `strategy/` altında makinece okunabilir runbook roster'ları, playbook'lar ve koordinasyon doktrini bulunur. Kaynak projenin kendi kuralları da tüm katalog yerine division/agent bazlı seçimi ve dar uzmanlaşmayı teşvik eder.

Hafize için önemli sonuç: değer, ajan sayısını büyütmekte değil; her uzman için açık görev sınırı, ölçülebilir başarı, kalite kapısı ve güvenli handoff tanımlamaktadır.

## Bu turda alınan fikirler

### 1. Başarı ölçütü ve kalite kapısı

`agents-orchestrator`, `minimal-change-engineer` ve diğer güçlü ajanlar teslimatın ne zaman başarılı sayılacağını açıkça tarif ediyor. Hafize'de bu yaklaşım aktif izin politikasını değiştirmeden görev ve handoff sözleşmelerinde kullanılmalıdır.

### 2. Yapılandırılmış delegasyon handoff'ı

Kaynak Workflow Architect yaklaşımındaki her sınır için payload, başarı, failure, timeout ve recovery fikri çok değerlidir. Hafize `agent_delegate` çağrısı bu nedenle yalnız serbest metin `task` taşımak yerine isteğe bağlı olarak şunları da taşıyabilir:

- `successCriteria`
- `constraints`
- `evidenceRequired`

Handoff yeni izin vermez ve backend yetkisini değiştirmez. Ama alt ajanın ne üretmesi, hangi sınırları koruması ve hangi kanıtı sunması gerektiğini açıklaştırır.

### 3. Workflow Architect uzmanı — aday

`specialized/specialized-workflow-architect` Hafize için mevcut Code Reviewer ve Minimal Engineer'dan gerçekten farklı bir sorumluluğa sahiptir. Zamanlanmış görevler, connector akışları ve çok-adımlı ajan süreçlerinde durum geçişi, timeout, partial failure, concurrent conflict, handoff ve recovery sözleşmeleri için güçlü bir adaydır.

Bu turda aktif registry'ye eklenmedi; ajan izin/registry yazımı platform güvenlik kapısı tarafından engellendi. İleride eklenecekse salt-okunur ve default-deny kalmalıdır.

## Sonraki turlarda yüksek değerli adaylar

### Automation Governance

`automation-governance-architect` özellikle Hafize'nin 7×24 zamanlanmış görevleri için yararlıdır. Alınacak prensipler:

- otomasyon değerini zaman tasarrufu, veri kritiklik seviyesi, harici bağımlılık riski ve ölçeklenebilirlikle değerlendirme;
- idempotency/duplicate koruması;
- bounded retry ve timeout;
- audit trail;
- manual fallback;
- her connector için source-of-truth, auth lifecycle, rate limit ve escalation sahibi.

n8n varsayılanı Hafize'ye taşınmaz; prensipler platformdan bağımsız uygulanır.

### Identity & Access

Google, Gmail ve Canva bağlantıları ilerlediğinde `engineering-identity-access-engineer` şu kontroller için iyi referanstır: OAuth authorization-code + PKCE, exact redirect allowlist, state/nonce, kısa ömürlü token, refresh rotation, server-side authorization ve tenant/user isolation.

### Privacy Engineering

Kişisel hafıza, Gmail, ses ve ekran analizi için `engineering-privacy-engineer` yaklaşımı değerlidir: data map, amaç/retention/delete path, write/use noktasında consent enforcement, PII'nin log/trace'e sızmaması ve doğrulanabilir deletion.

### Email Intelligence

Gmail connector geldiğinde düzleştirilmiş thread'i tek metin gibi modele vermek yerine mesaj topolojisi, sender attribution, quote deduplication, attachment bağlamı ve kaynaklı yapılandırılmış çıktı kullanılmalıdır.

### RAG / kişisel bilgi erişimi

Hafize kişisel bellek ve belge aramasında retrieval kalitesi ölçülmelidir. Structural chunking, metadata scope, hybrid retrieval ve golden eval yaklaşımı alınabilir. Kaynaktaki sağlayıcıya özel embedding örnekleri ürün bağımlılığı olarak alınmaz; sağlayıcı seçimi Hafize mimarisine ait kalır.

### Desktop App güvenlik sınırı

Electron/Tauri ajanındaki en önemli ders Jarvis incelemesiyle aynı yöndedir: renderer güvenilmez kabul edilir; generic shell/filesystem köprüsü yerine dar, typed ve privileged-side validated IPC verb'leri kullanılır. Electron için context isolation / no node integration / sandbox varsayılanı korunmalıdır.

### Voice pipeline

Gelişmiş ses kullanımında format ve süre doğrulama, timestamp/speaker bilgisini koruma, düşük güven segmentlerini işaretleme, PII/retention ve ham audio/transcript'i loglamama ilkeleri alınabilir.

### API Platform

Connector ve ileride açılacak Hafize API'lerinde contract-first tasarım, tek hata şekli, request/trace id, idempotent writes, rate-limit semantiği ve backward compatibility yararlıdır.

## Şimdilik aktif ajan yapılmayanlar

`UI Finish-Gate Reviewer` iyi bir kalite rolüdür; ancak gerçek ekran/screenshot kanıtı olmadan eksik çalışır. Hafize görsel inceleme aracına sahip olduğunda desktop + mobile PASS/HOLD gate olarak tekrar değerlendirilecektir.

`Security Architect`, `Prompt Engineer`, `Codebase Onboarding Engineer` ve benzerleri değerli referanslardır; fakat mevcut Code Reviewer, Hafize güvenlik kuralları ve runtime görevleriyle önemli ölçüde örtüştükleri için yalnız katalogda var oldukları gerekçesiyle yeni aktif ajan eklenmez.

## Bilerek alınmayan desenler

- bütün katalogu runtime'a kurmak veya yüzlerce uzmanı aynı router'a açmak;
- kaynak `convert.sh` / `install.sh` araçlarını Hafize runtime bağımlılığı yapmak;
- generated tool-integration çıktılarını repoya taşımak;
- OpenAI, n8n veya başka bir vendor'a özel örnek kodu mimari zorunluluk saymak;
- prompt içinde gizli reasoning üretmesini veya kullanıcıya göstermesini istemek;
- prompt metnini gerçek authorization mekanizması yerine kullanmak;
- uzmanların birbirlerinden serbestçe yetki miras aldığı kontrolsüz mesh topolojisi.

## Hafize için kalıcı seçim ilkesi

Yeni Agency Agents profili yalnız şu üç koşul birlikte sağlanırsa registry'ye eklenir:

1. Mevcut ajanlardan gerçekten ayrı bir sorumluluğu vardır.
2. Ayrı tool policy, output contract veya ölçülebilir kalite kapısı gerektirir.
3. Hafize yol haritasında somut bir özellik veya operasyon tarafından kullanılacaktır.

Amaç "çok ajan" değil; az sayıda, sınırları net, test edilebilir ve izlenebilir uzman ajandır.
